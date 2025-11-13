import { FlareClient } from "../server/utils/flare-client";
import { db } from "../server/db";
import { positions, fxrpToXrpRedemptions } from "../shared/schema";
import { sql, ne } from "drizzle-orm";
import { ethers } from "ethers";

const VAULT_ADDRESS = "0xeBb4a977492241B06A2423710c03BB63B2c5990e";
const SMART_ACCOUNT_ADDRESS = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
const EXPECTED_ON_CHAIN_BALANCE = "225";
const EXPECTED_DB_BALANCE = "35";
const VAULT_MINT_TX = "0x55b82848f61e28ed2e1172d06c3ea95aeb7f36ef2f67d7ad97d62f5588dc1276";

interface ValidationResult {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: any;
}

async function runValidation() {
  console.log("🔍 Starting Database Reconciliation Validation");
  console.log("=".repeat(60));
  console.log(`Vault Address: ${VAULT_ADDRESS}`);
  console.log(`Smart Account: ${SMART_ACCOUNT_ADDRESS}`);
  console.log(`Vault Mint TX: ${VAULT_MINT_TX}`);
  console.log("=".repeat(60));
  console.log("");

  const results: ValidationResult[] = [];
  let allPassed = true;

  try {
    // Initialize Flare Client
    const privateKey = process.env.PRIVATE_KEY;
    const bundlerApiKey = process.env.ETHERSPOT_API_KEY;

    if (!privateKey || !bundlerApiKey) {
      throw new Error("Missing PRIVATE_KEY or ETHERSPOT_API_KEY environment variables");
    }

    const flareClient = new FlareClient({
      network: "coston2",
      privateKey,
      bundlerApiKey,
      enablePaymaster: true,
    });

    await flareClient.initialize();
    console.log("✅ FlareClient initialized\n");

    // ==================== CHECK 1: Smart Account shXRP Balance ====================
    console.log("📊 CHECK 1: Smart Account shXRP Balance");
    const vault = flareClient.getShXRPVault(VAULT_ADDRESS);
    const balanceRaw = await vault.balanceOf(SMART_ACCOUNT_ADDRESS);
    const balance = ethers.formatUnits(balanceRaw, 18);
    
    const check1Passed = balance === EXPECTED_ON_CHAIN_BALANCE || Math.abs(parseFloat(balance) - parseFloat(EXPECTED_ON_CHAIN_BALANCE)) < 0.01;
    results.push({
      check: "Smart Account shXRP Balance",
      expected: `${EXPECTED_ON_CHAIN_BALANCE} shXRP`,
      actual: `${balance} shXRP`,
      passed: check1Passed,
      details: { rawBalance: balanceRaw.toString(), smartAccount: SMART_ACCOUNT_ADDRESS }
    });

    console.log(`   Expected: ${EXPECTED_ON_CHAIN_BALANCE} shXRP`);
    console.log(`   Actual:   ${balance} shXRP`);
    console.log(`   Status:   ${check1Passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");

    if (!check1Passed) allPassed = false;

    // ==================== CHECK 2: Vault Total Supply ====================
    console.log("📊 CHECK 2: Vault Total Supply");
    const totalSupplyRaw = await vault.totalSupply();
    const totalSupply = ethers.formatUnits(totalSupplyRaw, 18);
    
    const check2Passed = totalSupply === EXPECTED_ON_CHAIN_BALANCE || Math.abs(parseFloat(totalSupply) - parseFloat(EXPECTED_ON_CHAIN_BALANCE)) < 0.01;
    results.push({
      check: "Vault Total Supply",
      expected: `${EXPECTED_ON_CHAIN_BALANCE} shXRP`,
      actual: `${totalSupply} shXRP`,
      passed: check2Passed,
      details: { rawTotalSupply: totalSupplyRaw.toString() }
    });

    console.log(`   Expected: ${EXPECTED_ON_CHAIN_BALANCE} shXRP (matches smart account balance)`);
    console.log(`   Actual:   ${totalSupply} shXRP`);
    console.log(`   Status:   ${check2Passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");

    if (!check2Passed) allPassed = false;

    // ==================== CHECK 3: No Active Pending Redemptions ====================
    console.log("📊 CHECK 3: Active Pending Redemptions");
    const pendingRedemptions = await db
      .select()
      .from(fxrpToXrpRedemptions)
      .where(ne(fxrpToXrpRedemptions.status, "completed"));

    const check3Passed = pendingRedemptions.length === 0;
    results.push({
      check: "No Active Pending Redemptions",
      expected: "0 pending redemptions",
      actual: `${pendingRedemptions.length} pending redemptions`,
      passed: check3Passed,
      details: pendingRedemptions.map(r => ({
        id: r.id,
        status: r.status,
        shareAmount: r.shareAmount,
        createdAt: r.createdAt
      }))
    });

    console.log(`   Expected: 0 pending redemptions`);
    console.log(`   Actual:   ${pendingRedemptions.length} pending redemptions`);
    console.log(`   Status:   ${check3Passed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (pendingRedemptions.length > 0) {
      console.log(`   ⚠️  Active redemptions found:`);
      pendingRedemptions.forEach(r => {
        console.log(`      - ID: ${r.id}, Status: ${r.status}, Amount: ${r.shareAmount}`);
      });
    }
    console.log("");

    if (!check3Passed) allPassed = false;

    // ==================== CHECK 4: Database Position Sum ====================
    console.log("📊 CHECK 4: Database Position Sum");
    const allPositions = await db.select().from(positions);
    
    const totalDbAmount = allPositions.reduce((sum, pos) => {
      return sum + parseFloat(pos.amount);
    }, 0);

    const check4Passed = Math.abs(totalDbAmount - parseFloat(EXPECTED_DB_BALANCE)) < 0.01;
    results.push({
      check: "Database Position Sum",
      expected: `${EXPECTED_DB_BALANCE} shXRP`,
      actual: `${totalDbAmount.toFixed(2)} shXRP`,
      passed: check4Passed,
      details: allPositions.map(p => ({
        id: p.id,
        walletAddress: p.walletAddress,
        amount: p.amount,
        vaultId: p.vaultId
      }))
    });

    console.log(`   Expected: ${EXPECTED_DB_BALANCE} shXRP`);
    console.log(`   Actual:   ${totalDbAmount.toFixed(2)} shXRP`);
    console.log(`   Status:   ${check4Passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");
    console.log(`   📋 Position Breakdown:`);
    allPositions.forEach(p => {
      console.log(`      - ID: ${p.id}`);
      console.log(`        Wallet: ${p.walletAddress}`);
      console.log(`        Amount: ${p.amount} shXRP`);
      console.log(`        Vault: ${p.vaultId}`);
      console.log("");
    });

    if (!check4Passed) allPassed = false;

    // ==================== SUMMARY ====================
    console.log("=".repeat(60));
    console.log("📊 VALIDATION SUMMARY");
    console.log("=".repeat(60));
    
    results.forEach(result => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${result.check}`);
      console.log(`   Expected: ${result.expected}`);
      console.log(`   Actual:   ${result.actual}`);
      console.log("");
    });

    console.log("=".repeat(60));
    if (allPassed) {
      console.log("✅ ALL VALIDATION CHECKS PASSED");
      console.log("");
      console.log("📝 Reconciliation Gap Analysis:");
      console.log(`   On-chain Balance:  ${balance} shXRP`);
      console.log(`   Database Balance:  ${totalDbAmount.toFixed(2)} shXRP`);
      console.log(`   Gap to Reconcile:  ${(parseFloat(balance) - totalDbAmount).toFixed(2)} shXRP`);
      console.log("");
      console.log("✅ Ready to proceed with Phase 2: Reconciliation Plan");
    } else {
      console.log("❌ VALIDATION FAILED - Please review failed checks above");
    }
    console.log("=".repeat(60));

    // Clean exit
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error("❌ Validation Error:", error);
    process.exit(1);
  }
}

// Run validation
runValidation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
