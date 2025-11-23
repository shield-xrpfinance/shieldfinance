import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ShieldTokenArtifact from "../artifacts/contracts/ShieldToken.sol/ShieldToken.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy NEW SHIELD Token with 10M Supply
 * 
 * This script deploys a fresh ShieldToken contract with exactly 10,000,000 SHIELD
 * tokens minted to the deployer address.
 * 
 * The contract:
 * - Total Supply: 10,000,000 SHIELD (10M tokens with 18 decimals)
 * - All tokens minted to deployer at deployment
 * - Burnable (ERC20Burnable)
 * - No taxes, no restrictions
 * 
 * Execution: npx tsx scripts/deploy-shield-10m.ts
 */

async function main() {
  console.log("🛡️  Deploy NEW SHIELD Token (10M Supply)");
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

  // Connect to network
  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n💼 Deployer Address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Deployer Balance:", ethers.formatEther(balance), "FLR");

  if (balance === 0n) {
    throw new Error("❌ Deployer has no balance! Get FLR from: https://faucet.flare.network/coston2");
  }

  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  WARNING: Balance below 0.1 FLR. Deployment may fail.");
  }

  // Check for existing deployment in this session
  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFile = path.join(deploymentsDir, "coston2-shield-10m.json");

  if (fs.existsSync(deploymentFile)) {
    console.log("\n⚠️  IDEMPOTENCY CHECK:");
    console.log("   Found existing deployment at:", deploymentFile);
    
    const existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
    console.log("   Existing SHIELD Token:", existingDeployment.contracts.ShieldToken.address);
    console.log("   Deployed at:", existingDeployment.timestamp);
    
    console.log("\n❓ Skip re-deployment? (existing deployment found)");
    console.log("   To force re-deploy, delete:", deploymentFile);
    console.log("\n   Exiting to prevent duplicate deployment.");
    process.exit(0);
  }

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYING SHIELD TOKEN");
  console.log("=".repeat(60));

  // Deploy ShieldToken
  console.log("\n🚀 Deploying ShieldToken...");
  console.log("   Name: ShieldToken");
  console.log("   Symbol: SHIELD");
  console.log("   Total Supply: 10,000,000 SHIELD");
  console.log("   Decimals: 18");

  const ShieldToken = new ethers.ContractFactory(
    ShieldTokenArtifact.abi,
    ShieldTokenArtifact.bytecode,
    wallet
  );

  const shieldToken = await ShieldToken.deploy();
  await shieldToken.waitForDeployment();

  const shieldTokenAddress = await shieldToken.getAddress();
  const deploymentTx = shieldToken.deploymentTransaction();
  
  if (!deploymentTx) {
    throw new Error("❌ Deployment transaction not found");
  }

  const txHash = deploymentTx.hash;
  const receipt = await deploymentTx.wait();
  
  if (!receipt) {
    throw new Error("❌ Transaction receipt not found");
  }

  const blockNumber = receipt.blockNumber;
  const block = await provider.getBlock(blockNumber);
  const timestamp = block ? block.timestamp : Math.floor(Date.now() / 1000);

  console.log("   ✅ ShieldToken deployed!");
  console.log("   Address:", shieldTokenAddress);
  console.log("   TX Hash:", txHash);
  console.log("   Block:", blockNumber);

  // Verify deployment
  console.log("\n🔍 Verifying Deployment...");

  // Check total supply
  const totalSupply = await shieldToken.totalSupply();
  const totalSupplyFormatted = ethers.formatEther(totalSupply);
  const expectedSupply = "10000000.0";

  console.log("   Total Supply:", totalSupplyFormatted, "SHIELD");
  
  if (totalSupplyFormatted !== expectedSupply) {
    throw new Error(
      `❌ Total supply mismatch! Expected: ${expectedSupply}, Got: ${totalSupplyFormatted}`
    );
  }
  console.log("   ✅ Total supply verified: 10,000,000 SHIELD");

  // Check deployer balance
  const deployerBalance = await shieldToken.balanceOf(wallet.address);
  const deployerBalanceFormatted = ethers.formatEther(deployerBalance);

  console.log("   Deployer Balance:", deployerBalanceFormatted, "SHIELD");

  if (deployerBalanceFormatted !== expectedSupply) {
    throw new Error(
      `❌ Deployer balance mismatch! Expected: ${expectedSupply}, Got: ${deployerBalanceFormatted}`
    );
  }
  console.log("   ✅ Deployer balance verified: 10,000,000 SHIELD");

  // Check token details
  const name = await shieldToken.name();
  const symbol = await shieldToken.symbol();
  const decimals = await shieldToken.decimals();

  console.log("\n📊 Token Details:");
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Decimals:", decimals);
  console.log("   Total Supply:", totalSupplyFormatted, "SHIELD");
  console.log("   Supply (raw):", totalSupply.toString(), "wei");

  if (name !== "ShieldToken" || symbol !== "SHIELD" || Number(decimals) !== 18) {
    throw new Error("❌ Token details mismatch!");
  }
  console.log("   ✅ Token details verified");

  // Save deployment info
  console.log("\n💾 Saving Deployment Info...");

  const deploymentInfo = {
    network,
    chainId: networkConfig.chainId,
    timestamp: new Date(timestamp * 1000).toISOString(),
    deployer: wallet.address,
    contracts: {
      ShieldToken: {
        address: shieldTokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupplyFormatted,
        totalSupplyRaw: totalSupply.toString(),
        deployerBalance: deployerBalanceFormatted,
        deployerBalanceRaw: deployerBalance.toString(),
        transactionHash: txHash,
        blockNumber,
        explorerUrl: `${networkConfig.explorer}/address/${shieldTokenAddress}`,
        transactionUrl: `${networkConfig.explorer}/tx/${txHash}`,
      },
    },
  };

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("   ✅ Deployment saved to:", deploymentFile);

  // Display final summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ NEW SHIELD Token Deployed (10M Supply)");
  console.log("=".repeat(60));
  console.log("Address:", shieldTokenAddress);
  console.log("Total Supply:", totalSupplyFormatted, "SHIELD");
  console.log("Deployer Balance:", deployerBalanceFormatted, "SHIELD");
  console.log("TX:", txHash);
  console.log("Block:", blockNumber);
  console.log("Explorer:", `${networkConfig.explorer}/address/${shieldTokenAddress}`);
  console.log("=".repeat(60));

  console.log("\n📝 Next Steps:");
  console.log("1. Update environment variable:");
  console.log(`   VITE_SHIELD_TOKEN_ADDRESS=${shieldTokenAddress}`);
  console.log("\n2. Verify contract on block explorer:");
  console.log(`   npx hardhat verify --network coston2 ${shieldTokenAddress}`);
  console.log("\n3. Deploy dependent contracts (RevenueRouter, StakingBoost, MerkleDistributor)");
  console.log("   These contracts require the SHIELD token address");
  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
