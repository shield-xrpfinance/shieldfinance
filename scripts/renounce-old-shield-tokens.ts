import { ethers } from "ethers";
import ShieldTokenArtifact from "../artifacts/contracts/ShieldToken.sol/ShieldToken.json" assert { type: "json" };

/**
 * SHIELD Token Ownership Renouncement Script
 * 
 * Renounces ownership on deprecated SHIELD token deployments on Coston2 testnet:
 * - Old #1: 0xD6D476149D169fdA8e05f4EF5Da8a8f8c27a8308
 * - Old #2: 0x59fF3b7Ae628beEFFAe980F30240ec4e84448209
 * 
 * SAFETY: Will NOT renounce ownership on current/active contract:
 * - Current: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
 * 
 * Requirements:
 * - OPERATOR_PRIVATE_KEY environment variable must be set
 * - Signer must be the current owner of the contracts
 * 
 * Usage:
 * npx tsx scripts/renounce-old-shield-tokens.ts
 */

// Coston2 testnet configuration
const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const COSTON2_CHAIN_ID = 114;
const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";

// Zero address (renounced owner)
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// DEPRECATED contracts to renounce (DO NOT INCLUDE CURRENT/ACTIVE CONTRACT)
const DEPRECATED_CONTRACTS = [
  {
    label: "Old #1 (DEPRECATED - First Deployment)",
    address: "0xD6D476149D169fdA8e05f4EF5Da8a8f8c27a8308",
  },
  {
    label: "Old #2 (DEPRECATED - Second Deployment)",
    address: "0x59fF3b7Ae628beEFFAe980F30240ec4e84448209",
  },
];

// SAFETY: Current/active contract that must NOT be renounced
const ACTIVE_CONTRACT = "0x07F943F173a6bE5EC63a8475597d28aAA6B24992";

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Truncate transaction hash for display
 */
function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * Renounce ownership on a single deprecated SHIELD token contract
 */
async function renounceContract(
  wallet: ethers.Wallet,
  label: string,
  address: string,
  contractNumber: number
): Promise<boolean> {
  console.log("\n" + "=".repeat(80));
  console.log(`Contract #${contractNumber}: ${address}`);
  console.log("=".repeat(80));

  try {
    // Create contract instance with signer
    const contract = new ethers.Contract(address, ShieldTokenArtifact.abi, wallet);

    // Check current owner
    console.log("\n📍 Pre-Renouncement Status:");
    const currentOwner = await contract.owner();
    console.log(`   Current Owner: ${currentOwner}`);
    console.log(`   Current Owner (truncated): ${truncateAddress(currentOwner)}`);

    // Verify owner is not already renounced
    if (currentOwner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      console.log("\n✅ Ownership already renounced!");
      console.log(`   Owner is already: ${ZERO_ADDRESS}`);
      return true;
    }

    // Verify signer is the current owner
    const signerAddress = await wallet.getAddress();
    if (currentOwner.toLowerCase() !== signerAddress.toLowerCase()) {
      console.log("\n❌ SAFETY CHECK FAILED:");
      console.log(`   Signer (${truncateAddress(signerAddress)}) is NOT the owner!`);
      console.log(`   Current owner: ${truncateAddress(currentOwner)}`);
      console.log(`   Cannot proceed with renouncement.`);
      return false;
    }

    console.log(`   Signer: ${truncateAddress(signerAddress)} ✓`);
    console.log(`   ✅ Signer confirmed as current owner`);

    // Renounce ownership
    console.log("\n🔒 Renouncing ownership...");
    const tx = await contract.renounceOwnership();
    console.log(`   ✅ Transaction sent: ${tx.hash}`);
    console.log(`   Transaction (truncated): ${truncateTxHash(tx.hash)}`);

    // Wait for confirmation
    console.log(`   ⏳ Waiting for confirmation...`);
    const receipt = await tx.wait();
    console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Verify new owner is zero address
    console.log("\n🔍 Post-Renouncement Verification:");
    const newOwner = await contract.owner();
    console.log(`   New Owner: ${newOwner}`);

    if (newOwner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      console.log(`   ✅ Ownership successfully renounced!`);
      console.log(`   Owner is now: ${ZERO_ADDRESS}`);
    } else {
      console.log(`   ❌ WARNING: Owner is not zero address!`);
      console.log(`   Unexpected owner: ${newOwner}`);
      return false;
    }

    // Display explorer link
    console.log("\n🔗 Explorer Links:");
    console.log(`   Contract: ${COSTON2_EXPLORER}/address/${address}`);
    console.log(`   Transaction: ${COSTON2_EXPLORER}/tx/${tx.hash}`);

    return true;

  } catch (error: any) {
    console.log("\n❌ ERROR RENOUNCING OWNERSHIP:");
    console.log(`   ${error.message}`);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    if (error.reason) {
      console.log(`   Reason: ${error.reason}`);
    }
    return false;
  }
}

/**
 * Main renouncement function
 */
async function main() {
  console.log("\n🔒 Renouncing Ownership on Deprecated SHIELD Tokens");
  console.log("=".repeat(80));
  console.log(`Network: Coston2 Testnet (Chain ID: ${COSTON2_CHAIN_ID})`);
  console.log(`RPC: ${COSTON2_RPC}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("=".repeat(80));

  // Check for OPERATOR_PRIVATE_KEY
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!privateKey) {
    console.error("\n❌ FATAL ERROR:");
    console.error("   OPERATOR_PRIVATE_KEY environment variable is not set!");
    console.error("   Please set the environment variable and try again.");
    console.error("\n   Example:");
    console.error("   export OPERATOR_PRIVATE_KEY=0x...");
    process.exit(1);
  }

  // Connect to Coston2
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC, COSTON2_CHAIN_ID);

  try {
    // Verify connection
    const network = await provider.getNetwork();
    console.log(`\n✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey, provider);
    const signerAddress = await wallet.getAddress();
    console.log(`✅ Wallet loaded: ${signerAddress}`);
    console.log(`   Wallet (truncated): ${truncateAddress(signerAddress)}`);

    // Check wallet balance (need gas for transactions)
    const balance = await provider.getBalance(signerAddress);
    const balanceFormatted = ethers.formatEther(balance);
    console.log(`   Balance: ${balanceFormatted} C2FLR`);

    if (balance === 0n) {
      console.warn("\n⚠️  WARNING: Wallet has zero balance!");
      console.warn("   You may not have enough gas to execute transactions.");
    }

    // Safety check: Verify we're not accidentally targeting the active contract
    console.log("\n🛡️  Safety Check:");
    console.log(`   Active Contract (DO NOT RENOUNCE): ${ACTIVE_CONTRACT}`);
    
    for (const contract of DEPRECATED_CONTRACTS) {
      if (contract.address.toLowerCase() === ACTIVE_CONTRACT.toLowerCase()) {
        console.error("\n❌ FATAL ERROR:");
        console.error("   Active contract found in deprecated list!");
        console.error(`   Contract: ${contract.address}`);
        console.error("   Aborting to prevent accidental renouncement.");
        process.exit(1);
      }
    }
    console.log(`   ✅ No active contract in renouncement list`);

    console.log("\n📋 Contracts to Renounce:");
    DEPRECATED_CONTRACTS.forEach((contract, index) => {
      console.log(`   ${index + 1}. ${contract.label}`);
      console.log(`      ${contract.address}`);
    });

    // Renounce each deprecated contract
    const results: boolean[] = [];
    for (let i = 0; i < DEPRECATED_CONTRACTS.length; i++) {
      const contract = DEPRECATED_CONTRACTS[i];
      const success = await renounceContract(
        wallet,
        contract.label,
        contract.address,
        i + 1
      );
      results.push(success);
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📝 RENOUNCEMENT SUMMARY");
    console.log("=".repeat(80));

    const successCount = results.filter(r => r).length;
    const failureCount = results.filter(r => !r).length;

    console.log(`\nTotal Contracts Processed: ${DEPRECATED_CONTRACTS.length}`);
    console.log(`✅ Successfully Renounced: ${successCount}`);
    if (failureCount > 0) {
      console.log(`❌ Failed to Renounce: ${failureCount}`);
    }

    console.log("\nContract Status:");
    DEPRECATED_CONTRACTS.forEach((contract, index) => {
      const status = results[index] ? "✅ Renounced" : "❌ Failed";
      console.log(`   ${index + 1}. ${status} - ${contract.address}`);
    });

    console.log("\n" + "=".repeat(80));
    if (successCount === DEPRECATED_CONTRACTS.length) {
      console.log("✅ All deprecated contracts have been renounced!");
    } else {
      console.log("⚠️  Some contracts failed to renounce. Please review errors above.");
    }
    console.log("=".repeat(80) + "\n");

    // Exit with appropriate code
    if (failureCount > 0) {
      process.exit(1);
    }

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

// Execute renouncement
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Unhandled error:", error);
    process.exit(1);
  });
