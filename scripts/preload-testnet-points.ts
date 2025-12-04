/**
 * Preload Testnet Points Script
 * 
 * This script analyzes existing testnet activity (deposits, bridges, staking)
 * and creates corresponding points records for users who participated before
 * the points system was implemented.
 * 
 * Run with: npx tsx scripts/preload-testnet-points.ts
 */

import { db } from "../server/db";
import { 
  transactions, 
  xrpToFxrpBridges, 
  stakingPositions,
  testnetActivities,
  userPoints,
  POINTS_CONFIG 
} from "../shared/schema";
import { eq, sql, and, inArray, isNotNull } from "drizzle-orm";
import crypto from "crypto";

function generateReferralCode(): string {
  return `SHIELD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function preloadPoints() {
  console.log("🚀 Starting testnet points preload...\n");

  // Get all unique wallet addresses from transactions
  const depositTxs = await db.query.transactions.findMany({
    where: and(
      inArray(transactions.type, ["deposit", "direct_fxrp_deposit"]),
      eq(transactions.status, "completed")
    ),
  });

  console.log(`📊 Found ${depositTxs.length} completed deposit transactions`);

  // Get bridges
  const bridges = await db.query.xrpToFxrpBridges.findMany({
    where: eq(xrpToFxrpBridges.status, "completed"),
  });
  console.log(`🌉 Found ${bridges.length} completed bridges`);

  // Get staking positions
  const stakingPos = await db.query.stakingPositions.findMany();
  console.log(`💎 Found ${stakingPos.length} staking positions`);

  // Collect all unique wallet addresses
  const walletSet = new Set<string>();
  
  depositTxs.forEach(tx => {
    if (tx.walletAddress) walletSet.add(tx.walletAddress.toLowerCase());
  });
  bridges.forEach(b => {
    if (b.walletAddress) walletSet.add(b.walletAddress.toLowerCase());
  });
  stakingPos.forEach(s => {
    if (s.walletAddress) walletSet.add(s.walletAddress.toLowerCase());
  });

  console.log(`\n👥 Found ${walletSet.size} unique wallet addresses\n`);

  // Filter out test/mock wallets
  const validWallets = Array.from(walletSet).filter(wallet => {
    // Skip obvious test addresses
    if (wallet === "0x9999999999999999999999999999999999999999") return false;
    if (wallet === "0x1234567890123456789012345678901234567890") return false;
    if (wallet.startsWith("0x000000")) return false;
    return true;
  });

  console.log(`✅ ${validWallets.length} valid wallets to process\n`);

  let totalPointsAwarded = 0;
  let usersProcessed = 0;

  for (const walletAddress of validWallets) {
    console.log(`\n📍 Processing wallet: ${walletAddress.slice(0, 10)}...`);

    // Check if user already has points record
    let existingPoints = await db.query.userPoints.findFirst({
      where: eq(userPoints.walletAddress, walletAddress),
    });

    // Get existing activities for this wallet
    const existingActivities = await db.query.testnetActivities.findMany({
      where: eq(testnetActivities.walletAddress, walletAddress),
    });

    const existingActivityTypes = new Set(existingActivities.map(a => a.activityType));

    // Calculate points from deposits
    const userDeposits = depositTxs.filter(tx => tx.walletAddress.toLowerCase() === walletAddress);
    let depositPoints = 0;
    let firstDepositPoints = 0;
    const depositActivities: any[] = [];

    if (userDeposits.length > 0 && !existingActivityTypes.has("first_deposit")) {
      // Award first deposit bonus
      firstDepositPoints = POINTS_CONFIG.first_deposit.base;
      depositActivities.push({
        walletAddress,
        activityType: "first_deposit",
        pointsEarned: firstDepositPoints,
        relatedTxHash: userDeposits[0].txHash,
        description: "First deposit bonus (retroactive)",
        metadata: { preloaded: true, originalDate: userDeposits[0].createdAt },
      });
    }

    // Award points for each deposit (10 pts per deposit)
    for (const deposit of userDeposits) {
      // Skip if we already have this activity logged
      const txHash = deposit.txHash;
      if (txHash && existingActivities.some(a => a.relatedTxHash === txHash)) {
        continue;
      }

      const points = POINTS_CONFIG.deposit.base;
      depositPoints += points;
      depositActivities.push({
        walletAddress,
        activityType: "deposit",
        pointsEarned: points,
        relatedTxHash: txHash,
        description: `Deposit of ${deposit.amount} (retroactive)`,
        metadata: { 
          preloaded: true, 
          originalDate: deposit.createdAt,
          amount: deposit.amount 
        },
      });
    }

    // Calculate points from bridges
    const userBridges = bridges.filter(b => b.walletAddress.toLowerCase() === walletAddress);
    let bridgePoints = 0;
    const bridgeActivities: any[] = [];

    for (const bridge of userBridges) {
      const txHash = bridge.xrplTxHash;
      if (txHash && existingActivities.some(a => a.relatedTxHash === txHash)) {
        continue;
      }

      const points = POINTS_CONFIG.bridge_xrpl_flare.base;
      bridgePoints += points;
      bridgeActivities.push({
        walletAddress,
        activityType: "bridge_xrpl_flare",
        pointsEarned: points,
        relatedTxHash: txHash,
        description: `Bridge ${bridge.xrpAmount} XRP → FXRP (retroactive)`,
        metadata: { 
          preloaded: true, 
          originalDate: bridge.createdAt,
          xrpAmount: bridge.xrpAmount 
        },
      });
    }

    // Calculate staking points
    const userStaking = stakingPos.filter(s => s.walletAddress?.toLowerCase() === walletAddress);
    let stakingPoints = 0;
    const stakingActivities: any[] = [];

    for (const stake of userStaking) {
      // Check if we already have staking activity for this position
      if (existingActivities.some(a => a.relatedPositionId === stake.id.toString())) {
        continue;
      }

      // Calculate days staked - stakedAt could be a timestamp string or date
      let stakedAt: Date;
      if (typeof stake.stakedAt === 'string') {
        // Check if it's a numeric timestamp or ISO date
        const numericTs = parseInt(stake.stakedAt);
        if (!isNaN(numericTs) && numericTs > 1000000000) {
          stakedAt = new Date(numericTs * 1000);
        } else {
          stakedAt = new Date(stake.stakedAt);
        }
      } else {
        stakedAt = new Date(stake.stakedAt);
      }
      
      const now = new Date();
      const daysStaked = Math.floor((now.getTime() - stakedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysStaked > 0) {
        const points = Math.min(daysStaked * POINTS_CONFIG.stake_shield.base, 500); // Cap at 500 pts
        stakingPoints += points;
        stakingActivities.push({
          walletAddress,
          activityType: "stake_shield",
          pointsEarned: points,
          relatedPositionId: stake.id.toString(),
          description: `SHIELD staking for ${daysStaked} days (retroactive)`,
          metadata: { 
            preloaded: true, 
            originalDate: stakedAt,
            daysStaked,
            amount: stake.amount
          },
        });
      }
    }

    // Calculate total points for this user
    const totalUserPoints = firstDepositPoints + depositPoints + bridgePoints + stakingPoints;
    
    if (totalUserPoints === 0) {
      console.log(`   ⏭️  No new points to award`);
      continue;
    }

    // Determine tier based on total points
    let tier: "bronze" | "silver" | "gold" | "diamond" = "bronze";
    let multiplier = "1.0";
    
    const existingTotal = existingPoints?.totalPoints || 0;
    const newTotal = existingTotal + totalUserPoints;
    
    if (newTotal >= 5000) {
      tier = "diamond";
      multiplier = "3.0";
    } else if (newTotal >= 2000) {
      tier = "gold";
      multiplier = "2.0";
    } else if (newTotal >= 500) {
      tier = "silver";
      multiplier = "1.5";
    }

    // Insert or update user points
    if (existingPoints) {
      await db.update(userPoints)
        .set({
          totalPoints: newTotal,
          depositPoints: (existingPoints.depositPoints || 0) + firstDepositPoints + depositPoints,
          bridgePoints: (existingPoints.bridgePoints || 0) + bridgePoints,
          stakingPoints: (existingPoints.stakingPoints || 0) + stakingPoints,
          tier,
          airdropMultiplier: multiplier,
        })
        .where(eq(userPoints.walletAddress, walletAddress));
    } else {
      await db.insert(userPoints).values({
        walletAddress,
        totalPoints: totalUserPoints,
        depositPoints: firstDepositPoints + depositPoints,
        bridgePoints,
        stakingPoints,
        referralPoints: 0,
        bugReportPoints: 0,
        socialPoints: 0,
        otherPoints: 0,
        tier,
        airdropMultiplier: multiplier,
        referralCode: generateReferralCode(),
        referralCount: 0,
        badges: [],
        isOg: true, // Mark as OG since they participated before points system
      });
    }

    // Insert activities
    const allActivities = [...depositActivities, ...bridgeActivities, ...stakingActivities];
    
    if (allActivities.length > 0) {
      await db.insert(testnetActivities).values(allActivities);
    }

    console.log(`   ✅ Awarded ${totalUserPoints} points`);
    console.log(`      - First deposit: ${firstDepositPoints} pts`);
    console.log(`      - Deposits (${userDeposits.length}): ${depositPoints} pts`);
    console.log(`      - Bridges (${userBridges.length}): ${bridgePoints} pts`);
    console.log(`      - Staking: ${stakingPoints} pts`);
    console.log(`      - Tier: ${tier} (${multiplier}x multiplier)`);

    totalPointsAwarded += totalUserPoints;
    usersProcessed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 PRELOAD SUMMARY");
  console.log("=".repeat(50));
  console.log(`   Users processed: ${usersProcessed}`);
  console.log(`   Total points awarded: ${totalPointsAwarded.toLocaleString()}`);
  console.log("=".repeat(50) + "\n");

  // Show final leaderboard
  const leaderboard = await db.query.userPoints.findMany({
    orderBy: (userPoints, { desc }) => [desc(userPoints.totalPoints)],
    limit: 10,
  });

  console.log("🏆 TOP 10 LEADERBOARD:");
  console.log("-".repeat(50));
  leaderboard.forEach((user, i) => {
    console.log(
      `   ${i + 1}. ${user.walletAddress.slice(0, 10)}... - ${user.totalPoints.toLocaleString()} pts (${user.tier})`
    );
  });

  console.log("\n✅ Preload complete!");
}

preloadPoints()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error during preload:", err);
    process.exit(1);
  });
