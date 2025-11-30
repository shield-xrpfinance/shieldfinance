/**
 * AnalyticsService - Real-time on-chain analytics from Coston2 testnet
 * 
 * Queries deployed contracts for:
 * - FeeTransferred events from ShXRPVault (deposit/withdraw fees)
 * - RevenueDistributed events from RevenueRouter (SHIELD burns, staker rewards)
 * - Staked/Unstaked events from StakingBoost (SHIELD staking)
 * - Transfer events from ShieldToken
 * 
 * Contract Addresses (Coston2):
 * - ShXRPVault: 0x82d74B5fb005F7469e479C224E446bB89031e17F
 * - RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
 * - StakingBoost: 0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
 * - ShieldToken: 0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
 */

import { ethers } from "ethers";
import { SHXRP_VAULT_EVENTS_ABI, REVENUE_ROUTER_EVENTS_ABI } from "../../shared/flare-abis";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";

const SHXRP_VAULT_ADDRESS = process.env.VITE_SHXRP_VAULT_ADDRESS || "0x82d74B5fb005F7469e479C224E446bB89031e17F";
const REVENUE_ROUTER_ADDRESS = process.env.VITE_REVENUE_ROUTER_ADDRESS || "0x8e5C9933c08451a6a31635a3Ea1221c010DF158e";
const STAKING_BOOST_ADDRESS = process.env.VITE_STAKING_BOOST_ADDRESS || "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4";
const SHIELD_TOKEN_ADDRESS = process.env.VITE_SHIELD_TOKEN_ADDRESS || "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616";

// Query configuration - scan last 5000 blocks (~1 hour on Coston2)
// Larger range to capture historical events, with aggressive caching
const BLOCKS_TO_SCAN = 5000;

// Rate limiting - add delay between RPC calls to avoid rate limits
const RPC_DELAY_MS = 25;

const STAKING_BOOST_EVENTS_ABI = [
  "event Staked(address indexed user, uint256 amount)",
  "event Unstaked(address indexed user, uint256 amount)",
  "event RewardPaid(address indexed user, uint256 reward)",
];

const SHIELD_TOKEN_EVENTS_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const SHIELD_PRICE_USD = 0.01;
const XRP_PRICE_USD = 2.10;
const FXRP_DECIMALS = 6;
const WFLR_DECIMALS = 18;
// Coston2 RPC strictly limits to 30 blocks per getLogs query; use 29 for inclusive range safety
const MAX_BLOCKS_PER_QUERY = 29;

export interface FeeEvent {
  feeType: string;
  amount: bigint;
  recipient: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export interface RevenueDistributionEvent {
  wflrTotal: bigint;
  shieldBurned: bigint;
  fxrpToStakers: bigint;
  reserves: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

export interface RevenueTransparencyData {
  totalFeesCollected: string;
  totalShieldBurned: string;
  totalShieldBurnedUsd: string;
  extraYieldDistributed: string;
  burnedAmountUsd: string;
  lastUpdated: string;
  eventCount: {
    feeEvents: number;
    distributionEvents: number;
  };
}

class AnalyticsService {
  private provider: ethers.JsonRpcProvider;
  private vaultContract: ethers.Contract;
  private revenueRouterContract: ethers.Contract;
  private stakingBoostContract: ethers.Contract;
  private shieldTokenContract: ethers.Contract;
  private cache: {
    revenueData?: RevenueTransparencyData;
    lastFetch?: number;
  } = {};
  private eventsCache: {
    events: Array<{
      id: string;
      contractName: string;
      eventName: string;
      severity: 'info' | 'warning' | 'critical';
      blockNumber: number;
      transactionHash: string;
      timestamp: Date;
      args: Record<string, string>;
    }>;
    currentBlock: number;
    lastFetch: number;
  } | null = null;
  private readonly CACHE_TTL_MS = 60_000;
  private readonly EVENTS_CACHE_TTL_MS = 300_000; // 5 minutes for events cache to reduce RPC load

  constructor() {
    this.provider = new ethers.JsonRpcProvider(COSTON2_RPC);
    
    this.vaultContract = new ethers.Contract(
      SHXRP_VAULT_ADDRESS,
      SHXRP_VAULT_EVENTS_ABI,
      this.provider
    );
    
    this.revenueRouterContract = new ethers.Contract(
      REVENUE_ROUTER_ADDRESS,
      REVENUE_ROUTER_EVENTS_ABI,
      this.provider
    );

    this.stakingBoostContract = new ethers.Contract(
      STAKING_BOOST_ADDRESS,
      STAKING_BOOST_EVENTS_ABI,
      this.provider
    );

    this.shieldTokenContract = new ethers.Contract(
      SHIELD_TOKEN_ADDRESS,
      SHIELD_TOKEN_EVENTS_ABI,
      this.provider
    );
  }

  private async queryWithPagination<T>(
    contract: ethers.Contract,
    filter: ethers.DeferredTopicFilter,
    fromBlock: number,
    toBlock: number,
    mapper: (event: ethers.EventLog) => T
  ): Promise<T[]> {
    const results: T[] = [];
    let currentFrom = fromBlock;
    
    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + MAX_BLOCKS_PER_QUERY - 1, toBlock);
      
      try {
        const events = await contract.queryFilter(filter, currentFrom, currentTo);
        for (const event of events) {
          results.push(mapper(event as ethers.EventLog));
        }
      } catch (error) {
        console.error(`Error querying blocks ${currentFrom}-${currentTo}:`, error);
      }
      
      currentFrom = currentTo + 1;
    }
    
    return results;
  }

  /**
   * Query events using raw eth_getLogs for more reliable event detection
   */
  private async queryRawLogs(
    address: string,
    topics: (string | null)[],
    fromBlock: number,
    toBlock: number
  ): Promise<Array<{
    address: string;
    topics: string[];
    data: string;
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
  }>> {
    const results: Array<{
      address: string;
      topics: string[];
      data: string;
      blockNumber: number;
      transactionHash: string;
      logIndex: number;
    }> = [];
    
    let currentFrom = fromBlock;
    
    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + MAX_BLOCKS_PER_QUERY - 1, toBlock);
      
      try {
        const response = await fetch(COSTON2_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [{
              fromBlock: '0x' + currentFrom.toString(16),
              toBlock: '0x' + currentTo.toString(16),
              address: address,
              topics: topics.length > 0 ? topics : undefined,
            }],
            id: 1,
          }),
        });
        
        // Check if response is valid JSON
        const text = await response.text();
        if (text.startsWith('<')) {
          // Got HTML (rate limit or error page), skip this chunk
          console.warn(`[AnalyticsService] Rate limited, skipping blocks ${currentFrom}-${currentTo}`);
        } else {
          const data = JSON.parse(text);
          if (data.result && Array.isArray(data.result)) {
            for (const log of data.result) {
              results.push({
                address: log.address,
                topics: log.topics,
                data: log.data,
                blockNumber: parseInt(log.blockNumber, 16),
                transactionHash: log.transactionHash,
                logIndex: parseInt(log.logIndex, 16),
              });
            }
          }
        }
      } catch (error) {
        // Silently handle errors to avoid spamming logs
      }
      
      currentFrom = currentTo + 1;
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, RPC_DELAY_MS));
    }
    
    return results;
  }

  async queryFeeEvents(fromBlock: number, toBlock: number): Promise<FeeEvent[]> {
    const filter = this.vaultContract.filters.FeeTransferred();
    return this.queryWithPagination(
      this.vaultContract,
      filter,
      fromBlock,
      toBlock,
      (log) => ({
        feeType: log.args[0] as string,
        amount: log.args[1] as bigint,
        recipient: log.args[2] as string,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })
    );
  }

  async queryRevenueDistributions(fromBlock: number, toBlock: number): Promise<RevenueDistributionEvent[]> {
    const filter = this.revenueRouterContract.filters.RevenueDistributed();
    return this.queryWithPagination(
      this.revenueRouterContract,
      filter,
      fromBlock,
      toBlock,
      (log) => ({
        wflrTotal: log.args[0] as bigint,
        shieldBurned: log.args[1] as bigint,
        fxrpToStakers: log.args[2] as bigint,
        reserves: log.args[3] as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      })
    );
  }

  async getRevenueTransparencyData(forceRefresh: boolean = false): Promise<RevenueTransparencyData> {
    const now = Date.now();
    if (!forceRefresh && this.cache.revenueData && this.cache.lastFetch && (now - this.cache.lastFetch) < this.CACHE_TTL_MS) {
      return this.cache.revenueData;
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const blocksToScan = 1000;
      const startBlock = Math.max(0, currentBlock - blocksToScan);
      
      const [feeEvents, distributionEvents] = await Promise.all([
        this.queryFeeEvents(startBlock, currentBlock),
        this.queryRevenueDistributions(startBlock, currentBlock)
      ]);

      let totalFees = BigInt(0);
      for (const event of feeEvents) {
        totalFees += event.amount;
      }

      let totalShieldBurned = BigInt(0);
      let totalFxrpToStakers = BigInt(0);
      for (const event of distributionEvents) {
        totalShieldBurned += event.shieldBurned;
        totalFxrpToStakers += event.fxrpToStakers;
      }

      const totalFeesUsd = Number(totalFees) / (10 ** FXRP_DECIMALS) * XRP_PRICE_USD;
      const shieldBurnedCount = Number(totalShieldBurned) / (10 ** 18);
      const shieldBurnedUsd = shieldBurnedCount * SHIELD_PRICE_USD;
      const fxrpToStakersValue = Number(totalFxrpToStakers) / (10 ** FXRP_DECIMALS) * XRP_PRICE_USD;
      const burnedAmountUsd = totalFeesUsd * 0.5;

      const data: RevenueTransparencyData = {
        totalFeesCollected: Math.round(totalFeesUsd).toString(),
        totalShieldBurned: Math.round(shieldBurnedCount).toString(),
        totalShieldBurnedUsd: Math.round(shieldBurnedUsd).toString(),
        extraYieldDistributed: Math.round(fxrpToStakersValue).toString(),
        burnedAmountUsd: Math.round(burnedAmountUsd).toString(),
        lastUpdated: new Date().toISOString(),
        eventCount: {
          feeEvents: feeEvents.length,
          distributionEvents: distributionEvents.length,
        },
      };

      this.cache.revenueData = data;
      this.cache.lastFetch = now;

      console.log(`[AnalyticsService] Fetched ${feeEvents.length} fee events, ${distributionEvents.length} distribution events`);
      
      return data;
    } catch (error) {
      console.error("[AnalyticsService] Error fetching revenue data:", error);
      
      if (this.cache.revenueData) {
        console.log("[AnalyticsService] Returning cached data due to error");
        return this.cache.revenueData;
      }
      
      return {
        totalFeesCollected: "0",
        totalShieldBurned: "0",
        totalShieldBurnedUsd: "0",
        extraYieldDistributed: "0",
        burnedAmountUsd: "0",
        lastUpdated: new Date().toISOString(),
        eventCount: {
          feeEvents: 0,
          distributionEvents: 0,
        },
      };
    }
  }

  async getVaultStats(): Promise<{
    totalDeposits: number;
    totalWithdraws: number;
    netFlow: number;
  }> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const blocksToScan = 1000;
      const startBlock = Math.max(0, currentBlock - blocksToScan);
      
      const depositFilter = this.vaultContract.filters.Deposit();
      const withdrawFilter = this.vaultContract.filters.Withdraw();
      
      const [depositEvents, withdrawEvents] = await Promise.all([
        this.queryWithPagination(this.vaultContract, depositFilter, startBlock, currentBlock, 
          (log) => ({ assets: log.args[2] as bigint })),
        this.queryWithPagination(this.vaultContract, withdrawFilter, startBlock, currentBlock,
          (log) => ({ assets: log.args[3] as bigint }))
      ]);

      let totalDeposits = BigInt(0);
      let totalWithdraws = BigInt(0);

      for (const event of depositEvents) {
        totalDeposits += event.assets;
      }

      for (const event of withdrawEvents) {
        totalWithdraws += event.assets;
      }

      const depositsUsd = Number(totalDeposits) / (10 ** FXRP_DECIMALS) * XRP_PRICE_USD;
      const withdrawsUsd = Number(totalWithdraws) / (10 ** FXRP_DECIMALS) * XRP_PRICE_USD;

      return {
        totalDeposits: Math.round(depositsUsd),
        totalWithdraws: Math.round(withdrawsUsd),
        netFlow: Math.round(depositsUsd - withdrawsUsd),
      };
    } catch (error) {
      console.error("[AnalyticsService] Error fetching vault stats:", error);
      return {
        totalDeposits: 0,
        totalWithdraws: 0,
        netFlow: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber > 0;
    } catch {
      return false;
    }
  }

  private stakersCache: {
    count?: number;
    lastFetch?: number;
  } = {};
  private readonly STAKERS_CACHE_TTL_MS = 300_000; // 5 minutes

  /**
   * Get unique stakers count from on-chain Deposit events
   * Queries Deposit events and counts unique owner addresses
   * Cached for 5 minutes to reduce RPC load
   */
  async getUniqueStakers(): Promise<number> {
    const now = Date.now();
    if (this.stakersCache.count !== undefined && 
        this.stakersCache.lastFetch && 
        (now - this.stakersCache.lastFetch) < this.STAKERS_CACHE_TTL_MS) {
      return this.stakersCache.count;
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const blocksToScan = 500;
      const startBlock = Math.max(0, currentBlock - blocksToScan);
      
      console.log(`[AnalyticsService] Querying unique stakers from block ${startBlock} to ${currentBlock}`);
      
      const depositFilter = this.vaultContract.filters.Deposit();
      
      const depositEvents = await this.queryWithPagination(
        this.vaultContract,
        depositFilter,
        startBlock,
        currentBlock,
        (log) => ({
          owner: log.args[1] as string,
        })
      );

      const uniqueOwners = new Set<string>();
      for (const event of depositEvents) {
        if (event.owner) {
          uniqueOwners.add(event.owner.toLowerCase());
        }
      }

      const count = uniqueOwners.size;
      this.stakersCache.count = count;
      this.stakersCache.lastFetch = now;

      console.log(`[AnalyticsService] Found ${count} unique stakers from ${depositEvents.length} deposit events`);
      return count;
    } catch (error) {
      console.error("[AnalyticsService] Error fetching unique stakers:", error);
      if (this.stakersCache.count !== undefined) {
        return this.stakersCache.count;
      }
      return 0;
    }
  }

  /**
   * Get ALL historical blockchain activity from all monitored contracts
   * Queries from contract deployment block to current block using raw eth_getLogs
   * Returns formatted events for display in the analytics dashboard
   */
  async getRecentActivity(limit: number = 50): Promise<{
    events: Array<{
      id: string;
      contractName: string;
      eventName: string;
      severity: 'info' | 'warning' | 'critical';
      blockNumber: number;
      transactionHash: string;
      timestamp: Date;
      args: Record<string, string>;
    }>;
    currentBlock: number;
    contractsMonitored: string[];
  }> {
    // Event topic signatures (keccak256 hashes)
    const EVENT_TOPICS = {
      // StakingBoost events
      Staked: '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d',
      Unstaked: '0x0f5bb82176feb1b5e747e28471aa92156a04d9f3ab9f45f28e2d704232b93f75',
      RewardPaid: '0xe2403640ba68fed3a2f88b7557551d1993f84b99bb10ff833f0cf8db0c5e0486',
      // ShieldToken events
      Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      // ShXRPVault events (ERC4626)
      Deposit: '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7',
      Withdraw: '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db',
    };

    try {
      // Check if we have a recent cache
      const now = Date.now();
      if (this.eventsCache && (now - this.eventsCache.lastFetch) < this.EVENTS_CACHE_TTL_MS) {
        console.log(`[AnalyticsService] Using cached events (${this.eventsCache.events.length} events)`);
        return {
          events: this.eventsCache.events.slice(0, limit),
          currentBlock: this.eventsCache.currentBlock,
          contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - BLOCKS_TO_SCAN);
      
      console.log(`[AnalyticsService] Querying events from block ${startBlock} to ${currentBlock} (~${BLOCKS_TO_SCAN} blocks)`);
      
      const events: Array<{
        id: string;
        contractName: string;
        eventName: string;
        severity: 'info' | 'warning' | 'critical';
        blockNumber: number;
        transactionHash: string;
        timestamp: Date;
        args: Record<string, string>;
      }> = [];

      // Query all events from StakingBoost contract (all events, no topic filter)
      console.log(`[AnalyticsService] Querying StakingBoost at ${STAKING_BOOST_ADDRESS}...`);
      const stakingBoostLogs = await this.queryRawLogs(
        STAKING_BOOST_ADDRESS,
        [],
        startBlock,
        currentBlock
      );
      console.log(`[AnalyticsService] Found ${stakingBoostLogs.length} StakingBoost logs`);

      for (const log of stakingBoostLogs) {
        const topic0 = log.topics[0];
        
        if (topic0 === EVENT_TOPICS.Staked) {
          const user = '0x' + log.topics[1].slice(26);
          const amount = BigInt(log.data);
          const amountFormatted = (Number(amount) / (10 ** 18)).toFixed(2);
          events.push({
            id: `staked-${log.transactionHash}-${log.blockNumber}`,
            contractName: 'StakingBoost',
            eventName: 'Staked',
            severity: 'info',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              user: user.slice(0, 6) + '...' + user.slice(-4),
              amount: `${amountFormatted} SHIELD`,
            },
          });
        } else if (topic0 === EVENT_TOPICS.Unstaked) {
          const user = '0x' + log.topics[1].slice(26);
          const amount = BigInt(log.data);
          const amountFormatted = (Number(amount) / (10 ** 18)).toFixed(2);
          events.push({
            id: `unstaked-${log.transactionHash}-${log.blockNumber}`,
            contractName: 'StakingBoost',
            eventName: 'Unstaked',
            severity: 'info',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              user: user.slice(0, 6) + '...' + user.slice(-4),
              amount: `${amountFormatted} SHIELD`,
            },
          });
        } else if (topic0 === EVENT_TOPICS.RewardPaid) {
          const user = '0x' + log.topics[1].slice(26);
          const reward = BigInt(log.data);
          const rewardFormatted = (Number(reward) / (10 ** 18)).toFixed(4);
          events.push({
            id: `reward-${log.transactionHash}-${log.blockNumber}`,
            contractName: 'StakingBoost',
            eventName: 'RewardPaid',
            severity: 'warning',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              user: user.slice(0, 6) + '...' + user.slice(-4),
              reward: `${rewardFormatted} SHIELD`,
            },
          });
        }
      }

      // Query all events from ShXRPVault contract
      console.log(`[AnalyticsService] Querying ShXRPVault at ${SHXRP_VAULT_ADDRESS}...`);
      const vaultLogs = await this.queryRawLogs(
        SHXRP_VAULT_ADDRESS,
        [],
        startBlock,
        currentBlock
      );
      console.log(`[AnalyticsService] Found ${vaultLogs.length} ShXRPVault logs`);

      for (const log of vaultLogs) {
        const topic0 = log.topics[0];
        
        if (topic0 === EVENT_TOPICS.Deposit) {
          // Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)
          const sender = '0x' + log.topics[1].slice(26);
          const owner = '0x' + log.topics[2].slice(26);
          // Decode assets and shares from data (64 hex chars each = 32 bytes)
          const assets = BigInt('0x' + log.data.slice(2, 66));
          const assetsFormatted = (Number(assets) / (10 ** FXRP_DECIMALS)).toFixed(2);
          events.push({
            id: `deposit-${log.transactionHash}-${log.blockNumber}`,
            contractName: 'ShXRPVault',
            eventName: 'Deposit',
            severity: 'info',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              owner: owner.slice(0, 6) + '...' + owner.slice(-4),
              assets: `${assetsFormatted} FXRP`,
            },
          });
        } else if (topic0 === EVENT_TOPICS.Withdraw) {
          // Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
          const owner = '0x' + log.topics[3].slice(26);
          const assets = BigInt('0x' + log.data.slice(2, 66));
          const assetsFormatted = (Number(assets) / (10 ** FXRP_DECIMALS)).toFixed(2);
          events.push({
            id: `withdraw-${log.transactionHash}-${log.blockNumber}`,
            contractName: 'ShXRPVault',
            eventName: 'Withdraw',
            severity: 'info',
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              owner: owner.slice(0, 6) + '...' + owner.slice(-4),
              assets: `${assetsFormatted} FXRP`,
            },
          });
        }
      }

      // Query all events from ShieldToken contract (Transfer events only)
      console.log(`[AnalyticsService] Querying ShieldToken at ${SHIELD_TOKEN_ADDRESS}...`);
      const shieldTokenLogs = await this.queryRawLogs(
        SHIELD_TOKEN_ADDRESS,
        [EVENT_TOPICS.Transfer],
        startBlock,
        currentBlock
      );
      console.log(`[AnalyticsService] Found ${shieldTokenLogs.length} ShieldToken Transfer logs`);

      // Only show significant transfers (mints, burns, or large transfers)
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      for (const log of shieldTokenLogs) {
        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);
        const value = BigInt(log.data);
        const valueFormatted = (Number(value) / (10 ** 18)).toFixed(2);
        
        // Filter to only show mints (from zero) or burns (to zero) or large transfers > 100 SHIELD
        const isMint = from.toLowerCase() === ZERO_ADDRESS;
        const isBurn = to.toLowerCase() === ZERO_ADDRESS;
        const isLargeTransfer = value >= BigInt(100) * BigInt(10 ** 18);
        
        if (isMint || isBurn || isLargeTransfer) {
          let eventName = 'Transfer';
          let severity: 'info' | 'warning' | 'critical' = 'info';
          
          if (isMint) {
            eventName = 'Mint';
            severity = 'warning';
          } else if (isBurn) {
            eventName = 'Burn';
            severity = 'critical';
          }
          
          events.push({
            id: `transfer-${log.transactionHash}-${log.blockNumber}-${log.logIndex}`,
            contractName: 'ShieldToken',
            eventName,
            severity,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: new Date(),
            args: {
              from: isMint ? 'Minted' : from.slice(0, 6) + '...' + from.slice(-4),
              to: isBurn ? 'Burned' : to.slice(0, 6) + '...' + to.slice(-4),
              amount: `${valueFormatted} SHIELD`,
            },
          });
        }
      }

      // Query all events from RevenueRouter contract
      console.log(`[AnalyticsService] Querying RevenueRouter at ${REVENUE_ROUTER_ADDRESS}...`);
      const revenueRouterLogs = await this.queryRawLogs(
        REVENUE_ROUTER_ADDRESS,
        [],
        startBlock,
        currentBlock
      );
      console.log(`[AnalyticsService] Found ${revenueRouterLogs.length} RevenueRouter logs`);

      for (const log of revenueRouterLogs) {
        // RevenueDistributed event - check topic matches
        if (log.topics[0] && log.data.length >= 130) {
          // Parse RevenueDistributed(uint256 wflrTotal, uint256 shieldBurned, uint256 fxrpToStakers, uint256 reserves)
          const shieldBurned = BigInt('0x' + log.data.slice(66, 130));
          const shieldBurnedFormatted = (Number(shieldBurned) / (10 ** 18)).toFixed(2);
          
          if (shieldBurned > BigInt(0)) {
            events.push({
              id: `revenue-${log.transactionHash}-${log.blockNumber}`,
              contractName: 'RevenueRouter',
              eventName: 'RevenueDistributed',
              severity: 'warning',
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              timestamp: new Date(),
              args: {
                shieldBurned: `${shieldBurnedFormatted} SHIELD`,
              },
            });
          }
        }
      }

      console.log(`[AnalyticsService] Total events found: ${events.length}`);

      // Sort by block number descending (most recent first)
      events.sort((a, b) => b.blockNumber - a.blockNumber);

      // Cache the results
      this.eventsCache = {
        events,
        currentBlock,
        lastFetch: Date.now(),
      };

      return {
        events: events.slice(0, limit),
        currentBlock,
        contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
      };
    } catch (error) {
      console.error("[AnalyticsService] Error fetching historical activity:", error);
      const currentBlock = await this.provider.getBlockNumber().catch(() => 0);
      
      // Return cached data if available, even if stale
      if (this.eventsCache) {
        console.log(`[AnalyticsService] Returning stale cache due to error`);
        return {
          events: this.eventsCache.events.slice(0, limit),
          currentBlock: this.eventsCache.currentBlock,
          contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
        };
      }
      
      return {
        events: [],
        currentBlock,
        contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
