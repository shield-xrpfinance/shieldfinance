import { ethers } from "ethers";
import ShieldTokenArtifact from "../artifacts/contracts/ShieldToken.sol/ShieldToken.json" assert { type: "json" };

/**
 * SHIELD Token Audit Script
 * 
 * Audits all three SHIELD token deployments on Coston2 testnet:
 * - Old #1: 0xD6D476149D169fdA8e05f4EF5Da8a8f8c27a8308
 * - Old #2: 0x59fF3b7Ae628beEFFAe980F30240ec4e84448209
 * - Current: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
 * 
 * Checks:
 * - Total supply
 * - Owner address
 * - Deployer balance
 * - Ownership renouncement status
 * - Contract name and symbol
 */

// Coston2 testnet configuration
const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const COSTON2_CHAIN_ID = 114;
const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";

// Contract addresses
const SHIELD_CONTRACTS = [
  {
    label: "Old #1 (DEPRECATED - First Deployment)",
    address: "0xD6D476149D169fdA8e05f4EF5Da8a8f8c27a8308",
    expectedSupply: "100000000", // 100M
  },
  {
    label: "Old #2 (DEPRECATED - Second Deployment)",
    address: "0x59fF3b7Ae628beEFFAe980F30240ec4e84448209",
    expectedSupply: "100000000", // 100M
  },
  {
    label: "Current (ACTIVE Deployment)",
    address: "0x07F943F173a6bE5EC63a8475597d28aAA6B24992",
    expectedSupply: "100000000", // 100M (actual deployed supply)
  },
];

// Deployer address
const DEPLOYER_ADDRESS = "0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D";

// Zero address for renouncement check
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Format token amount with proper decimals
 */
function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const formatted = ethers.formatUnits(amount, decimals);
  // Add thousand separators
  const parts = formatted.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Audit a single SHIELD token contract
 */
async function auditContract(
  provider: ethers.Provider,
  label: string,
  address: string,
  expectedSupply: string
): Promise<void> {
  console.log("\n" + "=".repeat(80));
  console.log(`📊 ${label}`);
  console.log("=".repeat(80));

  try {
    // Create contract instance
    const contract = new ethers.Contract(address, ShieldTokenArtifact.abi, provider);

    // Fetch contract data
    const [name, symbol, totalSupply, owner, decimals, deployerBalance] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.totalSupply(),
      contract.owner(),
      contract.decimals(),
      contract.balanceOf(DEPLOYER_ADDRESS),
    ]);

    // Calculate expected supply in wei
    const expectedSupplyWei = ethers.parseUnits(expectedSupply, decimals);
    const supplyMatches = totalSupply === expectedSupplyWei;
    const isRenounced = owner.toLowerCase() === ZERO_ADDRESS.toLowerCase();

    // Display basic info
    console.log("\n📍 Contract Information:");
    console.log(`   Address: ${address}`);
    console.log(`   Explorer: ${COSTON2_EXPLORER}/address/${address}`);
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);

    // Display supply info
    console.log("\n💰 Supply Information:");
    console.log(`   Total Supply: ${formatTokenAmount(totalSupply, decimals)} ${symbol}`);
    console.log(`   Expected: ${formatTokenAmount(expectedSupplyWei, decimals)} ${symbol}`);
    if (supplyMatches) {
      console.log(`   Status: ✅ Supply matches expected`);
    } else {
      console.log(`   Status: ⚠️  Supply mismatch!`);
    }

    // Display ownership info
    console.log("\n👤 Ownership Information:");
    console.log(`   Owner: ${owner}`);
    if (isRenounced) {
      console.log(`   Status: ✅ Ownership RENOUNCED`);
    } else {
      console.log(`   Status: ⚠️  Ownership NOT RENOUNCED`);
      console.log(`   Owner (truncated): ${truncateAddress(owner)}`);
    }

    // Display deployer balance
    console.log("\n💼 Deployer Balance:");
    console.log(`   Address: ${DEPLOYER_ADDRESS}`);
    console.log(`   Balance: ${formatTokenAmount(deployerBalance, decimals)} ${symbol}`);
    const balancePercentage = (Number(deployerBalance) / Number(totalSupply)) * 100;
    console.log(`   Percentage of Supply: ${balancePercentage.toFixed(2)}%`);

    // Overall status assessment
    console.log("\n🔍 Overall Status:");
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!supplyMatches) {
      issues.push("Total supply does not match expected value");
    }

    if (!isRenounced && label.includes("DEPRECATED")) {
      warnings.push("Deprecated contract ownership should be renounced");
    }

    if (!isRenounced && label.includes("ACTIVE")) {
      console.log("   ℹ️  Note: Active contract ownership not renounced (expected for operational control)");
    }

    if (deployerBalance === 0n && label.includes("ACTIVE")) {
      warnings.push("Active contract deployer has zero balance");
    }

    if (issues.length > 0) {
      console.log("   ❌ ISSUES FOUND:");
      issues.forEach((issue) => console.log(`      - ${issue}`));
    }

    if (warnings.length > 0) {
      console.log("   ⚠️  WARNINGS:");
      warnings.forEach((warning) => console.log(`      - ${warning}`));
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log("   ✅ No issues detected");
    }

  } catch (error: any) {
    console.log("\n❌ ERROR AUDITING CONTRACT:");
    console.log(`   ${error.message}`);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
  }
}

/**
 * Main audit function
 */
async function main() {
  console.log("\n🔍 SHIELD Token Audit Report");
  console.log("=".repeat(80));
  console.log(`Network: Coston2 Testnet (Chain ID: ${COSTON2_CHAIN_ID})`);
  console.log(`RPC: ${COSTON2_RPC}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Deployer Address: ${DEPLOYER_ADDRESS}`);
  console.log("=".repeat(80));

  // Connect to Coston2
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC, COSTON2_CHAIN_ID);

  try {
    // Verify connection
    const network = await provider.getNetwork();
    console.log(`\n✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Audit each contract
    for (const contract of SHIELD_CONTRACTS) {
      await auditContract(provider, contract.label, contract.address, contract.expectedSupply);
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📝 AUDIT SUMMARY");
    console.log("=".repeat(80));
    console.log(`\nTotal Contracts Audited: ${SHIELD_CONTRACTS.length}`);
    console.log("\nContract Addresses:");
    SHIELD_CONTRACTS.forEach((contract, index) => {
      console.log(`   ${index + 1}. ${contract.label}`);
      console.log(`      ${contract.address}`);
      console.log(`      ${COSTON2_EXPLORER}/address/${contract.address}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("✅ Audit Complete");
    console.log("=".repeat(80) + "\n");

  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:");
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute audit
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Unhandled error:", error);
    process.exit(1);
  });
