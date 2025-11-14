import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Starting Strategy Deployment to Coston2...\n");

  // Get network configuration
  // Type assertions needed due to Hardhat type augmentation issues
  const network = hre.network as any;
  const ethers = (hre as any).ethers;
  
  console.log("📡 Network:", network.name);
  
  if (network.name !== "coston2") {
    console.error("❌ This script is intended for Coston2 testnet only");
    console.log("Run with: npx hardhat run scripts/deploy-strategies.ts --network coston2");
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
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethersLib.formatEther(balance), "C2FLR\n");

  if (balance === 0n) {
    console.error("❌ Error: Deployer account has zero balance!");
    console.log("Get testnet C2FLR from: https://faucet.flare.network/coston2");
    process.exit(1);
  }

  // Load existing deployment addresses
  const deploymentsDir = path.join(__dirname, "../deployments");
  const latestDeploymentFile = path.join(deploymentsDir, "coston2-latest.json");
  
  if (!fs.existsSync(latestDeploymentFile)) {
    console.error("❌ Error: coston2-latest.json not found!");
    console.log("Please deploy the vault contracts first using deploy-flare.ts");
    process.exit(1);
  }

  const existingDeployment = JSON.parse(fs.readFileSync(latestDeploymentFile, "utf-8"));
  const fxrpAddress = existingDeployment.contracts.FXRP?.address;

  if (!fxrpAddress) {
    console.error("❌ Error: FXRP address not found in deployment file!");
    process.exit(1);
  }

  // Load vault address - prefer deployment file over env var
  let vaultAddress = '';
  const latestDeploymentPath = latestDeploymentFile;
  
  if (fs.existsSync(latestDeploymentPath)) {
    const latestDeployment = JSON.parse(fs.readFileSync(latestDeploymentPath, 'utf-8'));
    vaultAddress = latestDeployment.contracts?.ShXRPVault?.address || '';
    if (vaultAddress) {
      console.log(`Using vault from deployment file: ${vaultAddress}`);
    }
  }
  
  if (!vaultAddress && process.env.VITE_SHXRP_VAULT_ADDRESS) {
    vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
    console.log(`Using vault from env var: ${vaultAddress}`);
    console.log('⚠️  WARNING: Using env var because deployment file not found');
  }
  
  if (!vaultAddress) {
    console.error("❌ Error: ShXRPVault address not found!");
    console.log("Please set VITE_SHXRP_VAULT_ADDRESS environment variable or deploy vault first");
    process.exit(1);
  }

  // Validate address format
  if (!ethersLib.isAddress(vaultAddress)) {
    throw new Error(`Invalid vault address: ${vaultAddress}`);
  }

  console.log("📋 Using existing contract addresses:");
  console.log("   FXRP Token:", fxrpAddress);
  console.log("   ShXRPVault:", vaultAddress);
  console.log("");

  // Deploy KineticStrategy
  console.log("1️⃣ Deploying KineticStrategy...");
  const KineticStrategy = await ethers.getContractFactory("KineticStrategy");
  const kineticStrategy = await KineticStrategy.deploy(
    fxrpAddress,      // _fxrpToken
    deployer.address, // _admin (DEFAULT_ADMIN_ROLE)
    deployer.address  // _operator (OPERATOR_ROLE)
  );
  await kineticStrategy.waitForDeployment();
  const kineticStrategyAddress = await kineticStrategy.getAddress();
  console.log("✅ KineticStrategy deployed to:", kineticStrategyAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${kineticStrategyAddress}`);

  // Deploy FirelightStrategy
  console.log("\n2️⃣ Deploying FirelightStrategy...");
  const FirelightStrategy = await ethers.getContractFactory("FirelightStrategy");
  const firelightStrategy = await FirelightStrategy.deploy(
    fxrpAddress,      // _fxrpToken
    deployer.address, // _admin (DEFAULT_ADMIN_ROLE)
    deployer.address  // _operator (OPERATOR_ROLE)
  );
  await firelightStrategy.waitForDeployment();
  const firelightStrategyAddress = await firelightStrategy.getAddress();
  console.log("✅ FirelightStrategy deployed to:", firelightStrategyAddress);
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${firelightStrategyAddress}`);

  // Configure KineticStrategy (conditional on environment variables)
  console.log("\n3️⃣ Configuring KineticStrategy...");
  
  const kineticCToken = process.env.KINETIC_CFXRP_ADDRESS;
  const kineticComptroller = process.env.KINETIC_COMPTROLLER_ADDRESS;
  
  let kineticConfigured = false;
  let configuredCToken = "";
  let configuredComptroller = "";
  
  if (kineticCToken && kineticComptroller) {
    console.log("   Configuring KineticStrategy with real addresses...");
    const setConfigTx = await kineticStrategy.setKineticConfig(
      kineticCToken,
      kineticComptroller
    );
    await setConfigTx.wait();
    console.log("✅ KineticStrategy configured successfully");
    console.log("   cToken:", kineticCToken);
    console.log("   Comptroller:", kineticComptroller);
    kineticConfigured = true;
    configuredCToken = kineticCToken;
    configuredComptroller = kineticComptroller;
  } else {
    console.log("\n⚠️  ============================================");
    console.log("⚠️  KINETIC CONFIGURATION SKIPPED");
    console.log("⚠️  ============================================");
    console.log("Kinetic addresses not provided via env vars:");
    console.log("  - KINETIC_CFXRP_ADDRESS");
    console.log("  - KINETIC_COMPTROLLER_ADDRESS");
    console.log("\n📋 IMPORTANT: Before Task 16 (full deployment):");
    console.log("  1. Obtain real Kinetic contract addresses");
    console.log("  2. Set env vars and re-run: npx hardhat run scripts/configure-kinetic.ts --network coston2");
    console.log("  3. Verify configuration before activation");
    console.log("⚠️  ============================================\n");
  }

  // Grant OPERATOR_ROLE to vault contract - fetch from each contract separately
  console.log("\n4️⃣ Granting OPERATOR_ROLE to vault contract...");
  
  const kineticOperatorRole = await kineticStrategy.OPERATOR_ROLE();
  const grantKineticTx = await kineticStrategy.grantRole(kineticOperatorRole, vaultAddress);
  await grantKineticTx.wait();
  console.log("✅ KineticStrategy: OPERATOR_ROLE granted to vault");
  
  const firelightOperatorRole = await firelightStrategy.OPERATOR_ROLE();
  const grantFirelightTx = await firelightStrategy.grantRole(firelightOperatorRole, vaultAddress);
  await grantFirelightTx.wait();
  console.log("✅ FirelightStrategy: OPERATOR_ROLE granted to vault");
  
  console.log("\n✅ OPERATOR_ROLE granted to vault on both strategies");
  console.log("⚠️  DEFAULT_ADMIN_ROLE still on deployer - transfer to multisig in production");

  // Verify strategy status
  console.log("\n5️⃣ Verifying strategy status...");
  const firelightActive = await firelightStrategy.isActive();
  const kineticActive = await kineticStrategy.isActive();
  
  console.log("   KineticStrategy active:", kineticActive);
  if (!kineticActive) {
    console.log("   ✅ KineticStrategy is disabled (activate after configuration)");
  }
  
  console.log("   FirelightStrategy active:", firelightActive);
  if (!firelightActive) {
    console.log("   ✅ FirelightStrategy is disabled (as expected until Q1 2026)");
  }

  // Check role assignments
  console.log("\n6️⃣ Verifying role assignments...");
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  const kineticDeployerOperator = await kineticStrategy.hasRole(kineticOperatorRole, deployer.address);
  const kineticDeployerAdmin = await kineticStrategy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const kineticVaultOperator = await kineticStrategy.hasRole(kineticOperatorRole, vaultAddress);
  
  const firelightDeployerOperator = await firelightStrategy.hasRole(firelightOperatorRole, deployer.address);
  const firelightDeployerAdmin = await firelightStrategy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const firelightVaultOperator = await firelightStrategy.hasRole(firelightOperatorRole, vaultAddress);
  
  console.log("   KineticStrategy:");
  console.log("     OPERATOR_ROLE (deployer):", kineticDeployerOperator ? "✅" : "❌");
  console.log("     OPERATOR_ROLE (vault):", kineticVaultOperator ? "✅" : "❌");
  console.log("     DEFAULT_ADMIN_ROLE (deployer):", kineticDeployerAdmin ? "✅" : "❌");
  console.log("   FirelightStrategy:");
  console.log("     OPERATOR_ROLE (deployer):", firelightDeployerOperator ? "✅" : "❌");
  console.log("     OPERATOR_ROLE (vault):", firelightVaultOperator ? "✅" : "❌");
  console.log("     DEFAULT_ADMIN_ROLE (deployer):", firelightDeployerAdmin ? "✅" : "❌");

  // Save deployment information
  const deploymentInfo = {
    network: "coston2",
    chainId: 114,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      KineticStrategy: {
        address: kineticStrategyAddress,
        fxrpToken: fxrpAddress,
        admin: deployer.address,
        vaultOperator: vaultAddress,
        isActive: kineticActive,
        configured: kineticConfigured,
        kineticCToken: configuredCToken || "Not configured",
        kineticComptroller: configuredComptroller || "Not configured",
        explorerUrl: `https://coston2-explorer.flare.network/address/${kineticStrategyAddress}`
      },
      FirelightStrategy: {
        address: firelightStrategyAddress,
        fxrpToken: fxrpAddress,
        admin: deployer.address,
        vaultOperator: vaultAddress,
        isActive: firelightActive,
        expectedLaunch: "Q1 2026",
        explorerUrl: `https://coston2-explorer.flare.network/address/${firelightStrategyAddress}`
      }
    },
    relatedContracts: {
      FXRP: fxrpAddress,
      ShXRPVault: vaultAddress
    },
    roles: {
      DEFAULT_ADMIN_ROLE: deployer.address,
      OPERATOR_ROLE: {
        deployer: deployer.address,
        vault: vaultAddress
      }
    }
  };

  const strategyDeploymentFile = path.join(deploymentsDir, "coston2-strategies.json");
  fs.writeFileSync(strategyDeploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n💾 Deployment info saved to:", strategyDeploymentFile);

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 STRATEGY DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("Network: Coston2 Testnet");
  console.log("Chain ID: 114");
  console.log("Deployer:", deployer.address);
  console.log("\n📈 KineticStrategy (FXRP Lending):");
  console.log("   Address:", kineticStrategyAddress);
  console.log("   Status:", kineticConfigured ? "Configured but INACTIVE" : "Deployed (not configured)");
  console.log("   Kinetic Config:", kineticConfigured ? "✅ Configured" : "⚠️  Not configured");
  console.log("   Vault Operator:", kineticVaultOperator ? "✅ Granted" : "❌ Not granted");
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${kineticStrategyAddress}`);
  console.log("\n🔥 FirelightStrategy (FXRP Staking):");
  console.log("   Address:", firelightStrategyAddress);
  console.log("   Status: INACTIVE (Expected launch: Q1 2026)");
  console.log("   Vault Operator:", firelightVaultOperator ? "✅ Granted" : "❌ Not granted");
  console.log("   Explorer:", `https://coston2-explorer.flare.network/address/${firelightStrategyAddress}`);
  console.log("\n🔐 Role Management:");
  console.log("   DEFAULT_ADMIN_ROLE:", deployer.address);
  console.log("   OPERATOR_ROLE (deployer):", deployer.address);
  console.log("   OPERATOR_ROLE (vault):", vaultAddress);
  console.log("\n✅ Deployment complete!");
  console.log("=".repeat(70) + "\n");

  // Next steps
  console.log("📋 NEXT STEPS:");
  console.log("\n1. Verify contracts on Coston2 block explorer:");
  console.log(`   npx hardhat verify --network coston2 ${kineticStrategyAddress} "${fxrpAddress}" "${deployer.address}" "${deployer.address}"`);
  console.log(`   npx hardhat verify --network coston2 ${firelightStrategyAddress} "${fxrpAddress}" "${deployer.address}" "${deployer.address}"`);
  
  if (!kineticConfigured) {
    console.log("\n2. Configure KineticStrategy (REQUIRED before activation):");
    console.log("   - Get actual Kinetic cToken address (cFXRP)");
    console.log("   - Get actual Kinetic Comptroller address");
    console.log(`   - Call setKineticConfig() on ${kineticStrategyAddress}`);
    console.log("   - Or redeploy with KINETIC_CFXRP_ADDRESS and KINETIC_COMPTROLLER_ADDRESS env vars");
  } else {
    console.log("\n2. KineticStrategy is configured ✅");
  }
  
  console.log("\n3. Activate KineticStrategy:");
  console.log(`   - Call activate() on ${kineticStrategyAddress}`);
  console.log("   - Strategy must be configured first");
  
  console.log("\n4. Add strategies to ShXRPVault:");
  console.log("   - Call addStrategy() on ShXRPVault for each strategy");
  console.log("   - Set allocation percentages using setStrategyAllocation()");
  
  console.log("\n5. Transfer DEFAULT_ADMIN_ROLE to multisig (PRODUCTION):");
  console.log(`   - Create multisig wallet for production admin control`);
  console.log(`   - Grant DEFAULT_ADMIN_ROLE to multisig on both strategies`);
  console.log(`   - Revoke DEFAULT_ADMIN_ROLE from deployer: ${deployer.address}`);
  console.log(`   - ⚠️  This is CRITICAL for production security`);
  
  console.log("\n6. FirelightStrategy (when ready in Q1 2026):");
  console.log("   - Configure Firelight contract addresses using setFirelightConfig()");
  console.log("   - Activate strategy using activate()");
  
  console.log("\n7. Update frontend .env:");
  console.log(`   VITE_KINETIC_STRATEGY_ADDRESS=${kineticStrategyAddress}`);
  console.log(`   VITE_FIRELIGHT_STRATEGY_ADDRESS=${firelightStrategyAddress}`);
  console.log("");

  console.log("⚠️  IMPORTANT REMINDERS:");
  if (!kineticConfigured) {
    console.log("   - ⚠️  KineticStrategy NOT configured - must configure before activation!");
  }
  console.log("   - ✅ OPERATOR_ROLE granted to vault automatically");
  console.log("   - ⚠️  DEFAULT_ADMIN_ROLE on deployer - transfer to multisig for production");
  console.log("   - Both strategies are INACTIVE by default");
  console.log("   - Test thoroughly on testnet before mainnet deployment");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
