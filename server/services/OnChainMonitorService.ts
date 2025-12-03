import { ethers } from "ethers";
import type { AlertingService, AlertSeverity } from "./AlertingService";
import type { IStorage } from "../storage";
import { db } from "../db";
import { onChainEvents } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

/**
 * OnChainMonitorService - OpenZeppelin Monitor-style blockchain event watcher
 * 
 * Inspired by https://github.com/OpenZeppelin/openzeppelin-monitor
 * 
 * Features:
 * - Real-time event listening for Shield Finance contracts
 * - Configurable severity levels and notification templates
 * - Slack/Discord alerts via AlertingService integration
 * - Persistent event storage for analytics
 * - Multi-contract support (ShXRPVault, ShieldToken, RevenueRouter, StakingBoost)
 */

export interface OnChainMonitorConfig {
  storage: IStorage;
  alertingService?: AlertingService;
  rpcUrl: string;
  contracts: ContractConfig[];
  enabled?: boolean;
  pollingInterval?: number;
}

export interface ContractConfig {
  name: string;
  address: string;
  abi: string[];
  events: EventConfig[];
}

export interface EventConfig {
  name: string;
  severity: AlertSeverity;
  description: string;
  notificationTemplate?: string;
}

export interface MonitoredEvent {
  id?: number;
  contractName: string;
  contractAddress: string;
  eventName: string;
  severity: AlertSeverity;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, any>;
  timestamp: Date;
  notified: boolean;
}

const SHXRP_VAULT_ABI = [
  "event OperatorAdded(address indexed operator)",
  "event OperatorRemoved(address indexed operator)",
  "event MinDepositUpdated(uint256 newMinDeposit)",
  "event BufferTargetUpdated(uint256 newTargetBps)",
  "event DepositLimitUpdated(uint256 newDepositLimit)",
  "event FeeTransferred(string indexed feeType, uint256 amount, address indexed recipient)",
  "event StrategyAdded(address indexed strategy, uint256 targetBps)",
  "event StrategyRemoved(address indexed strategy)",
  "event StrategyStatusUpdated(address indexed strategy, uint8 newStatus)",
  "event StrategyAllocationUpdated(address indexed strategy, uint256 newTargetBps)",
  "event DeployedToStrategy(address indexed strategy, uint256 amount)",
  "event WithdrawnFromStrategy(address indexed strategy, uint256 amount, uint256 actualAmount)",
  "event StrategyReported(address indexed strategy, uint256 profit, uint256 loss, uint256 totalAssets)",
  "event DonatedOnBehalf(address indexed user, uint256 fxrpAmount, uint256 sharesMinted)",
  "event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event Paused(address account)",
  "event Unpaused(address account)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

const SHIELD_TOKEN_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

const REVENUE_ROUTER_ABI = [
  "event RevenueDistributed(uint256 wflrTotal, uint256 shieldBurned, uint256 fxrpToStakers, uint256 reserves)",
  "event ReservesWithdrawn(address indexed to, uint256 amount)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

const STAKING_BOOST_ABI = [
  "event Staked(address indexed user, uint256 amount, uint256 unlockTime)",
  "event Unstaked(address indexed user, uint256 amount)",
  "event BoostUpdated(address indexed user, uint256 newBoost)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
];

const DEFAULT_EVENT_CONFIG: Record<string, EventConfig> = {
  "OwnershipTransferred": {
    name: "OwnershipTransferred",
    severity: "critical",
    description: "Contract ownership has been transferred",
    notificationTemplate: "CRITICAL: Ownership of {contractName} transferred from {previousOwner} to {newOwner}",
  },
  "Paused": {
    name: "Paused",
    severity: "critical",
    description: "Contract has been paused (emergency stop)",
    notificationTemplate: "CRITICAL: {contractName} has been PAUSED by {account}",
  },
  "Unpaused": {
    name: "Unpaused",
    severity: "warning",
    description: "Contract has been unpaused",
    notificationTemplate: "WARNING: {contractName} has been UNPAUSED by {account}",
  },
  "OperatorAdded": {
    name: "OperatorAdded",
    severity: "warning",
    description: "New operator added to vault",
    notificationTemplate: "WARNING: New operator {operator} added to {contractName}",
  },
  "OperatorRemoved": {
    name: "OperatorRemoved",
    severity: "warning",
    description: "Operator removed from vault",
    notificationTemplate: "WARNING: Operator {operator} removed from {contractName}",
  },
  "StrategyAdded": {
    name: "StrategyAdded",
    severity: "warning",
    description: "New strategy added to vault",
    notificationTemplate: "New strategy {strategy} added with {targetBps} bps allocation",
  },
  "StrategyRemoved": {
    name: "StrategyRemoved",
    severity: "warning",
    description: "Strategy removed from vault",
    notificationTemplate: "Strategy {strategy} removed from {contractName}",
  },
  "StrategyStatusUpdated": {
    name: "StrategyStatusUpdated",
    severity: "warning",
    description: "Strategy status changed",
    notificationTemplate: "Strategy {strategy} status updated to {newStatus}",
  },
  "DepositLimitUpdated": {
    name: "DepositLimitUpdated",
    severity: "info",
    description: "Vault deposit limit changed",
    notificationTemplate: "Deposit limit updated to {newDepositLimit}",
  },
  "RevenueDistributed": {
    name: "RevenueDistributed",
    severity: "info",
    description: "Revenue distributed to stakeholders",
    notificationTemplate: "Revenue distributed: {shieldBurned} SHIELD burned, {fxrpToStakers} to stakers",
  },
  "Deposit": {
    name: "Deposit",
    severity: "info",
    description: "User deposited to vault",
    notificationTemplate: "Deposit: {assets} FXRP from {sender}",
  },
  "Withdraw": {
    name: "Withdraw",
    severity: "info",
    description: "User withdrew from vault",
    notificationTemplate: "Withdrawal: {assets} FXRP to {receiver}",
  },
  "DeployedToStrategy": {
    name: "DeployedToStrategy",
    severity: "info",
    description: "Funds deployed to strategy",
    notificationTemplate: "{amount} FXRP deployed to strategy {strategy}",
  },
  "WithdrawnFromStrategy": {
    name: "WithdrawnFromStrategy",
    severity: "info",
    description: "Funds withdrawn from strategy",
    notificationTemplate: "{actualAmount} FXRP withdrawn from strategy {strategy}",
  },
  "StrategyReported": {
    name: "StrategyReported",
    severity: "info",
    description: "Strategy reported performance",
    notificationTemplate: "Strategy {strategy} reported: profit={profit}, loss={loss}, totalAssets={totalAssets}",
  },
  "Staked": {
    name: "Staked",
    severity: "info",
    description: "User staked SHIELD tokens",
    notificationTemplate: "{user} staked {amount} SHIELD",
  },
  "Unstaked": {
    name: "Unstaked",
    severity: "info",
    description: "User unstaked SHIELD tokens",
    notificationTemplate: "{user} unstaked {amount} SHIELD",
  },
  "Transfer": {
    name: "Transfer",
    severity: "info",
    description: "Token transfer",
    notificationTemplate: undefined,
  },
  "Approval": {
    name: "Approval",
    severity: "info",
    description: "Token approval",
    notificationTemplate: undefined,
  },
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const LARGE_TRANSFER_THRESHOLD = BigInt("100000000000000000000000");

export class OnChainMonitorService {
  private config: OnChainMonitorConfig;
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract> = new Map();
  private eventConfigs: Map<string, EventConfig> = new Map();
  private isRunning = false;
  private lastProcessedBlock: number = 0;
  private pollingTimer: NodeJS.Timeout | null = null;

  constructor(config: OnChainMonitorConfig) {
    this.config = {
      enabled: true,
      pollingInterval: 15000,
      ...config,
    };

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    for (const contract of config.contracts) {
      const ethersContract = new ethers.Contract(
        contract.address,
        contract.abi,
        this.provider
      );
      this.contracts.set(contract.name, ethersContract);

      for (const event of contract.events) {
        this.eventConfigs.set(`${contract.name}:${event.name}`, event);
      }
    }

    console.log(`✅ OnChainMonitorService initialized`);
    console.log(`   Contracts: ${config.contracts.map(c => c.name).join(", ")}`);
    console.log(`   Events: ${Array.from(this.eventConfigs.keys()).length} configured`);
    console.log(`   Polling interval: ${this.config.pollingInterval}ms`);
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log("ℹ️  OnChainMonitorService disabled via configuration");
      return;
    }

    if (this.isRunning) {
      console.log("⚠️  OnChainMonitorService already running");
      return;
    }

    this.isRunning = true;

    try {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      console.log(`🔍 OnChainMonitor starting from block ${this.lastProcessedBlock}`);

      this.setupEventListeners();

      this.pollingTimer = setInterval(() => {
        this.pollForEvents().catch(err => {
          console.error("OnChainMonitor polling error:", err);
        });
      }, this.config.pollingInterval);

      console.log("🚀 OnChainMonitorService started successfully");
    } catch (error) {
      console.error("❌ Failed to start OnChainMonitorService:", error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.contracts.forEach((contract) => {
      contract.removeAllListeners();
    });

    console.log("🛑 OnChainMonitorService stopped");
  }

  private setupEventListeners(): void {
    for (const contractConfig of this.config.contracts) {
      const contract = this.contracts.get(contractConfig.name);
      if (!contract) continue;

      for (const eventConfig of contractConfig.events) {
        try {
          contract.on(eventConfig.name, async (...args) => {
            const event = args[args.length - 1] as ethers.EventLog;
            await this.handleEvent(contractConfig.name, contractConfig.address, eventConfig, event);
          });
        } catch (error) {
          console.warn(`Could not set up listener for ${contractConfig.name}.${eventConfig.name}:`, error);
        }
      }
    }
  }

  private async pollForEvents(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = currentBlock;

      for (const contractConfig of this.config.contracts) {
        const contract = this.contracts.get(contractConfig.name);
        if (!contract) continue;

        for (const eventConfig of contractConfig.events) {
          try {
            const filter = contract.filters[eventConfig.name]?.();
            if (!filter) continue;

            const events = await contract.queryFilter(filter, fromBlock, toBlock);
            
            for (const event of events) {
              if (event instanceof ethers.EventLog) {
                await this.handleEvent(
                  contractConfig.name,
                  contractConfig.address,
                  eventConfig,
                  event
                );
              }
            }
          } catch (error) {
          }
        }
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      console.error("Error polling for events:", error);
    }
  }

  private async handleEvent(
    contractName: string,
    contractAddress: string,
    eventConfig: EventConfig,
    event: ethers.EventLog
  ): Promise<void> {
    try {
      const args = this.parseEventArgs(event);

      if (eventConfig.name === "Transfer" && !this.isSignificantTransfer(args)) {
        return;
      }

      // Handle case where blockNumber might be undefined for real-time listener events
      // Real-time events from contract.on() may not have blockNumber populated yet
      let blockNumber = event.blockNumber;
      if (blockNumber === undefined || blockNumber === null) {
        // Try to get block number from the event log, or fetch current block as fallback
        try {
          const currentBlock = await this.provider.getBlockNumber();
          blockNumber = currentBlock;
        } catch {
          blockNumber = 0; // Last resort fallback
        }
      }

      const monitoredEvent: MonitoredEvent = {
        contractName,
        contractAddress,
        eventName: eventConfig.name,
        severity: eventConfig.severity,
        blockNumber,
        transactionHash: event.transactionHash || "",
        logIndex: event.index ?? 0,
        args,
        timestamp: new Date(),
        notified: false,
      };

      const savedEvent = await this.saveEvent(monitoredEvent);

      // Persist staking events to staking_positions table
      if (contractName === "StakingBoost") {
        await this.persistStakingEvent(eventConfig.name, args);
      }

      if (eventConfig.notificationTemplate && this.config.alertingService) {
        await this.sendNotification(contractName, eventConfig, args, savedEvent.id);
      }

      console.log(`📡 ${contractName}.${eventConfig.name} detected [${eventConfig.severity}]`);
    } catch (error) {
      console.error(`Error handling event ${contractName}.${eventConfig.name}:`, error);
    }
  }

  private async persistStakingEvent(eventName: string, args: Record<string, any>): Promise<void> {
    try {
      if (eventName === "Staked") {
        const user = args.user;
        const amount = args.amount;
        const unlockTime = args.unlockTime?.toString() || "0";
        const stakedAt = Date.now().toString();
        
        if (user && amount) {
          await this.config.storage.recordStake(user, amount, stakedAt, unlockTime);
          console.log(`📊 Staking position recorded: ${user} staked ${amount}`);
        }
      } else if (eventName === "Unstaked") {
        const user = args.user;
        const amount = args.amount;
        
        if (user && amount) {
          try {
            await this.config.storage.recordUnstake(user, amount);
            console.log(`📊 Unstake recorded: ${user} unstaked ${amount}`);
          } catch (error) {
            // May fail if no position exists (e.g., event from before we started tracking)
            console.warn(`Could not record unstake for ${user}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error persisting staking event ${eventName}:`, error);
    }
  }

  private parseEventArgs(event: ethers.EventLog): Record<string, any> {
    const args: Record<string, any> = {};
    
    if (event.args) {
      const fragment = event.fragment;
      if (fragment && fragment.inputs) {
        fragment.inputs.forEach((input, index) => {
          const value = event.args[index];
          if (typeof value === 'bigint') {
            args[input.name] = value.toString();
          } else {
            args[input.name] = value;
          }
        });
      }
    }

    return args;
  }

  private isSignificantTransfer(args: Record<string, any>): boolean {
    if (args.from === ZERO_ADDRESS || args.to === ZERO_ADDRESS) {
      return true;
    }

    try {
      const value = BigInt(args.value || "0");
      return value >= LARGE_TRANSFER_THRESHOLD;
    } catch {
      return false;
    }
  }

  private async saveEvent(event: MonitoredEvent): Promise<MonitoredEvent & { id: number }> {
    try {
      const [saved] = await db.insert(onChainEvents).values({
        contractName: event.contractName,
        contractAddress: event.contractAddress,
        eventName: event.eventName,
        severity: event.severity,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.logIndex,
        args: event.args,
        timestamp: event.timestamp,
        notified: event.notified,
      }).returning();

      return { ...event, id: saved.id };
    } catch (error) {
      console.error("Error saving event to database:", error);
      return { ...event, id: -1 };
    }
  }

  private async sendNotification(
    contractName: string,
    eventConfig: EventConfig,
    args: Record<string, any>,
    eventId?: number
  ): Promise<void> {
    if (!this.config.alertingService || !eventConfig.notificationTemplate) {
      return;
    }

    let message = eventConfig.notificationTemplate;
    message = message.replace("{contractName}", contractName);
    
    for (const [key, value] of Object.entries(args)) {
      message = message.replace(`{${key}}`, String(value));
    }

    try {
      await (this.config.alertingService as any).sendCustomAlert({
        type: "on_chain_event",
        severity: eventConfig.severity,
        message,
        metadata: {
          contractName,
          eventName: eventConfig.name,
          eventId,
          args,
        },
      });

      if (eventId && eventId > 0) {
        await db.update(onChainEvents)
          .set({ notified: true })
          .where(sql`${onChainEvents.id} = ${eventId}`);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  async getRecentEvents(limit: number = 50): Promise<MonitoredEvent[]> {
    try {
      const events = await db.select()
        .from(onChainEvents)
        .orderBy(desc(onChainEvents.timestamp))
        .limit(limit);

      return events.map(e => ({
        id: e.id,
        contractName: e.contractName,
        contractAddress: e.contractAddress,
        eventName: e.eventName,
        severity: e.severity as AlertSeverity,
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        logIndex: e.logIndex,
        args: e.args as Record<string, any>,
        timestamp: e.timestamp,
        notified: e.notified,
      }));
    } catch (error) {
      console.error("Error fetching recent events:", error);
      return [];
    }
  }

  async getEventsBySeverity(severity: AlertSeverity, limit: number = 50): Promise<MonitoredEvent[]> {
    try {
      const events = await db.select()
        .from(onChainEvents)
        .where(sql`${onChainEvents.severity} = ${severity}`)
        .orderBy(desc(onChainEvents.timestamp))
        .limit(limit);

      return events.map(e => ({
        id: e.id,
        contractName: e.contractName,
        contractAddress: e.contractAddress,
        eventName: e.eventName,
        severity: e.severity as AlertSeverity,
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        logIndex: e.logIndex,
        args: e.args as Record<string, any>,
        timestamp: e.timestamp,
        notified: e.notified,
      }));
    } catch (error) {
      console.error("Error fetching events by severity:", error);
      return [];
    }
  }

  async getEventsByContract(contractName: string, limit: number = 50): Promise<MonitoredEvent[]> {
    try {
      const events = await db.select()
        .from(onChainEvents)
        .where(sql`${onChainEvents.contractName} = ${contractName}`)
        .orderBy(desc(onChainEvents.timestamp))
        .limit(limit);

      return events.map(e => ({
        id: e.id,
        contractName: e.contractName,
        contractAddress: e.contractAddress,
        eventName: e.eventName,
        severity: e.severity as AlertSeverity,
        blockNumber: e.blockNumber,
        transactionHash: e.transactionHash,
        logIndex: e.logIndex,
        args: e.args as Record<string, any>,
        timestamp: e.timestamp,
        notified: e.notified,
      }));
    } catch (error) {
      console.error("Error fetching events by contract:", error);
      return [];
    }
  }

  getStatus(): {
    isRunning: boolean;
    lastProcessedBlock: number;
    contractsMonitored: string[];
    eventsConfigured: number;
  } {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      contractsMonitored: Array.from(this.contracts.keys()),
      eventsConfigured: this.eventConfigs.size,
    };
  }

  static getDefaultContractConfigs(deploymentInfo: {
    shXRPVault: string;
    shieldToken: string;
    revenueRouter: string;
    stakingBoost: string;
  }): ContractConfig[] {
    return [
      {
        name: "ShXRPVault",
        address: deploymentInfo.shXRPVault,
        abi: SHXRP_VAULT_ABI,
        events: [
          DEFAULT_EVENT_CONFIG["OwnershipTransferred"],
          DEFAULT_EVENT_CONFIG["Paused"],
          DEFAULT_EVENT_CONFIG["Unpaused"],
          DEFAULT_EVENT_CONFIG["OperatorAdded"],
          DEFAULT_EVENT_CONFIG["OperatorRemoved"],
          DEFAULT_EVENT_CONFIG["StrategyAdded"],
          DEFAULT_EVENT_CONFIG["StrategyRemoved"],
          DEFAULT_EVENT_CONFIG["StrategyStatusUpdated"],
          DEFAULT_EVENT_CONFIG["DepositLimitUpdated"],
          DEFAULT_EVENT_CONFIG["Deposit"],
          DEFAULT_EVENT_CONFIG["Withdraw"],
          DEFAULT_EVENT_CONFIG["DeployedToStrategy"],
          DEFAULT_EVENT_CONFIG["WithdrawnFromStrategy"],
          DEFAULT_EVENT_CONFIG["StrategyReported"],
        ],
      },
      {
        name: "ShieldToken",
        address: deploymentInfo.shieldToken,
        abi: SHIELD_TOKEN_ABI,
        events: [
          DEFAULT_EVENT_CONFIG["OwnershipTransferred"],
          { ...DEFAULT_EVENT_CONFIG["Transfer"], notificationTemplate: undefined },
        ],
      },
      {
        name: "RevenueRouter",
        address: deploymentInfo.revenueRouter,
        abi: REVENUE_ROUTER_ABI,
        events: [
          DEFAULT_EVENT_CONFIG["OwnershipTransferred"],
          DEFAULT_EVENT_CONFIG["RevenueDistributed"],
        ],
      },
      {
        name: "StakingBoost",
        address: deploymentInfo.stakingBoost,
        abi: STAKING_BOOST_ABI,
        events: [
          DEFAULT_EVENT_CONFIG["OwnershipTransferred"],
          DEFAULT_EVENT_CONFIG["Staked"],
          DEFAULT_EVENT_CONFIG["Unstaked"],
        ],
      },
    ];
  }
}
