import hre from "hardhat";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Shield Finance Complete Deployment Script
 * 
 * ⚠️  REPLACES: scripts/deploy-flare.ts (DEPRECATED - uses wrong ShieldToken constructor)
 * 
 * Deploys all Shield Finance fair launch contracts:
 * 1. ShieldToken (10M supply)
 * 2. RevenueRouter (50% burn, 50% reserves)
 * 3. StakingBoost (30-day lock, 1% boost per 100 SHIELD)
 * 4. MerkleDistributor (2M SHIELD airdrop)
 * 
 * Pre-requisites:
 * - DEPLOYER_PRIVATE_KEY in environment
 * - MERKLE_ROOT in environment (for MerkleDistributor)
 * - Deployer wallet funded with 5 FLR minimum
 * 
 * Network: Flare mainnet or Coston2 testnet
 */

// Flare Network Addresses (Mainnet)
const WFLR_MAINNET = "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d";
const SPARKDEX_SWAP_ROUTER_MAINNET = "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781";

// Coston2 Testnet Addresses (if different)
const WFLR_COSTON2 = "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273"; // Testnet wFLR
const SPARKDEX_SWAP_ROUTER_COSTON2 = SPARKDEX_SWAP_ROUTER_MAINNET; // Placeholder - verify if exists on Coston2

async function main() {
  console.log("🚀 Shield Finance Deployment Script");
  console.log("=" .repeat(60));

  // Get network configuration
  const network = hre.network;
  const isMainnet = network.name === "flare";
  console.log("📡 Network:", network.name);
  console.log("🔗 Chain ID:", network.config.chainId);
  
  // Determine network-specific addresses
  const WFLR = isMainnet ? WFLR_MAINNET : WFLR_COSTON2;
  const SPARKDEX_ROUTER = isMainnet ? SPARKDEX_SWAP_ROUTER_MAINNET : SPARKDEX_SWAP_ROUTER_COSTON2;

  console.log("📍 Network Addresses:");
  console.log("   wFLR:", WFLR);
  console.log("   SparkDEX Router:", SPARKDEX_ROUTER);
  
  // Create provider and wallet
  const provider = new ethersLib.JsonRpcProvider(
    network.config.url,
    { chainId: network.config.chainId as number, name: network.name }
  );
  
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set in environment");
  }
  
  const deployer = new ethersLib.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log("\n💼 Deployer:", deployer.address);
  
  const balance = await provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethersLib.formatEther(balance), "FLR");

  if (balance === 0n) {
    console.error("\n❌ Error: Deployer account has zero balance!");
    if (!isMainnet) {
      console.log("Get testnet FLR from: https://faucet.flare.network/coston2");
    }
    process.exit(1);
  }

  if (balance < ethersLib.parseEther("5")) {
    console.warn("\n⚠️  WARNING: Balance below 5 FLR. Deployment may fail due to insufficient gas.");
    console.log("Recommended: Fund with at least 5 FLR");
  }

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYING SHIELD FINANCE CONTRACTS");
  console.log("=".repeat(60));

  // =========================================================================
  // STEP 1: Deploy ShieldToken
  // =========================================================================
  console.log("\n1️⃣  Deploying ShieldToken...");
  const ShieldToken = await hre.ethers.getContractFactory("ShieldToken");
  const shieldToken = await ShieldToken.deploy();
  await shieldToken.waitForDeployment();
  const shieldTokenAddress = await shieldToken.getAddress();
  console.log("   ✅ ShieldToken deployed:", shieldTokenAddress);

  // Verify token details
  const totalSupply = await shieldToken.totalSupply();
  const decimals = await shieldToken.decimals();
  const name = await shieldToken.name();
  const symbol = await shieldToken.symbol();
  
  console.log("   📊 Token Details:");
  console.log("      Name:", name);
  console.log("      Symbol:", symbol);
  console.log("      Decimals:", decimals);
  console.log("      Total Supply:", ethersLib.formatEther(totalSupply), "SHIELD");
  console.log("      Deployer Balance:", ethersLib.formatEther(totalSupply), "SHIELD");

  // Verify supply = 10M
  const expectedSupply = ethersLib.parseEther("10000000");
  if (totalSupply !== expectedSupply) {
    throw new Error(`❌ Total supply mismatch! Expected: ${ethersLib.formatEther(expectedSupply)}, Got: ${ethersLib.formatEther(totalSupply)}`);
  }
  console.log("      ✅ Supply verified: 10,000,000 SHIELD");

  // =========================================================================
  // STEP 2: Deploy RevenueRouter
  // =========================================================================
  console.log("\n2️⃣  Deploying RevenueRouter...");
  console.log("   Constructor args:");
  console.log("      SHIELD Token:", shieldTokenAddress);
  console.log("      wFLR:", WFLR);
  console.log("      Router:", SPARKDEX_ROUTER);

  const RevenueRouter = await hre.ethers.getContractFactory("RevenueRouter");
  const revenueRouter = await RevenueRouter.deploy(
    shieldTokenAddress,
    WFLR,
    SPARKDEX_ROUTER
  );
  await revenueRouter.waitForDeployment();
  const revenueRouterAddress = await revenueRouter.getAddress();
  console.log("   ✅ RevenueRouter deployed:", revenueRouterAddress);

  // Verify immutable addresses
  const shieldTokenCheck = await revenueRouter.shieldToken();
  const wflrCheck = await revenueRouter.wflr();
  const routerCheck = await revenueRouter.router();
  
  console.log("   📊 Configuration:");
  console.log("      SHIELD Token:", shieldTokenCheck);
  console.log("      wFLR:", wflrCheck);
  console.log("      Router:", routerCheck);
  console.log("      Split: 50% Burn / 50% Reserves");

  if (shieldTokenCheck !== shieldTokenAddress || wflrCheck !== WFLR || routerCheck !== SPARKDEX_ROUTER) {
    throw new Error("❌ RevenueRouter configuration mismatch!");
  }
  console.log("      ✅ Configuration verified");

  // =========================================================================
  // STEP 3: Deploy StakingBoost
  // =========================================================================
  console.log("\n3️⃣  Deploying StakingBoost...");
  console.log("   Constructor args:");
  console.log("      SHIELD Token:", shieldTokenAddress);

  const StakingBoost = await hre.ethers.getContractFactory("StakingBoost");
  const stakingBoost = await StakingBoost.deploy(shieldTokenAddress);
  await stakingBoost.waitForDeployment();
  const stakingBoostAddress = await stakingBoost.getAddress();
  console.log("   ✅ StakingBoost deployed:", stakingBoostAddress);

  // Verify configuration
  const shieldTokenCheckStaking = await stakingBoost.shieldToken();
  const lockPeriod = await stakingBoost.LOCK_PERIOD();
  
  console.log("   📊 Configuration:");
  console.log("      SHIELD Token:", shieldTokenCheckStaking);
  console.log("      Lock Period:", lockPeriod.toString(), "seconds (", Number(lockPeriod) / 86400, "days)");
  console.log("      Boost Formula: 1% per 100 SHIELD staked");

  if (shieldTokenCheckStaking !== shieldTokenAddress) {
    throw new Error("❌ StakingBoost configuration mismatch!");
  }
  if (lockPeriod !== 2592000n) { // 30 days in seconds
    throw new Error("❌ StakingBoost lock period mismatch! Expected: 2592000, Got: " + lockPeriod.toString());
  }
  console.log("      ✅ Configuration verified");

  // =========================================================================
  // STEP 4: Add Liquidity to SparkDEX V3 (Optional - can run separately)
  // =========================================================================
  console.log("\n4️⃣  SparkDEX V3 Liquidity Deployment");
  console.log("   ⚠️  Liquidity deployment skipped (run scripts/sparkdex-lp.ts separately)");
  console.log("   Required: 1,000,000 SHIELD + 535,451 wFLR");
  console.log("   Command:");
  console.log(`   SHIELD_TOKEN_ADDRESS=${shieldTokenAddress} npx hardhat run scripts/sparkdex-lp.ts --network ${network.name}`);
  console.log("   After deployment: Lock LP NFT for 12 months via Team Finance");

  // =========================================================================
  // STEP 5: Deploy MerkleDistributor
  // =========================================================================
  console.log("\n5️⃣  Deploying MerkleDistributor...");
  
  let merkleDistributorAddress = "";
  const merkleRoot = process.env.MERKLE_ROOT;
  if (!merkleRoot || merkleRoot === "") {
    console.warn("   ⚠️  WARNING: MERKLE_ROOT not set in environment");
    console.warn("   Skipping MerkleDistributor deployment");
    console.warn("   Set MERKLE_ROOT and re-run to deploy MerkleDistributor");
    console.log("\n   To generate merkle root:");
    console.log("   1. Create allocation CSV (address,amount)");
    console.log("   2. Run: npx ts-node scripts/generate-merkle-tree.ts");
    console.log("   3. Set MERKLE_ROOT=<root> in .env");
    console.log("   4. Re-run this script");
  } else {
    console.log("   Constructor args:");
    console.log("      SHIELD Token:", shieldTokenAddress);
    console.log("      Merkle Root:", merkleRoot);

    const MerkleDistributor = await hre.ethers.getContractFactory("MerkleDistributor");
    const merkleDistributor = await MerkleDistributor.deploy(
      shieldTokenAddress,
      merkleRoot
    );
    await merkleDistributor.waitForDeployment();
    merkleDistributorAddress = await merkleDistributor.getAddress();
    console.log("   ✅ MerkleDistributor deployed:", merkleDistributorAddress);

    // Verify configuration
    const tokenCheck = await merkleDistributor.token();
    const rootCheck = await merkleDistributor.merkleRoot();
    
    console.log("   📊 Configuration:");
    console.log("      SHIELD Token:", tokenCheck);
    console.log("      Merkle Root:", rootCheck);
    console.log("      Total Claimed:", "0 SHIELD");
    console.log("      ⚠️  Root is IMMUTABLE - cannot be changed!");

    if (tokenCheck !== shieldTokenAddress || rootCheck !== merkleRoot) {
      throw new Error("❌ MerkleDistributor configuration mismatch!");
    }
    console.log("      ✅ Configuration verified");

    console.log("\n   🔔 FUNDING MERKLE DISTRIBUTOR:");
    console.log("      ⚠️  Distributor deployed but NOT FUNDED");
    console.log("      You must transfer 2,000,000 SHIELD to distributor:");
    console.log(`      1. Run: cast send ${shieldTokenAddress} "transfer(address,uint256)" ${merkleDistributorAddress} 2000000000000000000000000 --private-key <key>`);
    console.log(`      2. Verify balance: cast call ${shieldTokenAddress} "balanceOf(address)" ${merkleDistributorAddress}`);
    console.log("      3. Expected: 2000000000000000000000000 (2M * 10^18)");

    console.log("\n   🔔 NEXT STEPS:");
    console.log("      1. Verify merkle root matches your generated tree");
    console.log("      2. Test claim with valid proof");
    console.log("      3. Transfer 2M SHIELD to MerkleDistributor (see commands above)");
    console.log("      4. Announce distributor address to community");
  }

  // =========================================================================
  // DEPLOYMENT SUMMARY
  // =========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));

  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ShieldToken: {
        address: shieldTokenAddress,
        totalSupply: ethersLib.formatEther(totalSupply),
        symbol: symbol,
      },
      RevenueRouter: {
        address: revenueRouterAddress,
        shieldToken: shieldTokenAddress,
        wflr: WFLR,
        router: SPARKDEX_ROUTER,
        split: "50% Burn / 50% Reserves",
      },
      StakingBoost: {
        address: stakingBoostAddress,
        shieldToken: shieldTokenAddress,
        lockPeriod: lockPeriod.toString() + " seconds (30 days)",
      },
      MerkleDistributor: merkleRoot
        ? {
            address: merkleDistributorAddress,
            shieldToken: shieldTokenAddress,
            merkleRoot: merkleRoot,
          }
        : {
            status: "NOT_DEPLOYED",
            reason: "MERKLE_ROOT not set",
          },
    },
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `shield-finance-${network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentFile);

  // Print contract addresses
  console.log("\n📋 CONTRACT ADDRESSES:");
  console.log("   ShieldToken:", shieldTokenAddress);
  console.log("   RevenueRouter:", revenueRouterAddress);
  console.log("   StakingBoost:", stakingBoostAddress);
  if (merkleRoot && merkleDistributorAddress) {
    console.log("   MerkleDistributor:", merkleDistributorAddress);
  } else {
    console.log("   MerkleDistributor: NOT_DEPLOYED (set MERKLE_ROOT)");
  }

  // Block explorer links
  const explorerBase = isMainnet
    ? "https://flare-explorer.flare.network/address"
    : "https://coston2-explorer.flare.network/address";

  console.log("\n🔍 BLOCK EXPLORER:");
  console.log("   ShieldToken:", `${explorerBase}/${shieldTokenAddress}`);
  console.log("   RevenueRouter:", `${explorerBase}/${revenueRouterAddress}`);
  console.log("   StakingBoost:", `${explorerBase}/${stakingBoostAddress}`);

  // Verification commands
  console.log("\n✅ VERIFICATION COMMANDS:");
  console.log(`npx hardhat verify --network ${network.name} ${shieldTokenAddress}`);
  console.log(
    `npx hardhat verify --network ${network.name} ${revenueRouterAddress} ${shieldTokenAddress} ${WFLR} ${SPARKDEX_ROUTER}`
  );
  console.log(`npx hardhat verify --network ${network.name} ${stakingBoostAddress} ${shieldTokenAddress}`);
  if (merkleRoot && merkleDistributorAddress) {
    console.log(
      `npx hardhat verify --network ${network.name} ${merkleDistributorAddress} ${shieldTokenAddress} ${merkleRoot}`
    );
  }

  // Next steps
  console.log("\n📝 NEXT STEPS:");
  console.log("   1. Verify all contracts on block explorer (commands above)");
  console.log("   2. Add liquidity on SparkDEX V3 (1M SHIELD + 535,451 wFLR)");
  console.log("   3. Lock LP NFT for 12 months (Team Finance)");
  console.log("   4. Transfer 2M SHIELD to MerkleDistributor");
  console.log("   5. Announce contract addresses to community");
  console.log("   6. Test full flow: claim → stake → distribute");
  console.log("\n   See docs/SHIELD_DEPLOYMENT.md for detailed guide");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Shield Finance deployment successful!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
