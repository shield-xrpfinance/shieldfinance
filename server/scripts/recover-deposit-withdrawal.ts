/**
 * Emergency Recovery Script: Manually create database records for orphaned blockchain transactions
 * 
 * Context: DEMO_MODE was enabled while real blockchain transactions executed, causing a mismatch
 * where money moved on-chain but no database records were created.
 * 
 * This script creates the missing records to reflect actual blockchain state.
 */

import { db } from "../db";
import { vaults, positions, transactions, xrpToFxrpBridges, fxrpToXrpRedemptions } from "../../shared/schema";
import { eq } from "drizzle-orm";

const RECOVERY_DATA = {
  // User wallet
  walletAddress: "r3fMucz3hfhAaeS3kJsLuU5E2L6dSYGoQn",
  
  // Deposit transaction (21 XRP requested → 30 XRP deposited after lot rounding)
  deposit: {
    requestedXrpAmount: "21.000000",
    xrpAmount: "30.000000", // Lot-rounded to 3 lots
    xrplTxHash: "0AD2565D2E6AE5E5F18B072284DCCF4F4C35A3DA594F54983431CAFCA6D3F0FB",
    fassetsRedemptionTxHash: "0x600711b7b047569b169f4ce77b6e3e0b557f0fab879ae383c730c8cc2e1e37e3",
    vaultMintTxHash: "0xed05adf8350a263ec06b7bd2863c73fb8bb3f68f3a2afabf02d7979d8c38ecac",
    depositedAt: new Date("2025-11-14T07:30:00Z"), // Approximate time from user report
  },
  
  // Withdrawal transaction (30 shXRP → 29.85 XRP received)
  withdrawal: {
    shareAmount: "30.000000",
    xrpReceived: "29.850000", // After FAssets redemption fees
    xrplPayoutTxHash: "63A45398126711A310EA96CAEF3EAE53CC180B22CC6C9D3B77F3A208C0A8A82D",
    withdrawnAt: new Date("2025-11-14T07:30:23Z"), // From user report
  },
};

async function recoverDepositWithdrawal() {
  try {
    console.log("🚨 Starting emergency data recovery...");
    console.log(`   User wallet: ${RECOVERY_DATA.walletAddress}`);
    
    // Step 0: Idempotency check - verify if recovery already ran
    const existingBridge = await db.query.xrpToFxrpBridges.findFirst({
      where: eq(xrpToFxrpBridges.xrplTxHash, RECOVERY_DATA.deposit.xrplTxHash),
    });
    
    if (existingBridge) {
      console.log("✅ Recovery already completed - bridge record exists");
      console.log(`   Bridge ID: ${existingBridge.id}`);
      console.log(`   Status: ${existingBridge.status}`);
      
      // Verify related records
      const position = await db.query.positions.findFirst({
        where: eq(positions.walletAddress, RECOVERY_DATA.walletAddress),
      });
      
      const redemption = await db.query.fxrpToXrpRedemptions.findFirst({
        where: eq(fxrpToXrpRedemptions.xrplPayoutTxHash, RECOVERY_DATA.withdrawal.xrplPayoutTxHash),
      });
      
      console.log(`   Position exists: ${position ? 'Yes (' + position.id + ')' : 'No'}`);
      console.log(`   Redemption exists: ${redemption ? 'Yes (' + redemption.id + ')' : 'No'}`);
      console.log("\n⚠️  Skipping recovery to prevent duplicate records.");
      return;
    }
    
    // Step 1: Find or verify vault
    const vault = await db.query.vaults.findFirst({
      where: eq(vaults.name, "XRP Stable Yield"),
    });
    
    if (!vault) {
      throw new Error("Vault 'XRP Stable Yield' not found in database");
    }
    
    console.log(`✅ Found vault: ${vault.name} (${vault.id})`);
    
    // Step 2: Create bridge record (deposit)
    console.log("\n📊 Creating bridge record for deposit...");
    const [bridge] = await db.insert(xrpToFxrpBridges).values({
      walletAddress: RECOVERY_DATA.walletAddress,
      vaultId: vault.id,
      requestedXrpAmount: RECOVERY_DATA.deposit.requestedXrpAmount,
      xrpAmount: RECOVERY_DATA.deposit.xrpAmount,
      fxrpExpected: RECOVERY_DATA.deposit.xrpAmount, // 1:1 XRP to FXRP (lot-rounded)
      fxrpReceived: RECOVERY_DATA.deposit.xrpAmount, // Assume full amount received
      status: "completed",
      xrplTxHash: RECOVERY_DATA.deposit.xrplTxHash,
      flareTxHash: RECOVERY_DATA.deposit.fassetsRedemptionTxHash,
      vaultMintTxHash: RECOVERY_DATA.deposit.vaultMintTxHash,
      createdAt: RECOVERY_DATA.deposit.depositedAt,
      xrplConfirmedAt: RECOVERY_DATA.deposit.depositedAt,
      fxrpReceivedAt: RECOVERY_DATA.deposit.depositedAt,
      completedAt: RECOVERY_DATA.deposit.depositedAt,
    }).returning();
    
    console.log(`✅ Bridge created: ${bridge.id}`);
    console.log(`   Requested: ${RECOVERY_DATA.deposit.requestedXrpAmount} XRP`);
    console.log(`   Deposited (lot-rounded): ${RECOVERY_DATA.deposit.xrpAmount} XRP`);
    
    // Step 3: Create position record
    console.log("\n📊 Creating position record...");
    const [position] = await db.insert(positions).values({
      walletAddress: RECOVERY_DATA.walletAddress,
      vaultId: vault.id,
      amount: RECOVERY_DATA.deposit.xrpAmount,
      rewards: "0",
      depositedAt: RECOVERY_DATA.deposit.depositedAt,
    }).returning();
    
    console.log(`✅ Position created: ${position.id}`);
    console.log(`   Amount: ${position.amount} shXRP`);
    
    // Step 4: Create deposit transaction record
    console.log("\n📊 Creating deposit transaction record...");
    const [depositTx] = await db.insert(transactions).values({
      vaultId: vault.id,
      positionId: position.id,
      type: "deposit",
      amount: RECOVERY_DATA.deposit.xrpAmount,
      rewards: "0",
      status: "completed",
      txHash: RECOVERY_DATA.deposit.vaultMintTxHash,
      network: "testnet",
      createdAt: RECOVERY_DATA.deposit.depositedAt,
    }).returning();
    
    console.log(`✅ Deposit transaction created: ${depositTx.id}`);
    
    // Step 5: Create redemption record (withdrawal - COMPLETED)
    console.log("\n📊 Creating redemption record (completed withdrawal)...");
    const [redemption] = await db.insert(fxrpToXrpRedemptions).values({
      positionId: position.id,
      walletAddress: RECOVERY_DATA.walletAddress,
      vaultId: vault.id,
      shareAmount: RECOVERY_DATA.withdrawal.shareAmount,
      fxrpRedeemed: RECOVERY_DATA.withdrawal.shareAmount, // 1:1 for now
      xrpSent: RECOVERY_DATA.withdrawal.xrpReceived,
      status: "completed",
      xrplPayoutTxHash: RECOVERY_DATA.withdrawal.xrplPayoutTxHash,
      createdAt: RECOVERY_DATA.withdrawal.withdrawnAt,
      xrplPayoutAt: RECOVERY_DATA.withdrawal.withdrawnAt,
      completedAt: RECOVERY_DATA.withdrawal.withdrawnAt,
    }).returning();
    
    console.log(`✅ Redemption created: ${redemption.id}`);
    console.log(`   Shares redeemed: ${RECOVERY_DATA.withdrawal.shareAmount} shXRP`);
    console.log(`   XRP received: ${RECOVERY_DATA.withdrawal.xrpReceived} XRP`);
    
    // Step 6: Update position balance (subtract withdrawn amount)
    console.log("\n📊 Updating position balance...");
    const remainingBalance = (
      parseFloat(RECOVERY_DATA.deposit.xrpAmount) - 
      parseFloat(RECOVERY_DATA.withdrawal.shareAmount)
    ).toFixed(6);
    
    await db.update(positions)
      .set({ amount: remainingBalance })
      .where(eq(positions.id, position.id));
    
    console.log(`✅ Position balance updated: ${remainingBalance} shXRP remaining`);
    
    // Step 7: Create withdrawal transaction record
    console.log("\n📊 Creating withdrawal transaction record...");
    const [withdrawalTx] = await db.insert(transactions).values({
      vaultId: vault.id,
      positionId: position.id,
      type: "withdrawal",
      amount: RECOVERY_DATA.withdrawal.shareAmount,
      rewards: "0",
      status: "completed",
      txHash: RECOVERY_DATA.withdrawal.xrplPayoutTxHash,
      network: "testnet",
      createdAt: RECOVERY_DATA.withdrawal.withdrawnAt,
    }).returning();
    
    console.log(`✅ Withdrawal transaction created: ${withdrawalTx.id}`);
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ RECOVERY COMPLETE");
    console.log("=".repeat(60));
    console.log(`Bridge ID: ${bridge.id}`);
    console.log(`Position ID: ${position.id}`);
    console.log(`Redemption ID: ${redemption.id}`);
    console.log(`\nDeposit: ${RECOVERY_DATA.deposit.xrpAmount} XRP → ${RECOVERY_DATA.deposit.xrpAmount} shXRP`);
    console.log(`Withdrawal: ${RECOVERY_DATA.withdrawal.shareAmount} shXRP → ${RECOVERY_DATA.withdrawal.xrpReceived} XRP`);
    console.log(`Remaining Balance: ${remainingBalance} shXRP`);
    console.log("\n⚠️  The database now reflects actual blockchain state.");
    console.log("⚠️  User should see correct balances in Portfolio page.");
    
  } catch (error) {
    console.error("❌ Recovery failed:", error);
    throw error;
  }
}

// Run recovery
recoverDepositWithdrawal()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
