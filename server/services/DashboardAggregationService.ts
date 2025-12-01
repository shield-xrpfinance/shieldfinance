/**
 * DashboardAggregationService - User Portfolio Intelligence
 * 
 * Aggregates user portfolio data from multiple sources:
 * - Positions from storage (vault deposits)
 * - SHIELD staking positions
 * - Real-time prices from PriceService
 * - Boost calculations from on-chain data
 * 
 * Provides unified dashboard summary and portfolio history management.
 */

import type { IStorage } from "../storage";
import type { PriceService } from "./PriceService";
import type { MetricsService } from "./MetricsService";
import type { DashboardSummary, InsertDashboardSnapshot, InsertUserNotification, NotificationType } from "@shared/schema";
import Decimal from "decimal.js";

export interface DashboardAggregationConfig {
  storage: IStorage;
  priceService: PriceService;
  metricsService: MetricsService;
}

export interface PositionWithValue {
  vaultId: string;
  vaultName: string;
  asset: string;
  amount: string;
  valueUsd: number;
  rewards: string;
  rewardsValueUsd: number;
  baseApy: number;
  boostedApy: number;
  boostPercentage: number;
}

export class DashboardAggregationService {
  private config: DashboardAggregationConfig;
  private ready: boolean = false;

  constructor(config: DashboardAggregationConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log("📊 Initializing DashboardAggregationService...");
    this.ready = true;
    console.log("✅ DashboardAggregationService initialized");
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get comprehensive dashboard summary for a wallet
   * Aggregates all position values, rewards, and boost metrics
   */
  async getDashboardSummary(walletAddress: string): Promise<DashboardSummary> {
    const { storage, priceService } = this.config;

    // Get all active positions for this wallet
    const positions = await storage.getPositions(walletAddress);
    const activePositions = positions.filter(p => p.status === "active");

    // Get SHIELD staking position
    const stakingPosition = await storage.getStakeInfo(walletAddress);

    // Get all vaults for metadata
    const vaults = await storage.getVaults();
    const vaultMap = new Map(vaults.map(v => [v.id, v]));

    // Get prices for calculations
    const prices = await priceService.getPrices(["XRP", "FXRP", "SHIELD", "FLR"]);

    // Calculate position values
    let totalValueUsd = new Decimal(0);
    let stakedValueUsd = new Decimal(0);
    let rewardsValueUsd = new Decimal(0);
    let totalWeightedApy = new Decimal(0);
    let totalWeight = new Decimal(0);
    const assetBreakdown: Record<string, number> = {};

    for (const position of activePositions) {
      const vault = vaultMap.get(position.vaultId);
      if (!vault) continue;

      const amount = new Decimal(position.amount || "0");
      const rewards = new Decimal(position.rewards || "0");
      
      // Get asset price - handle multi-asset vaults
      const assets = vault.asset.split(",");
      const primaryAsset = assets[0].trim().toUpperCase();
      const price = prices.get(primaryAsset) || prices.get("XRP") || 0;

      // Calculate USD values
      const positionValueUsd = amount.mul(price);
      const positionRewardsUsd = rewards.mul(price);

      totalValueUsd = totalValueUsd.add(positionValueUsd).add(positionRewardsUsd);
      stakedValueUsd = stakedValueUsd.add(positionValueUsd);
      rewardsValueUsd = rewardsValueUsd.add(positionRewardsUsd);

      // Track asset breakdown
      const assetKey = primaryAsset;
      assetBreakdown[assetKey] = (assetBreakdown[assetKey] || 0) + positionValueUsd.toNumber();

      // Weight APY by position value
      const vaultApy = new Decimal(vault.apy || "0");
      totalWeightedApy = totalWeightedApy.add(vaultApy.mul(positionValueUsd));
      totalWeight = totalWeight.add(positionValueUsd);
    }

    // Calculate SHIELD staking value
    let shieldStakedValueUsd = 0;
    let boostPercentage = 0;
    
    if (stakingPosition) {
      const shieldAmount = new Decimal(stakingPosition.amount || "0").div(1e18); // Convert from wei
      const shieldPrice = prices.get("SHIELD") || 0.01;
      shieldStakedValueUsd = shieldAmount.mul(shieldPrice).toNumber();
      totalValueUsd = totalValueUsd.add(shieldStakedValueUsd);
      
      // Calculate boost percentage based on staking amount
      // Boost formula: min(stakedAmount / 10000, 50) => max 50% boost
      boostPercentage = Math.min(shieldAmount.div(10000).toNumber(), 50);
      
      assetBreakdown["SHIELD"] = shieldStakedValueUsd;
    }

    // Calculate effective APY with boost
    const baseApy = totalWeight.gt(0) ? totalWeightedApy.div(totalWeight).toNumber() : 0;
    const effectiveApy = baseApy * (1 + boostPercentage / 100);

    return {
      totalValueUsd: totalValueUsd.toNumber(),
      stakedValueUsd: stakedValueUsd.toNumber(),
      shieldStakedValueUsd,
      rewardsValueUsd: rewardsValueUsd.toNumber(),
      effectiveApy,
      baseApy,
      boostPercentage,
      positionCount: activePositions.length,
      assetBreakdown,
    };
  }

  /**
   * Get detailed position breakdown with USD values and boost info
   */
  async getPositionsWithValue(walletAddress: string): Promise<PositionWithValue[]> {
    const { storage, priceService } = this.config;

    const positions = await storage.getPositions(walletAddress);
    const activePositions = positions.filter(p => p.status === "active");
    const vaults = await storage.getVaults();
    const vaultMap = new Map(vaults.map(v => [v.id, v]));

    // Get SHIELD staking for boost calculation
    const stakingPosition = await storage.getStakeInfo(walletAddress);
    let boostPercentage = 0;
    if (stakingPosition) {
      const shieldAmount = new Decimal(stakingPosition.amount || "0").div(1e18);
      boostPercentage = Math.min(shieldAmount.div(10000).toNumber(), 50);
    }

    const prices = await priceService.getPrices(["XRP", "FXRP", "SHIELD", "FLR"]);

    const result: PositionWithValue[] = [];

    for (const position of activePositions) {
      const vault = vaultMap.get(position.vaultId);
      if (!vault) continue;

      const amount = new Decimal(position.amount || "0");
      const rewards = new Decimal(position.rewards || "0");
      
      const assets = vault.asset.split(",");
      const primaryAsset = assets[0].trim().toUpperCase();
      const price = prices.get(primaryAsset) || prices.get("XRP") || 0;

      const valueUsd = amount.mul(price).toNumber();
      const rewardsValueUsd = rewards.mul(price).toNumber();
      const baseApy = parseFloat(vault.apy || "0");
      const boostedApy = baseApy * (1 + boostPercentage / 100);

      result.push({
        vaultId: position.vaultId,
        vaultName: vault.name,
        asset: vault.asset,
        amount: position.amount,
        valueUsd,
        rewards: position.rewards || "0",
        rewardsValueUsd,
        baseApy,
        boostedApy,
        boostPercentage,
      });
    }

    return result;
  }

  /**
   * Create a daily portfolio snapshot for historical tracking
   */
  async createDailySnapshot(walletAddress: string): Promise<void> {
    const { storage } = this.config;
    
    // Get current summary
    const summary = await this.getDashboardSummary(walletAddress);
    
    // Create snapshot for today (at midnight UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const snapshot: InsertDashboardSnapshot = {
      walletAddress,
      snapshotDate: today,
      totalValueUsd: summary.totalValueUsd.toString(),
      stakedValueUsd: summary.stakedValueUsd.toString(),
      shieldStakedValueUsd: summary.shieldStakedValueUsd.toString(),
      rewardsValueUsd: summary.rewardsValueUsd.toString(),
      assetBreakdown: summary.assetBreakdown,
      effectiveApy: summary.effectiveApy.toString(),
      baseApy: summary.baseApy.toString(),
      boostPercentage: summary.boostPercentage.toString(),
    };

    await storage.createDashboardSnapshot(snapshot);
  }

  /**
   * Get portfolio history for charts
   */
  async getPortfolioHistory(
    walletAddress: string, 
    days: number = 30
  ): Promise<Array<{
    date: string;
    totalValueUsd: number;
    stakedValueUsd: number;
    shieldStakedValueUsd: number;
    rewardsValueUsd: number;
    effectiveApy: number;
    boostPercentage: number;
  }>> {
    const { storage } = this.config;
    
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const snapshots = await storage.getDashboardSnapshots(walletAddress, fromDate, toDate);

    return snapshots.map(s => ({
      date: s.snapshotDate.toISOString().split('T')[0],
      totalValueUsd: parseFloat(s.totalValueUsd),
      stakedValueUsd: parseFloat(s.stakedValueUsd),
      shieldStakedValueUsd: parseFloat(s.shieldStakedValueUsd),
      rewardsValueUsd: parseFloat(s.rewardsValueUsd),
      effectiveApy: parseFloat(s.effectiveApy),
      boostPercentage: parseFloat(s.boostPercentage),
    }));
  }

  /**
   * Create a notification for a user
   */
  async createNotification(
    walletAddress: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
    relatedTxHash?: string,
    relatedVaultId?: string,
    relatedPositionId?: string
  ): Promise<void> {
    const { storage } = this.config;

    const notification: InsertUserNotification = {
      walletAddress,
      type,
      title,
      message,
      metadata: metadata || {},
      relatedTxHash,
      relatedVaultId,
      relatedPositionId,
      read: false,
    };

    await storage.createUserNotification(notification);
  }

  /**
   * Create deposit success notification
   */
  async notifyDepositSuccess(
    walletAddress: string,
    vaultName: string,
    amount: string,
    asset: string,
    txHash?: string,
    vaultId?: string
  ): Promise<void> {
    await this.createNotification(
      walletAddress,
      "deposit",
      "Deposit Successful",
      `Your deposit of ${amount} ${asset} to ${vaultName} has been confirmed.`,
      { amount, asset, vaultName },
      txHash,
      vaultId
    );
  }

  /**
   * Create withdrawal success notification
   */
  async notifyWithdrawalSuccess(
    walletAddress: string,
    vaultName: string,
    amount: string,
    asset: string,
    txHash?: string,
    vaultId?: string
  ): Promise<void> {
    await this.createNotification(
      walletAddress,
      "withdrawal",
      "Withdrawal Complete",
      `Your withdrawal of ${amount} ${asset} from ${vaultName} has been processed.`,
      { amount, asset, vaultName },
      txHash,
      vaultId
    );
  }

  /**
   * Create reward notification
   */
  async notifyRewardsEarned(
    walletAddress: string,
    amount: string,
    asset: string,
    vaultName: string
  ): Promise<void> {
    await this.createNotification(
      walletAddress,
      "reward",
      "Rewards Earned",
      `You've earned ${amount} ${asset} in rewards from ${vaultName}.`,
      { amount, asset, vaultName }
    );
  }

  /**
   * Create boost notification
   */
  async notifyBoostChange(
    walletAddress: string,
    action: "staked" | "unstaked",
    shieldAmount: string,
    newBoostPercentage: number
  ): Promise<void> {
    const title = action === "staked" ? "SHIELD Staked" : "SHIELD Unstaked";
    const message = action === "staked"
      ? `You've staked ${shieldAmount} SHIELD. Your new APY boost is ${newBoostPercentage.toFixed(1)}%.`
      : `You've unstaked ${shieldAmount} SHIELD. Your APY boost is now ${newBoostPercentage.toFixed(1)}%.`;

    await this.createNotification(
      walletAddress,
      "boost",
      title,
      message,
      { shieldAmount, boostPercentage: newBoostPercentage, action }
    );
  }
}
