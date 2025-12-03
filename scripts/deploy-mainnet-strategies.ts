import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";

const MAINNET_ADDRESSES = {
  fxrpToken: "0x7fDB5cf1F7a75d9a47e097D73c1AF0B73d5A5d2e",
  firelightStXRP: "0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3",
  rpcUrl: "https://flare-api.flare.network/ext/C/rpc",
  chainId: 14,
  explorer: "https://flare-explorer.flare.network"
};

async function main() {
  console.log("=".repeat(70));
  console.log("🚀 MAINNET STRATEGY DEPLOYMENT");
  console.log("=".repeat(70) + "\n");

  const network = hre.network as any;
  const ethers = (hre as any).ethers;
  
  console.log("📡 Network:", network.name);
  
  if (network.name !== "mainnet" && network.name !== "flare") {
    console.error("❌ This script is intended for Flare mainnet only");
    console.log("Run with: npx hardhat run scripts/deploy-mainnet-strategies.ts --network flare");
    console.log("\nAdd to hardhat.config.ts if not present:");
    console.log(`
    flare: {
      url: "${MAINNET_ADDRESSES.rpcUrl}",
      chainId: ${MAINNET_ADDRESSES.chainId},
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    }
    `);
    process.exit(1);
  }

  const provider = new ethersLib.JsonRpcProvider(
    network.config.url || MAINNET_ADDRESSES.rpcUrl,
    { chainId: MAINNET_ADDRESSES.chainId, name: "flare" }
  );

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error("❌ DEPLOYER_PRIVATE_KEY not set");
    console.log("Set DEPLOYER_PRIVATE_KEY environment variable for mainnet deployment");
    process.exit(1);
  }

  const deployer = new ethersLib.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethersLib.formatEther(balance), "FLR");

  if (balance < ethersLib.parseEther("1")) {
    console.error("❌ Insufficient FLR for mainnet deployment (need at least 1 FLR)");
    process.exit(1);
  }

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const mainnetDeploymentFile = path.join(deploymentsDir, "mainnet-latest.json");
  let existingDeployment: any = {};
  
  if (fs.existsSync(mainnetDeploymentFile)) {
    existingDeployment = JSON.parse(fs.readFileSync(mainnetDeploymentFile, "utf-8"));
    console.log("📄 Loading existing mainnet deployment...");
  }

  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS || existingDeployment.contracts?.ShXRPVault?.address;
  const vaultControllerAddress = process.env.VAULT_CONTROLLER_ADDRESS || existingDeployment.contracts?.VaultController?.address;

  if (!vaultAddress) {
    console.error("❌ ShXRPVault address not found!");
    console.log("Set VITE_SHXRP_VAULT_ADDRESS or deploy vault first");
    process.exit(1);
  }

  console.log("\n📋 Deployment Configuration:");
  console.log("   Chain ID:", MAINNET_ADDRESSES.chainId, "(Flare Mainnet)");
  console.log("   FXRP Token:", MAINNET_ADDRESSES.fxrpToken);
  console.log("   Firelight stXRP:", MAINNET_ADDRESSES.firelightStXRP);
  console.log("   ShXRPVault:", vaultAddress);
  console.log("   VaultController:", vaultControllerAddress || "Not deployed");

  console.log("\n⚠️  MAINNET DEPLOYMENT CHECKLIST:");
  console.log("   [ ] External security audit completed?");
  console.log("   [ ] Multi-sig wallet ready for admin control?");
  console.log("   [ ] Emergency procedures documented?");
  console.log("   [ ] Monitoring/alerting infrastructure in place?");
  console.log("   [ ] Deposit caps configured for gradual rollout?");
  console.log("\nProceeding with deployment in 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("\n1️⃣ Deploying FirelightStrategy (FXRP Staking)...");
  const FirelightStrategy = await ethers.getContractFactory("FirelightStrategy");
  const firelightStrategy = await FirelightStrategy.deploy(
    MAINNET_ADDRESSES.fxrpToken,
    deployer.address,
    deployer.address
  );
  await firelightStrategy.waitForDeployment();
  const firelightStrategyAddress = await firelightStrategy.getAddress();
  console.log("✅ FirelightStrategy deployed:", firelightStrategyAddress);
  console.log("   Explorer:", `${MAINNET_ADDRESSES.explorer}/address/${firelightStrategyAddress}`);

  console.log("\n2️⃣ Deploying KineticStrategy (FXRP Lending)...");
  const KineticStrategy = await ethers.getContractFactory("KineticStrategy");
  const kineticStrategy = await KineticStrategy.deploy(
    MAINNET_ADDRESSES.fxrpToken,
    deployer.address,
    deployer.address
  );
  await kineticStrategy.waitForDeployment();
  const kineticStrategyAddress = await kineticStrategy.getAddress();
  console.log("✅ KineticStrategy deployed:", kineticStrategyAddress);
  console.log("   Explorer:", `${MAINNET_ADDRESSES.explorer}/address/${kineticStrategyAddress}`);

  console.log("\n3️⃣ Configuring FirelightStrategy...");
  const firelightOperatorRole = await firelightStrategy.OPERATOR_ROLE();
  
  if (vaultAddress) {
    console.log("   Granting OPERATOR_ROLE to vault...");
    const grantTx = await firelightStrategy.grantRole(firelightOperatorRole, vaultAddress);
    await grantTx.wait();
    console.log("   ✅ Vault granted OPERATOR_ROLE");
  }

  console.log("   Setting Firelight stXRP vault address...");
  const configTx = await firelightStrategy.setFirelightConfig(MAINNET_ADDRESSES.firelightStXRP);
  await configTx.wait();
  console.log("   ✅ Firelight stXRP configured:", MAINNET_ADDRESSES.firelightStXRP);

  console.log("\n4️⃣ Configuring KineticStrategy...");
  const kineticOperatorRole = await kineticStrategy.OPERATOR_ROLE();
  
  if (vaultAddress) {
    console.log("   Granting OPERATOR_ROLE to vault...");
    const grantTx = await kineticStrategy.grantRole(kineticOperatorRole, vaultAddress);
    await grantTx.wait();
    console.log("   ✅ Vault granted OPERATOR_ROLE");
  }

  if (process.env.KINETIC_CFXRP_ADDRESS && process.env.KINETIC_COMPTROLLER_ADDRESS) {
    console.log("   Setting Kinetic configuration...");
    const kineticConfigTx = await kineticStrategy.setKineticConfig(
      process.env.KINETIC_CFXRP_ADDRESS,
      process.env.KINETIC_COMPTROLLER_ADDRESS
    );
    await kineticConfigTx.wait();
    console.log("   ✅ Kinetic configured");
  } else {
    console.log("   ⚠️  Kinetic not configured (set KINETIC_CFXRP_ADDRESS and KINETIC_COMPTROLLER_ADDRESS)");
  }

  console.log("\n5️⃣ Verifying deployment...");
  const firelightActive = await firelightStrategy.isActive();
  const kineticActive = await kineticStrategy.isActive();
  
  console.log("   FirelightStrategy active:", firelightActive);
  console.log("   KineticStrategy active:", kineticActive);

  const deploymentInfo = {
    network: "mainnet",
    chainId: MAINNET_ADDRESSES.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ...(existingDeployment.contracts || {}),
      FirelightStrategy: {
        address: firelightStrategyAddress,
        fxrpToken: MAINNET_ADDRESSES.fxrpToken,
        firelightStXRP: MAINNET_ADDRESSES.firelightStXRP,
        admin: deployer.address,
        vaultOperator: vaultAddress,
        isActive: firelightActive,
        explorerUrl: `${MAINNET_ADDRESSES.explorer}/address/${firelightStrategyAddress}`
      },
      KineticStrategy: {
        address: kineticStrategyAddress,
        fxrpToken: MAINNET_ADDRESSES.fxrpToken,
        admin: deployer.address,
        vaultOperator: vaultAddress,
        isActive: kineticActive,
        explorerUrl: `${MAINNET_ADDRESSES.explorer}/address/${kineticStrategyAddress}`
      }
    },
    mainnetAddresses: MAINNET_ADDRESSES,
    roles: {
      DEFAULT_ADMIN_ROLE: deployer.address,
      OPERATOR_ROLE: {
        deployer: deployer.address,
        vault: vaultAddress
      }
    }
  };

  fs.writeFileSync(mainnetDeploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment saved:", mainnetDeploymentFile);

  console.log("\n" + "=".repeat(70));
  console.log("📊 MAINNET DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\n🔥 FirelightStrategy (FXRP Staking):");
  console.log("   Address:", firelightStrategyAddress);
  console.log("   Status:", firelightActive ? "ACTIVE ✅" : "INACTIVE (call activate() when ready)");
  console.log("   Firelight stXRP:", MAINNET_ADDRESSES.firelightStXRP);
  
  console.log("\n📈 KineticStrategy (FXRP Lending):");
  console.log("   Address:", kineticStrategyAddress);
  console.log("   Status:", kineticActive ? "ACTIVE ✅" : "INACTIVE");

  console.log("\n" + "=".repeat(70));
  console.log("🔐 CRITICAL NEXT STEPS FOR PRODUCTION");
  console.log("=".repeat(70));
  
  console.log("\n1. TRANSFER ADMIN TO MULTISIG:");
  console.log("   - Create/use Gnosis Safe multisig for admin control");
  console.log("   - Grant DEFAULT_ADMIN_ROLE to multisig on both strategies");
  console.log("   - Revoke DEFAULT_ADMIN_ROLE from deployer:", deployer.address);
  
  console.log("\n2. REGISTER WITH VAULT:");
  console.log("   If VaultController deployed:");
  console.log(`   - vaultController.registerStrategy("${firelightStrategyAddress}", "Firelight")`);
  console.log(`   - vaultController.registerStrategy("${kineticStrategyAddress}", "Kinetic")`);
  console.log("   ");
  console.log("   Add to ShXRPVault:");
  console.log(`   - vault.addStrategy("${firelightStrategyAddress}", 5000) // 50%`);
  console.log(`   - vault.addStrategy("${kineticStrategyAddress}", 4000)  // 40%`);
  console.log("   - Remaining 10% stays as buffer");
  
  console.log("\n3. ACTIVATE STRATEGIES:");
  console.log(`   - firelightStrategy.activate() at ${firelightStrategyAddress}`);
  console.log(`   - kineticStrategy.activate() at ${kineticStrategyAddress}`);
  
  console.log("\n4. SET DEPOSIT CAPS:");
  console.log("   - Start with low deposit limit (e.g., 10,000 FXRP)");
  console.log("   - Gradually increase as confidence grows");
  
  console.log("\n5. VERIFY CONTRACTS:");
  console.log(`   npx hardhat verify --network flare ${firelightStrategyAddress} "${MAINNET_ADDRESSES.fxrpToken}" "${deployer.address}" "${deployer.address}"`);
  console.log(`   npx hardhat verify --network flare ${kineticStrategyAddress} "${MAINNET_ADDRESSES.fxrpToken}" "${deployer.address}" "${deployer.address}"`);
  
  console.log("\n6. UPDATE ENVIRONMENT:");
  console.log(`   FIRELIGHT_STRATEGY_ADDRESS=${firelightStrategyAddress}`);
  console.log(`   KINETIC_STRATEGY_ADDRESS=${kineticStrategyAddress}`);
  
  console.log("\n" + "=".repeat(70));
  console.log("⚠️  SECURITY REMINDERS");
  console.log("=".repeat(70));
  console.log("   - DEFAULT_ADMIN_ROLE on deployer - MUST transfer to multisig!");
  console.log("   - Both strategies INACTIVE by default - activate only when ready");
  console.log("   - Monitor closely during initial rollout");
  console.log("   - Have emergency pause procedures ready");
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Mainnet deployment failed:", error);
    process.exit(1);
  });
