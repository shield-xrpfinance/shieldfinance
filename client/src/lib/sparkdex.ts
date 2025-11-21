/**
 * SparkDEX V3 Integration for Shield Finance
 * 
 * Enables users to swap FLR/wFLR for $SHIELD tokens directly in-app
 * and stake them immediately for APY boosts on shXRP positions.
 */

import { ethers } from "ethers";

// Network-specific contract addresses
export const CONTRACTS = {
  mainnet: {
    WFLR: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
    SPARKDEX_ROUTER: "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781", // SparkDEX V3 SwapRouter
    SHIELD_TOKEN: process.env.VITE_SHIELD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000", // Deployed address
  },
  testnet: {
    WFLR: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273", // Coston2
    SPARKDEX_ROUTER: "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781", // Same as mainnet
    SHIELD_TOKEN: process.env.VITE_SHIELD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
  },
};

// Uniswap V2-compatible Router ABI (SparkDEX V3 uses V2 interface)
export const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)",
];

// ERC20 ABI for token approvals
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
];

/**
 * Get contract addresses for current network
 */
export function getContracts(isTestnet: boolean) {
  return isTestnet ? CONTRACTS.testnet : CONTRACTS.mainnet;
}

/**
 * Get price quote for swapping tokens
 * @param router - Ethers contract instance of SparkDEX router
 * @param amountIn - Amount of input tokens (in wei)
 * @param path - Token swap path [tokenIn, tokenOut]
 * @returns Expected output amount (in wei)
 */
export async function getSwapQuote(
  router: ethers.Contract,
  amountIn: bigint,
  path: string[]
): Promise<bigint> {
  try {
    const amounts = await router.getAmountsOut(amountIn, path);
    return amounts[amounts.length - 1];
  } catch (error) {
    console.error("Failed to get swap quote:", error);
    throw new Error("Unable to fetch price quote");
  }
}

/**
 * Calculate price impact percentage
 * @param amountIn - Input amount (human-readable)
 * @param amountOut - Output amount (human-readable)
 * @param expectedRate - Expected exchange rate (output per input)
 * @returns Price impact as percentage (e.g., 0.5 for 0.5%)
 */
export function calculatePriceImpact(
  amountIn: number,
  amountOut: number,
  expectedRate: number
): number {
  if (amountIn === 0 || expectedRate === 0) return 0;
  const expectedOut = amountIn * expectedRate;
  const impact = ((expectedOut - amountOut) / expectedOut) * 100;
  return Math.max(0, impact); // Never negative
}

/**
 * Apply slippage tolerance to minimum output
 * @param amount - Expected output amount (in wei)
 * @param slippagePercent - Slippage tolerance (e.g., 0.5 for 0.5%)
 * @returns Minimum acceptable output with slippage applied
 */
export function applySlippage(amount: bigint, slippagePercent: number): bigint {
  const slippageBps = Math.floor(slippagePercent * 100); // Convert to basis points
  const slippageAmount = (amount * BigInt(slippageBps)) / BigInt(10000);
  return amount - slippageAmount;
}

/**
 * Get deadline timestamp (10 minutes from now)
 */
export function getDeadline(): number {
  return Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes
}

/**
 * Format token amount for display
 * @param amount - Amount in wei
 * @param decimals - Token decimals
 * @param maxDecimals - Max decimal places to show
 * @returns Formatted string
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
  maxDecimals: number = 6
): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return whole.toString();
  }
  
  const decimalStr = remainder.toString().padStart(decimals, "0");
  const trimmed = decimalStr.slice(0, maxDecimals).replace(/0+$/, "");
  
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Parse human-readable token amount to wei
 * @param amount - Human-readable amount (e.g., "1.5")
 * @param decimals - Token decimals
 * @returns Amount in wei
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  try {
    return ethers.parseUnits(amount, decimals);
  } catch (error) {
    throw new Error("Invalid amount format");
  }
}
