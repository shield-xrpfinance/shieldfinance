/**
 * AnalyticsService - Real-time on-chain analytics from Coston2 testnet
 * 
 * Queries deployed contracts for:
 * - FeeTransferred events from ShXRPVault (deposit/withdraw fees)
 * - RevenueDistributed events from RevenueRouter (SHIELD burns, staker rewards)
 * 
 * Contract Addresses (Coston2):
 * - ShXRPVault: 0x82d74B5fb005F7469e479C224E446bB89031e17F
 * - RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
 */

import { ethers } from "ethers";
import { SHXRP_VAULT_EVENTS_ABI, REVENUE_ROUTER_EVENTS_ABI } from "../../shared/flare-abis";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";

const SHXRP_VAULT_ADDRESS = process.env.VITE_SHXRP_VAULT_ADDRESS || "0x82d74B5fb005F7469e479C224E446bB89031e17F";
const REVENUE_ROUTER_ADDRESS = process.env.VITE_REVENUE_ROUTER_ADDRESS || "0x8e5C9933c08451a6a31635a3Ea1221c010DF158e";

const SHIELD_PRICE_USD = 0.01;
const XRP_PRICE_USD = 2.10;
const FXRP_DECIMALS = 6;
const WFLR_DECIMALS = 18;

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
  }

  async queryFeeEvents(fromBlock: number = 0, toBlock: number | "latest" = "latest"): Promise<FeeEvent[]> {
    try {
      const filter = this.vaultContract.filters.FeeTransferred();
      const events = await this.vaultContract.queryFilter(filter, fromBlock, toBlock);
      
      return events.map(event => {
        const log = event as ethers.EventLog;
        return {
          feeType: log.args[0] as string,
          amount: log.args[1] as bigint,
          recipient: log.args[2] as string,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
      });
    } catch (error) {
      console.error("Error querying FeeTransferred events:", error);
      return [];
    }
  }

  async queryRevenueDistributions(fromBlock: number = 0, toBlock: number | "latest" = "latest"): Promise<RevenueDistributionEvent[]> {
    try {
      const filter = this.revenueRouterContract.filters.RevenueDistributed();
      const events = await this.revenueRouterContract.queryFilter(filter, fromBlock, toBlock);
      
      return events.map(event => {
        const log = event as ethers.EventLog;
        return {
          wflrTotal: log.args[0] as bigint,
          shieldBurned: log.args[1] as bigint,
          fxrpToStakers: log.args[2] as bigint,
          reserves: log.args[3] as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
      });
    } catch (error) {
      console.error("Error querying RevenueDistributed events:", error);
      return [];
    }
  }

  async getRevenueTransparencyData(forceRefresh: boolean = false): Promise<RevenueTransparencyData> {
    const now = Date.now();
    if (!forceRefresh && this.cache.revenueData && this.cache.lastFetch && (now - this.cache.lastFetch) < this.CACHE_TTL_MS) {
      return this.cache.revenueData;
    }

    try {
      const currentBlock = await this.provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - 50000);
      
      const [feeEvents, distributionEvents] = await Promise.all([
        this.queryFeeEvents(startBlock),
        this.queryRevenueDistributions(startBlock)
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
      const startBlock = Math.max(0, currentBlock - 50000);
      
      const depositFilter = this.vaultContract.filters.Deposit();
      const withdrawFilter = this.vaultContract.filters.Withdraw();
      
      const [depositEvents, withdrawEvents] = await Promise.all([
        this.vaultContract.queryFilter(depositFilter, startBlock),
        this.vaultContract.queryFilter(withdrawFilter, startBlock)
      ]);

      let totalDeposits = BigInt(0);
      let totalWithdraws = BigInt(0);

      for (const event of depositEvents) {
        const log = event as ethers.EventLog;
        totalDeposits += log.args[2] as bigint;
      }

      for (const event of withdrawEvents) {
        const log = event as ethers.EventLog;
        totalWithdraws += log.args[3] as bigint;
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
}

export const analyticsService = new AnalyticsService();
