import { ethers } from "ethers";

/**
 * Fund MerkleDistributor with SHIELD Tokens
 * 
 * Transfers 2M SHIELD tokens from the deployer (who owns all 10M supply)
 * to the MerkleDistributor contract for airdrop claims.
 */

const SHIELD_TOKEN = "0x07F943F173a6bE5EC63a8475597d28aAA6B24992";
const MERKLE_DISTRIBUTOR = "0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31";
const AMOUNT_TO_FUND = ethers.parseEther("2000000"); // 2M SHIELD

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("💰 Fund MerkleDistributor with SHIELD Tokens");
  console.log("=".repeat(60));

  const network = "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("❌ DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const networkConfig = {
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    chainId: 114,
    explorer: "https://coston2-explorer.flare.network",
  };

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("\n💼 Deployer:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("💰 FLR Balance:", ethers.formatEther(balance), "FLR");

  // Create SHIELD token contract instance
  const shieldToken = new ethers.Contract(SHIELD_TOKEN, ERC20_ABI, wallet);

  // Get token info
  const symbol = await shieldToken.symbol();
  const decimals = await shieldToken.decimals();
  console.log(`\n📍 Token: ${symbol} (${decimals} decimals)`);
  console.log(`   Address: ${SHIELD_TOKEN}`);

  // Check deployer balance
  const deployerBalance = await shieldToken.balanceOf(wallet.address);
  console.log(`\n💼 Deployer ${symbol} Balance:`, ethers.formatEther(deployerBalance));

  if (deployerBalance < AMOUNT_TO_FUND) {
    throw new Error(
      `❌ Insufficient SHIELD balance!\n` +
      `   Required: ${ethers.formatEther(AMOUNT_TO_FUND)} SHIELD\n` +
      `   Available: ${ethers.formatEther(deployerBalance)} SHIELD`
    );
  }

  // Check current MerkleDistributor balance
  const distributorBalance = await shieldToken.balanceOf(MERKLE_DISTRIBUTOR);
  console.log(`\n📦 MerkleDistributor Current Balance:`, ethers.formatEther(distributorBalance), symbol);

  // =========================================================================
  // IDEMPOTENCY CHECK: Skip transfer if already funded
  // =========================================================================
  if (distributorBalance >= AMOUNT_TO_FUND) {
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALREADY FUNDED - SKIPPING TRANSFER");
    console.log("=".repeat(60));
    console.log(`\n✅ MerkleDistributor already has ${ethers.formatEther(distributorBalance)} ${symbol}`);
    console.log(`   Required: ${ethers.formatEther(AMOUNT_TO_FUND)} ${symbol}`);
    console.log(`   Status: ✅ Sufficient balance - no transfer needed`);
    
    console.log("\n" + "=".repeat(60));
    console.log("📝 NEXT STEPS:");
    console.log("=".repeat(60));

    console.log("\n1️⃣  Users can now claim their airdrop:");
    console.log("   - Go to /airdrop page");
    console.log("   - Connect wallet");
    console.log("   - If eligible, click 'Claim Airdrop'");

    console.log("\n2️⃣  Test airdrop claim flow:");
    console.log("   - Use one of the 20 eligible addresses from merkle-tree.json");
    console.log("   - Get proof from backend /api/merkle-proof/:address");
    console.log("   - Call MerkleDistributor.claim()");

    console.log("\n3️⃣  Monitor distribution:");
    console.log(`   - Watch MerkleDistributor balance decrease as users claim`);
    console.log(`   - Track Claimed events on block explorer`);

    console.log("\n" + "=".repeat(60) + "\n");
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("TRANSFERRING TOKENS");
  console.log("=".repeat(60));

  console.log(`\n💡 MerkleDistributor needs funding`);
  console.log(`   Current: ${ethers.formatEther(distributorBalance)} ${symbol}`);
  console.log(`   Required: ${ethers.formatEther(AMOUNT_TO_FUND)} ${symbol}`);
  console.log(`   To transfer: ${ethers.formatEther(AMOUNT_TO_FUND - distributorBalance)} ${symbol}`);

  console.log(`\n📤 Transferring ${ethers.formatEther(AMOUNT_TO_FUND)} ${symbol} to MerkleDistributor...`);
  console.log(`   From: ${wallet.address}`);
  console.log(`   To: ${MERKLE_DISTRIBUTOR}`);

  const tx = await shieldToken.transfer(MERKLE_DISTRIBUTOR, AMOUNT_TO_FUND);
  console.log(`\n⏳ Transaction sent: ${tx.hash}`);
  console.log(`   View: ${networkConfig.explorer}/tx/${tx.hash}`);

  console.log("\n⏳ Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

  // Verify final balances
  const newDeployerBalance = await shieldToken.balanceOf(wallet.address);
  const newDistributorBalance = await shieldToken.balanceOf(MERKLE_DISTRIBUTOR);

  console.log("\n" + "=".repeat(60));
  console.log("✅ TRANSFER COMPLETE");
  console.log("=".repeat(60));

  console.log("\n📊 Final Balances:");
  console.log(`   Deployer: ${ethers.formatEther(newDeployerBalance)} ${symbol}`);
  console.log(`   MerkleDistributor: ${ethers.formatEther(newDistributorBalance)} ${symbol}`);

  // Verify the transfer amount
  const transferredAmount = newDistributorBalance - distributorBalance;
  if (transferredAmount !== AMOUNT_TO_FUND) {
    console.warn(`\n⚠️  WARNING: Transferred amount mismatch!`);
    console.warn(`   Expected: ${ethers.formatEther(AMOUNT_TO_FUND)} ${symbol}`);
    console.warn(`   Actual: ${ethers.formatEther(transferredAmount)} ${symbol}`);
  } else {
    console.log(`\n✅ Verified: ${ethers.formatEther(AMOUNT_TO_FUND)} ${symbol} transferred successfully`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(60));

  console.log("\n1️⃣  Users can now claim their airdrop:");
  console.log("   - Go to /airdrop page");
  console.log("   - Connect wallet");
  console.log("   - If eligible, click 'Claim Airdrop'");

  console.log("\n2️⃣  Test airdrop claim flow:");
  console.log("   - Use one of the 20 eligible addresses from merkle-tree.json");
  console.log("   - Get proof from backend /api/merkle-proof/:address");
  console.log("   - Call MerkleDistributor.claim()");

  console.log("\n3️⃣  Monitor distribution:");
  console.log(`   - Watch MerkleDistributor balance decrease as users claim`);
  console.log(`   - Track Claimed events on block explorer`);

  console.log("\n" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
