import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ShieldTokenArtifact from "../artifacts/contracts/ShieldToken.sol/ShieldToken.json" assert { type: "json" };
import RevenueRouterArtifact from "../artifacts/contracts/RevenueRouter.sol/RevenueRouter.json" assert { type: "json" };
import StakingBoostArtifact from "../artifacts/contracts/StakingBoost.sol/StakingBoost.json" assert { type: "json" };
import MerkleDistributorArtifact from "../artifacts/contracts/MerkleDistributor.sol/MerkleDistributor.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy Missing Shield Finance Contracts
 * 
 * Deploys contracts that are missing from the Coston2 testnet:
 * 1. RevenueRouter (50% burn, 50% reserves)
 * 2. StakingBoost (30-day lock, 1% boost per 100 SHIELD)
 * 3. MerkleDistributor (2M SHIELD airdrop)
 * 
 * Uses existing ShieldToken: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
 */

// Existing contract addresses on Coston2
const EXISTING_SHIELD_TOKEN = "0x07F943F173a6bE5EC63a8475597d28aAA6B24992";

// Network addresses
const WFLR_COSTON2 = "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273";
const SPARKDEX_SWAP_ROUTER = "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781";

async function main() {
  console.log("🚀 Deploy Missing Shield Finance Contracts");
  console.log("=".repeat(60));

  const network = "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const merkleRoot = process.env.MERKLE_ROOT;
  if (!merkleRoot || merkleRoot === "") {
    throw new Error("❌ MERKLE_ROOT not set in environment. Run: export MERKLE_ROOT=$(cat data/merkle-root.txt)");
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

  if (balance < ethers.parseEther("2")) {
    console.warn("⚠️  WARNING: Balance below 2 FLR. Deployment may fail.");
  }

  console.log("\n📍 Using Existing Contracts:");
  console.log("   ShieldToken:", EXISTING_SHIELD_TOKEN);

  console.log("\n📍 Network Addresses:");
  console.log("   wFLR:", WFLR_COSTON2);
  console.log("   SparkDEX Router:", SPARKDEX_SWAP_ROUTER);
  console.log("   Merkle Root:", merkleRoot);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYING MISSING CONTRACTS");
  console.log("=".repeat(60));

  // =========================================================================
  // STEP 1: Deploy RevenueRouter
  // =========================================================================
  console.log("\n1️⃣  Deploying RevenueRouter...");
  console.log("   Constructor args:");
  console.log("      SHIELD Token:", EXISTING_SHIELD_TOKEN);
  console.log("      wFLR:", WFLR_COSTON2);
  console.log("      Router:", SPARKDEX_SWAP_ROUTER);

  const RevenueRouter = new ethers.ContractFactory(
    RevenueRouterArtifact.abi,
    RevenueRouterArtifact.bytecode,
    wallet
  );

  const revenueRouter = await RevenueRouter.deploy(
    EXISTING_SHIELD_TOKEN,
    WFLR_COSTON2,
    SPARKDEX_SWAP_ROUTER
  );
  await revenueRouter.waitForDeployment();
  const revenueRouterAddress = await revenueRouter.getAddress();
  console.log("   ✅ RevenueRouter deployed:", revenueRouterAddress);
  console.log(`   View: ${networkConfig.explorer}/address/${revenueRouterAddress}`);

  // Verify configuration
  const shieldTokenCheck = await revenueRouter.shieldToken();
  const wflrCheck = await revenueRouter.wflr();
  const routerCheck = await revenueRouter.router();

  console.log("   📊 Configuration:");
  console.log("      SHIELD Token:", shieldTokenCheck);
  console.log("      wFLR:", wflrCheck);
  console.log("      Router:", routerCheck);
  console.log("      Split: 50% Burn / 50% Reserves");

  if (
    shieldTokenCheck !== EXISTING_SHIELD_TOKEN ||
    wflrCheck !== WFLR_COSTON2 ||
    routerCheck !== SPARKDEX_SWAP_ROUTER
  ) {
    throw new Error("❌ RevenueRouter configuration mismatch!");
  }
  console.log("      ✅ Configuration verified");

  // =========================================================================
  // STEP 2: Deploy StakingBoost
  // =========================================================================
  console.log("\n2️⃣  Deploying StakingBoost...");
  console.log("   Constructor args:");
  console.log("      SHIELD Token:", EXISTING_SHIELD_TOKEN);

  const StakingBoost = new ethers.ContractFactory(
    StakingBoostArtifact.abi,
    StakingBoostArtifact.bytecode,
    wallet
  );

  const stakingBoost = await StakingBoost.deploy(EXISTING_SHIELD_TOKEN);
  await stakingBoost.waitForDeployment();
  const stakingBoostAddress = await stakingBoost.getAddress();
  console.log("   ✅ StakingBoost deployed:", stakingBoostAddress);
  console.log(`   View: ${networkConfig.explorer}/address/${stakingBoostAddress}`);

  // Verify configuration
  const shieldTokenCheckStaking = await stakingBoost.shieldToken();
  const lockPeriod = await stakingBoost.LOCK_PERIOD();

  console.log("   📊 Configuration:");
  console.log("      SHIELD Token:", shieldTokenCheckStaking);
  console.log("      Lock Period:", lockPeriod.toString(), "seconds (", Number(lockPeriod) / 86400, "days)");
  console.log("      Boost Formula: 1% per 100 SHIELD staked");

  if (shieldTokenCheckStaking !== EXISTING_SHIELD_TOKEN) {
    throw new Error("❌ StakingBoost configuration mismatch!");
  }
  if (lockPeriod !== 2592000n) {
    throw new Error("❌ StakingBoost lock period mismatch! Expected: 2592000, Got: " + lockPeriod.toString());
  }
  console.log("      ✅ Configuration verified");

  // =========================================================================
  // STEP 3: Deploy MerkleDistributor
  // =========================================================================
  console.log("\n3️⃣  Deploying MerkleDistributor...");
  console.log("   Constructor args:");
  console.log("      SHIELD Token:", EXISTING_SHIELD_TOKEN);
  console.log("      Merkle Root:", merkleRoot);

  const MerkleDistributor = new ethers.ContractFactory(
    MerkleDistributorArtifact.abi,
    MerkleDistributorArtifact.bytecode,
    wallet
  );

  const merkleDistributor = await MerkleDistributor.deploy(EXISTING_SHIELD_TOKEN, merkleRoot);
  await merkleDistributor.waitForDeployment();
  const merkleDistributorAddress = await merkleDistributor.getAddress();
  console.log("   ✅ MerkleDistributor deployed:", merkleDistributorAddress);
  console.log(`   View: ${networkConfig.explorer}/address/${merkleDistributorAddress}`);

  // Verify configuration
  const tokenCheck = await merkleDistributor.token();
  const rootCheck = await merkleDistributor.merkleRoot();

  console.log("   📊 Configuration:");
  console.log("      SHIELD Token:", tokenCheck);
  console.log("      Merkle Root:", rootCheck);
  console.log("      ⚠️  Root is IMMUTABLE - cannot be changed!");

  if (tokenCheck !== EXISTING_SHIELD_TOKEN || rootCheck !== merkleRoot) {
    throw new Error("❌ MerkleDistributor configuration mismatch!");
  }
  console.log("      ✅ Configuration verified");

  // =========================================================================
  // DEPLOYMENT SUMMARY
  // =========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));

  const deploymentInfo = {
    network,
    chainId: networkConfig.chainId,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    contracts: {
      ShieldToken: {
        address: EXISTING_SHIELD_TOKEN,
        status: "Pre-existing (not deployed)",
      },
      RevenueRouter: {
        address: revenueRouterAddress,
        shieldToken: EXISTING_SHIELD_TOKEN,
        wflr: WFLR_COSTON2,
        router: SPARKDEX_SWAP_ROUTER,
        split: "50% Burn / 50% Reserves",
      },
      StakingBoost: {
        address: stakingBoostAddress,
        shieldToken: EXISTING_SHIELD_TOKEN,
        lockPeriod: lockPeriod.toString() + " seconds (30 days)",
      },
      MerkleDistributor: {
        address: merkleDistributorAddress,
        shieldToken: EXISTING_SHIELD_TOKEN,
        merkleRoot: merkleRoot,
      },
    },
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(deploymentsDir, `coston2-missing-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Contract Addresses:");
  console.log("   ShieldToken (existing):", EXISTING_SHIELD_TOKEN);
  console.log("   RevenueRouter:", revenueRouterAddress);
  console.log("   StakingBoost:", stakingBoostAddress);
  console.log("   MerkleDistributor:", merkleDistributorAddress);

  console.log("\n💾 Deployment saved to:", deploymentFile);

  console.log("\n" + "=".repeat(60));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(60));

  console.log("\n1️⃣  Update environment variables:");
  console.log(`   VITE_REVENUE_ROUTER_ADDRESS=${revenueRouterAddress}`);
  console.log(`   VITE_STAKING_BOOST_ADDRESS=${stakingBoostAddress}`);
  console.log(`   VITE_MERKLE_DISTRIBUTOR_ADDRESS=${merkleDistributorAddress}`);

  console.log("\n2️⃣  Verify contracts on block explorer:");
  console.log(`   npx hardhat verify --network coston2 ${revenueRouterAddress} "${EXISTING_SHIELD_TOKEN}" "${WFLR_COSTON2}" "${SPARKDEX_SWAP_ROUTER}"`);
  console.log(`   npx hardhat verify --network coston2 ${stakingBoostAddress} "${EXISTING_SHIELD_TOKEN}"`);
  console.log(`   npx hardhat verify --network coston2 ${merkleDistributorAddress} "${EXISTING_SHIELD_TOKEN}" "${merkleRoot}"`);

  console.log("\n3️⃣  Re-deploy ShXRPVault with RevenueRouter and StakingBoost");
  console.log("   The current ShXRPVault constructor needs these addresses.");

  console.log("\n4️⃣  Fund MerkleDistributor with 2M SHIELD");
  console.log("   Transfer from deployer (who owns all 10M SHIELD)");

  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
