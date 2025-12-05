import { db } from "../db";
import { 
  testnetActivities, 
  userPoints,
  type TestnetActivityType,
  type UserTier,
  POINTS_CONFIG,
  TIER_CONFIG,
  type InsertTestnetActivity,
  type TestnetActivity,
  type UserPoints,
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import crypto from "crypto";

/**
 * PointsService - Manages testnet points, activities, and tier calculations
 * 
 * This service:
 * - Logs testnet activities and awards points
 * - Calculates and updates user tiers based on points
 * - Generates referral codes
 * - Tracks first-time actions for bonus points
 * - Provides leaderboard data
 */
export class PointsService {
  private static instance: PointsService;

  private constructor() {}

  static getInstance(): PointsService {
    if (!PointsService.instance) {
      PointsService.instance = new PointsService();
    }
    return PointsService.instance;
  }

  /**
   * Calculate tier based on total points
   */
  calculateTier(totalPoints: number): { tier: UserTier; multiplier: number } {
    if (totalPoints >= TIER_CONFIG.diamond.minPoints) {
      return { tier: "diamond", multiplier: TIER_CONFIG.diamond.multiplier };
    } else if (totalPoints >= TIER_CONFIG.gold.minPoints) {
      return { tier: "gold", multiplier: TIER_CONFIG.gold.multiplier };
    } else if (totalPoints >= TIER_CONFIG.silver.minPoints) {
      return { tier: "silver", multiplier: TIER_CONFIG.silver.multiplier };
    }
    return { tier: "bronze", multiplier: TIER_CONFIG.bronze.multiplier };
  }

  /**
   * Generate a unique referral code for a user
   */
  generateReferralCode(): string {
    return `SHIELD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  /**
   * Get or create user points record
   */
  async getOrCreateUserPoints(walletAddress: string): Promise<UserPoints> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    let userPointsRecord = await db.query.userPoints.findFirst({
      where: eq(userPoints.walletAddress, normalizedAddress),
    });

    if (!userPointsRecord) {
      const referralCode = this.generateReferralCode();
      
      const [newRecord] = await db.insert(userPoints).values({
        walletAddress: normalizedAddress,
        totalPoints: 0,
        depositPoints: 0,
        stakingPoints: 0,
        bridgePoints: 0,
        referralPoints: 0,
        bugReportPoints: 0,
        socialPoints: 0,
        otherPoints: 0,
        tier: "bronze",
        airdropMultiplier: "1.0",
        referralCode,
        referralCount: 0,
        badges: [],
        isOg: false,
      }).returning();
      
      userPointsRecord = newRecord;
    }

    return userPointsRecord;
  }

  /**
   * Check if user has already received first deposit bonus
   */
  async hasFirstDepositBonus(walletAddress: string): Promise<boolean> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    const existing = await db.query.testnetActivities.findFirst({
      where: and(
        eq(testnetActivities.walletAddress, normalizedAddress),
        eq(testnetActivities.activityType, "first_deposit")
      ),
    });

    return !!existing;
  }

  /**
   * Log an activity and award points
   */
  async logActivity(params: {
    walletAddress: string;
    activityType: TestnetActivityType;
    relatedTxHash?: string;
    relatedVaultId?: string;
    relatedPositionId?: string;
    metadata?: Record<string, unknown>;
    description?: string;
    customPoints?: number; // Override default points (e.g., for deposit scaling)
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number }> {
    const normalizedAddress = params.walletAddress.toLowerCase();
    
    // Get points for this activity type
    const basePoints = params.customPoints ?? POINTS_CONFIG[params.activityType].base;
    
    // Create activity record
    const [activity] = await db.insert(testnetActivities).values({
      walletAddress: normalizedAddress,
      activityType: params.activityType,
      pointsEarned: basePoints,
      relatedTxHash: params.relatedTxHash,
      relatedVaultId: params.relatedVaultId,
      relatedPositionId: params.relatedPositionId,
      metadata: params.metadata || {},
      description: params.description || POINTS_CONFIG[params.activityType].description,
    }).returning();

    // Update user points
    const updatedUserPoints = await this.updateUserPoints(normalizedAddress, params.activityType, basePoints);

    console.log(`✅ Points awarded: ${basePoints} pts for ${params.activityType} to ${normalizedAddress.slice(0, 10)}...`);

    return {
      activity,
      userPoints: updatedUserPoints,
      pointsAwarded: basePoints,
    };
  }

  /**
   * Update user's total points and tier
   */
  private async updateUserPoints(
    walletAddress: string,
    activityType: TestnetActivityType,
    points: number
  ): Promise<UserPoints> {
    // Get or create user points record
    await this.getOrCreateUserPoints(walletAddress);

    // Determine which category to update
    let categoryColumn: keyof typeof userPoints.$inferSelect;
    switch (activityType) {
      case "first_deposit":
      case "deposit":
        categoryColumn = "depositPoints";
        break;
      case "stake_shield":
      case "boost_activated":
        categoryColumn = "stakingPoints";
        break;
      case "bridge_xrpl_flare":
      case "bridge_flare_xrpl":
        categoryColumn = "bridgePoints";
        break;
      case "referral":
        categoryColumn = "referralPoints";
        break;
      case "bug_report":
        categoryColumn = "bugReportPoints";
        break;
      case "social_share":
        categoryColumn = "socialPoints";
        break;
      case "faucet_claim":
        categoryColumn = "otherPoints";
        break;
      default:
        categoryColumn = "otherPoints";
    }

    // Update points atomically
    const [updated] = await db
      .update(userPoints)
      .set({
        totalPoints: sql`${userPoints.totalPoints} + ${points}`,
        [categoryColumn]: sql`${userPoints[categoryColumn]} + ${points}`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.walletAddress, walletAddress))
      .returning();

    // Calculate and update tier if needed
    const newTotalPoints = updated.totalPoints;
    const { tier, multiplier } = this.calculateTier(newTotalPoints);
    
    if (tier !== updated.tier) {
      const [tierUpdated] = await db
        .update(userPoints)
        .set({
          tier,
          airdropMultiplier: multiplier.toString(),
          isOg: tier === "gold" || tier === "diamond",
          updatedAt: new Date(),
        })
        .where(eq(userPoints.walletAddress, walletAddress))
        .returning();
      
      console.log(`🎉 Tier upgrade: ${walletAddress.slice(0, 10)}... upgraded to ${tier.toUpperCase()}!`);
      return tierUpdated;
    }

    return updated;
  }

  /**
   * Award points for deposit (scaled by amount)
   */
  async awardDepositPoints(params: {
    walletAddress: string;
    amountUsd: number;
    txHash?: string;
    vaultId?: string;
    positionId?: string;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number }> {
    const normalizedAddress = params.walletAddress.toLowerCase();
    
    // Check for first deposit bonus
    const hasFirstBonus = await this.hasFirstDepositBonus(normalizedAddress);
    
    if (!hasFirstBonus) {
      // Award first deposit bonus
      await this.logActivity({
        walletAddress: normalizedAddress,
        activityType: "first_deposit",
        relatedTxHash: params.txHash,
        relatedVaultId: params.vaultId,
        relatedPositionId: params.positionId,
        metadata: { amountUsd: params.amountUsd },
        description: "First deposit bonus - Welcome to Shield Finance!",
      });

      // Check if user was referred by someone and award referral points
      const userRecord = await this.getOrCreateUserPoints(normalizedAddress);
      if (userRecord.referredBy) {
        console.log(`🎁 Processing referral: ${userRecord.referredBy.slice(0, 10)}... referred ${normalizedAddress.slice(0, 10)}...`);
        await this.processReferral({
          referrerAddress: userRecord.referredBy,
          referredAddress: normalizedAddress,
          depositTxHash: params.txHash,
        });
      }
    }

    // Calculate deposit points (10 pts per $10)
    const depositPoints = Math.floor(params.amountUsd / 10) * POINTS_CONFIG.deposit.base;
    
    if (depositPoints > 0) {
      return this.logActivity({
        walletAddress: normalizedAddress,
        activityType: "deposit",
        relatedTxHash: params.txHash,
        relatedVaultId: params.vaultId,
        relatedPositionId: params.positionId,
        metadata: { amountUsd: params.amountUsd },
        customPoints: depositPoints,
        description: `Deposit of ~$${params.amountUsd.toFixed(2)}`,
      });
    }

    // Return current user points if no points to award
    const currentPoints = await this.getOrCreateUserPoints(normalizedAddress);
    return {
      activity: null as unknown as TestnetActivity,
      userPoints: currentPoints,
      pointsAwarded: 0,
    };
  }

  /**
   * Award points for bridge operation
   */
  async awardBridgePoints(params: {
    walletAddress: string;
    direction: "xrpl_to_flare" | "flare_to_xrpl";
    txHash?: string;
    amount?: string;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number }> {
    const activityType: TestnetActivityType = 
      params.direction === "xrpl_to_flare" ? "bridge_xrpl_flare" : "bridge_flare_xrpl";

    return this.logActivity({
      walletAddress: params.walletAddress,
      activityType,
      relatedTxHash: params.txHash,
      metadata: { direction: params.direction, amount: params.amount },
      description: `Bridge ${params.direction === "xrpl_to_flare" ? "XRPL → Flare" : "Flare → XRPL"}`,
    });
  }

  /**
   * Award referral points when a referred user makes their first deposit
   */
  async processReferral(params: {
    referrerAddress: string;
    referredAddress: string;
    depositTxHash?: string;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    const normalizedReferrer = params.referrerAddress.toLowerCase();
    const normalizedReferred = params.referredAddress.toLowerCase();

    // Update referrer's referral count
    await db
      .update(userPoints)
      .set({
        referralCount: sql`${userPoints.referralCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.walletAddress, normalizedReferrer));

    // Mark referred user
    await db
      .update(userPoints)
      .set({
        referredBy: normalizedReferrer,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.walletAddress, normalizedReferred));

    // Award referral points to referrer
    return this.logActivity({
      walletAddress: normalizedReferrer,
      activityType: "referral",
      relatedTxHash: params.depositTxHash,
      metadata: { referredAddress: normalizedReferred },
      description: `Referral bonus for ${normalizedReferred.slice(0, 10)}...`,
    });
  }

  /**
   * Award withdrawal points (25 pts for completing a withdrawal cycle)
   */
  async awardWithdrawalPoints(params: {
    walletAddress: string;
    txHash?: string;
    redemptionId?: string;
    amount?: string;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    return this.logActivity({
      walletAddress: params.walletAddress,
      activityType: "withdrawal",
      relatedTxHash: params.txHash,
      metadata: { redemptionId: params.redemptionId, amount: params.amount },
      description: "Withdrawal cycle completed",
    });
  }

  /**
   * Award daily login points (2 pts, once per day per wallet)
   * Returns null if already claimed today
   */
  async awardDailyLoginPoints(walletAddress: string): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if user already claimed daily login today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingActivity = await db.query.testnetActivities.findFirst({
      where: and(
        eq(testnetActivities.walletAddress, normalizedAddress),
        eq(testnetActivities.activityType, "daily_login"),
        sql`${testnetActivities.createdAt} >= ${today}`
      ),
    });
    
    if (existingActivity) {
      console.log(`⏭️  Daily login already claimed today for ${normalizedAddress.slice(0, 10)}...`);
      return null;
    }
    
    return this.logActivity({
      walletAddress: normalizedAddress,
      activityType: "daily_login",
      description: "Daily active user bonus",
    });
  }

  /**
   * Award swap points (15 pts per swap)
   */
  async awardSwapPoints(params: {
    walletAddress: string;
    txHash?: string;
    fromToken?: string;
    toToken?: string;
    amount?: string;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    return this.logActivity({
      walletAddress: params.walletAddress,
      activityType: "swap",
      relatedTxHash: params.txHash,
      metadata: { fromToken: params.fromToken, toToken: params.toToken, amount: params.amount },
      description: `Swap ${params.fromToken || "tokens"} → ${params.toToken || "tokens"}`,
    });
  }

  /**
   * Award boost activated points (30 pts, one-time per wallet)
   */
  async awardBoostActivatedPoints(params: {
    walletAddress: string;
    txHash?: string;
    shieldAmount?: string;
    boostPercentage?: number;
  }): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    const normalizedAddress = params.walletAddress.toLowerCase();
    
    // Check if user already received boost_activated points (one-time only)
    const existingActivity = await db.query.testnetActivities.findFirst({
      where: and(
        eq(testnetActivities.walletAddress, normalizedAddress),
        eq(testnetActivities.activityType, "boost_activated"),
      ),
    });
    
    if (existingActivity) {
      console.log(`⏭️  Boost activation already awarded for ${normalizedAddress.slice(0, 10)}...`);
      return null;
    }
    
    return this.logActivity({
      walletAddress: normalizedAddress,
      activityType: "boost_activated",
      relatedTxHash: params.txHash,
      metadata: { shieldAmount: params.shieldAmount, boostPercentage: params.boostPercentage },
      description: `Activated SHIELD boost (+${params.boostPercentage || 0}% APY)`,
    });
  }

  /**
   * Award SHIELD staking daily points (5 pts per day while staking)
   * Called by scheduled job, awards once per 24h per wallet
   */
  async awardStakingDailyPoints(walletAddress: string): Promise<{ activity: TestnetActivity; userPoints: UserPoints; pointsAwarded: number } | null> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Check if user already received staking points today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingActivity = await db.query.testnetActivities.findFirst({
      where: and(
        eq(testnetActivities.walletAddress, normalizedAddress),
        eq(testnetActivities.activityType, "stake_shield"),
        sql`${testnetActivities.createdAt} >= ${today}`
      ),
    });
    
    if (existingActivity) {
      console.log(`⏭️  Staking daily points already awarded today for ${normalizedAddress.slice(0, 10)}...`);
      return null;
    }
    
    return this.logActivity({
      walletAddress: normalizedAddress,
      activityType: "stake_shield",
      description: "SHIELD staking daily reward",
    });
  }

  /**
   * Get user's activity history
   */
  async getUserActivities(
    walletAddress: string,
    limit: number = 50
  ): Promise<TestnetActivity[]> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    return db.query.testnetActivities.findMany({
      where: eq(testnetActivities.walletAddress, normalizedAddress),
      orderBy: [desc(testnetActivities.createdAt)],
      limit,
    });
  }

  /**
   * Get leaderboard (top users by points)
   */
  async getLeaderboard(limit: number = 100): Promise<UserPoints[]> {
    return db.query.userPoints.findMany({
      orderBy: [desc(userPoints.totalPoints)],
      limit,
    });
  }

  /**
   * Get leaderboard stats
   */
  async getLeaderboardStats(): Promise<{
    totalParticipants: number;
    totalPointsDistributed: number;
    tierBreakdown: Record<UserTier, number>;
  }> {
    const allUsers = await db.query.userPoints.findMany();
    
    const tierBreakdown: Record<UserTier, number> = {
      bronze: 0,
      silver: 0,
      gold: 0,
      diamond: 0,
    };

    let totalPoints = 0;
    for (const user of allUsers) {
      totalPoints += user.totalPoints;
      tierBreakdown[user.tier as UserTier]++;
    }

    return {
      totalParticipants: allUsers.length,
      totalPointsDistributed: totalPoints,
      tierBreakdown,
    };
  }

  /**
   * Validate referral code and get referrer
   */
  async validateReferralCode(code: string): Promise<UserPoints | null> {
    const result = await db.query.userPoints.findFirst({
      where: eq(userPoints.referralCode, code.toUpperCase()),
    });
    return result ?? null;
  }

  /**
   * Get user rank on leaderboard
   */
  async getUserRank(walletAddress: string): Promise<number> {
    const normalizedAddress = walletAddress.toLowerCase();
    
    const userPointsRecord = await db.query.userPoints.findFirst({
      where: eq(userPoints.walletAddress, normalizedAddress),
    });

    if (!userPointsRecord) return 0;

    const higherRanked = await db
      .select({ count: sql<number>`count(*)` })
      .from(userPoints)
      .where(sql`${userPoints.totalPoints} > ${userPointsRecord.totalPoints}`);

    return (higherRanked[0]?.count || 0) + 1;
  }

  /**
   * Get progress to next tier
   */
  getNextTierProgress(currentPoints: number, currentTier: UserTier): {
    nextTier: UserTier | null;
    pointsNeeded: number;
    progressPercent: number;
  } {
    const tiers: UserTier[] = ["bronze", "silver", "gold", "diamond"];
    const currentIndex = tiers.indexOf(currentTier);
    
    if (currentIndex === tiers.length - 1) {
      return { nextTier: null, pointsNeeded: 0, progressPercent: 100 };
    }

    const nextTier = tiers[currentIndex + 1];
    const nextThreshold = TIER_CONFIG[nextTier].minPoints;
    const currentThreshold = TIER_CONFIG[currentTier].minPoints;
    
    const pointsNeeded = nextThreshold - currentPoints;
    const progressPercent = Math.min(
      100,
      Math.floor(((currentPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
    );

    return { nextTier, pointsNeeded, progressPercent };
  }
}

// Export singleton instance
export const pointsService = PointsService.getInstance();
