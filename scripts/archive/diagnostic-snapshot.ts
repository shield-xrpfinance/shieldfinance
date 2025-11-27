import { ethers } from "ethers";
import { FlareClient } from "../server/utils/flare-client";
import { db } from "../server/db";
import { positions, fxrpToXrpRedemptions, transactions } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

interface OnChainData {
  smartAccountAddress: string;
  cflrBalance: string;
  fxrpBalance: string;
  shxrpBalance: string;
  vaultFxrpLiquidity: string;
  vaultAddress: string;
  timestamp: string;
}

interface DatabaseData {
  positions: Array<{
    id: string;
    walletAddress: string;
    vaultId: string;
    amount: string;
    createdAt: Date;
  }>;
  redemptions: Array<{
    id: string;
    status: string;
    shareAmount: string | null;
    fxrpRedeemed: string | null;
    xrplPayoutTxHash: string | null;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: string;
    status: string;
    txHash: string | null;
  }>;
  transactionSummary: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

interface ComparisonReport {
  totalShxrpInDb: string;
  onChainShxrpBalance: string;
  shxrpDiscrepancy: string;
  shxrpDiscrepancyPercent: number;
  fxrpStuckInSmartAccount: string;
  shouldBeZero: boolean;
  completedRedemptions: number;
  redemptionsWithXrplTx: number;
  orphanedRedemptions: number;
  issues: string[];
}

interface DiagnosticSnapshot {
  timestamp: string;
  network: string;
  onChainData: OnChainData;
  databaseData: DatabaseData;
  comparisonReport: ComparisonReport;
}

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function printSection(title: string) {
  console.log(`\n${BOLD}${BLUE}${'='.repeat(80)}${RESET}`);
  console.log(`${BOLD}${BLUE}${title}${RESET}`);
  console.log(`${BOLD}${BLUE}${'='.repeat(80)}${RESET}\n`);
}

function printSubSection(title: string) {
  console.log(`\n${BOLD}${CYAN}${title}${RESET}`);
  console.log(`${CYAN}${'-'.repeat(60)}${RESET}`);
}

function printError(message: string) {
  console.log(`${RED}❌ ${message}${RESET}`);
}

function printWarning(message: string) {
  console.log(`${YELLOW}⚠️  ${message}${RESET}`);
}

function printSuccess(message: string) {
  console.log(`${GREEN}✅ ${message}${RESET}`);
}

function printInfo(label: string, value: string | number) {
  console.log(`   ${label}: ${BOLD}${value}${RESET}`);
}

async function collectOnChainData(flareClient: FlareClient, vaultAddress: string): Promise<OnChainData> {
  printSubSection("Collecting On-Chain Data");
  
  try {
    const smartAccountAddress = flareClient.getSignerAddress();
    printInfo("Smart Account Address", smartAccountAddress);
    
    const cflrBalance = await flareClient.getBalance(smartAccountAddress);
    printInfo("CFLR Balance", `${cflrBalance} CFLR`);
    
    const fxrpToken = await flareClient.getFXRPToken();
    const fxrpBalanceRaw = await fxrpToken.balanceOf(smartAccountAddress);
    const fxrpBalance = ethers.formatUnits(fxrpBalanceRaw, 6);
    printInfo("FXRP Balance", `${fxrpBalance} FXRP`);
    
    const vault = flareClient.getShXRPVault(vaultAddress);
    const shxrpBalanceRaw = await vault.balanceOf(smartAccountAddress);
    const shxrpBalance = ethers.formatUnits(shxrpBalanceRaw, 6);
    printInfo("shXRP Balance", `${shxrpBalance} shXRP`);
    
    const vaultFxrpBalanceRaw = await fxrpToken.balanceOf(vaultAddress);
    const vaultFxrpLiquidity = ethers.formatUnits(vaultFxrpBalanceRaw, 6);
    printInfo("Vault FXRP Liquidity", `${vaultFxrpLiquidity} FXRP`);
    
    return {
      smartAccountAddress,
      cflrBalance,
      fxrpBalance,
      shxrpBalance,
      vaultFxrpLiquidity,
      vaultAddress,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    printError(`Failed to collect on-chain data: ${error}`);
    throw error;
  }
}

async function collectDatabaseData(): Promise<DatabaseData> {
  printSubSection("Collecting Database Data");
  
  try {
    const allPositions = await db.select().from(positions);
    printInfo("Total Positions", allPositions.length);
    
    const allRedemptions = await db.select().from(fxrpToXrpRedemptions);
    printInfo("Total Redemptions", allRedemptions.length);
    
    const allTransactions = await db.select().from(transactions);
    printInfo("Total Transactions", allTransactions.length);
    
    const transactionSummary = {
      total: allTransactions.length,
      byType: allTransactions.reduce((acc, tx) => {
        acc[tx.type] = (acc[tx.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: allTransactions.reduce((acc, tx) => {
        acc[tx.status] = (acc[tx.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
    
    console.log("\n   Transaction Breakdown:");
    console.log(`     By Type: ${JSON.stringify(transactionSummary.byType, null, 2).split('\n').join('\n     ')}`);
    console.log(`     By Status: ${JSON.stringify(transactionSummary.byStatus, null, 2).split('\n').join('\n     ')}`);
    
    return {
      positions: allPositions.map(p => ({
        id: p.id,
        walletAddress: p.walletAddress,
        vaultId: p.vaultId,
        amount: p.amount,
        createdAt: p.createdAt,
      })),
      redemptions: allRedemptions.map(r => ({
        id: r.id,
        status: r.status,
        shareAmount: r.shareAmount,
        fxrpRedeemed: r.fxrpRedeemed,
        xrplPayoutTxHash: r.xrplPayoutTxHash,
      })),
      transactions: allTransactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        txHash: t.txHash,
      })),
      transactionSummary,
    };
  } catch (error) {
    printError(`Failed to collect database data: ${error}`);
    throw error;
  }
}

function generateComparisonReport(
  onChain: OnChainData,
  dbData: DatabaseData
): ComparisonReport {
  printSubSection("Generating Comparison Report");
  
  const issues: string[] = [];
  
  const totalShxrpInDb = dbData.positions
    .reduce((sum, pos) => sum + parseFloat(pos.amount), 0)
    .toFixed(6);
  
  const onChainShxrpBalance = onChain.shxrpBalance;
  
  const shxrpDiscrepancy = (
    parseFloat(totalShxrpInDb) - parseFloat(onChainShxrpBalance)
  ).toFixed(6);
  
  const shxrpDiscrepancyPercent = parseFloat(onChainShxrpBalance) > 0
    ? (parseFloat(shxrpDiscrepancy) / parseFloat(onChainShxrpBalance)) * 100
    : 0;
  
  if (Math.abs(parseFloat(shxrpDiscrepancy)) > 0.01) {
    issues.push(
      `shXRP balance mismatch: DB shows ${totalShxrpInDb} but on-chain is ${onChainShxrpBalance} (diff: ${shxrpDiscrepancy})`
    );
  }
  
  const fxrpStuckInSmartAccount = onChain.fxrpBalance;
  const shouldBeZero = parseFloat(fxrpStuckInSmartAccount) === 0;
  
  if (!shouldBeZero && parseFloat(fxrpStuckInSmartAccount) > 0.01) {
    issues.push(
      `FXRP stuck in smart account: ${fxrpStuckInSmartAccount} FXRP should be deposited to vault`
    );
  }
  
  const completedRedemptions = dbData.redemptions.filter(
    r => r.status === 'completed'
  ).length;
  
  const redemptionsWithXrplTx = dbData.redemptions.filter(
    r => r.status === 'completed' && r.xrplPayoutTxHash
  ).length;
  
  const orphanedRedemptions = completedRedemptions - redemptionsWithXrplTx;
  
  if (orphanedRedemptions > 0) {
    issues.push(
      `${orphanedRedemptions} redemptions marked "completed" but missing XRPL payout transaction hash`
    );
  }
  
  const redeemedButNotPaid = dbData.redemptions.filter(
    r => r.fxrpRedeemed && parseFloat(r.fxrpRedeemed) > 0 && !r.xrplPayoutTxHash
  ).length;
  
  if (redeemedButNotPaid > 0) {
    issues.push(
      `${redeemedButNotPaid} redemptions have redeemed FXRP but no XRPL payout recorded`
    );
  }
  
  console.log("\n   Comparisons:");
  printInfo("Total shXRP in DB", totalShxrpInDb);
  printInfo("On-Chain shXRP Balance", onChainShxrpBalance);
  
  if (Math.abs(parseFloat(shxrpDiscrepancy)) > 0.01) {
    printError(`Discrepancy: ${shxrpDiscrepancy} (${shxrpDiscrepancyPercent.toFixed(2)}%)`);
  } else {
    printSuccess(`Discrepancy: ${shxrpDiscrepancy} (within tolerance)`);
  }
  
  console.log();
  printInfo("FXRP in Smart Account", fxrpStuckInSmartAccount);
  
  if (shouldBeZero) {
    printSuccess("All FXRP properly deposited to vault");
  } else if (parseFloat(fxrpStuckInSmartAccount) > 0.01) {
    printError(`${fxrpStuckInSmartAccount} FXRP stuck in smart account`);
  } else {
    printWarning(`Small amount of FXRP in smart account (dust: ${fxrpStuckInSmartAccount})`);
  }
  
  console.log();
  printInfo("Completed Redemptions", completedRedemptions);
  printInfo("Redemptions with XRPL TX", redemptionsWithXrplTx);
  
  if (orphanedRedemptions > 0) {
    printError(`Orphaned Redemptions: ${orphanedRedemptions}`);
  } else {
    printSuccess("No orphaned redemptions");
  }
  
  return {
    totalShxrpInDb,
    onChainShxrpBalance,
    shxrpDiscrepancy,
    shxrpDiscrepancyPercent,
    fxrpStuckInSmartAccount,
    shouldBeZero,
    completedRedemptions,
    redemptionsWithXrplTx,
    orphanedRedemptions,
    issues,
  };
}

function saveSnapshot(snapshot: DiagnosticSnapshot) {
  printSubSection("Saving Snapshot");
  
  const diagnosticsDir = path.join(process.cwd(), "diagnostics");
  
  if (!fs.existsSync(diagnosticsDir)) {
    fs.mkdirSync(diagnosticsDir, { recursive: true });
    printInfo("Created directory", diagnosticsDir);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `snapshot-${timestamp}.json`;
  const filepath = path.join(diagnosticsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  
  printSuccess(`Snapshot saved to: ${filepath}`);
  printInfo("File size", `${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
}

function printSummary(report: ComparisonReport) {
  printSection("DIAGNOSTIC SUMMARY");
  
  if (report.issues.length === 0) {
    printSuccess("No issues detected! System is healthy.");
  } else {
    printError(`${report.issues.length} issue(s) detected:\n`);
    
    report.issues.forEach((issue, index) => {
      console.log(`${RED}${BOLD}${index + 1}.${RESET} ${RED}${issue}${RESET}`);
    });
  }
  
  console.log();
}

async function main() {
  const network = process.env.FLARE_NETWORK || "coston2";
  const privateKey = process.env.SMART_ACCOUNT_PRIVATE_KEY;
  const bundlerApiKey = process.env.PIMLICO_API_KEY;
  
  printSection("DIAGNOSTIC SNAPSHOT - XRP LIQUID STAKING PROTOCOL");
  
  console.log(`${BOLD}Network:${RESET} ${network}`);
  console.log(`${BOLD}Timestamp:${RESET} ${new Date().toISOString()}`);
  
  if (!privateKey || !bundlerApiKey) {
    printError("Missing required environment variables:");
    if (!privateKey) printError("  - SMART_ACCOUNT_PRIVATE_KEY");
    if (!bundlerApiKey) printError("  - PIMLICO_API_KEY");
    process.exit(1);
  }
  
  const vaultAddress = "0xeBb4a977492241B06A2423710c03BB63B2c5990e";
  
  try {
    printSection("INITIALIZING FLARE CLIENT");
    
    const flareClient = new FlareClient({
      network: network as "mainnet" | "coston2",
      privateKey,
      bundlerApiKey,
      enablePaymaster: true,
    });
    
    await flareClient.initialize();
    printSuccess("FlareClient initialized successfully");
    
    printSection("DATA COLLECTION");
    
    const onChainData = await collectOnChainData(flareClient, vaultAddress);
    const databaseData = await collectDatabaseData();
    
    printSection("ANALYSIS");
    
    const comparisonReport = generateComparisonReport(onChainData, databaseData);
    
    const snapshot: DiagnosticSnapshot = {
      timestamp: new Date().toISOString(),
      network,
      onChainData,
      databaseData,
      comparisonReport,
    };
    
    saveSnapshot(snapshot);
    printSummary(comparisonReport);
    
    printSection("SNAPSHOT COMPLETE");
    printSuccess("Diagnostic snapshot completed successfully");
    
    if (comparisonReport.issues.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    printSection("ERROR");
    printError(`Snapshot failed: ${error}`);
    
    if (error instanceof Error) {
      console.log(`\n${RED}${error.stack}${RESET}`);
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`${RED}Fatal error:${RESET}`, error);
    process.exit(1);
  });
