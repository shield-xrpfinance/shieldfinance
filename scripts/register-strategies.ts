import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Strategy Registration Script
 * 
 * This script:
 * 1. Loads deployed strategy addresses from coston2-strategies.json
 * 2. Registers them with ShXRPVault using addStrategy()
 * 3. Activates strategies that are ready
 * 4. Grants OPERATOR_ROLE to the VaultController
 * 
 * Run with:
 *   npx hardhat run scripts/register-strategies.ts --network coston2
 */

const SHXRP_VAULT_ABI = [
  "function owner() view returns (address)",
  "function addStrategy(address strategy, uint256 targetBps) external",
  "function setStrategyStatus(address strategy, uint8 status) external",
  "function strategies(address) view returns (address strategyAddress, uint256 targetBps, uint8 status, uint256 totalDeployed, uint256 lastReportTimestamp)",
  "function strategyList(uint256) view returns (address)",
  "function addOperator(address operator) external",
  "function operators(address) view returns (bool)",
  "function bufferTargetBps() view returns (uint256)",
  "function totalStrategyTargetBps() view returns (uint256)",
] as const;

const STRATEGY_ABI = [
  "function name() view returns (string)",
  "function asset() view returns (address)",
  "function isActive() view returns (bool)",
  "function activate() external",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
] as const;

const VAULT_CONTROLLER_ABI = [
  "function registerStrategy(address strategy, string calldata name) external",
  "function registeredStrategies(address) view returns (bool)",
  "function registerVault(address vault) external",
  "function registeredVaults(address) view returns (bool)",
] as const;

// Strategy status enum matching ShXRPVault
enum StrategyStatus {
  Inactive = 0,
  Active = 1,
  Paused = 2,
  Deprecated = 3
}

async function main() {
  console.log("🔧 Strategy Registration Script\n");

  const network = hre.network as any;
  const ethers = (hre as any).ethers;
  
  console.log("📡 Network:", network.name);
  
  if (network.name !== "coston2") {
    console.error("❌ This script is intended for Coston2 testnet only");
    process.exit(1);
  }

  // Create provider and wallet
  const provider = new ethersLib.JsonRpcProvider(
    network.config.url,
    { chainId: network.config.chainId, name: network.name }
  );
  
  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.OPERATOR_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY or OPERATOR_PRIVATE_KEY not set");
  }
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY!;
  const deployer = new ethersLib.Wallet(privateKey, provider);
  console.log("📝 Using account:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethersLib.formatEther(balance), "C2FLR\n");

  // Load deployment files
  const deploymentsDir = path.join(__dirname, "../deployments");
  
  // Get vault address from env or deployment file
  let vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS || '';
  
  if (!vaultAddress) {
    const latestDeploymentPath = path.join(deploymentsDir, "coston2-latest.json");
    if (fs.existsSync(latestDeploymentPath)) {
      const latestDeployment = JSON.parse(fs.readFileSync(latestDeploymentPath, 'utf-8'));
      vaultAddress = latestDeployment.contracts?.ShXRPVault?.address || '';
    }
  }
  
  if (!vaultAddress || !ethersLib.isAddress(vaultAddress)) {
    console.error("❌ Valid ShXRPVault address not found!");
    console.log("Set VITE_SHXRP_VAULT_ADDRESS environment variable");
    process.exit(1);
  }
  
  console.log("📋 ShXRPVault:", vaultAddress);

  // Load strategy deployment file
  const strategyDeploymentPath = path.join(deploymentsDir, "coston2-strategies.json");
  let strategyDeployment: any = null;
  
  if (fs.existsSync(strategyDeploymentPath)) {
    strategyDeployment = JSON.parse(fs.readFileSync(strategyDeploymentPath, 'utf-8'));
    console.log("📋 Strategy deployment found");
  } else {
    console.log("⚠️  Strategy deployment file not found");
    console.log("   Run: npx hardhat run scripts/deploy-strategies.ts --network coston2");
    console.log("\nContinuing with manual addresses from environment...\n");
  }

  // Get strategy addresses
  let kineticStrategyAddress = strategyDeployment?.contracts?.KineticStrategy?.address 
    || process.env.KINETIC_STRATEGY_ADDRESS || '';
  let firelightStrategyAddress = strategyDeployment?.contracts?.FirelightStrategy?.address 
    || process.env.FIRELIGHT_STRATEGY_ADDRESS || '';
  let vaultControllerAddress = process.env.VAULT_CONTROLLER_ADDRESS || '';
  
  // Load VaultController from deployment
  const allFilesDeploymentPath = path.join(deploymentsDir, "coston2-deployment.json");
  if (fs.existsSync(allFilesDeploymentPath) && !vaultControllerAddress) {
    const allDeployment = JSON.parse(fs.readFileSync(allFilesDeploymentPath, 'utf-8'));
    vaultControllerAddress = allDeployment.contracts?.VaultController?.address || '';
  }

  console.log("\n📊 Contract Addresses:");
  console.log("   ShXRPVault:", vaultAddress);
  console.log("   VaultController:", vaultControllerAddress || "Not deployed");
  console.log("   KineticStrategy:", kineticStrategyAddress || "Not deployed");
  console.log("   FirelightStrategy:", firelightStrategyAddress || "Not deployed");
  console.log("");

  // Connect to contracts
  const vault = new ethersLib.Contract(vaultAddress, SHXRP_VAULT_ABI, deployer);

  // Check ownership
  const owner = await vault.owner();
  console.log("🔐 Vault owner:", owner);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the vault owner!");
    console.log("   Owner:", owner);
    console.log("   Deployer:", deployer.address);
    process.exit(1);
  }
  console.log("✅ Deployer is vault owner\n");

  // Get current allocation state
  const bufferTargetBps = await vault.bufferTargetBps();
  const totalStrategyTargetBps = await vault.totalStrategyTargetBps();
  
  console.log("📊 Current Vault Allocation:");
  console.log("   Buffer Target:", Number(bufferTargetBps) / 100, "%");
  console.log("   Total Strategy Targets:", Number(totalStrategyTargetBps) / 100, "%");
  console.log("   Available for new strategies:", (10000 - Number(bufferTargetBps) - Number(totalStrategyTargetBps)) / 100, "%");
  console.log("");

  // Register VaultController as operator if available
  if (vaultControllerAddress && ethersLib.isAddress(vaultControllerAddress)) {
    console.log("1️⃣ Checking VaultController operator status...");
    
    const isOperator = await vault.operators(vaultControllerAddress);
    if (!isOperator) {
      console.log("   Adding VaultController as operator...");
      const tx = await vault.addOperator(vaultControllerAddress);
      await tx.wait();
      console.log("   ✅ VaultController added as operator");
    } else {
      console.log("   ✅ VaultController already an operator");
    }
    console.log("");
  }

  // Process Kinetic Strategy
  if (kineticStrategyAddress && ethersLib.isAddress(kineticStrategyAddress)) {
    console.log("2️⃣ Processing KineticStrategy...");
    
    await registerStrategy(
      vault,
      deployer,
      kineticStrategyAddress,
      "Kinetic",
      4000, // 40% allocation
      vaultControllerAddress
    );
    console.log("");
  }

  // Process Firelight Strategy
  if (firelightStrategyAddress && ethersLib.isAddress(firelightStrategyAddress)) {
    console.log("3️⃣ Processing FirelightStrategy...");
    
    await registerStrategy(
      vault,
      deployer,
      firelightStrategyAddress,
      "Firelight",
      5000, // 50% allocation
      vaultControllerAddress
    );
    console.log("");
  }

  // Final status
  console.log("=".repeat(60));
  console.log("📊 FINAL REGISTRATION STATUS");
  console.log("=".repeat(60));
  
  const finalBufferBps = await vault.bufferTargetBps();
  const finalStrategyBps = await vault.totalStrategyTargetBps();
  
  console.log("Vault Allocation:");
  console.log("   Buffer Target:", Number(finalBufferBps) / 100, "%");
  console.log("   Strategy Targets:", Number(finalStrategyBps) / 100, "%");
  console.log("   Total:", (Number(finalBufferBps) + Number(finalStrategyBps)) / 100, "%");
  
  if (kineticStrategyAddress) {
    const kineticInfo = await vault.strategies(kineticStrategyAddress);
    console.log("\nKineticStrategy:");
    console.log("   Address:", kineticStrategyAddress);
    console.log("   Target:", Number(kineticInfo.targetBps) / 100, "%");
    console.log("   Status:", StrategyStatus[Number(kineticInfo.status)]);
  }
  
  if (firelightStrategyAddress) {
    const firelightInfo = await vault.strategies(firelightStrategyAddress);
    console.log("\nFirelightStrategy:");
    console.log("   Address:", firelightStrategyAddress);
    console.log("   Target:", Number(firelightInfo.targetBps) / 100, "%");
    console.log("   Status:", StrategyStatus[Number(firelightInfo.status)]);
  }
  
  console.log("\n✅ Strategy registration complete!");
  console.log("=".repeat(60) + "\n");

  console.log("📋 NEXT STEPS:");
  console.log("1. Activate strategies when ready:");
  console.log("   - Call setStrategyStatus(address, 1) for Active");
  console.log("2. Trigger rebalancing via API:");
  console.log("   - POST /api/strategies/rebalance");
  console.log("3. Monitor allocations:");
  console.log("   - GET /api/strategies/status");
  console.log("");
}

async function registerStrategy(
  vault: ethersLib.Contract,
  deployer: ethersLib.Wallet,
  strategyAddress: string,
  strategyName: string,
  targetBps: number,
  vaultControllerAddress: string
): Promise<void> {
  const strategy = new ethersLib.Contract(strategyAddress, STRATEGY_ABI, deployer);
  
  // Check if already registered
  const existingInfo = await vault.strategies(strategyAddress);
  
  if (existingInfo.strategyAddress !== ethersLib.ZeroAddress) {
    console.log(`   ✅ ${strategyName}Strategy already registered`);
    console.log("      Current allocation:", Number(existingInfo.targetBps) / 100, "%");
    console.log("      Status:", StrategyStatus[Number(existingInfo.status)]);
    return;
  }
  
  // Verify strategy asset matches vault
  const strategyAsset = await strategy.asset();
  console.log(`   Verifying ${strategyName}Strategy...`);
  console.log("      Asset:", strategyAsset);
  
  // Add strategy to vault
  console.log(`   Adding ${strategyName}Strategy to vault (${targetBps/100}% allocation)...`);
  const addTx = await vault.addStrategy(strategyAddress, targetBps);
  await addTx.wait();
  console.log(`   ✅ ${strategyName}Strategy added to vault`);
  
  // Grant OPERATOR_ROLE to vault on the strategy
  const operatorRole = await strategy.OPERATOR_ROLE();
  const vaultAddress = await vault.getAddress();
  
  const hasRole = await strategy.hasRole(operatorRole, vaultAddress);
  if (!hasRole) {
    console.log(`   Granting OPERATOR_ROLE to vault on ${strategyName}Strategy...`);
    const grantTx = await strategy.grantRole(operatorRole, vaultAddress);
    await grantTx.wait();
    console.log(`   ✅ OPERATOR_ROLE granted`);
  } else {
    console.log(`   ✅ Vault already has OPERATOR_ROLE`);
  }
  
  // Register with VaultController if available
  if (vaultControllerAddress && ethersLib.isAddress(vaultControllerAddress)) {
    const vaultController = new ethersLib.Contract(
      vaultControllerAddress, 
      VAULT_CONTROLLER_ABI, 
      deployer
    );
    
    const isRegistered = await vaultController.registeredStrategies(strategyAddress);
    if (!isRegistered) {
      console.log(`   Registering ${strategyName}Strategy with VaultController...`);
      try {
        const registerTx = await vaultController.registerStrategy(strategyAddress, strategyName);
        await registerTx.wait();
        console.log(`   ✅ Registered with VaultController`);
      } catch (error: any) {
        console.log(`   ⚠️  VaultController registration failed: ${error.message}`);
      }
    } else {
      console.log(`   ✅ Already registered with VaultController`);
    }
  }
  
  // Check if strategy is active
  const isActive = await strategy.isActive();
  console.log(`   Strategy active:`, isActive ? "Yes" : "No (needs activation)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Registration failed:", error);
    process.exit(1);
  });
