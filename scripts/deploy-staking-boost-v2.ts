import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import StakingBoostArtifact from "../artifacts/contracts/StakingBoost.sol/StakingBoost.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const network = "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  console.log(`\n🚀 Deploying StakingBoost V2 (with testnet lock bypass) to ${network}...\n`);

  const networkConfig = {
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
    explorer: "https://coston2-explorer.flare.network",
  };

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deployer address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} FLR\n`);

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Please fund the account.");
  }

  // Contract addresses from current deployment
  const SHIELD_TOKEN = "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616";
  const FXRP_TOKEN = "0x0b6A3645c240605887a5532109323A3E12273dc7";
  const SHXRP_VAULT = "0x82d74B5fb005F7469e479C224E446bB89031e17F";
  const REVENUE_ROUTER = "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB";

  console.log("📋 Contract Addresses:");
  console.log(`   SHIELD Token: ${SHIELD_TOKEN}`);
  console.log(`   FXRP Token: ${FXRP_TOKEN}`);
  console.log(`   ShXRP Vault: ${SHXRP_VAULT}`);
  console.log(`   Revenue Router: ${REVENUE_ROUTER}\n`);

  console.log("🔒 Deploying StakingBoost V2...");
  const StakingBoost = new ethers.ContractFactory(
    StakingBoostArtifact.abi,
    StakingBoostArtifact.bytecode,
    wallet
  );

  const stakingBoost = await StakingBoost.deploy(
    SHIELD_TOKEN,
    FXRP_TOKEN,
    SHXRP_VAULT,
    REVENUE_ROUTER
  );
  await stakingBoost.waitForDeployment();
  const stakingBoostAddress = await stakingBoost.getAddress();
  console.log(`✅ StakingBoost V2 deployed: ${stakingBoostAddress}`);
  console.log(`   View: ${networkConfig.explorer}/address/${stakingBoostAddress}\n`);

  // Enable testnet lock bypass immediately
  console.log("🔓 Enabling testnet lock bypass...");
  const bypassTx = await stakingBoost.setTestnetLockBypass(true);
  await bypassTx.wait();
  console.log("✅ Testnet lock bypass enabled!\n");

  // Verify the bypass is enabled
  const bypassEnabled = await stakingBoost.testnetLockBypass();
  console.log(`   Lock bypass status: ${bypassEnabled ? "ENABLED" : "DISABLED"}\n`);

  // Save deployment info
  const deploymentInfo = {
    network,
    chainId: networkConfig.chainId,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    version: "2.1.0",
    note: "StakingBoost V2 with testnet lock bypass feature",
    contracts: {
      StakingBoost: {
        address: stakingBoostAddress,
        explorerUrl: `${networkConfig.explorer}/address/${stakingBoostAddress}`,
        testnetLockBypass: bypassEnabled,
      },
    },
    linkedContracts: {
      SHIELD_TOKEN,
      FXRP_TOKEN,
      SHXRP_VAULT,
      REVENUE_ROUTER,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `coston2-staking-boost-v2-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("📝 Deployment saved to:", filename);
  console.log("\n=== IMPORTANT ===");
  console.log("Update the following in your frontend:");
  console.log(`   STAKING_BOOST_ADDRESS = "${stakingBoostAddress}"`);
  console.log("\nUpdate in: client/src/hooks/useStakingContract.ts\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
