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
  private readonly CACHE_TTL_MS = 60_000;

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
   * Get recent blockchain activity from all monitored contracts
   * Returns formatted events for display in the analytics dashboard
   */
  async getRecentActivity(limit: number = 20): Promise<{
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
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const blocksToScan = 500; // Scan recent ~500 blocks
      const startBlock = Math.max(0, currentBlock - blocksToScan);
      
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

      // Query Deposit events
      const depositFilter = this.vaultContract.filters.Deposit();
      const depositEvents = await this.queryWithPagination(
        this.vaultContract,
        depositFilter,
        startBlock,
        currentBlock,
        (log) => ({
          sender: log.args[0] as string,
          owner: log.args[1] as string,
          assets: log.args[2] as bigint,
          shares: log.args[3] as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })
      );

      for (const event of depositEvents) {
        const assetsFormatted = (Number(event.assets) / (10 ** FXRP_DECIMALS)).toFixed(2);
        events.push({
          id: `deposit-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'ShXRPVault',
          eventName: 'Deposit',
          severity: 'info',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(), // Block timestamp would require additional RPC call
          args: {
            owner: event.owner.slice(0, 6) + '...' + event.owner.slice(-4),
            assets: `${assetsFormatted} FXRP`,
          },
        });
      }

      // Query Withdraw events
      const withdrawFilter = this.vaultContract.filters.Withdraw();
      const withdrawEvents = await this.queryWithPagination(
        this.vaultContract,
        withdrawFilter,
        startBlock,
        currentBlock,
        (log) => ({
          sender: log.args[0] as string,
          receiver: log.args[1] as string,
          owner: log.args[2] as string,
          assets: log.args[3] as bigint,
          shares: log.args[4] as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })
      );

      for (const event of withdrawEvents) {
        const assetsFormatted = (Number(event.assets) / (10 ** FXRP_DECIMALS)).toFixed(2);
        events.push({
          id: `withdraw-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'ShXRPVault',
          eventName: 'Withdraw',
          severity: 'info',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(),
          args: {
            owner: event.owner.slice(0, 6) + '...' + event.owner.slice(-4),
            assets: `${assetsFormatted} FXRP`,
          },
        });
      }

      // Query Fee events
      const feeEvents = await this.queryFeeEvents(startBlock, currentBlock);
      for (const event of feeEvents) {
        const amountFormatted = (Number(event.amount) / (10 ** FXRP_DECIMALS)).toFixed(4);
        events.push({
          id: `fee-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'ShXRPVault',
          eventName: 'FeeTransferred',
          severity: 'info',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(),
          args: {
            feeType: event.feeType,
            amount: `${amountFormatted} FXRP`,
          },
        });
      }

      // Query Revenue Distribution events
      const distributionEvents = await this.queryRevenueDistributions(startBlock, currentBlock);
      for (const event of distributionEvents) {
        const shieldBurnedFormatted = (Number(event.shieldBurned) / (10 ** 18)).toFixed(2);
        events.push({
          id: `revenue-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'RevenueRouter',
          eventName: 'RevenueDistributed',
          severity: 'warning', // More visible for important events
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(),
          args: {
            shieldBurned: `${shieldBurnedFormatted} SHIELD`,
          },
        });
      }

      // Query Staked events from StakingBoost
      const stakedFilter = this.stakingBoostContract.filters.Staked();
      const stakedEvents = await this.queryWithPagination(
        this.stakingBoostContract,
        stakedFilter,
        startBlock,
        currentBlock,
        (log) => ({
          user: log.args[0] as string,
          amount: log.args[1] as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })
      );

      for (const event of stakedEvents) {
        const amountFormatted = (Number(event.amount) / (10 ** 18)).toFixed(2);
        events.push({
          id: `staked-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'StakingBoost',
          eventName: 'Staked',
          severity: 'info',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(),
          args: {
            user: event.user.slice(0, 6) + '...' + event.user.slice(-4),
            amount: `${amountFormatted} SHIELD`,
          },
        });
      }

      // Query Unstaked events from StakingBoost
      const unstakedFilter = this.stakingBoostContract.filters.Unstaked();
      const unstakedEvents = await this.queryWithPagination(
        this.stakingBoostContract,
        unstakedFilter,
        startBlock,
        currentBlock,
        (log) => ({
          user: log.args[0] as string,
          amount: log.args[1] as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })
      );

      for (const event of unstakedEvents) {
        const amountFormatted = (Number(event.amount) / (10 ** 18)).toFixed(2);
        events.push({
          id: `unstaked-${event.transactionHash}-${event.blockNumber}`,
          contractName: 'StakingBoost',
          eventName: 'Unstaked',
          severity: 'info',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: new Date(),
          args: {
            user: event.user.slice(0, 6) + '...' + event.user.slice(-4),
            amount: `${amountFormatted} SHIELD`,
          },
        });
      }

      console.log(`[AnalyticsService] Found ${events.length} events: ${depositEvents.length} deposits, ${withdrawEvents.length} withdraws, ${stakedEvents.length} stakes, ${unstakedEvents.length} unstakes`);

      // Sort by block number descending
      events.sort((a, b) => b.blockNumber - a.blockNumber);

      return {
        events: events.slice(0, limit),
        currentBlock,
        contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
      };
    } catch (error) {
      console.error("[AnalyticsService] Error fetching recent activity:", error);
      const currentBlock = await this.provider.getBlockNumber().catch(() => 0);
      return {
        events: [],
        currentBlock,
        contractsMonitored: ['ShXRPVault', 'RevenueRouter', 'StakingBoost', 'ShieldToken'],
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
