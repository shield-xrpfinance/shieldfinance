import hre from "hardhat";

const { ethers } = hre;

/**
 * Weekly SHIELD Burn Script (SECURITY-HARDENED)
 * 
 * IMPORTANT: This script runs in public GitHub Actions logs
 * DO NOT log sensitive data: addresses, tx hashes, balances, gas usage, etc.
 * 
 * Called automatically every Sunday via GitHub Actions (.github/workflows/weekly-burn.yml)
 * Can also be run manually: npx hardhat run scripts/burn.ts --network flare
 */

const REVENUE_ROUTER_ADDRESS = process.env.REVENUE_ROUTER_ADDRESS || "";
const WFLR_ADDRESS = "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d";
const MIN_BALANCE_THRESHOLD = ethers.parseEther("5000"); // 5000 wFLR

async function main() {
  // Validate configuration
  if (!REVENUE_ROUTER_ADDRESS) {
    // Fail silently - no error details
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  
  // Connect to contracts (no logging of addresses)
  const wflr = await ethers.getContractAt("IERC20", WFLR_ADDRESS);
  const revenueRouter = await ethers.getContractAt(
    "RevenueRouter",
    REVENUE_ROUTER_ADDRESS
  );

  // Check wFLR balance
  const balance = await wflr.balanceOf(REVENUE_ROUTER_ADDRESS);

  // Public-safe logging ONLY - no addresses, hashes, or precise balances
  const balanceNum = Number(ethers.formatEther(balance));
  console.log(`Balance check: ${balanceNum > 5000 ? "Above" : "Below"} threshold`);

  // Check if balance meets threshold
  if (balance < MIN_BALANCE_THRESHOLD) {
    console.log("No burn needed");
    return;
  }

  console.log("Executing burn");

  try {
    // Execute burn (DO NOT log tx hash - it's sensitive!)
    const tx = await revenueRouter.distribute({
      gasLimit: 1000000
    });
    
    await tx.wait();
    
    console.log("Burn completed successfully");

  } catch (error: any) {
    // DO NOT log error details - they contain sensitive transaction data
    console.log("Burn failed");
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    // Exit with error code but no logging
    process.exit(1);
  });
