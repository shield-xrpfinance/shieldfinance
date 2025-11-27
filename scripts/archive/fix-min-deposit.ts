/**
 * Fix MinDeposit Script
 * 
 * This script updates the deployed ShXRPVault contract to use the correct
 * minDeposit value for FXRP's 6 decimal places (10000 instead of 0.01 ether).
 * 
 * Usage:
 *   tsx scripts/fix-min-deposit.ts
 */

import { ethers } from "ethers";

const VAULT_ABI = [
  "function minDeposit() view returns (uint256)",
  "function setMinDeposit(uint256 newMinDeposit) returns (bool)",
  "function owner() view returns (address)",
] as const;

async function main() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("ShXRPVault - Fix MinDeposit (6 decimals)");
  console.log("═══════════════════════════════════════════════════════\n");

  // Get vault address from environment
  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
  if (!vaultAddress) {
    throw new Error("VITE_SHXRP_VAULT_ADDRESS not set in environment");
  }

  console.log(`📍 Vault Address: ${vaultAddress}`);
  console.log(`🌐 Network: Coston2\n`);

  // Initialize wallet
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  // Connect to Coston2 network
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  const wallet = new ethers.Wallet(privateKey, provider);
  const signerAddress = wallet.address;
  
  console.log("🔐 Wallet Initialized");
  console.log(`✅ Deployer Address: ${signerAddress}\n`);

  // Connect to vault contract
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);

  // Check current owner
  const owner = await vault.owner();
  console.log(`👤 Vault Owner: ${owner}`);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.log(`⚠️  Warning: Deployer (${signerAddress}) is not the owner!`);
    console.log(`   This transaction will likely fail.\n`);
  } else {
    console.log(`✅ Deployer is the owner\n`);
  }

  // Check current minDeposit
  const currentMinDeposit = await vault.minDeposit();
  console.log("📊 Current State:");
  console.log(`   minDeposit (raw): ${currentMinDeposit.toString()}`);
  console.log(`   minDeposit (formatted): ${ethers.formatUnits(currentMinDeposit, 6)} FXRP`);
  
  const isCorrect = currentMinDeposit.toString() === "10000";
  if (isCorrect) {
    console.log(`   ✅ Already correct! (10000 = 0.01 FXRP with 6 decimals)\n`);
    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ No update needed - minDeposit is already correct");
    console.log("═══════════════════════════════════════════════════════\n");
    return;
  }

  console.log(`   ❌ Incorrect! (should be 10000 for 0.01 FXRP with 6 decimals)\n`);

  // Prepare the setMinDeposit transaction
  const newMinDeposit = 10000; // 0.01 FXRP with 6 decimals
  console.log("🔧 Updating minDeposit...");
  console.log(`   New value (raw): ${newMinDeposit}`);
  console.log(`   New value (formatted): ${ethers.formatUnits(newMinDeposit, 6)} FXRP\n`);

  // Connect vault contract with wallet
  const vaultWithSigner = vault.connect(wallet) as any;

  try {
    console.log("📤 Sending transaction...");
    const tx = await vaultWithSigner.setMinDeposit(newMinDeposit);
    console.log(`   Transaction submitted`);
    console.log(`   Waiting for confirmation...\n`);

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Transaction hash: ${receipt.hash}\n`);

    // Verify the update
    const updatedMinDeposit = await vault.minDeposit();
    console.log("📊 Updated State:");
    console.log(`   minDeposit (raw): ${updatedMinDeposit.toString()}`);
    console.log(`   minDeposit (formatted): ${ethers.formatUnits(updatedMinDeposit, 6)} FXRP`);

    const isNowCorrect = updatedMinDeposit.toString() === "10000";
    if (isNowCorrect) {
      console.log(`   ✅ Update successful!\n`);
      console.log("═══════════════════════════════════════════════════════");
      console.log("✅ SUCCESS - minDeposit updated to 10000 (0.01 FXRP)");
      console.log("═══════════════════════════════════════════════════════\n");
    } else {
      console.log(`   ❌ Update failed - value is still incorrect\n`);
      throw new Error(`MinDeposit is ${updatedMinDeposit.toString()}, expected 10000`);
    }

  } catch (error: any) {
    console.error("\n❌ Transaction failed:");
    if (error.reason) {
      console.error(`   Reason: ${error.reason}`);
    }
    if (error.data?.message) {
      console.error(`   Message: ${error.data.message}`);
    }
    console.error(`   Error: ${error.message}\n`);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Script failed:");
    console.error(error);
    process.exit(1);
  });
