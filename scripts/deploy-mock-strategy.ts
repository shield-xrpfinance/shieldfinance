import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHXRP_VAULT_ABI = [
  "function owner() view returns (address)",
  "function addStrategy(address strategy, uint256 targetBps) external",
  "function activateStrategy(address strategy) external",
  "function strategies(address) view returns (address strategyAddress, uint256 targetBps, uint8 status, uint256 totalDeployed, uint256 lastReportTimestamp)",
  "function strategyList(uint256) view returns (address)",
  "function addOperator(address operator) external",
  "function operators(address) view returns (bool)",
  "function bufferTargetBps() view returns (uint256)",
  "function totalStrategyTargetBps() view returns (uint256)",
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
] as const;

const MOCK_STRATEGY_ABI = [
  "function name() view returns (string)",
  "function asset() view returns (address)",
  "function isActive() view returns (bool)",
  "function activate() external",
  "function totalAssets() view returns (uint256)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function grantRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function setYieldAmount(uint256 amount) external",
  "function getState() view returns (uint256, uint256, uint256, uint256, uint256, bool)",
] as const;

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 MOCK STRATEGY DEPLOYMENT FOR TESTNET SIMULATION");
  console.log("=".repeat(60) + "\n");

  const COSTON2_RPC = process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
  const COSTON2_CHAIN_ID = 114;
  
  const network = hre.network;
  const ethers = (hre as any).ethers;
  const networkName = network?.name || "coston2";
  const networkConfig = (network?.config as any) || {};
  
  console.log("📡 Network:", networkName);
  console.log("📡 Chain ID:", networkConfig.chainId || COSTON2_CHAIN_ID);
  console.log("📡 RPC URL:", networkConfig.url || COSTON2_RPC);
  
  // Use configured network or fallback to Coston2
  const rpcUrl = networkConfig.url || COSTON2_RPC;
  const chainId = networkConfig.chainId || COSTON2_CHAIN_ID;
  
  if (chainId !== 114) {
    console.error("❌ This script is intended for Coston2 testnet only (chainId 114)");
    console.log("Run with: npx hardhat run scripts/deploy-mock-strategy.ts --network coston2");
    process.exit(1);
  }

  const provider = new ethersLib.JsonRpcProvider(
    rpcUrl,
    { chainId, name: "coston2" }
  );
  
  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.OPERATOR_PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY or OPERATOR_PRIVATE_KEY not set");
    process.exit(1);
  }
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY!;
  const deployer = new ethersLib.Wallet(privateKey, provider);
  
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethersLib.formatEther(balance), "C2FLR\n");

  if (balance < ethersLib.parseEther("0.1")) {
    console.error("❌ Insufficient balance for deployment");
    process.exit(1);
  }

  const deploymentsDir = path.join(__dirname, "../deployments");
  const latestDeploymentFile = path.join(deploymentsDir, "coston2-latest.json");
  
  if (!fs.existsSync(latestDeploymentFile)) {
    console.error("❌ coston2-latest.json not found!");
    process.exit(1);
  }

  const existingDeployment = JSON.parse(fs.readFileSync(latestDeploymentFile, "utf-8"));
  const fxrpAddress = existingDeployment.contracts.FXRP?.address;
  const vaultAddress = existingDeployment.contracts?.ShXRPVault?.address || process.env.VITE_SHXRP_VAULT_ADDRESS;

  if (!fxrpAddress) {
    console.error("❌ FXRP address not found!");
    process.exit(1);
  }

  if (!vaultAddress) {
    console.error("❌ ShXRPVault address not found!");
    process.exit(1);
  }

  console.log("📋 Contract Addresses:");
  console.log("   FXRP Token:", fxrpAddress);
  console.log("   ShXRPVault:", vaultAddress);
  console.log("");

  console.log("1️⃣ Deploying MockStrategy...");
  
  // Get contract factory through proper HRE ethers
  const hreEthers = (hre as any).ethers;
  if (!hreEthers || !hreEthers.getContractFactory) {
    // Fallback: deploy using direct provider and bytecode
    console.log("   Using direct deployment method...");
    const artifact = JSON.parse(fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/test/MockStrategy.sol/MockStrategy.json"),
      "utf-8"
    ));
    
    const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const mockStrategyContract = await factory.deploy(
      fxrpAddress,
      deployer.address,
      deployer.address,
      "MockFirelight"
    );
    await mockStrategyContract.waitForDeployment();
    var mockStrategyAddress = await mockStrategyContract.getAddress();
    var mockStrategy = new ethersLib.Contract(mockStrategyAddress, MOCK_STRATEGY_ABI, deployer);
  } else {
    const MockStrategy = await hreEthers.getContractFactory("MockStrategy", deployer);
    const mockStrategyContract = await MockStrategy.deploy(
      fxrpAddress,
      deployer.address,
      deployer.address,
      "MockFirelight"
    );
    await mockStrategyContract.waitForDeployment();
    var mockStrategyAddress = await mockStrategyContract.getAddress();
    var mockStrategy = new ethersLib.Contract(mockStrategyAddress, MOCK_STRATEGY_ABI, deployer);
  }
  console.log("✅ MockStrategy deployed:", mockStrategyAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${mockStrategyAddress}`);

  console.log("\n2️⃣ Configuring MockStrategy...");
  const operatorRole = await mockStrategy.OPERATOR_ROLE();
  
  console.log("   Granting OPERATOR_ROLE to vault...");
  const grantRoleTx = await mockStrategy.grantRole(operatorRole, vaultAddress);
  await grantRoleTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to vault");

  console.log("   Granting OPERATOR_ROLE to deployer (for test calls)...");
  const grantRoleDeployerTx = await mockStrategy.grantRole(operatorRole, deployer.address);
  await grantRoleDeployerTx.wait();
  console.log("   ✅ OPERATOR_ROLE granted to deployer");

  console.log("   Activating strategy...");
  const activateTx = await mockStrategy.activate();
  await activateTx.wait();
  console.log("   ✅ Strategy activated");

  console.log("\n3️⃣ Adding MockStrategy to ShXRPVault...");
  const vault = new ethersLib.Contract(vaultAddress, SHXRP_VAULT_ABI, deployer);
  
  const vaultOwner = await vault.owner();
  if (vaultOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("   ⚠️  Deployer is not vault owner. Owner:", vaultOwner);
    console.log("   Skipping vault registration - please run the following from vault owner:");
    console.log(`      vault.addStrategy("${mockStrategyAddress}", 5000) // 50% allocation`);
    console.log(`      vault.activateStrategy("${mockStrategyAddress}")`);
    console.log(`      vault.addOperator("${deployer.address}") // for test calls`);
  } else {
    const currentBufferBps = await vault.bufferTargetBps();
    const currentStrategyBps = await vault.totalStrategyTargetBps();
    console.log("   Current buffer:", currentBufferBps.toString(), "bps");
    console.log("   Current strategy total:", currentStrategyBps.toString(), "bps");
    
    const remainingBps = 10000n - currentBufferBps - currentStrategyBps;
    const mockTargetBps = remainingBps > 5000n ? 5000n : remainingBps;
    
    if (mockTargetBps > 0) {
      console.log(`   Adding strategy with ${mockTargetBps} bps (${Number(mockTargetBps) / 100}%)...`);
      const addTx = await vault.addStrategy(mockStrategyAddress, mockTargetBps);
      await addTx.wait();
      console.log("   ✅ Strategy added to vault");
      
      console.log("   Activating strategy in vault...");
      const activateInVaultTx = await vault.activateStrategy(mockStrategyAddress);
      await activateInVaultTx.wait();
      console.log("   ✅ Strategy activated in vault");
    } else {
      console.log("   ⚠️  No room for additional strategy allocation");
    }
  }

  console.log("\n4️⃣ Adding vault as operator (if needed)...");
  const isOperator = await vault.operators(deployer.address);
  if (!isOperator) {
    try {
      const addOpTx = await vault.addOperator(deployer.address);
      await addOpTx.wait();
      console.log("   ✅ Deployer added as vault operator");
    } catch (e) {
      console.log("   ⚠️  Could not add operator (may already be set or permission issue)");
    }
  } else {
    console.log("   ✅ Deployer is already vault operator");
  }

  const deploymentInfo = {
    network: "coston2",
    chainId: 114,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MockStrategy: {
        address: mockStrategyAddress,
        fxrpToken: fxrpAddress,
        vault: vaultAddress,
        name: "MockFirelight",
        explorerUrl: `https://coston2-explorer.flare.network/address/${mockStrategyAddress}`
      }
    }
  };

  const mockDeploymentFile = path.join(deploymentsDir, "coston2-mock-strategy.json");
  fs.writeFileSync(mockDeploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment saved:", mockDeploymentFile);

  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("   MockStrategy:", mockStrategyAddress);
  console.log("   Name: MockFirelight");
  console.log("   Status: ACTIVE");
  console.log("   FXRP Token:", fxrpAddress);
  console.log("   Linked Vault:", vaultAddress);

  console.log("\n📋 NEXT STEPS:");
  console.log("   1. Run the simulation test:");
  console.log("      npx hardhat run scripts/test-vault-simulation.ts --network coston2");
  console.log("   2. Simulate yield by calling:");
  console.log(`      mockStrategy.setYieldAmount(1000000) // 1 FXRP yield`);
  console.log("   3. Check strategy state:");
  console.log(`      mockStrategy.getState()`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
