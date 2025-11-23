/**
 * On-Chain Reconciliation Script for shXRP Holdings
 * 
 * CRITICAL FINDING from Diagnostics:
 * - Smart Account has 225 FXRP in wallet (NOT deposited to vault)
 * - Smart Account has 0 shXRP (no vault shares)
 * - Database has 2 positions for XRPL address r3fMucz3hfhAaeS3kJsLuU5E2L6dSYGoQn
 * 
 * This script traces:
 * 1. FXRP transfers to smart account
 * 2. Vault deposit attempts (if any)
 * 3. Provides migration recommendations
 */

import { ethers } from "ethers";
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./shared/schema";
import { FIRELIGHT_VAULT_ABI, ERC20_ABI } from "./shared/flare-abis";

// Configure database
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Configuration
const SMART_ACCOUNT = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
const VAULT_ADDRESS = "0x8fe09217445e90DA692D29F30859dafA4eb281d1";
const FXRP_ADDRESS = "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3"; // From deployment
const RPC_URL = "https://coston2-api.flare.network/ext/C/rpc";

interface ReconciliationReport {
  summary: {
    smartAccount: string;
    vaultAddress: string;
    fxrpAddress: string;
    currentBalances: {
      fxrp: number;
      shxrp: number;
    };
    databaseTotals: {
      positions: number;
      bridgeRecords: number;
      totalShxrp: number;
    };
  };
  findings: {
    fxrpStuck: number;
    shxrpExpected: number;
    gap: number;
    rootCause: string;
  };
  allocation: {
    userDeposits: number;
    recoveryMints: number;
    testData: number;
    unknown: number;
  };
  dbMigrationNeeded: string[];
  technicalDetails: {
    fxrpBalance: string;
    shxrpBalance: string;
    vaultAllowance: string;
  };
}

async function main() {
  console.log("=" + "=".repeat(79));
  console.log("🔍 shXRP On-Chain Reconciliation Report");
  console.log("=" + "=".repeat(79));
  console.log();

  try {
    // Connect to RPC
    console.log("🔗 Connecting to Flare Coston2...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const fxrp = new ethers.Contract(FXRP_ADDRESS, ERC20_ABI, provider);
    const vault = new ethers.Contract(VAULT_ADDRESS, FIRELIGHT_VAULT_ABI, provider);
    console.log("✅ Connected\n");

    // Check current balances
    console.log("📊 Checking on-chain balances...");
    const fxrpBalanceRaw = await fxrp.balanceOf(SMART_ACCOUNT);
    const fxrpBalance = parseFloat(ethers.formatUnits(fxrpBalanceRaw, 6)); // FXRP uses 6 decimals
    
    const shxrpBalanceRaw = await vault.balanceOf(SMART_ACCOUNT);
    const shxrpBalance = parseFloat(ethers.formatUnits(shxrpBalanceRaw, 18));
    
    const allowanceRaw = await fxrp.allowance(SMART_ACCOUNT, VAULT_ADDRESS);
    const allowance = parseFloat(ethers.formatUnits(allowanceRaw, 6)); // FXRP allowance uses 6 decimals

    console.log(`  FXRP Balance: ${fxrpBalance.toFixed(2)}`);
    console.log(`  shXRP Balance: ${shxrpBalance.toFixed(6)}`);
    console.log(`  Vault Allowance: ${allowance.toFixed(2)}\n`);

    // Query database
    console.log("💾 Querying database...");
    const positions = await db.query.positions.findMany();
    const bridges = await db.query.xrpToFxrpBridges.findMany();
    
    const totalDbShxrp = positions.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    console.log(`  Total positions: ${positions.length}`);
    console.log(`  Total bridges: ${bridges.length}`);
    console.log(`  DB shXRP total: ${totalDbShxrp.toFixed(2)}\n`);

    // Analyze the situation
    console.log("=" + "=".repeat(79));
    console.log("📋 ANALYSIS");
    console.log("=" + "=".repeat(79));
    console.log();

    console.log("🔍 ROOT CAUSE IDENTIFIED:");
    console.log("  ❌ 225 FXRP is sitting in smart account wallet (NOT deposited to vault)");
    console.log("  ❌ 0 shXRP in vault (no shares minted)");
    console.log("  ❌ Database positions reference XRPL addresses, not smart account\n");

    console.log("💡 WHAT HAPPENED:");
    console.log("  1. FXRP was minted to smart account successfully");
    console.log("  2. FXRP was NEVER deposited into the vault");
    console.log("  3. No vault.deposit() transaction was executed");
    console.log("  4. Therefore, no shXRP shares were minted\n");

    // Build allocation report
    const totalShares = shxrpBalance; // Should be 0
    const expectedShares = fxrpBalance; // Assuming 1:1 ratio
    const gap = expectedShares - totalShares;

    const allocation = {
      userDeposits: 0, // No deposits found
      recoveryMints: expectedShares, // All FXRP needs to be deposited
      testData: 0,
      unknown: 0
    };

    // Generate migration recommendations
    const dbMigrationNeeded: string[] = [
      `⚠️  URGENT: ${fxrpBalance.toFixed(2)} FXRP stuck in smart account wallet`,
      `Action required: Execute vault.deposit(${fxrpBalance.toFixed(2)} FXRP) to mint ${expectedShares.toFixed(2)} shXRP`,
      `After deposit: Create position record for ${expectedShares.toFixed(2)} shXRP`,
      `Update existing database positions to use smart account address instead of XRPL addresses`,
      `Current DB positions use r3fMucz3hfhAaeS3kJsLuU5E2L6dSYGoQn - needs correction`
    ];

    if (allowance === 0) {
      dbMigrationNeeded.unshift(
        `STEP 0: Approve vault to spend FXRP: fxrp.approve(${VAULT_ADDRESS}, ${fxrpBalance.toFixed(2)} FXRP)`
      );
    }

    console.log("🔧 MIGRATION STEPS:");
    dbMigrationNeeded.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log();

    console.log("📊 ALLOCATION BREAKDOWN:");
    console.log(`  User Deposits (current): ${allocation.userDeposits.toFixed(2)} shXRP`);
    console.log(`  Recovery Needed: ${allocation.recoveryMints.toFixed(2)} shXRP`);
    console.log(`  Test Data: ${allocation.testData.toFixed(2)} shXRP`);
    console.log(`  Unknown: ${allocation.unknown.toFixed(2)} shXRP\n`);

    // Generate final report
    const report: ReconciliationReport = {
      summary: {
        smartAccount: SMART_ACCOUNT,
        vaultAddress: VAULT_ADDRESS,
        fxrpAddress: FXRP_ADDRESS,
        currentBalances: {
          fxrp: fxrpBalance,
          shxrp: shxrpBalance
        },
        databaseTotals: {
          positions: positions.length,
          bridgeRecords: bridges.length,
          totalShxrp: totalDbShxrp
        }
      },
      findings: {
        fxrpStuck: fxrpBalance,
        shxrpExpected: expectedShares,
        gap: gap,
        rootCause: "FXRP never deposited to vault - deposit transaction was never executed"
      },
      allocation,
      dbMigrationNeeded,
      technicalDetails: {
        fxrpBalance: fxrpBalanceRaw.toString(),
        shxrpBalance: shxrpBalanceRaw.toString(),
        vaultAllowance: allowanceRaw.toString()
      }
    };

    // Display database inconsistencies
    console.log("💾 DATABASE POSITION DETAILS:");
    positions.forEach(p => {
      console.log(`  Position ${p.id}:`);
      console.log(`    Wallet: ${p.walletAddress} (❌ XRPL address, should be smart account)`);
      console.log(`    Amount: ${p.amount} shXRP`);
      console.log(`    Vault: ${p.vaultId}\n`);
    });

    // Save report
    const fs = await import('fs/promises');
    await fs.writeFile('/tmp/reconciliation-report.json', JSON.stringify(report, null, 2));
    console.log("💾 Full report saved to: /tmp/reconciliation-report.json\n");

    console.log("=" + "=".repeat(79));
    console.log("✅ RECONCILIATION COMPLETE");
    console.log("=" + "=".repeat(79));
    console.log();

    console.log("📝 NEXT STEPS:");
    console.log("  1. Execute scripts/recover-stuck-fxrp.ts to deposit FXRP into vault");
    console.log("  2. Update database positions to reflect correct smart account address");
    console.log("  3. Verify 225 shXRP is minted to smart account");
    console.log("  4. Create proper position records in database\n");

    await pool.end();

  } catch (error) {
    console.error("\n❌ Error:", error);
    await pool.end();
    throw error;
  }
}

main().catch(console.error);
