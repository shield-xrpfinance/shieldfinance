import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import vault ABI
import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json" assert { type: "json" };

/**
 * Gelato Automation Script for FXRP Yield Auto-Compounding
 * 
 * This script is designed to be called by Gelato Network every 24 hours to:
 * 1. Claim rewards from SparkDEX LP staking
 * 2. Swap rewards to FXRP
 * 3. Auto-compound into shXRP exchange rate
 * 
 * For testnet: Uses simulateRewards() to demonstrate compounding
 * For production: Would call claimAndCompound() after implementing real reward harvesting
 */

async function main() {
  console.log("🔄 Starting FXRP Yield Auto-Compound...\n");

  // Load deployment info
  const deploymentFile = path.join(__dirname, "../deployments/coston2-deployment.json");
  if (!fs.existsSync(deploymentFile)) {
    throw new Error("Deployment file not found. Run deploy-direct.ts first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const vaultAddress = deployment.contracts.ShXRPVault.address;

  // Network configuration
  const rpcUrl = process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
  const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY environment variable is required");
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("📝 Operator address:", wallet.address);
  console.log("🏦 ShXRPVault address:", vaultAddress);

  // Connect to vault contract
  const vault = new ethers.Contract(
    vaultAddress,
    ShXRPVaultArtifact.abi,
    wallet
  );

  // Check if operator is authorized
  const isOperator = await vault.operators(wallet.address);
  const owner = await vault.owner();
  
  if (!isOperator && wallet.address !== owner) {
    throw new Error("Wallet is not an authorized operator or owner");
  }

  // Check if yield is enabled
  const yieldEnabled = await vault.yieldEnabled();
  if (!yieldEnabled) {
    console.log("⚠️  Yield generation is not enabled. Skipping compound.");
    console.log("   Call setYieldEnabled(true) on the vault to enable yield.\n");
    return;
  }

  // Get current vault state
  const exchangeRateBefore = await vault.exchangeRate();
  const totalSupply = await vault.totalSupply();
  const totalXRPLocked = await vault.totalXRPLocked();

  console.log("\n📊 Current Vault State:");
  console.log("   Exchange Rate:", ethers.formatEther(exchangeRateBefore), "shXRP per XRP");
  console.log("   Total shXRP Supply:", ethers.formatEther(totalSupply));
  console.log("   Total XRP Locked:", ethers.formatEther(totalXRPLocked));

  try {
    // In production, this would:
    // 1. Check LP staking contract for claimable rewards
    // 2. Call withdrawFromLP() if needed to realize gains
    // 3. Call swapToFXRP() to convert rewards
    // 4. Call claimAndCompound() to update exchange rate

    // For testnet demo: Call claimAndCompound() which checks for idle FXRP rewards
    console.log("\n🔄 Calling claimAndCompound()...");
    
    const tx = await vault.claimAndCompound();
    const receipt = await tx.wait();
    
    console.log("✅ Transaction successful!");
    console.log("   Tx Hash:", receipt.hash);
    console.log("   Gas Used:", receipt.gasUsed.toString());

    // Get updated exchange rate
    const exchangeRateAfter = await vault.exchangeRate();
    const totalXRPLockedAfter = await vault.totalXRPLocked();

    console.log("\n📊 Updated Vault State:");
    console.log("   New Exchange Rate:", ethers.formatEther(exchangeRateAfter), "shXRP per XRP");
    console.log("   Total XRP Locked:", ethers.formatEther(totalXRPLockedAfter));

    // Calculate APY (simplified - assumes daily compounds)
    if (exchangeRateAfter > exchangeRateBefore) {
      const rateIncrease = exchangeRateAfter - exchangeRateBefore;
      const percentageIncrease = Number(rateIncrease * 10000n / exchangeRateBefore) / 100;
      const estimatedAPY = percentageIncrease * 365n; // Daily compound * 365 days
      
      console.log("\n📈 Yield Stats:");
      console.log("   Daily Yield:", percentageIncrease.toFixed(4), "%");
      console.log("   Estimated APY:", estimatedAPY.toFixed(2), "%");
    } else {
      console.log("\n⚠️  No rewards to compound this cycle.");
    }

    console.log("\n✅ Auto-compound complete!\n");

  } catch (error: any) {
    console.error("\n❌ Auto-compound failed:", error.message);
    
    // Check for common errors
    if (error.message.includes("Not an operator")) {
      console.log("   ERROR: Wallet is not authorized as an operator");
    } else if (error.message.includes("Yield not enabled")) {
      console.log("   ERROR: Yield generation is disabled on the vault");
    }
    
    throw error;
  }
}

// Gelato-compatible exports
export default main;

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Compound script failed:", error);
      process.exit(1);
    });
}
