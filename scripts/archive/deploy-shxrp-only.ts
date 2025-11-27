import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy ShXRPVault Only
 * 
 * Uses already-deployed RevenueRouter and StakingBoost
 */

async function main() {
  console.log("🛡️  Deploy ShXRPVault (10M SHIELD)");
  console.log("=".repeat(60));

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set");
  }

  // Already deployed contracts
  const FXRP_TOKEN = "0x0b6A3645c240605887a5532109323A3E12273dc7";
  const REVENUE_ROUTER = "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB";
  const STAKING_BOOST = "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4";

  const networkConfig = {
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    explorer: "https://coston2-explorer.flare.network",
  };

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n💼 Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "FLR");

  if (balance < ethers.parseEther("0.05")) {
    throw new Error("❌ Insufficient balance for deployment");
  }

  console.log("\n🚀 Deploying ShXRPVault...");
  console.log("   fxrpToken:", FXRP_TOKEN);
  console.log("   revenueRouter:", REVENUE_ROUTER);
  console.log("   stakingBoost:", STAKING_BOOST);

  const ShXRPVault = new ethers.ContractFactory(
    ShXRPVaultArtifact.abi,
    ShXRPVaultArtifact.bytecode,
    wallet
  );

  // Use lower gas limit
  const vault = await ShXRPVault.deploy(
    FXRP_TOKEN,
    "Shield XRP",
    "shXRP",
    REVENUE_ROUTER,
    STAKING_BOOST,
    { gasLimit: 5000000 }
  );
  
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log("\n✅ ShXRPVault deployed!");
  console.log("   Address:", vaultAddress);
  console.log("   Explorer:", `${networkConfig.explorer}/address/${vaultAddress}`);

  // Verify
  const asset = await vault.asset();
  const name = await vault.name();
  const symbol = await vault.symbol();
  
  console.log("\n🔍 Verification:");
  console.log("   Asset:", asset, asset === FXRP_TOKEN ? "✅" : "❌");
  console.log("   Name:", name, name === "Shield XRP" ? "✅" : "❌");
  console.log("   Symbol:", symbol, symbol === "shXRP" ? "✅" : "❌");

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nShXRPVault:", vaultAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ FAILED:", error.message);
    process.exit(1);
  });
