import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

const { ethers } = hre;

/**
 * SparkDEX V3 Liquidity Deployment Script
 * 
 * Purpose: Add initial liquidity for Shield Finance ($SHIELD) fair launch
 * - 535,451 wFLR + 1,000,000 SHIELD = ~$10K liquidity
 * - Initial price: $0.01 per SHIELD token
 * - 12-month LP lock recommended via Team Finance or alternative
 * 
 * SparkDEX V3 is a Uniswap V3 fork on Flare mainnet
 */

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

// SparkDEX V3 Addresses (Flare Mainnet)
// Source: https://docs.sparkdex.ai/additional-information/smart-contract-overview/v2-and-v3.1-dex
const SPARKDEX_FACTORY = "0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652";
const SPARKDEX_POSITION_MANAGER = "0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da";
const SPARKDEX_UNIVERSAL_ROUTER = "0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3";
const SPARKDEX_SWAP_ROUTER = "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781";

// Token Addresses (Flare Mainnet)
const WFLR_ADDRESS = "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d";

// SHIELD token address - MUST be set before running
// Get this from your deployment (scripts/deploy-flare.ts output)
const SHIELD_ADDRESS = process.env.SHIELD_TOKEN_ADDRESS || "";

// Fair Launch Amounts ($10K total liquidity at $0.01 per SHIELD)
// Math: 535,451 wFLR * ~$0.01868/wFLR = ~$10,006
//       1,000,000 SHIELD * $0.01/SHIELD = $10,000
// Price ratio: 535,451 wFLR / 1,000,000 SHIELD = 0.535451 wFLR per SHIELD
const WFLR_AMOUNT = ethers.parseEther("535451"); // 535,451 wFLR
const SHIELD_AMOUNT = ethers.parseEther("1000000"); // 1,000,000 SHIELD

// Uniswap V3 Pool Parameters
const FEE_TIER = 3000; // 0.3% fee tier (standard for most pairs, 3000 = 0.30%)
const TICK_SPACING = 60; // Tick spacing for 0.3% fee tier

// Price Range Configuration
// Wide range (±100% from initial price) for stability during fair launch
// This allows significant price movement without going out of range
const PRICE_RANGE_PERCENT = 1.0; // 100% = ±100% range

// LP Locking Information (Manual step required after deployment)
// Team Finance on Flare: As of 2025, Team Finance recently integrated with Flare
// but specific locker contract addresses are not yet publicly documented.
// 
// ALTERNATIVES for 12-month LP lock:
// 1. Team Finance: https://www.team.finance/ (check Flare mainnet support)
// 2. Unicrypt: https://www.uncx.network/ (if available on Flare)
// 3. Custom Timelock Contract: Deploy your own ERC721 timelock
// 4. Gnosis Safe: Multi-sig with timelock
const LOCK_DURATION_DAYS = 365; // 12 months
const LOCK_DURATION_SECONDS = LOCK_DURATION_DAYS * 24 * 60 * 60;

// =============================================================================
// HELPER FUNCTIONS - UNISWAP V3 MATH
// =============================================================================

/**
 * Calculate square root using Babylonian method for BigInt
 * @param value The value to find the square root of
 * @returns The square root
 */
function sqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("Square root of negative number");
  }
  if (value < 2n) {
    return value;
  }

  // Babylonian method
  let x = value;
  let y = (x + 1n) / 2n;
  
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  
  return x;
}

/**
 * Calculate sqrtPriceX96 for Uniswap V3
 * 
 * In Uniswap V3, price is stored as sqrtPriceX96 where:
 * sqrtPriceX96 = sqrt(price) * 2^96
 * price = amount1 / amount0 (how much token1 per 1 token0)
 * 
 * IMPORTANT: Token ordering matters!
 * - token0 must be < token1 (by address)
 * - If WFLR < SHIELD: price = SHIELD/WFLR (SHIELD per WFLR)
 * - If SHIELD < WFLR: price = WFLR/SHIELD (WFLR per SHIELD)
 * 
 * @param amount0 Amount of token0
 * @param amount1 Amount of token1
 * @returns sqrtPriceX96 value
 */
function calculateSqrtPriceX96(amount0: bigint, amount1: bigint): bigint {
  // Calculate price ratio: amount1 / amount0
  // Multiply by 2^192 first (instead of 2^96) because we'll take sqrt
  // sqrt(price * 2^192) = sqrt(price) * 2^96
  const Q96 = 2n ** 96n;
  const Q192 = 2n ** 192n;
  
  // price_scaled = (amount1 * 2^192) / amount0
  const priceScaled = (amount1 * Q192) / amount0;
  
  // sqrtPriceX96 = sqrt(price_scaled)
  const sqrtPriceX96 = sqrt(priceScaled);
  
  return sqrtPriceX96;
}

/**
 * Calculate tick from sqrtPriceX96
 * 
 * In Uniswap V3:
 * tick = floor(log_1.0001(price))
 * price = sqrtPriceX96^2 / 2^192
 * 
 * @param sqrtPriceX96 The sqrt price value
 * @returns The corresponding tick
 */
function tickFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const Q96 = 2n ** 96n;
  
  // Calculate price from sqrtPriceX96
  // price = (sqrtPriceX96^2) / 2^192
  const price = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  
  // Convert to float for logarithm calculation
  const priceFloat = Number(price) / Number(10n ** 18n);
  
  // tick = log_1.0001(price) = ln(price) / ln(1.0001)
  const tick = Math.log(priceFloat) / Math.log(1.0001);
  
  return Math.floor(tick);
}

/**
 * Calculate tick bounds for liquidity range
 * 
 * @param centerTick The center tick (current price)
 * @param rangePercent The range as a percentage (e.g., 1.0 = ±100%)
 * @param tickSpacing The tick spacing for the fee tier
 * @returns [tickLower, tickUpper]
 */
function calculateTickBounds(
  centerTick: number,
  rangePercent: number,
  tickSpacing: number
): [number, number] {
  // Calculate tick range from percentage
  // For ±100% range: ticks = ln(2) / ln(1.0001) ≈ 6931
  const tickRange = Math.floor(Math.log(1 + rangePercent) / Math.log(1.0001));
  
  // Calculate bounds
  let tickLower = centerTick - tickRange;
  let tickUpper = centerTick + tickRange;
  
  // Round to nearest tick spacing (required by Uniswap V3)
  tickLower = Math.floor(tickLower / tickSpacing) * tickSpacing;
  tickUpper = Math.ceil(tickUpper / tickSpacing) * tickSpacing;
  
  // Uniswap V3 tick bounds: [-887272, 887272]
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;
  
  tickLower = Math.max(tickLower, MIN_TICK);
  tickUpper = Math.min(tickUpper, MAX_TICK);
  
  return [tickLower, tickUpper];
}

/**
 * Sort tokens by address (required for Uniswap V3)
 * @returns [token0, token1, amount0, amount1]
 */
function sortTokens(
  tokenA: string,
  tokenB: string,
  amountA: bigint,
  amountB: bigint
): [string, string, bigint, bigint] {
  const token0IsA = tokenA.toLowerCase() < tokenB.toLowerCase();
  
  return token0IsA
    ? [tokenA, tokenB, amountA, amountB]
    : [tokenB, tokenA, amountB, amountA];
}

// =============================================================================
// MAIN DEPLOYMENT FUNCTION
// =============================================================================

async function main() {
  console.log("=".repeat(80));
  console.log("🚀 SparkDEX V3 Liquidity Deployment - Shield Finance Fair Launch");
  console.log("=".repeat(80));
  console.log();

  // Step 1: Validate configuration
  if (!SHIELD_ADDRESS) {
    console.error("❌ ERROR: SHIELD_TOKEN_ADDRESS environment variable not set!");
    console.log("\nPlease set SHIELD_TOKEN_ADDRESS in your .env file or environment:");
    console.log("export SHIELD_TOKEN_ADDRESS=0x...");
    console.log("\nGet this address from your ShieldToken deployment output.");
    process.exit(1);
  }

  console.log("📋 Configuration:");
  console.log("   Network:", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("   wFLR Address:", WFLR_ADDRESS);
  console.log("   SHIELD Address:", SHIELD_ADDRESS);
  console.log("   SparkDEX Position Manager:", SPARKDEX_POSITION_MANAGER);
  console.log("   Liquidity: ", ethers.formatEther(WFLR_AMOUNT), "wFLR +", ethers.formatEther(SHIELD_AMOUNT), "SHIELD");
  console.log("   Fee Tier:", FEE_TIER / 10000, "%");
  console.log("   Price Range: ±" + (PRICE_RANGE_PERCENT * 100) + "%");
  console.log();

  // Step 2: Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 FLR Balance:", ethers.formatEther(balance), "FLR");
  console.log();

  // Step 3: Connect to token contracts
  console.log("🔗 Connecting to token contracts...");
  const wflr = await ethers.getContractAt("IWFLR", WFLR_ADDRESS);
  const shield = await ethers.getContractAt("IERC20", SHIELD_ADDRESS);
  
  // Step 4: Check balances
  console.log("\n💰 Checking token balances...");
  const wflrBalance = await wflr.balanceOf(deployer.address);
  const shieldBalance = await shield.balanceOf(deployer.address);
  
  console.log("   wFLR Balance:", ethers.formatEther(wflrBalance), "wFLR");
  console.log("   SHIELD Balance:", ethers.formatEther(shieldBalance), "SHIELD");
  
  // Validate sufficient balances
  if (wflrBalance < WFLR_AMOUNT) {
    console.error("\n❌ ERROR: Insufficient wFLR balance!");
    console.log("   Required:", ethers.formatEther(WFLR_AMOUNT), "wFLR");
    console.log("   Available:", ethers.formatEther(wflrBalance), "wFLR");
    console.log("   Shortfall:", ethers.formatEther(WFLR_AMOUNT - wflrBalance), "wFLR");
    console.log("\nTo wrap FLR into wFLR:");
    console.log("   1. Send FLR to wFLR contract:", WFLR_ADDRESS);
    console.log("   2. Or call wflr.deposit() with value");
    process.exit(1);
  }
  
  if (shieldBalance < SHIELD_AMOUNT) {
    console.error("\n❌ ERROR: Insufficient SHIELD balance!");
    console.log("   Required:", ethers.formatEther(SHIELD_AMOUNT), "SHIELD");
    console.log("   Available:", ethers.formatEther(shieldBalance), "SHIELD");
    console.log("   Shortfall:", ethers.formatEther(SHIELD_AMOUNT - shieldBalance), "SHIELD");
    process.exit(1);
  }
  
  console.log("✅ Sufficient balances confirmed");

  // Step 5: Sort tokens (Uniswap V3 requires token0 < token1)
  console.log("\n🔀 Sorting tokens for Uniswap V3...");
  const [token0, token1, amount0Desired, amount1Desired] = sortTokens(
    WFLR_ADDRESS,
    SHIELD_ADDRESS,
    WFLR_AMOUNT,
    SHIELD_AMOUNT
  );
  
  console.log("   Token0:", token0, token0 === WFLR_ADDRESS ? "(wFLR)" : "(SHIELD)");
  console.log("   Token1:", token1, token1 === WFLR_ADDRESS ? "(wFLR)" : "(SHIELD)");
  console.log("   Amount0:", ethers.formatEther(amount0Desired));
  console.log("   Amount1:", ethers.formatEther(amount1Desired));

  // Step 6: Calculate sqrtPriceX96 and tick range
  console.log("\n🧮 Calculating Uniswap V3 price parameters...");
  const sqrtPriceX96 = calculateSqrtPriceX96(amount0Desired, amount1Desired);
  console.log("   sqrtPriceX96:", sqrtPriceX96.toString());
  
  const centerTick = tickFromSqrtPriceX96(sqrtPriceX96);
  console.log("   Center Tick:", centerTick);
  
  const [tickLower, tickUpper] = calculateTickBounds(
    centerTick,
    PRICE_RANGE_PERCENT,
    TICK_SPACING
  );
  console.log("   Tick Lower:", tickLower);
  console.log("   Tick Upper:", tickUpper);
  console.log("   Tick Range:", tickUpper - tickLower, "ticks");
  
  // Calculate price range
  const priceLower = 1.0001 ** tickLower;
  const priceUpper = 1.0001 ** tickUpper;
  console.log("   Price Range: [", priceLower.toFixed(6), ",", priceUpper.toFixed(6), "]");

  // Step 7: Approve tokens
  console.log("\n✅ Approving tokens for NonfungiblePositionManager...");
  
  const wflrAllowance = await wflr.allowance(deployer.address, SPARKDEX_POSITION_MANAGER);
  if (wflrAllowance < WFLR_AMOUNT) {
    console.log("   Approving wFLR...");
    const approveTx = await wflr.approve(SPARKDEX_POSITION_MANAGER, WFLR_AMOUNT);
    await approveTx.wait();
    console.log("   ✅ wFLR approved");
  } else {
    console.log("   ✅ wFLR already approved");
  }
  
  const shieldAllowance = await shield.allowance(deployer.address, SPARKDEX_POSITION_MANAGER);
  if (shieldAllowance < SHIELD_AMOUNT) {
    console.log("   Approving SHIELD...");
    const approveTx = await shield.approve(SPARKDEX_POSITION_MANAGER, SHIELD_AMOUNT);
    await approveTx.wait();
    console.log("   ✅ SHIELD approved");
  } else {
    console.log("   ✅ SHIELD already approved");
  }

  // Step 8: Connect to Position Manager
  console.log("\n🔗 Connecting to NonfungiblePositionManager...");
  const positionManager = await ethers.getContractAt(
    "INonfungiblePositionManager",
    SPARKDEX_POSITION_MANAGER
  );

  // Step 9: Create and initialize pool
  console.log("\n🏊 Creating/initializing pool...");
  console.log("   This will create the pool if it doesn't exist, or skip if it does.");
  
  try {
    const createPoolTx = await positionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      FEE_TIER,
      sqrtPriceX96
    );
    const createPoolReceipt = await createPoolTx.wait();
    console.log("   ✅ Pool created/initialized");
    console.log("   Transaction:", createPoolReceipt?.hash);
  } catch (error: any) {
    if (error.message?.includes("Already initialized")) {
      console.log("   ℹ️  Pool already exists");
    } else {
      throw error;
    }
  }

  // Step 10: Mint LP position
  console.log("\n💎 Minting LP position NFT...");
  
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
  
  const mintParams = {
    token0,
    token1,
    fee: FEE_TIER,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min: 0, // No slippage protection for initial pool
    amount1Min: 0,
    recipient: deployer.address,
    deadline,
  };
  
  console.log("   Minting position...");
  const mintTx = await positionManager.mint(mintParams);
  const mintReceipt = await mintTx.wait();
  console.log("   ✅ Position minted!");
  console.log("   Transaction:", mintReceipt?.hash);
  
  // Step 11: Extract token ID from Transfer event
  console.log("\n🔍 Extracting LP NFT token ID...");
  
  let tokenId: bigint | undefined;
  
  if (mintReceipt) {
    for (const log of mintReceipt.logs) {
      try {
        if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
          // Transfer event: Transfer(address from, address to, uint256 tokenId)
          // tokenId is in topics[3]
          tokenId = BigInt(log.topics[3]);
          break;
        }
      } catch (e) {
        // Skip logs that don't match
        continue;
      }
    }
  }
  
  if (!tokenId) {
    console.error("   ⚠️  Warning: Could not extract token ID from transaction");
    console.log("   Check transaction on block explorer:", mintReceipt?.hash);
  } else {
    console.log("   ✅ LP NFT Token ID:", tokenId.toString());
    
    // Verify ownership
    const owner = await positionManager.ownerOf(tokenId);
    console.log("   Owner:", owner);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.warn("   ⚠️  Warning: Owner doesn't match deployer!");
    }
  }

  // Step 12: Get pool address
  console.log("\n🏊 Getting pool address...");
  const IUniswapV3FactoryABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ];
  const factory = await ethers.getContractAt(IUniswapV3FactoryABI, SPARKDEX_FACTORY);
  const poolAddress = await factory.getPool(token0, token1, FEE_TIER);
  console.log("   Pool Address:", poolAddress);

  // Step 13: Save deployment info
  console.log("\n💾 Saving deployment info...");
  
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    tokens: {
      wflr: WFLR_ADDRESS,
      shield: SHIELD_ADDRESS,
    },
    liquidity: {
      wflrAmount: ethers.formatEther(WFLR_AMOUNT),
      shieldAmount: ethers.formatEther(SHIELD_AMOUNT),
      initialPrice: "0.01 USD per SHIELD (assuming wFLR = $0.01868)",
    },
    pool: {
      address: poolAddress,
      token0,
      token1,
      feeTier: FEE_TIER,
      tickLower,
      tickUpper,
      sqrtPriceX96: sqrtPriceX96.toString(),
    },
    lpNft: {
      tokenId: tokenId?.toString() || "Unknown",
      positionManager: SPARKDEX_POSITION_MANAGER,
      owner: deployer.address,
    },
    transactions: {
      poolCreation: mintReceipt?.hash,
      mint: mintReceipt?.hash,
    },
  };
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const deploymentFile = path.join(deploymentsDir, `sparkdex-lp-${timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log("   ✅ Saved to:", deploymentFile);

  // Step 14: Print summary and next steps
  console.log("\n" + "=".repeat(80));
  console.log("✅ LP DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n📊 SUMMARY:");
  console.log("   Pool Address:", poolAddress);
  console.log("   LP NFT Token ID:", tokenId?.toString() || "Check transaction");
  console.log("   Initial Liquidity:");
  console.log("      -", ethers.formatEther(WFLR_AMOUNT), "wFLR");
  console.log("      -", ethers.formatEther(SHIELD_AMOUNT), "SHIELD");
  console.log("   Estimated Value: ~$10,000 USD");
  console.log("\n🔗 Useful Links:");
  console.log("   Pool on SparkDEX:", `https://sparkdex.ai/pool/${poolAddress}`);
  console.log("   Pool Explorer:", `https://flarescan.com/address/${poolAddress}`);
  console.log("   LP NFT Explorer:", `https://flarescan.com/token/${SPARKDEX_POSITION_MANAGER}?a=${tokenId}`);
  
  console.log("\n⚠️  CRITICAL NEXT STEP: LOCK LP TOKENS FOR 12 MONTHS");
  console.log("=".repeat(80));
  console.log("\n🔒 LP Locking Options:");
  console.log("\n1. Team Finance (Recommended):");
  console.log("   - Website: https://www.team.finance/");
  console.log("   - Check if Flare mainnet is supported");
  console.log("   - Lock NFT token ID:", tokenId?.toString() || "Unknown");
  console.log("   - Duration:", LOCK_DURATION_DAYS, "days (12 months)");
  console.log("\n2. Unicrypt:");
  console.log("   - Website: https://www.uncx.network/");
  console.log("   - Check Flare mainnet support");
  console.log("\n3. Custom Timelock Contract:");
  console.log("   - Deploy ERC721 timelock contract");
  console.log("   - Transfer NFT to timelock");
  console.log("   - Set unlock time to:", LOCK_DURATION_SECONDS, "seconds from now");
  console.log("\n4. Gnosis Safe:");
  console.log("   - Create multi-sig wallet");
  console.log("   - Transfer NFT to safe");
  console.log("   - Implement timelock via safe modules");
  
  console.log("\n📝 Manual Steps:");
  console.log("   1. Choose a locking mechanism from above");
  console.log("   2. Transfer LP NFT (token ID:", tokenId?.toString() || "Unknown", ") to locker");
  console.log("   3. Set lock duration to 365 days");
  console.log("   4. Verify lock on block explorer");
  console.log("   5. Announce lock to community (proof of commitment)");
  
  console.log("\n⚠️  WARNING: DO NOT SKIP LP LOCKING!");
  console.log("   Locked liquidity is essential for:");
  console.log("   - Building community trust");
  console.log("   - Preventing rug pulls");
  console.log("   - Meeting fair launch standards");
  console.log("   - Exchange listings (many require locked LP)");
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ Deployment script complete!");
  console.log("=".repeat(80) + "\n");
}

// =============================================================================
// SCRIPT EXECUTION
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
