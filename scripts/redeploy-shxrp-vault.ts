import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Re-deploy ShXRPVault with RevenueRouter and StakingBoost
 * 
 * The original ShXRPVault was deployed without RevenueRouter and StakingBoost.
 * This script deploys a new ShXRPVault with the correct constructor parameters.
 * 
 * New addresses:
 * - RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
 * - StakingBoost: 0xD8DF192872e94F189602ae3634850C989A1802C6
 */

const REVENUE_ROUTER = "0x8e5C9933c08451a6a31635a3Ea1221c010DF158e";
const STAKING_BOOST = "0xD8DF192872e94F189602ae3634850C989A1802C6";

async function main() {
  console.log("🚀 Re-deploy ShXRPVault with RevenueRouter & StakingBoost");
  console.log("=".repeat(60));

  const network = "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const networkConfig = {
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
    explorer: "https://coston2-explorer.flare.network",
  };

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n💼 Deployer:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "FLR");

  if (balance === 0n) {
    throw new Error("❌ Deployer has no balance! Get FLR from: https://faucet.flare.network/coston2");
  }

  // Dynamically fetch FXRP address from AssetManager
  console.log("\n🔍 Fetching FXRP address from AssetManager...");
  const assetManagerAddress = await nameToAddress("AssetManagerFXRP", network as "coston2" | "flare", provider);
  console.log(`   AssetManager address: ${assetManagerAddress}`);

  const assetManagerAbi = ["function fAsset() external view returns (address)"];
  const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, provider);

  const fxrpAddress = await assetManager.fAsset();
  console.log(`   ✅ FXRP token address: ${fxrpAddress}`);

  console.log("\n📍 New Contract Addresses:");
  console.log("   RevenueRouter:", REVENUE_ROUTER);
  console.log("   StakingBoost:", STAKING_BOOST);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYING SHXRP VAULT");
  console.log("=".repeat(60));

  console.log("\n🏦 Deploying ShXRPVault...");
  console.log("   Constructor args:");
  console.log("      FXRP Token:", fxrpAddress);
  console.log("      Name: Shield XRP");
  console.log("      Symbol: shXRP");
  console.log("      RevenueRouter:", REVENUE_ROUTER);
  console.log("      StakingBoost:", STAKING_BOOST);

  const ShXRPVault = new ethers.ContractFactory(
    ShXRPVaultArtifact.abi,
    ShXRPVaultArtifact.bytecode,
    wallet
  );

  const shxrpVault = await ShXRPVault.deploy(
    fxrpAddress,
    "Shield XRP",
    "shXRP",
    REVENUE_ROUTER,
    STAKING_BOOST
  );

  await shxrpVault.waitForDeployment();
  const shxrpVaultAddress = await shxrpVault.getAddress();
  console.log("   ✅ ShXRPVault deployed:", shxrpVaultAddress);
  console.log(`   View: ${networkConfig.explorer}/address/${shxrpVaultAddress}`);

  // Verify configuration
  const asset = await shxrpVault.asset();
  const name = await shxrpVault.name();
  const symbol = await shxrpVault.symbol();
  const revenueRouterCheck = await shxrpVault.revenueRouter();
  const stakingBoostCheck = await shxrpVault.stakingBoost();

  console.log("\n   📊 Configuration:");
  console.log("      Asset (FXRP):", asset);
  console.log("      Name:", name);
  console.log("      Symbol:", symbol);
  console.log("      RevenueRouter:", revenueRouterCheck);
  console.log("      StakingBoost:", stakingBoostCheck);

  if (asset !== fxrpAddress) {
    throw new Error("❌ Asset mismatch!");
  }
  if (revenueRouterCheck !== REVENUE_ROUTER) {
    throw new Error("❌ RevenueRouter mismatch!");
  }
  if (stakingBoostCheck !== STAKING_BOOST) {
    throw new Error("❌ StakingBoost mismatch!");
  }
  console.log("      ✅ Configuration verified");

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentInfo = {
    network,
    chainId: networkConfig.chainId,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    contracts: {
      ShXRPVault: {
        address: shxrpVaultAddress,
        fxrp: fxrpAddress,
        name,
        symbol,
        revenueRouter: REVENUE_ROUTER,
        stakingBoost: STAKING_BOOST,
      },
    },
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(deploymentsDir, `coston2-shxrp-vault-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n💾 Deployment saved to:", deploymentFile);

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));

  console.log("\n📄 New ShXRPVault Address:");
  console.log("  ", shxrpVaultAddress);

  console.log("\n" + "=".repeat(60));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(60));

  console.log("\n1️⃣  Update environment variable:");
  console.log(`   VITE_SHXRP_VAULT_ADDRESS=${shxrpVaultAddress}`);

  console.log("\n2️⃣  Verify contract on block explorer:");
  console.log(`   npx hardhat verify --network coston2 ${shxrpVaultAddress} "${fxrpAddress}" "Shield XRP" "shXRP" "${REVENUE_ROUTER}" "${STAKING_BOOST}"`);

  console.log("\n3️⃣  Update backend services:");
  console.log("   - VaultService needs the new vault address");
  console.log("   - BridgeService deposit flow uses the vault");
  console.log("   - Update deployment files if needed");

  console.log("\n⚠️  IMPORTANT:");
  console.log("   The old ShXRPVault is still deployed at:");
  console.log("   0x8fe09217445e90DA692D29F30859dafA4eb281d1");
  console.log("   ");
  console.log("   If there are existing user positions, you need to migrate them!");
  console.log("   Consider:");
  console.log("   - Pause old vault deposits");
  console.log("   - Allow withdrawals from old vault");
  console.log("   - Communicate migration to users");

  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
