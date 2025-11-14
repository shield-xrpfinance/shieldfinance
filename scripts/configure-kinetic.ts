import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔧 Configuring KineticStrategy Post-Deployment...\n");

  const deploymentPath = path.join(__dirname, "../deployments/coston2-strategies.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Error: Deployment not found!");
    console.log("Please run deploy-strategies.ts first:");
    console.log("  npx hardhat run scripts/deploy-strategies.ts --network coston2");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  
  if (!deployment.contracts?.KineticStrategy?.address) {
    console.error("❌ Error: KineticStrategy address not found in deployment!");
    process.exit(1);
  }

  const kineticStrategyAddress = deployment.contracts.KineticStrategy.address;
  console.log("📋 KineticStrategy address:", kineticStrategyAddress);
  
  const kineticCToken = process.env.KINETIC_CFXRP_ADDRESS;
  const kineticComptroller = process.env.KINETIC_COMPTROLLER_ADDRESS;
  
  if (!kineticCToken || !kineticComptroller) {
    console.error("❌ Error: Required environment variables not set!");
    console.log("\nPlease set the following environment variables:");
    console.log("  KINETIC_CFXRP_ADDRESS=<address>");
    console.log("  KINETIC_COMPTROLLER_ADDRESS=<address>");
    console.log("\nExample:");
    console.log("  export KINETIC_CFXRP_ADDRESS=0x...");
    console.log("  export KINETIC_COMPTROLLER_ADDRESS=0x...");
    process.exit(1);
  }

  console.log("\n📡 Configuration parameters:");
  console.log("  cToken (cFXRP):", kineticCToken);
  console.log("  Comptroller:", kineticComptroller);
  
  const ethers = (hre as any).ethers;
  const kineticStrategy = await ethers.getContractAt("KineticStrategy", kineticStrategyAddress);
  
  console.log("\n🔧 Configuring KineticStrategy with real addresses...");
  const tx = await kineticStrategy.setKineticConfig(kineticCToken, kineticComptroller);
  console.log("⏳ Transaction submitted:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");
  
  // Update deployment JSON
  deployment.contracts.KineticStrategy.configured = true;
  deployment.contracts.KineticStrategy.kineticCToken = kineticCToken;
  deployment.contracts.KineticStrategy.kineticComptroller = kineticComptroller;
  deployment.contracts.KineticStrategy.configuredAt = new Date().toISOString();
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  
  console.log("\n💾 Deployment file updated:", deploymentPath);
  console.log("\n" + "=".repeat(70));
  console.log("✅ CONFIGURATION COMPLETE");
  console.log("=".repeat(70));
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Verify configuration on block explorer:");
  console.log(`   https://coston2-explorer.flare.network/address/${kineticStrategyAddress}`);
  console.log("\n2. Activate KineticStrategy:");
  console.log("   - Call activate() on KineticStrategy contract");
  console.log("   - Only activate after thorough testing");
  console.log("\n3. Add to ShXRPVault:");
  console.log("   - Call addStrategy() on vault");
  console.log("   - Set allocation percentage");
  console.log("\n⚠️  IMPORTANT:");
  console.log("   - Test deposit/withdraw flow before full activation");
  console.log("   - Monitor strategy performance after activation");
  console.log("   - Ensure proper role permissions are set");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });
