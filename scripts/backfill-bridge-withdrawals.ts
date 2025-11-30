/**
 * Backfill script to populate historical completed bridge redemptions as withdrawal events
 * 
 * This script:
 * 1. Queries all completed redemptions from fxrp_to_xrp_redemptions table
 * 2. Creates corresponding Withdrawal events in on_chain_events table
 * 3. Skips redemptions that already have events (deduplication by XRPL tx hash)
 */

import { db } from "../server/db";
import { fxrpToXrpRedemptions, onChainEvents } from "../shared/schema";
import { eq, sql, and, or, isNotNull } from "drizzle-orm";

/**
 * Convert a decimal XRP/FXRP amount string to drops (6 decimal places) using string math
 * Avoids float precision loss for large amounts
 */
function decimalToDrops(amount: string): string {
  const parts = amount.split('.');
  const whole = parts[0] || '0';
  let fraction = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  const drops = whole + fraction;
  return drops.replace(/^0+/, '') || '0';
}

async function main() {
  console.log("=== Bridge Redemption Withdrawal Backfill ===\n");

  // Query all completed redemptions (userStatus = 'completed' means XRP was received)
  const completedRedemptions = await db.select()
    .from(fxrpToXrpRedemptions)
    .where(
      and(
        eq(fxrpToXrpRedemptions.userStatus, "completed"),
        isNotNull(fxrpToXrpRedemptions.xrplPayoutTxHash)
      )
    );

  console.log(`Found ${completedRedemptions.length} completed redemptions\n`);

  if (completedRedemptions.length === 0) {
    console.log("No completed redemptions to backfill.");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const redemption of completedRedemptions) {
    // Check if this redemption already has an event
    const existingEvent = await db.select()
      .from(onChainEvents)
      .where(
        and(
          eq(onChainEvents.transactionHash, redemption.xrplPayoutTxHash!),
          eq(onChainEvents.contractName, "BridgeRedemption")
        )
      )
      .limit(1);

    if (existingEvent.length > 0) {
      console.log(`  ⏭️  Skipping ${redemption.id} - event already exists`);
      skipped++;
      continue;
    }

    // Calculate XRP amount in drops (6 decimals) using string-safe conversion
    const xrpAmount = redemption.xrpSent ?? redemption.fxrpRedeemed ?? redemption.shareAmount;
    const xrpAmountDrops = decimalToDrops(xrpAmount);

    // Insert withdrawal event
    await db.insert(onChainEvents).values({
      contractName: "BridgeRedemption",
      contractAddress: "XRPL",
      eventName: "Withdrawal",
      severity: "info",
      blockNumber: 0,
      transactionHash: redemption.xrplPayoutTxHash!,
      logIndex: 0,
      args: {
        walletAddress: redemption.walletAddress,
        vaultId: redemption.vaultId,
        positionId: redemption.positionId,
        xrpAmount: xrpAmountDrops,
        shareAmount: redemption.shareAmount,
        redemptionId: redemption.id,
      },
      timestamp: redemption.xrplPayoutAt ?? redemption.createdAt,
      notified: true,
    });

    console.log(`  ✅ Inserted withdrawal event for ${redemption.id}`);
    console.log(`     ${xrpAmount} XRP to ${redemption.walletAddress}`);
    inserted++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Inserted: ${inserted} withdrawal events`);
  console.log(`Skipped: ${skipped} (already existed)`);
  console.log(`Total processed: ${completedRedemptions.length}`);
}

main()
  .then(() => {
    console.log("\n✅ Backfill complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  });
