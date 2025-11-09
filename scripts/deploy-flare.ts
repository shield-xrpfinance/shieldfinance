import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Starting Flare deployment...\n");

  // Get ethers from hre
  const { ethers } = hre;

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "FLR\n");

  if (balance === 0n) {
    console.error("❌ Error: Deployer account has zero balance!");
    console.log("Get testnet FLR from: https://faucet.flare.network/coston2");
    process.exit(1);
  }

  // Treasury address (can be same as deployer or different)
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;
  console.log("🏦 Treasury address:", treasuryAddress);

  // Deploy ShieldToken
  console.log("\n1️⃣ Deploying ShieldToken...");
  const ShieldToken = await ethers.getContractFactory("ShieldToken");
  const shieldToken = await ShieldToken.deploy(treasuryAddress);
  await shieldToken.waitForDeployment();
  const shieldTokenAddress = await shieldToken.getAddress();
  console.log("✅ ShieldToken deployed to:", shieldTokenAddress);

  // Verify token details
  const totalSupply = await shieldToken.TOTAL_SUPPLY();
  const treasuryAllocation = await shieldToken.TREASURY_ALLOCATION();
  console.log("   Total Supply:", ethers.formatEther(totalSupply), "SHIELD");
  console.log("   Treasury Allocation:", ethers.formatEther(treasuryAllocation), "SHIELD");

  // Deploy Shield XRP Vault (shXRP)
  console.log("\n2️⃣ Deploying Shield XRP Vault (shXRP)...");
  const StXRPVault = await ethers.getContractFactory("StXRPVault");
  const stXRPVault = await StXRPVault.deploy();
  await stXRPVault.waitForDeployment();
  const stXRPVaultAddress = await stXRPVault.getAddress();
  console.log("✅ Shield XRP Vault deployed to:", stXRPVaultAddress);

  // Verify vault details
  const vaultName = await stXRPVault.name();
  const vaultSymbol = await stXRPVault.symbol();
  const exchangeRate = await stXRPVault.exchangeRate();
  console.log("   Vault Token:", vaultName, `(${vaultSymbol})`);
  console.log("   Initial Exchange Rate:", ethers.formatEther(exchangeRate), "shXRP per XRP");

  // Save deployment addresses
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
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

  const networkName = (await ethers.provider.getNetwork()).name || "unknown";
  const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", deploymentInfo.network);
  console.log("Chain ID:", deploymentInfo.chainId);
  console.log("\n🪙 ShieldToken ($SHIELD):");
  console.log("   Address:", shieldTokenAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${shieldTokenAddress}`);
  console.log("\n🏦 Shield XRP Vault (shXRP):");
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
  console.log("\n3. Configure operator for Shield XRP Vault to mint/burn shXRP\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
