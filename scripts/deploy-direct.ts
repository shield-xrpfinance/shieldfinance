import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled contract ABIs
import ShieldTokenArtifact from "../artifacts/contracts/ShieldToken.sol/ShieldToken.json" assert { type: "json" };
import StXRPVaultArtifact from "../artifacts/contracts/StXRPVault.sol/StXRPVault.json" assert { type: "json" };

async function main() {
  console.log("🚀 Starting Flare Coston2 deployment...\n");

  // Network configuration
  const rpcUrl = process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required");
  }

  if (!treasuryAddress) {
    throw new Error("TREASURY_ADDRESS environment variable is required");
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("📝 Deploying contracts with account:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "CFLR\n");

  if (balance === 0n) {
    console.error("❌ Error: Deployer account has zero balance!");
    console.log("Get testnet CFLR from: https://faucet.flare.network/coston2");
    process.exit(1);
  }

  // Deploy ShieldToken
  console.log("1️⃣  Deploying ShieldToken...");
  const ShieldToken = new ethers.ContractFactory(
    ShieldTokenArtifact.abi,
    ShieldTokenArtifact.bytecode,
    wallet
  );
  const shieldToken = await ShieldToken.deploy(treasuryAddress);
  await shieldToken.waitForDeployment();
  const shieldTokenAddress = await shieldToken.getAddress();
  console.log("✅ ShieldToken deployed to:", shieldTokenAddress);

  // Verify token details
  const totalSupply = await shieldToken.TOTAL_SUPPLY();
  const treasuryAllocation = await shieldToken.TREASURY_ALLOCATION();
  console.log("   Total Supply:", ethers.formatEther(totalSupply), "SHIELD");
  console.log("   Treasury Allocation:", ethers.formatEther(treasuryAllocation), "SHIELD");

  // Deploy StXRPVault
  console.log("\n2️⃣  Deploying StXRPVault...");
  const StXRPVault = new ethers.ContractFactory(
    StXRPVaultArtifact.abi,
    StXRPVaultArtifact.bytecode,
    wallet
  );
  const stXRPVault = await StXRPVault.deploy();
  await stXRPVault.waitForDeployment();
  const stXRPVaultAddress = await stXRPVault.getAddress();
  console.log("✅ StXRPVault deployed to:", stXRPVaultAddress);

  // Verify vault details
  const vaultName = await stXRPVault.name();
  const vaultSymbol = await stXRPVault.symbol();
  const exchangeRate = await stXRPVault.exchangeRate();
  console.log("   Vault Token:", vaultName, `(${vaultSymbol})`);
  console.log("   Initial Exchange Rate:", ethers.formatEther(exchangeRate), "shXRP per XRP");

  // Get network info
  const network = await provider.getNetwork();
  
  // Save deployment addresses
  const deploymentInfo = {
    network: "coston2",
    chainId: network.chainId.toString(),
    deployer: wallet.address,
    treasury: treasuryAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      ShieldToken: {
        address: shieldTokenAddress,
        totalSupply: ethers.formatEther(totalSupply),
        treasuryAllocation: ethers.formatEther(treasuryAllocation),
      },
      StXRPVault: {
        address: stXRPVaultAddress,
        name: vaultName,
        symbol: vaultSymbol,
        exchangeRate: ethers.formatEther(exchangeRate),
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, "coston2-deployment.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network: Flare Coston2 Testnet");
  console.log("Chain ID:", deploymentInfo.chainId);
  console.log("\n🪙 ShieldToken ($SHIELD):");
  console.log("   Address:", shieldTokenAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${shieldTokenAddress}`);
  console.log("\n🏦 StXRPVault (shXRP):");
  console.log("   Address:", stXRPVaultAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${stXRPVaultAddress}`);
  console.log("\n✅ Deployment complete!");
  console.log("=".repeat(60) + "\n");

  // Next steps
  console.log("📋 NEXT STEPS:");
  console.log("1. Verify contracts on block explorer (optional):");
  console.log(`   npx hardhat verify --network coston2 ${shieldTokenAddress} "${treasuryAddress}"`);
  console.log(`   npx hardhat verify --network coston2 ${stXRPVaultAddress}`);
  console.log("\n2. Update frontend .env with contract addresses:");
  console.log(`   VITE_SHIELD_TOKEN_ADDRESS=${shieldTokenAddress}`);
  console.log(`   VITE_SHXRP_VAULT_ADDRESS=${stXRPVaultAddress}`);
  console.log("\n3. Configure operator for StXRPVault to mint/burn shXRP");
  console.log("\n4. Deploy XRPL hooks using: npm run deploy:hooks\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
