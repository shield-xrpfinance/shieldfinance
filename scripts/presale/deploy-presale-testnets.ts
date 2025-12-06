/**
 * SHIELD Presale Multi-Chain Testnet Deployment Script
 * 
 * Deploys the complete presale infrastructure across 4 testnets:
 * - Flare Coston2: ShieldOFTAdapter + ShieldPresale + ZapPresale
 * - Base Sepolia: ShieldOFT + ShieldPresale + ZapPresale
 * - Arbitrum Sepolia: ShieldOFT + ShieldPresale + ZapPresale
 * - Ethereum Sepolia: ShieldOFT + ShieldPresale + ZapPresale
 * 
 * Usage:
 *   npx hardhat run scripts/presale/deploy-presale-testnets.ts --network coston2
 *   npx hardhat run scripts/presale/deploy-presale-testnets.ts --network baseSepolia
 *   npx hardhat run scripts/presale/deploy-presale-testnets.ts --network arbitrumSepolia
 *   npx hardhat run scripts/presale/deploy-presale-testnets.ts --network sepolia
 */

import { ethers } from "ethers";
import { 
  LAYERZERO_ENDPOINTS, 
  DEX_ROUTERS, 
  PAYMENT_TOKENS, 
  WRAPPED_NATIVE 
} from "../../shared/layerzero-config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Network configurations
const NETWORK_CONFIGS: Record<string, { rpcUrl: string; chainId: number }> = {
  coston2: { 
    rpcUrl: process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc", 
    chainId: 114 
  },
  baseSepolia: { 
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", 
    chainId: 84532 
  },
  arbitrumSepolia: { 
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc", 
    chainId: 421614 
  },
  sepolia: { 
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || "https://rpc.sepolia.org", 
    chainId: 11155111 
  },
};

// Contract factory helper
async function getContractFactory(name: string, deployer: ethers.Wallet) {
  const artifactPath = path.join(process.cwd(), "artifacts", "contracts");
  
  // Find artifact file
  let artifact: any;
  const searchDirs = ["presale", "layerzero"];
  
  for (const dir of searchDirs) {
    try {
      const filePath = path.join(artifactPath, dir, `${name}.sol`, `${name}.json`);
      const content = await fs.promises.readFile(filePath, "utf-8");
      artifact = JSON.parse(content);
      break;
    } catch {}
  }
  
  if (!artifact) {
    throw new Error(`Artifact not found for ${name}`);
  }
  
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
}

// Existing SHIELD token on Coston2 (checksummed)
const SHIELD_TOKEN_COSTON2 = "0x061CF4B8fA61bac17aeB6990002DAb1a7C416616";

// Presale configuration
const PRESALE_CONFIG = {
  softCap: BigInt(100_000) * BigInt(10 ** 6),     // 100K USDC
  hardCap: BigInt(2_000_000) * BigInt(10 ** 6),   // 2M USDC
  stage1Cap: BigInt(250_000) * BigInt(10 ** 6),   // 250K USDC (5% bonus)
  stage2Cap: BigInt(500_000) * BigInt(10 ** 6),   // 500K USDC (3% bonus)
  stage3Cap: BigInt(1_000_000) * BigInt(10 ** 6), // 1M USDC (1% bonus)
  // Stage 4 is remainder to hardCap (0% bonus)
  
  // Prices in USDC (6 decimals)
  stage1Price: 5000,    // $0.005
  stage2Price: 7500,    // $0.0075
  stage3Price: 10000,   // $0.01
  stage4Price: 20000,   // $0.02
  
  // Vesting
  tgePercent: 2000, // 20%
  vestingDuration: 180 * 24 * 60 * 60, // 6 months in seconds
  vestingCliff: 0, // No cliff
  
  // Limits
  minPurchase: BigInt(10) * BigInt(10 ** 6),      // $10 min
  maxPurchaseNoKyc: BigInt(1000) * BigInt(10 ** 6), // $1000 without KYC
  maxPurchaseKyc: BigInt(50000) * BigInt(10 ** 6),  // $50K with KYC
  
  // Rate limit
  hourlyRateLimit: BigInt(100000) * BigInt(10 ** 6), // $100K per hour per chain
};

interface DeploymentResult {
  network: string;
  chainId: number;
  shieldOFT?: string;
  shieldOFTAdapter?: string;
  presale: string;
  zapPresale: string;
  paymentToken: string;
  lzEndpoint: string;
}

async function configurePresaleStages(presale: any): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const stageDuration = 7 * 24 * 60 * 60; // 7 days per stage
  
  // Stage allocations in SHIELD tokens (18 decimals)
  // Total presale allocation: 20M SHIELD (20% of 100M supply)
  const SHIELD_DECIMALS = BigInt(10 ** 18);
  const stage1Allocation = BigInt(4_000_000) * SHIELD_DECIMALS;  // 4M SHIELD
  const stage2Allocation = BigInt(5_000_000) * SHIELD_DECIMALS;  // 5M SHIELD
  const stage3Allocation = BigInt(5_000_000) * SHIELD_DECIMALS;  // 5M SHIELD
  const stage4Allocation = BigInt(6_000_000) * SHIELD_DECIMALS;  // 6M SHIELD

  console.log("   Adding presale stages...");
  await presale.addStage(PRESALE_CONFIG.stage1Price, stage1Allocation, now, now + stageDuration);
  await presale.addStage(PRESALE_CONFIG.stage2Price, stage2Allocation, now + stageDuration, now + 2 * stageDuration);
  await presale.addStage(PRESALE_CONFIG.stage3Price, stage3Allocation, now + 2 * stageDuration, now + 3 * stageDuration);
  await presale.addStage(PRESALE_CONFIG.stage4Price, stage4Allocation, now + 3 * stageDuration, now + 4 * stageDuration);
  console.log("   Added 4 presale stages");

  // Disable allowlist for testnet (easier testing)
  await presale.setAllowlistEnabled(false);
  console.log("   Disabled allowlist for testnet");
}

async function main() {
  // Parse network from command line args
  const networkArg = process.argv.find(arg => arg.startsWith("--network=")) 
    || process.argv[process.argv.indexOf("--network") + 1];
  const networkName = networkArg?.replace("--network=", "") || "coston2";
  
  const networkConfig = NETWORK_CONFIGS[networkName];
  if (!networkConfig) {
    console.error(`❌ Unsupported network: ${networkName}`);
    console.log("Supported networks: " + Object.keys(NETWORK_CONFIGS).join(", "));
    process.exit(1);
  }
  
  console.log(`\n🚀 Deploying SHIELD Presale to ${networkName}...\n`);
  console.log(`   Chain ID: ${networkConfig.chainId}`);
  console.log(`   RPC URL: ${networkConfig.rpcUrl}`);
  
  // Create provider and wallet
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }
  
  const provider = new ethers.JsonRpcProvider(
    networkConfig.rpcUrl, 
    { chainId: networkConfig.chainId, name: networkName }
  );
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  console.log(`Deployer: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} native token\n`);

  let result: DeploymentResult;

  if (networkName === "coston2") {
    result = await deployFlareCoston2(deployer);
  } else if (networkName === "baseSepolia") {
    result = await deployBaseSepolia(deployer);
  } else if (networkName === "arbitrumSepolia") {
    result = await deployArbitrumSepolia(deployer);
  } else if (networkName === "sepolia") {
    result = await deploySepolia(deployer);
  } else {
    throw new Error(`Unsupported network: ${networkName}`);
  }

  console.log("\n✅ Deployment Complete!");
  console.log("━".repeat(50));
  console.log(JSON.stringify(result, null, 2));
  console.log("━".repeat(50));

  // Save deployment to file
  const fs = await import("fs");
  const path = await import("path");
  const deploymentsDir = path.join(process.cwd(), "deployments", networkName);
  await fs.promises.mkdir(deploymentsDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(deploymentsDir, "presale.json"),
    JSON.stringify(result, null, 2)
  );
  console.log(`\n📁 Saved to deployments/${networkName}/presale.json`);
}

async function deployFlareCoston2(deployer: ethers.Wallet): Promise<DeploymentResult> {
  const chainId = 114;
  const lzEndpoint = LAYERZERO_ENDPOINTS.coston2.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.coston2;
  const dexRouter = DEX_ROUTERS.testnet.coston2.sparkdex;
  const wrappedNative = WRAPPED_NATIVE.testnets.coston2;

  console.log("📦 Deploying ShieldOFTAdapter (Flare home chain)...");
  const OFTAdapter = await getContractFactory("ShieldOFTAdapter", deployer);
  const oftAdapter = await OFTAdapter.deploy(
    SHIELD_TOKEN_COSTON2,
    lzEndpoint,
    deployer.address
  );
  await oftAdapter.waitForDeployment();
  console.log(`   ShieldOFTAdapter: ${await oftAdapter.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await getContractFactory("ShieldPresale", deployer);
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  // Skip ZapPresale for testnet - DEX may not be available
  console.log("⚠️  Skipping ZapPresale deployment (DEX router not verified on testnet)");
  const zapPresaleAddress = "0x0000000000000000000000000000000000000000";

  console.log("\n⚙️  Configuring contracts...");
  await configurePresaleStages(presale);

  return {
    network: "coston2",
    chainId,
    shieldOFTAdapter: await oftAdapter.getAddress(),
    presale: await presale.getAddress(),
    zapPresale: zapPresaleAddress,
    paymentToken,
    lzEndpoint,
  };
}

async function deployBaseSepolia(deployer: ethers.Wallet): Promise<DeploymentResult> {
  const chainId = 84532;
  const lzEndpoint = LAYERZERO_ENDPOINTS.baseSepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.baseSepolia;
  const dexRouter = DEX_ROUTERS.testnet.baseSepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.baseSepolia;

  console.log("📦 Deploying ShieldOFT (Base Sepolia)...");
  const OFT = await getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("⚠️  Skipping ZapPresale deployment (DEX router not verified on testnet)");
  const ZapPresale = await getContractFactory("ZapPresale");
  const zapPresale = await ZapPresale.deploy(
    await presale.getAddress(),
    dexRouter,
    wrappedNative,
    deployer.address
  );
  await zapPresale.waitForDeployment();
  console.log(`   ZapPresale: ${await zapPresale.getAddress()}`);

  console.log("\n⚙️  Configuring contracts...");
  
  // Add WETH as supported token
  await zapPresale.addSupportedToken(wrappedNative, 3000);
  console.log("   Added WETH to ZapPresale supported tokens");

  await configurePresaleStages(presale);

  return {
    network: "baseSepolia",
    chainId,
    shieldOFT: await oft.getAddress(),
    presale: await presale.getAddress(),
    zapPresale: await zapPresale.getAddress(),
    paymentToken,
    lzEndpoint,
  };
}

async function deployArbitrumSepolia(deployer: ethers.Wallet): Promise<DeploymentResult> {
  const chainId = 421614;
  const lzEndpoint = LAYERZERO_ENDPOINTS.arbitrumSepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.arbitrumSepolia;
  const dexRouter = DEX_ROUTERS.testnet.arbitrumSepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.arbitrumSepolia;

  console.log("📦 Deploying ShieldOFT (Arbitrum Sepolia)...");
  const OFT = await getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("⚠️  Skipping ZapPresale deployment (DEX router not verified on testnet)");
  const ZapPresale = await getContractFactory("ZapPresale");
  const zapPresale = await ZapPresale.deploy(
    await presale.getAddress(),
    dexRouter,
    wrappedNative,
    deployer.address
  );
  await zapPresale.waitForDeployment();
  console.log(`   ZapPresale: ${await zapPresale.getAddress()}`);

  console.log("\n⚙️  Configuring contracts...");
  
  await zapPresale.addSupportedToken(wrappedNative, 3000);
  console.log("   Added WETH to ZapPresale supported tokens");

  await configurePresaleStages(presale);

  return {
    network: "arbitrumSepolia",
    chainId,
    shieldOFT: await oft.getAddress(),
    presale: await presale.getAddress(),
    zapPresale: await zapPresale.getAddress(),
    paymentToken,
    lzEndpoint,
  };
}

async function deploySepolia(deployer: ethers.Wallet): Promise<DeploymentResult> {
  const chainId = 11155111;
  const lzEndpoint = LAYERZERO_ENDPOINTS.sepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.sepolia;
  const dexRouter = DEX_ROUTERS.testnet.sepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.sepolia;

  console.log("📦 Deploying ShieldOFT (Ethereum Sepolia)...");
  const OFT = await getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("⚠️  Skipping ZapPresale deployment (DEX router not verified on testnet)");
  const ZapPresale = await getContractFactory("ZapPresale");
  const zapPresale = await ZapPresale.deploy(
    await presale.getAddress(),
    dexRouter,
    wrappedNative,
    deployer.address
  );
  await zapPresale.waitForDeployment();
  console.log(`   ZapPresale: ${await zapPresale.getAddress()}`);

  console.log("\n⚙️  Configuring contracts...");
  
  await zapPresale.addSupportedToken(wrappedNative, 3000);
  console.log("   Added WETH to ZapPresale supported tokens");

  await configurePresaleStages(presale);

  return {
    network: "sepolia",
    chainId,
    shieldOFT: await oft.getAddress(),
    presale: await presale.getAddress(),
    zapPresale: await zapPresale.getAddress(),
    paymentToken,
    lzEndpoint,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
