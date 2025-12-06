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

import hre from "hardhat";
import { 
  LAYERZERO_ENDPOINTS, 
  DEX_ROUTERS, 
  PAYMENT_TOKENS, 
  WRAPPED_NATIVE 
} from "../../shared/layerzero-config";

// Existing SHIELD token on Coston2
const SHIELD_TOKEN_COSTON2 = "0x061Cf4B8fa61bAc17AeB6990002daB1A7C416616";

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
  const network = hre.network.name;
  console.log(`\n🚀 Deploying SHIELD Presale to ${network}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  let result: DeploymentResult;

  if (network === "coston2") {
    result = await deployFlareCoston2(deployer);
  } else if (network === "baseSepolia") {
    result = await deployBaseSepolia(deployer);
  } else if (network === "arbitrumSepolia") {
    result = await deployArbitrumSepolia(deployer);
  } else if (network === "sepolia") {
    result = await deploySepolia(deployer);
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }

  console.log("\n✅ Deployment Complete!");
  console.log("━".repeat(50));
  console.log(JSON.stringify(result, null, 2));
  console.log("━".repeat(50));

  // Save deployment to file
  const fs = await import("fs");
  const path = await import("path");
  const deploymentsDir = path.join(process.cwd(), "deployments", network);
  await fs.promises.mkdir(deploymentsDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(deploymentsDir, "presale.json"),
    JSON.stringify(result, null, 2)
  );
  console.log(`\n📁 Saved to deployments/${network}/presale.json`);
}

async function deployFlareCoston2(deployer: any): Promise<DeploymentResult> {
  const chainId = 114;
  const lzEndpoint = LAYERZERO_ENDPOINTS.coston2.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.coston2;
  const dexRouter = DEX_ROUTERS.testnet.coston2.sparkdex;
  const wrappedNative = WRAPPED_NATIVE.testnets.coston2;

  console.log("📦 Deploying ShieldOFTAdapter (Flare home chain)...");
  const OFTAdapter = await hre.ethers.getContractFactory("ShieldOFTAdapter");
  const oftAdapter = await OFTAdapter.deploy(
    SHIELD_TOKEN_COSTON2,
    lzEndpoint,
    deployer.address
  );
  await oftAdapter.waitForDeployment();
  console.log(`   ShieldOFTAdapter: ${await oftAdapter.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await hre.ethers.getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("📦 Deploying ZapPresale...");
  const ZapPresale = await hre.ethers.getContractFactory("ZapPresale");
  const zapPresale = await ZapPresale.deploy(
    await presale.getAddress(),
    dexRouter,
    wrappedNative,
    deployer.address
  );
  await zapPresale.waitForDeployment();
  console.log(`   ZapPresale: ${await zapPresale.getAddress()}`);

  console.log("\n⚙️  Configuring contracts...");
  
  // Add WFLR as supported token for zap
  await zapPresale.addSupportedToken(wrappedNative, 3000); // 0.3% fee
  console.log("   Added WFLR to ZapPresale supported tokens");

  await configurePresaleStages(presale);

  return {
    network: "coston2",
    chainId,
    shieldOFTAdapter: await oftAdapter.getAddress(),
    presale: await presale.getAddress(),
    zapPresale: await zapPresale.getAddress(),
    paymentToken,
    lzEndpoint,
  };
}

async function deployBaseSepolia(deployer: any): Promise<DeploymentResult> {
  const chainId = 84532;
  const lzEndpoint = LAYERZERO_ENDPOINTS.baseSepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.baseSepolia;
  const dexRouter = DEX_ROUTERS.testnet.baseSepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.baseSepolia;

  console.log("📦 Deploying ShieldOFT (Base Sepolia)...");
  const OFT = await hre.ethers.getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await hre.ethers.getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("📦 Deploying ZapPresale...");
  const ZapPresale = await hre.ethers.getContractFactory("ZapPresale");
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

async function deployArbitrumSepolia(deployer: any): Promise<DeploymentResult> {
  const chainId = 421614;
  const lzEndpoint = LAYERZERO_ENDPOINTS.arbitrumSepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.arbitrumSepolia;
  const dexRouter = DEX_ROUTERS.testnet.arbitrumSepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.arbitrumSepolia;

  console.log("📦 Deploying ShieldOFT (Arbitrum Sepolia)...");
  const OFT = await hre.ethers.getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await hre.ethers.getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("📦 Deploying ZapPresale...");
  const ZapPresale = await hre.ethers.getContractFactory("ZapPresale");
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

async function deploySepolia(deployer: any): Promise<DeploymentResult> {
  const chainId = 11155111;
  const lzEndpoint = LAYERZERO_ENDPOINTS.sepolia.endpoint;
  const paymentToken = PAYMENT_TOKENS.testnets.sepolia;
  const dexRouter = DEX_ROUTERS.testnet.sepolia.uniswapV3;
  const wrappedNative = WRAPPED_NATIVE.testnets.sepolia;

  console.log("📦 Deploying ShieldOFT (Ethereum Sepolia)...");
  const OFT = await hre.ethers.getContractFactory("ShieldOFT");
  const oft = await OFT.deploy(
    "SHIELD",
    "SHIELD",
    lzEndpoint,
    deployer.address
  );
  await oft.waitForDeployment();
  console.log(`   ShieldOFT: ${await oft.getAddress()}`);

  console.log("📦 Deploying ShieldPresale...");
  const Presale = await hre.ethers.getContractFactory("ShieldPresale");
  const presale = await Presale.deploy(
    paymentToken,
    PRESALE_CONFIG.hardCap,
    PRESALE_CONFIG.minPurchase,
    PRESALE_CONFIG.maxPurchaseKyc,
    deployer.address
  );
  await presale.waitForDeployment();
  console.log(`   ShieldPresale: ${await presale.getAddress()}`);

  console.log("📦 Deploying ZapPresale...");
  const ZapPresale = await hre.ethers.getContractFactory("ZapPresale");
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
