import { db } from "../server/db";
import { positions, fxrpToXrpRedemptions, vaults } from "../shared/schema";
import { ne } from "drizzle-orm";

const EXPECTED_DB_BALANCE = "35";
const TEST_POSITION_ID = "pos-lkTOWzyi";
const MAIN_POSITION_ID = "0bb1e2b9-a63a-405f-92c5-8e2a61bfbc8c";
const EXPECTED_TEST_AMOUNT = "15";
const EXPECTED_MAIN_AMOUNT = "20";

interface ValidationResult {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: any;
}

async function runDatabaseValidation() {
  console.log("🔍 Database Reconciliation Validation (Database Only)");
  console.log("=".repeat(60));
  console.log(`Expected DB Total: ${EXPECTED_DB_BALANCE} shXRP`);
  console.log(`Test Position: ${TEST_POSITION_ID}`);
  console.log(`Main Position: ${MAIN_POSITION_ID}`);
  console.log("=".repeat(60));
  console.log("");

  const results: ValidationResult[] = [];
  let allPassed = true;

  try {
    // ==================== CHECK 1: No Active Pending Redemptions ====================
    console.log("📊 CHECK 1: Active Pending Redemptions");
    // Exclude both 'completed' and 'failed' as these are terminal states
    const allRedemptions = await db.select().from(fxrpToXrpRedemptions);
    const pendingRedemptions = allRedemptions.filter(
      r => r.status !== "completed" && r.status !== "failed"
    );

    const check1Passed = pendingRedemptions.length === 0;
    results.push({
      check: "No Active Pending Redemptions",
      expected: "0 pending redemptions",
      actual: `${pendingRedemptions.length} pending redemptions`,
      passed: check1Passed,
      details: pendingRedemptions.map(r => ({
        id: r.id,
        status: r.status,
        shareAmount: r.shareAmount,
        createdAt: r.createdAt
      }))
    });

    console.log(`   Expected: 0 pending redemptions`);
    console.log(`   Actual:   ${pendingRedemptions.length} pending redemptions`);
    console.log(`   Status:   ${check1Passed ? "✅ PASS" : "❌ FAIL"}`);
    
    if (pendingRedemptions.length > 0) {
      console.log(`   ⚠️  Active redemptions found:`);
      pendingRedemptions.forEach(r => {
        console.log(`      - ID: ${r.id}, Status: ${r.status}, Amount: ${r.shareAmount}`);
      });
    }
    console.log("");

    if (!check1Passed) allPassed = false;

    // ==================== CHECK 2: Database Position Sum ====================
    console.log("📊 CHECK 2: Database Position Sum");
    const allPositions = await db.select().from(positions);
    
    const totalDbAmount = allPositions.reduce((sum, pos) => {
      return sum + parseFloat(pos.amount);
    }, 0);

    const check2Passed = Math.abs(totalDbAmount - parseFloat(EXPECTED_DB_BALANCE)) < 0.01;
    results.push({
      check: "Database Position Sum",
      expected: `${EXPECTED_DB_BALANCE} shXRP`,
      actual: `${totalDbAmount.toFixed(2)} shXRP`,
      passed: check2Passed,
      details: allPositions.map(p => ({
        id: p.id,
        walletAddress: p.walletAddress,
        amount: p.amount,
        vaultId: p.vaultId
      }))
    });

    console.log(`   Expected: ${EXPECTED_DB_BALANCE} shXRP`);
    console.log(`   Actual:   ${totalDbAmount.toFixed(2)} shXRP`);
    console.log(`   Status:   ${check2Passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");

    if (!check2Passed) allPassed = false;

    // ==================== CHECK 3: Test Position Exists and Has Correct Amount ====================
    console.log("📊 CHECK 3: Test Position Validation");
    const testPosition = allPositions.find(p => p.id === TEST_POSITION_ID);
    
    if (!testPosition) {
      console.log(`   ❌ Test position ${TEST_POSITION_ID} not found`);
      results.push({
        check: "Test Position Exists",
        expected: `Position ${TEST_POSITION_ID} exists`,
        actual: "Position not found",
        passed: false
      });
      allPassed = false;
    } else {
      const testAmountMatches = Math.abs(parseFloat(testPosition.amount) - parseFloat(EXPECTED_TEST_AMOUNT)) < 0.01;
      results.push({
        check: "Test Position Amount",
        expected: `${EXPECTED_TEST_AMOUNT} shXRP`,
        actual: `${testPosition.amount} shXRP`,
        passed: testAmountMatches,
        details: { id: testPosition.id, walletAddress: testPosition.walletAddress }
      });

      console.log(`   Position ID: ${TEST_POSITION_ID}`);
      console.log(`   Expected Amount: ${EXPECTED_TEST_AMOUNT} shXRP`);
      console.log(`   Actual Amount:   ${testPosition.amount} shXRP`);
      console.log(`   Wallet: ${testPosition.walletAddress}`);
      console.log(`   Status: ${testAmountMatches ? "✅ PASS" : "❌ FAIL"}`);

      if (!testAmountMatches) allPassed = false;
    }
    console.log("");

    // ==================== CHECK 4: Main Position Exists and Has Correct Amount ====================
    console.log("📊 CHECK 4: Main Position Validation");
    const mainPosition = allPositions.find(p => p.id === MAIN_POSITION_ID);
    
    if (!mainPosition) {
      console.log(`   ❌ Main position ${MAIN_POSITION_ID} not found`);
      results.push({
        check: "Main Position Exists",
        expected: `Position ${MAIN_POSITION_ID} exists`,
        actual: "Position not found",
        passed: false
      });
      allPassed = false;
    } else {
      const mainAmountMatches = Math.abs(parseFloat(mainPosition.amount) - parseFloat(EXPECTED_MAIN_AMOUNT)) < 0.01;
      results.push({
        check: "Main Position Amount",
        expected: `${EXPECTED_MAIN_AMOUNT} shXRP`,
        actual: `${mainPosition.amount} shXRP`,
        passed: mainAmountMatches,
        details: { id: mainPosition.id, walletAddress: mainPosition.walletAddress }
      });

      console.log(`   Position ID: ${MAIN_POSITION_ID}`);
      console.log(`   Expected Amount: ${EXPECTED_MAIN_AMOUNT} shXRP`);
      console.log(`   Actual Amount:   ${mainPosition.amount} shXRP`);
      console.log(`   Wallet: ${mainPosition.walletAddress}`);
      console.log(`   Status: ${mainAmountMatches ? "✅ PASS" : "❌ FAIL"}`);

      if (!mainAmountMatches) allPassed = false;
    }
    console.log("");

    // ==================== CHECK 5: Only 2 Positions Exist ====================
    console.log("📊 CHECK 5: Position Count");
    const expectedCount = 2;
    const actualCount = allPositions.length;
    const countMatches = actualCount === expectedCount;

    results.push({
      check: "Position Count",
      expected: `${expectedCount} positions`,
      actual: `${actualCount} positions`,
      passed: countMatches
    });

    console.log(`   Expected: ${expectedCount} positions`);
    console.log(`   Actual:   ${actualCount} positions`);
    console.log(`   Status:   ${countMatches ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");

    if (!countMatches) {
      console.log(`   📋 All Positions in Database:`);
      allPositions.forEach(p => {
        console.log(`      - ID: ${p.id}`);
        console.log(`        Wallet: ${p.walletAddress}`);
        console.log(`        Amount: ${p.amount} shXRP`);
        console.log("");
      });
      allPassed = false;
    }

    // ==================== SUMMARY ====================
    console.log("=".repeat(60));
    console.log("📊 DATABASE VALIDATION SUMMARY");
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
      console.log("✅ ALL DATABASE VALIDATION CHECKS PASSED");
      console.log("");
      console.log("📝 Current Database State:");
      console.log(`   Total Positions: ${actualCount}`);
      console.log(`   Total Balance:   ${totalDbAmount.toFixed(2)} shXRP`);
      console.log("");
      console.log("📋 Position Details:");
      allPositions.forEach(p => {
        console.log(`   • ${p.id}`);
        console.log(`     Amount: ${p.amount} shXRP`);
        console.log(`     Wallet: ${p.walletAddress}`);
      });
      console.log("");
      console.log("✅ Ready to proceed with reconciliation");
      console.log("   The SQL migration will:");
      console.log(`   1. Delete test position (${TEST_POSITION_ID}): -${EXPECTED_TEST_AMOUNT} shXRP`);
      console.log(`   2. Update main position (${MAIN_POSITION_ID}): ${EXPECTED_MAIN_AMOUNT} → 225 shXRP`);
      console.log(`   3. Create audit record with vault mint TX`);
      console.log("");
    } else {
      console.log("❌ DATABASE VALIDATION FAILED");
      console.log("   Please review failed checks above before proceeding");
    }
    console.log("=".repeat(60));

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error("❌ Validation Error:", error);
    process.exit(1);
  }
}

// Run validation
runDatabaseValidation().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
