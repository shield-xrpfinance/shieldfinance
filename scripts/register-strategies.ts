import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Strategy Registration Script
 * 
 * This script:
 * 1. Verifies deployed contracts exist and have correct interfaces
 * 2. Registers strategies with VaultController (global registry)
 * 3. Adds strategies to ShXRPVault with target allocations
 * 4. Sets up operator permissions
 * 
 * Prerequisites:
 * - Strategies must be deployed first (run: npx hardhat run scripts/deploy-strategies.ts --network coston2)
 * - VaultController must be deployed
 * - Deployer must be owner of ShXRPVault and admin of VaultController
 * 
 * Run with:
 *   npx hardhat run scripts/register-strategies.ts --network coston2
 * 
 * Environment Variables:
 *   DEPLOYER_PRIVATE_KEY or OPERATOR_PRIVATE_KEY - Required for signing transactions
 *   VITE_SHXRP_VAULT_ADDRESS - Optional, reads from deployment file if not set
 *   VAULT_CONTROLLER_ADDRESS - Optional, reads from deployment file if not set
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
  "function asset() view returns (address)",
] as const;

const STRATEGY_ABI = [
  "function name() view returns (string)",
  "function asset() view returns (address)",
  "function isActive() view returns (bool)",
  "function activate() external",
  "function vault() view returns (address)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
] as const;

const VAULT_CONTROLLER_ABI = [
  "function registerStrategy(address strategy, string calldata name) external",
  "function registeredStrategies(address) view returns (bool)",
  "function registerVault(address vault) external",
  "function registeredVaults(address) view returns (bool)",
  "function strategyList(uint256) view returns (address)",
  "function strategyNames(address) view returns (string)",
  "function getStrategyCount() view returns (uint256)",
  "function addOperator(address operator) external",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
] as const;

enum StrategyStatus {
  Inactive = 0,
  Active = 1,
  Paused = 2,
  Deprecated = 3
}

interface ContractAddresses {
  vaultAddress: string;
  vaultControllerAddress: string;
  kineticStrategyAddress: string;
  firelightStrategyAddress: string;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔧 STRATEGY REGISTRATION SCRIPT");
  console.log("=".repeat(60) + "\n");

  const network = hre.network as any;
  
  console.log("📡 Network:", network.name);
  
  if (network.name !== "coston2") {
    console.error("❌ This script is intended for Coston2 testnet only");
    process.exit(1);
  }

  const provider = new ethersLib.JsonRpcProvider(
    network.config.url,
    { chainId: network.config.chainId, name: network.name }
  );
  
  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.OPERATOR_PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY or OPERATOR_PRIVATE_KEY not set");
    process.exit(1);
  }
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY!;
  const deployer = new ethersLib.Wallet(privateKey, provider);
  
  console.log("📝 Using account:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethersLib.formatEther(balance), "C2FLR\n");

  if (balance < ethersLib.parseEther("0.1")) {
    console.error("❌ Insufficient balance for gas fees");
    process.exit(1);
  }

  const addresses = loadContractAddresses();
  
  if (!addresses.vaultAddress) {
    console.error("❌ ShXRPVault address not found");
    console.log("   Set VITE_SHXRP_VAULT_ADDRESS or check deployments/coston2-latest.json");
    process.exit(1);
  }

  console.log("📋 Contract Addresses:");
  console.log("   ShXRPVault:", addresses.vaultAddress);
  console.log("   VaultController:", addresses.vaultControllerAddress || "Not found");
  console.log("   KineticStrategy:", addresses.kineticStrategyAddress || "Not deployed");
  console.log("   FirelightStrategy:", addresses.firelightStrategyAddress || "Not deployed");
  console.log("");

  const vault = new ethersLib.Contract(addresses.vaultAddress, SHXRP_VAULT_ABI, deployer);

  console.log("🔐 Checking permissions...");
  const owner = await vault.owner();
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is not the vault owner");
    console.log("   Owner:", owner);
    console.log("   Deployer:", deployer.address);
    process.exit(1);
  }
  console.log("   ✅ Deployer is vault owner\n");

  const bufferTargetBps = await vault.bufferTargetBps();
  const totalStrategyTargetBps = await vault.totalStrategyTargetBps();
  const availableBps = 10000 - Number(bufferTargetBps) - Number(totalStrategyTargetBps);
  
  console.log("📊 Current Vault Allocation:");
  console.log("   Buffer Target:", Number(bufferTargetBps) / 100, "%");
  console.log("   Total Strategy Targets:", Number(totalStrategyTargetBps) / 100, "%");
  console.log("   Available for new strategies:", availableBps / 100, "%");
  console.log("");

  let vaultController: ethersLib.Contract | null = null;
  if (addresses.vaultControllerAddress) {
    vaultController = new ethersLib.Contract(
      addresses.vaultControllerAddress, 
      VAULT_CONTROLLER_ABI, 
      deployer
    );

    console.log("1️⃣ VaultController Setup");
    
    const isVaultRegistered = await vaultController.registeredVaults(addresses.vaultAddress)
      .catch(() => false);
    
    if (!isVaultRegistered) {
      console.log("   Registering vault with VaultController...");
      try {
        const tx = await vaultController.registerVault(addresses.vaultAddress);
        await tx.wait();
        console.log("   ✅ Vault registered with VaultController");
      } catch (error: any) {
        console.warn("   ⚠️  Could not register vault:", error.message?.split('\n')[0]);
      }
    } else {
      console.log("   ✅ Vault already registered with VaultController");
    }

    const isOperator = await vault.operators(addresses.vaultControllerAddress);
    if (!isOperator) {
      console.log("   Adding VaultController as vault operator...");
      try {
        const tx = await vault.addOperator(addresses.vaultControllerAddress);
        await tx.wait();
        console.log("   ✅ VaultController added as operator");
      } catch (error: any) {
        console.warn("   ⚠️  Could not add as operator:", error.message?.split('\n')[0]);
      }
    } else {
      console.log("   ✅ VaultController already an operator");
    }
    console.log("");
  }

  if (addresses.kineticStrategyAddress) {
    console.log("2️⃣ KineticStrategy Registration");
    await registerStrategyWithVault(
      vault,
      vaultController,
      deployer,
      addresses.kineticStrategyAddress,
      "Kinetic",
      4000
    );
    console.log("");
  } else {
    console.log("2️⃣ KineticStrategy: Skipped (not deployed)\n");
  }

  if (addresses.firelightStrategyAddress) {
    console.log("3️⃣ FirelightStrategy Registration");
    await registerStrategyWithVault(
      vault,
      vaultController,
      deployer,
      addresses.firelightStrategyAddress,
      "Firelight",
      5000
    );
    console.log("");
  } else {
    console.log("3️⃣ FirelightStrategy: Skipped (not deployed)\n");
  }

  console.log("=".repeat(60));
  console.log("📊 FINAL STATUS");
  console.log("=".repeat(60));
  
  const finalBufferBps = await vault.bufferTargetBps();
  const finalStrategyBps = await vault.totalStrategyTargetBps();
  
  console.log("\nVault Allocation Summary:");
  console.log("   Buffer Target:", Number(finalBufferBps) / 100, "%");
  console.log("   Strategy Targets:", Number(finalStrategyBps) / 100, "%");
  console.log("   Total:", (Number(finalBufferBps) + Number(finalStrategyBps)) / 100, "%");
  
  if (addresses.kineticStrategyAddress) {
    try {
      const kineticInfo = await vault.strategies(addresses.kineticStrategyAddress);
      console.log("\nKineticStrategy:");
      console.log("   Address:", addresses.kineticStrategyAddress);
      console.log("   Target:", Number(kineticInfo.targetBps) / 100, "%");
      console.log("   Status:", StrategyStatus[Number(kineticInfo.status)]);
    } catch (e) {
      console.log("\nKineticStrategy: Not registered");
    }
  }
  
  if (addresses.firelightStrategyAddress) {
    try {
      const firelightInfo = await vault.strategies(addresses.firelightStrategyAddress);
      console.log("\nFirelightStrategy:");
      console.log("   Address:", addresses.firelightStrategyAddress);
      console.log("   Target:", Number(firelightInfo.targetBps) / 100, "%");
      console.log("   Status:", StrategyStatus[Number(firelightInfo.status)]);
    } catch (e) {
      console.log("\nFirelightStrategy: Not registered");
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Strategy registration complete!");
  console.log("=".repeat(60) + "\n");

  console.log("📋 NEXT STEPS:");
  console.log("1. Activate strategies when ready:");
  console.log("   vault.setStrategyStatus(address, 1) for Active");
  console.log("");
  console.log("2. Trigger rebalancing via API:");
  console.log("   POST /api/strategies/rebalance");
  console.log("");
  console.log("3. Monitor allocations:");
  console.log("   GET /api/strategies/status");
  console.log("");
}

function loadContractAddresses(): ContractAddresses {
  const deploymentsDir = path.join(process.cwd(), "deployments");
  const result: ContractAddresses = {
    vaultAddress: process.env.VITE_SHXRP_VAULT_ADDRESS || '',
    vaultControllerAddress: process.env.VAULT_CONTROLLER_ADDRESS || '',
    kineticStrategyAddress: process.env.KINETIC_STRATEGY_ADDRESS || '',
    firelightStrategyAddress: process.env.FIRELIGHT_STRATEGY_ADDRESS || '',
  };

  const latestFile = path.join(deploymentsDir, "coston2-latest.json");
  if (fs.existsSync(latestFile)) {
    const deployment = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
    if (!result.vaultAddress) {
      result.vaultAddress = deployment.contracts?.ShXRPVault?.address || '';
    }
    if (!result.vaultControllerAddress) {
      result.vaultControllerAddress = deployment.contracts?.VaultController?.address || '';
    }
  }

  const strategiesFile = path.join(deploymentsDir, "coston2-strategies.json");
  if (fs.existsSync(strategiesFile)) {
    const deployment = JSON.parse(fs.readFileSync(strategiesFile, "utf-8"));
    if (!result.kineticStrategyAddress) {
      result.kineticStrategyAddress = deployment.contracts?.KineticStrategy?.address || '';
    }
    if (!result.firelightStrategyAddress) {
      result.firelightStrategyAddress = deployment.contracts?.FirelightStrategy?.address || '';
    }
    if (!result.vaultControllerAddress && deployment.contracts?.VaultController) {
      result.vaultControllerAddress = deployment.contracts.VaultController.address;
    }
  }

  const files = fs.readdirSync(deploymentsDir)
    .filter(f => /coston2-\d+\.json/.test(f))
    .sort()
    .reverse();
  
  for (const file of files) {
    try {
      const deployment = JSON.parse(
        fs.readFileSync(path.join(deploymentsDir, file), "utf-8")
      );
      if (!result.vaultControllerAddress && deployment.contracts?.VaultController) {
        result.vaultControllerAddress = deployment.contracts.VaultController.address;
      }
    } catch (e) {}
  }

  return result;
}

async function registerStrategyWithVault(
  vault: ethersLib.Contract,
  vaultController: ethersLib.Contract | null,
  deployer: ethersLib.Wallet,
  strategyAddress: string,
  strategyName: string,
  targetBps: number
): Promise<void> {
  const strategy = new ethersLib.Contract(strategyAddress, STRATEGY_ABI, deployer);

  console.log(`   Verifying ${strategyName}Strategy...`);
  
  let strategyAsset: string;
  try {
    strategyAsset = await strategy.asset();
  } catch (error: any) {
    console.log(`   ❌ Strategy does not implement IStrategy interface`);
    return;
  }

  const vaultAsset = await vault.asset();
  if (strategyAsset.toLowerCase() !== vaultAsset.toLowerCase()) {
    console.log(`   ❌ Asset mismatch: strategy=${strategyAsset}, vault=${vaultAsset}`);
    return;
  }
  console.log(`   ✅ Asset verified: ${strategyAsset}`);

  const existingInfo = await vault.strategies(strategyAddress);
  const isRegisteredWithVault = existingInfo.strategyAddress !== ethersLib.ZeroAddress;
  
  if (isRegisteredWithVault) {
    console.log(`   ✅ Already registered with vault`);
    console.log(`      Target: ${Number(existingInfo.targetBps) / 100}%`);
    console.log(`      Status: ${StrategyStatus[Number(existingInfo.status)]}`);
  } else {
    console.log(`   Adding to vault with ${targetBps/100}% allocation...`);
    try {
      const tx = await vault.addStrategy(strategyAddress, targetBps);
      await tx.wait();
      console.log(`   ✅ Added to vault`);
    } catch (error: any) {
      const errorMsg = error.message?.split('\n')[0] || 'Unknown error';
      console.log(`   ❌ Failed to add to vault: ${errorMsg}`);
      return;
    }
  }

  if (vaultController) {
    const isRegisteredWithController = await vaultController.registeredStrategies(strategyAddress)
      .catch(() => false);
    
    if (!isRegisteredWithController) {
      console.log(`   Registering with VaultController...`);
      try {
        const tx = await vaultController.registerStrategy(strategyAddress, strategyName);
        await tx.wait();
        console.log(`   ✅ Registered with VaultController`);
      } catch (error: any) {
        console.warn(`   ⚠️  VaultController registration failed (may not have admin role)`);
      }
    } else {
      console.log(`   ✅ Already registered with VaultController`);
    }
  }

  const vaultAddress = await vault.getAddress();
  try {
    const operatorRole = await strategy.OPERATOR_ROLE();
    const hasRole = await strategy.hasRole(operatorRole, vaultAddress);
    
    if (!hasRole) {
      console.log(`   Granting OPERATOR_ROLE to vault...`);
      const tx = await strategy.grantRole(operatorRole, vaultAddress);
      await tx.wait();
      console.log(`   ✅ OPERATOR_ROLE granted`);
    } else {
      console.log(`   ✅ Vault has OPERATOR_ROLE`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Could not set up OPERATOR_ROLE (may not have admin role on strategy)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Registration failed:", error);
    process.exit(1);
  });
