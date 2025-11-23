import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import RevenueRouterArtifact from "../artifacts/contracts/RevenueRouter.sol/RevenueRouter.json" assert { type: "json" };
import StakingBoostArtifact from "../artifacts/contracts/StakingBoost.sol/StakingBoost.json" assert { type: "json" };
import MerkleDistributorArtifact from "../artifacts/contracts/MerkleDistributor.sol/MerkleDistributor.json" assert { type: "json" };
import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy All Contracts for 10M SHIELD Supply
 * 
 * This script deploys all dependent contracts for the new 10M SHIELD token:
 * 1. RevenueRouter - Routes protocol revenue (50% buyback & burn, 50% reserves)
 * 2. StakingBoost - SHIELD staking with APY boost calculation
 * 3. MerkleDistributor - Airdrop distribution via Merkle proofs
 * 4. ShXRPVault - ERC-4626 vault for FXRP with yield strategies
 * 
 * Execution: npx tsx scripts/deploy-all-contracts-10m.ts
 */

async function main() {
  console.log("🛡️  Deploy All Contracts (10M SHIELD Supply)");
  console.log("=".repeat(80));

  // ========================================
  // CONFIGURATION
  // ========================================

  const network = "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set in environment");
  }

  // Contract Addresses
  const SHIELD_TOKEN = "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616";
  const FXRP_TOKEN = "0x0b6A3645c240605887a5532109323A3E12273dc7";
  const WFLR_TOKEN = "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273";
  const SPARKDEX_ROUTER = "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781";
  const MERKLE_ROOT = "0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4";

  const networkConfig = {
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
    explorer: "https://coston2-explorer.flare.network",
  };

  // ========================================
  // CONNECT TO NETWORK
  // ========================================

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n💼 Deployer Address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Deployer Balance:", ethers.formatEther(balance), "FLR");

  if (balance === 0n) {
    throw new Error("❌ Deployer has no balance! Get FLR from: https://faucet.flare.network/coston2");
  }

  if (balance < ethers.parseEther("0.5")) {
    console.warn("⚠️  WARNING: Balance below 0.5 FLR. Multiple deployments may fail.");
  }

  // ========================================
  // CHECK FOR EXISTING DEPLOYMENT
  // ========================================

  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFile = path.join(deploymentsDir, "coston2-10m-complete.json");

  if (fs.existsSync(deploymentFile)) {
    console.log("\n⚠️  IDEMPOTENCY CHECK:");
    console.log("   Found existing deployment at:", deploymentFile);
    
    const existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
    console.log("   Existing contracts:");
    console.log("   - RevenueRouter:", existingDeployment.contracts?.RevenueRouter?.address);
    console.log("   - StakingBoost:", existingDeployment.contracts?.StakingBoost?.address);
    console.log("   - MerkleDistributor:", existingDeployment.contracts?.MerkleDistributor?.address);
    console.log("   - ShXRPVault:", existingDeployment.contracts?.ShXRPVault?.address);
    console.log("   Deployed at:", existingDeployment.timestamp);
    
    console.log("\n❓ Skip re-deployment? (existing deployment found)");
    console.log("   To force re-deploy, delete:", deploymentFile);
    console.log("\n   Exiting to prevent duplicate deployment.");
    process.exit(0);
  }

  // ========================================
  // DISPLAY CONFIGURATION
  // ========================================

  console.log("\n" + "=".repeat(80));
  console.log("CONFIGURATION");
  console.log("=".repeat(80));
  console.log("\n📋 Contract Addresses:");
  console.log("   SHIELD Token:", SHIELD_TOKEN);
  console.log("   FXRP Token:", FXRP_TOKEN);
  console.log("   wFLR Token:", WFLR_TOKEN);
  console.log("   SparkDEX Router:", SPARKDEX_ROUTER);
  console.log("\n📋 Merkle Root:", MERKLE_ROOT);

  // ========================================
  // COMPILE CONTRACTS
  // ========================================

  console.log("\n" + "=".repeat(80));
  console.log("COMPILING CONTRACTS");
  console.log("=".repeat(80));

  console.log("\n🔨 Running Hardhat compile...");
  
  try {
    const { execSync } = await import("child_process");
    execSync("npx hardhat compile", { stdio: "inherit" });
    console.log("✅ Contracts compiled successfully");
  } catch (error) {
    throw new Error("❌ Contract compilation failed");
  }

  // ========================================
  // DEPLOY CONTRACTS
  // ========================================

  const deployedContracts: any = {};
  const timestamp = new Date().toISOString();

  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYING CONTRACTS");
  console.log("=".repeat(80));

  // ========================================
  // 1. DEPLOY REVENUE ROUTER
  // ========================================

  console.log("\n🚀 [1/4] Deploying RevenueRouter...");
  console.log("   Constructor Args:");
  console.log("   - shieldToken:", SHIELD_TOKEN);
  console.log("   - wflr:", WFLR_TOKEN);
  console.log("   - router:", SPARKDEX_ROUTER);

  const RevenueRouter = new ethers.ContractFactory(
    RevenueRouterArtifact.abi,
    RevenueRouterArtifact.bytecode,
    wallet
  );

  const revenueRouter = await RevenueRouter.deploy(
    SHIELD_TOKEN,
    WFLR_TOKEN,
    SPARKDEX_ROUTER
  );
  await revenueRouter.waitForDeployment();

  const revenueRouterAddress = await revenueRouter.getAddress();
  console.log("   ✅ RevenueRouter deployed!");
  console.log("   Address:", revenueRouterAddress);

  // Verify deployment
  const rrShieldToken = await revenueRouter.shieldToken();
  const rrWflr = await revenueRouter.wflr();
  const rrRouter = await revenueRouter.router();
  
  if (rrShieldToken !== SHIELD_TOKEN || rrWflr !== WFLR_TOKEN || rrRouter !== SPARKDEX_ROUTER) {
    throw new Error("❌ RevenueRouter verification failed!");
  }
  console.log("   ✅ RevenueRouter verified on-chain");

  deployedContracts.RevenueRouter = {
    address: revenueRouterAddress,
    explorerUrl: `${networkConfig.explorer}/address/${revenueRouterAddress}`,
    constructorArgs: {
      shieldToken: SHIELD_TOKEN,
      wflr: WFLR_TOKEN,
      router: SPARKDEX_ROUTER,
    },
  };

  // ========================================
  // 2. DEPLOY STAKING BOOST
  // ========================================

  console.log("\n🚀 [2/4] Deploying StakingBoost...");
  console.log("   Constructor Args:");
  console.log("   - shieldToken:", SHIELD_TOKEN);

  const StakingBoost = new ethers.ContractFactory(
    StakingBoostArtifact.abi,
    StakingBoostArtifact.bytecode,
    wallet
  );

  const stakingBoost = await StakingBoost.deploy(SHIELD_TOKEN);
  await stakingBoost.waitForDeployment();

  const stakingBoostAddress = await stakingBoost.getAddress();
  console.log("   ✅ StakingBoost deployed!");
  console.log("   Address:", stakingBoostAddress);

  // Verify deployment
  const sbShieldToken = await stakingBoost.shieldToken();
  const sbLockPeriod = await stakingBoost.LOCK_PERIOD();
  
  if (sbShieldToken !== SHIELD_TOKEN) {
    throw new Error("❌ StakingBoost verification failed!");
  }
  console.log("   ✅ StakingBoost verified on-chain");
  console.log("   Lock Period:", Number(sbLockPeriod) / 86400, "days");

  deployedContracts.StakingBoost = {
    address: stakingBoostAddress,
    explorerUrl: `${networkConfig.explorer}/address/${stakingBoostAddress}`,
    constructorArgs: {
      shieldToken: SHIELD_TOKEN,
    },
  };

  // ========================================
  // 3. DEPLOY MERKLE DISTRIBUTOR
  // ========================================

  console.log("\n🚀 [3/4] Deploying MerkleDistributor...");
  console.log("   Constructor Args:");
  console.log("   - token:", SHIELD_TOKEN);
  console.log("   - merkleRoot:", MERKLE_ROOT);

  const MerkleDistributor = new ethers.ContractFactory(
    MerkleDistributorArtifact.abi,
    MerkleDistributorArtifact.bytecode,
    wallet
  );

  const merkleDistributor = await MerkleDistributor.deploy(
    SHIELD_TOKEN,
    MERKLE_ROOT
  );
  await merkleDistributor.waitForDeployment();

  const merkleDistributorAddress = await merkleDistributor.getAddress();
  console.log("   ✅ MerkleDistributor deployed!");
  console.log("   Address:", merkleDistributorAddress);

  // Verify deployment
  const mdToken = await merkleDistributor.token();
  const mdRoot = await merkleDistributor.merkleRoot();
  
  if (mdToken !== SHIELD_TOKEN || mdRoot !== MERKLE_ROOT) {
    throw new Error("❌ MerkleDistributor verification failed!");
  }
  console.log("   ✅ MerkleDistributor verified on-chain");

  deployedContracts.MerkleDistributor = {
    address: merkleDistributorAddress,
    explorerUrl: `${networkConfig.explorer}/address/${merkleDistributorAddress}`,
    constructorArgs: {
      token: SHIELD_TOKEN,
      merkleRoot: MERKLE_ROOT,
    },
  };

  // ========================================
  // 4. DEPLOY SHXRP VAULT
  // ========================================

  console.log("\n🚀 [4/4] Deploying ShXRPVault...");
  console.log("   Constructor Args:");
  console.log("   - fxrpToken:", FXRP_TOKEN);
  console.log("   - name: Shield XRP");
  console.log("   - symbol: shXRP");
  console.log("   - revenueRouter:", revenueRouterAddress);
  console.log("   - stakingBoost:", stakingBoostAddress);

  const ShXRPVault = new ethers.ContractFactory(
    ShXRPVaultArtifact.abi,
    ShXRPVaultArtifact.bytecode,
    wallet
  );

  const shxrpVault = await ShXRPVault.deploy(
    FXRP_TOKEN,
    "Shield XRP",
    "shXRP",
    revenueRouterAddress,
    stakingBoostAddress
  );
  await shxrpVault.waitForDeployment();

  const shxrpVaultAddress = await shxrpVault.getAddress();
  console.log("   ✅ ShXRPVault deployed!");
  console.log("   Address:", shxrpVaultAddress);

  // Verify deployment
  const vaultAsset = await shxrpVault.asset();
  const vaultName = await shxrpVault.name();
  const vaultSymbol = await shxrpVault.symbol();
  const vaultRevenueRouter = await shxrpVault.revenueRouter();
  const vaultStakingBoost = await shxrpVault.stakingBoost();
  
  if (
    vaultAsset !== FXRP_TOKEN ||
    vaultName !== "Shield XRP" ||
    vaultSymbol !== "shXRP" ||
    vaultRevenueRouter !== revenueRouterAddress ||
    vaultStakingBoost !== stakingBoostAddress
  ) {
    throw new Error("❌ ShXRPVault verification failed!");
  }
  console.log("   ✅ ShXRPVault verified on-chain");

  deployedContracts.ShXRPVault = {
    address: shxrpVaultAddress,
    explorerUrl: `${networkConfig.explorer}/address/${shxrpVaultAddress}`,
    constructorArgs: {
      fxrpToken: FXRP_TOKEN,
      name: "Shield XRP",
      symbol: "shXRP",
      revenueRouter: revenueRouterAddress,
      stakingBoost: stakingBoostAddress,
    },
  };

  // ========================================
  // SAVE DEPLOYMENT DATA
  // ========================================

  console.log("\n" + "=".repeat(80));
  console.log("SAVING DEPLOYMENT DATA");
  console.log("=".repeat(80));

  const deploymentData = {
    network: "coston2",
    chainId: 114,
    timestamp,
    deployer: wallet.address,
    shieldToken: SHIELD_TOKEN,
    merkleRoot: MERKLE_ROOT,
    contracts: {
      ShieldToken: {
        address: SHIELD_TOKEN,
        explorerUrl: `${networkConfig.explorer}/address/${SHIELD_TOKEN}`,
      },
      FXRP: {
        address: FXRP_TOKEN,
        explorerUrl: `${networkConfig.explorer}/address/${FXRP_TOKEN}`,
      },
      ...deployedContracts,
    },
  };

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentData, null, 2),
    "utf-8"
  );

  console.log("\n✅ Deployment data saved to:", deploymentFile);

  // ========================================
  // DISPLAY SUMMARY
  // ========================================

  console.log("\n" + "=".repeat(80));
  console.log("✅ ALL CONTRACTS DEPLOYED (10M SHIELD SUPPLY)");
  console.log("=".repeat(80));

  console.log("\n📋 Deployed Contracts:");
  console.log("   ShieldToken:       ", SHIELD_TOKEN);
  console.log("   RevenueRouter:     ", revenueRouterAddress);
  console.log("   StakingBoost:      ", stakingBoostAddress);
  console.log("   MerkleDistributor: ", merkleDistributorAddress);
  console.log("   ShXRPVault:        ", shxrpVaultAddress);

  console.log("\n🔗 Explorer Links:");
  console.log("   SHIELD Token:       ", `${networkConfig.explorer}/address/${SHIELD_TOKEN}`);
  console.log("   RevenueRouter:      ", `${networkConfig.explorer}/address/${revenueRouterAddress}`);
  console.log("   StakingBoost:       ", `${networkConfig.explorer}/address/${stakingBoostAddress}`);
  console.log("   MerkleDistributor:  ", `${networkConfig.explorer}/address/${merkleDistributorAddress}`);
  console.log("   ShXRPVault:         ", `${networkConfig.explorer}/address/${shxrpVaultAddress}`);

  console.log("\n📝 Deployment Summary:");
  console.log("   Network:    ", "Coston2 Testnet (Chain ID: 114)");
  console.log("   Deployer:   ", wallet.address);
  console.log("   Timestamp:  ", timestamp);
  console.log("   Data File:  ", deploymentFile);

  console.log("\n" + "=".repeat(80));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    process.exit(1);
  });
