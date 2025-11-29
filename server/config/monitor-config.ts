/**
 * OpenZeppelin Monitor-style Configuration
 * 
 * Event monitoring configuration for Shield Finance smart contracts.
 * Based on: https://github.com/OpenZeppelin/openzeppelin-monitor
 * 
 * Features:
 * - Configurable event severity levels (info, warning, critical)
 * - Custom notification templates for Slack/Discord
 * - Multi-contract support
 * - Risk categorization
 */

import type { AlertSeverity } from "../services/AlertingService";

export interface EventMonitorConfig {
  name: string;
  severity: AlertSeverity;
  description: string;
  notificationTemplate?: string;
  riskCategory?: "access_control" | "security" | "operations" | "financial" | "configuration";
}

export interface ContractMonitorConfig {
  name: string;
  address: string;
  abi: string[];
  events: EventMonitorConfig[];
  enabled: boolean;
}

export interface MonitorConfiguration {
  network: {
    name: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
  };
  contracts: ContractMonitorConfig[];
  notifications: {
    enabled: boolean;
    slackWebhookUrl?: string;
    discordWebhookUrl?: string;
    minIntervalMinutes: number;
  };
  polling: {
    intervalMs: number;
    maxBlocksPerQuery: number;
  };
}

const SHXRP_VAULT_EVENTS_ABI = [
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
  "event Paused(address account)",
  "event Unpaused(address account)",
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

export function getMonitorConfiguration(deployment: {
  shXRPVault: string;
  shieldToken: string;
  revenueRouter: string;
  stakingBoost: string;
}): MonitorConfiguration {
  return {
    network: {
      name: "coston2",
      chainId: 114,
      rpcUrl: process.env.FLARE_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      explorerUrl: "https://coston2-explorer.flare.network",
    },

    contracts: [
      {
        name: "ShXRPVault",
        address: deployment.shXRPVault,
        abi: SHXRP_VAULT_EVENTS_ABI,
        enabled: true,
        events: [
          {
            name: "OwnershipTransferred",
            severity: "critical",
            description: "Vault ownership has been transferred to a new owner",
            notificationTemplate: "🚨 CRITICAL: ShXRPVault ownership transferred from {previousOwner} to {newOwner}",
            riskCategory: "access_control",
          },
          {
            name: "Paused",
            severity: "critical",
            description: "Vault has been paused - all deposits and withdrawals halted",
            notificationTemplate: "🚨 CRITICAL: ShXRPVault PAUSED by {account} - Emergency stop activated",
            riskCategory: "security",
          },
          {
            name: "Unpaused",
            severity: "warning",
            description: "Vault has been unpaused - operations resumed",
            notificationTemplate: "⚠️ ShXRPVault UNPAUSED by {account} - Normal operations resumed",
            riskCategory: "security",
          },
          {
            name: "OperatorAdded",
            severity: "warning",
            description: "New operator added to vault with special permissions",
            notificationTemplate: "⚠️ New operator {operator} added to ShXRPVault",
            riskCategory: "access_control",
          },
          {
            name: "OperatorRemoved",
            severity: "warning",
            description: "Operator removed from vault",
            notificationTemplate: "⚠️ Operator {operator} removed from ShXRPVault",
            riskCategory: "access_control",
          },
          {
            name: "StrategyAdded",
            severity: "warning",
            description: "New yield strategy added to vault",
            notificationTemplate: "⚠️ New strategy {strategy} added with {targetBps} bps allocation",
            riskCategory: "configuration",
          },
          {
            name: "StrategyRemoved",
            severity: "warning",
            description: "Yield strategy removed from vault",
            notificationTemplate: "⚠️ Strategy {strategy} removed from ShXRPVault",
            riskCategory: "configuration",
          },
          {
            name: "StrategyStatusUpdated",
            severity: "warning",
            description: "Strategy operational status changed",
            notificationTemplate: "⚠️ Strategy {strategy} status changed to {newStatus}",
            riskCategory: "operations",
          },
          {
            name: "DepositLimitUpdated",
            severity: "info",
            description: "Maximum deposit limit updated",
            notificationTemplate: "ℹ️ Deposit limit updated to {newDepositLimit}",
            riskCategory: "configuration",
          },
          {
            name: "DeployedToStrategy",
            severity: "info",
            description: "Funds deployed to yield strategy",
            notificationTemplate: "ℹ️ {amount} FXRP deployed to strategy {strategy}",
            riskCategory: "operations",
          },
          {
            name: "WithdrawnFromStrategy",
            severity: "info",
            description: "Funds withdrawn from yield strategy",
            notificationTemplate: "ℹ️ {actualAmount} FXRP withdrawn from strategy {strategy}",
            riskCategory: "operations",
          },
          {
            name: "StrategyReported",
            severity: "info",
            description: "Strategy reported performance metrics",
            notificationTemplate: "ℹ️ Strategy {strategy}: profit={profit}, loss={loss}",
            riskCategory: "financial",
          },
          {
            name: "Deposit",
            severity: "info",
            description: "User deposited assets into vault",
            riskCategory: "financial",
          },
          {
            name: "Withdraw",
            severity: "info",
            description: "User withdrew assets from vault",
            riskCategory: "financial",
          },
        ],
      },

      {
        name: "ShieldToken",
        address: deployment.shieldToken,
        abi: SHIELD_TOKEN_ABI,
        enabled: true,
        events: [
          {
            name: "OwnershipTransferred",
            severity: "critical",
            description: "SHIELD token ownership transferred",
            notificationTemplate: "🚨 CRITICAL: SHIELD token ownership transferred from {previousOwner} to {newOwner}",
            riskCategory: "access_control",
          },
          {
            name: "Transfer",
            severity: "info",
            description: "SHIELD token transfer (only significant transfers logged)",
            riskCategory: "financial",
          },
        ],
      },

      {
        name: "RevenueRouter",
        address: deployment.revenueRouter,
        abi: REVENUE_ROUTER_ABI,
        enabled: true,
        events: [
          {
            name: "OwnershipTransferred",
            severity: "critical",
            description: "RevenueRouter ownership transferred",
            notificationTemplate: "🚨 CRITICAL: RevenueRouter ownership transferred from {previousOwner} to {newOwner}",
            riskCategory: "access_control",
          },
          {
            name: "RevenueDistributed",
            severity: "info",
            description: "Protocol revenue distributed to stakeholders",
            notificationTemplate: "💰 Revenue distributed: {shieldBurned} SHIELD burned, {fxrpToStakers} FXRP to stakers",
            riskCategory: "financial",
          },
          {
            name: "ReservesWithdrawn",
            severity: "warning",
            description: "Reserves withdrawn from router",
            notificationTemplate: "⚠️ {amount} reserves withdrawn to {to}",
            riskCategory: "financial",
          },
        ],
      },

      {
        name: "StakingBoost",
        address: deployment.stakingBoost,
        abi: STAKING_BOOST_ABI,
        enabled: true,
        events: [
          {
            name: "OwnershipTransferred",
            severity: "critical",
            description: "StakingBoost ownership transferred",
            notificationTemplate: "🚨 CRITICAL: StakingBoost ownership transferred from {previousOwner} to {newOwner}",
            riskCategory: "access_control",
          },
          {
            name: "Staked",
            severity: "info",
            description: "User staked SHIELD tokens for APY boost",
            riskCategory: "financial",
          },
          {
            name: "Unstaked",
            severity: "info",
            description: "User unstaked SHIELD tokens",
            riskCategory: "financial",
          },
        ],
      },
    ],

    notifications: {
      enabled: process.env.ONCHAIN_MONITOR_ENABLED === "true",
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
      minIntervalMinutes: 15,
    },

    polling: {
      intervalMs: 15000,
      maxBlocksPerQuery: 1000,
    },
  };
}

export const RISK_CATEGORY_COLORS: Record<string, string> = {
  access_control: "#FF0000",
  security: "#FF4500",
  operations: "#FFA500",
  financial: "#FFD700",
  configuration: "#32CD32",
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "#FF0000",
  warning: "#FFA500",
  info: "#0099FF",
};

export const COSTON2_DEPLOYMENT = {
  shXRPVault: "0x3219232a45880b79736Ee899Cb3b2f95D527C631",
  shieldToken: "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616",
  revenueRouter: "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB",
  stakingBoost: "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4",
};
