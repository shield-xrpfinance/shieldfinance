/**
 * FTSO V2 Integration for Flare Network
 * 
 * Provides real-time price feeds from Flare Time Series Oracle
 * Documentation: https://dev.flare.network/ftso/getting-started/
 */

import { ethers } from "ethers";

// FTSO Feed IDs (21 bytes) - see https://dev.flare.network/ftso/feeds
export const FTSO_FEED_IDS = {
  FLR_USD: "0x01464c522f55534400000000000000000000000000", // Index 0, Risk: Low
  XRP_USD: "0x015852502f55534400000000000000000000000000", // Index 3, Risk: Low
} as const;

// Flare Contract Registry Address (same on mainnet and Coston2)
export const CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

// Contract Registry ABI - minimal interface to get FTSO contract
export const CONTRACT_REGISTRY_ABI = [
  "function getContractAddressByName(string) external view returns (address)",
] as const;

// FTSO V2 Interface ABI - minimal interface for price fetching
export const FTSO_V2_ABI = [
  "function getFeedById(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp)",
  "function getFeedsById(bytes21[] feedIds) external view returns (uint256[] values, int8[] decimals, uint64 timestamp)",
] as const;

/**
 * Get FTSO contract address from Contract Registry
 * @param provider - Ethers provider
 * @param isTestnet - Whether using testnet (Coston2) or mainnet
 * @returns FTSO contract address
 */
export async function getFtsoContractAddress(
  provider: ethers.Provider,
  isTestnet: boolean
): Promise<string> {
  const registry = new ethers.Contract(
    CONTRACT_REGISTRY_ADDRESS,
    CONTRACT_REGISTRY_ABI,
    provider
  );

  // Use TestFtsoV2 for testnet, FtsoV2 for mainnet
  const contractName = isTestnet ? "TestFtsoV2" : "FtsoV2";
  const ftsoAddress = await registry.getContractAddressByName(contractName);
  
  return ftsoAddress;
}

/**
 * Fetch price for a single feed
 * @param provider - Ethers provider
 * @param feedId - FTSO feed ID (21 bytes)
 * @param isTestnet - Whether using testnet
 * @returns Price as a number (already divided by 10^decimals)
 */
export async function getFtsoPrice(
  provider: ethers.Provider,
  feedId: string,
  isTestnet: boolean
): Promise<number> {
  try {
    const ftsoAddress = await getFtsoContractAddress(provider, isTestnet);
    const ftso = new ethers.Contract(ftsoAddress, FTSO_V2_ABI, provider);
    
    const [value, decimals] = await ftso.getFeedById(feedId);
    
    // Calculate floating point price: value / 10^decimals
    const price = Number(value) / Math.pow(10, Number(decimals));
    
    return price;
  } catch (error) {
    console.error(`Failed to fetch FTSO price for ${feedId}:`, error);
    return 0;
  }
}

/**
 * Fetch multiple prices at once (more efficient)
 * @param provider - Ethers provider
 * @param feedIds - Array of FTSO feed IDs
 * @param isTestnet - Whether using testnet
 * @returns Map of feedId to price
 */
export async function getFtsoPrices(
  provider: ethers.Provider,
  feedIds: string[],
  isTestnet: boolean
): Promise<Map<string, number>> {
  try {
    const ftsoAddress = await getFtsoContractAddress(provider, isTestnet);
    const ftso = new ethers.Contract(ftsoAddress, FTSO_V2_ABI, provider);
    
    const [values, decimals] = await ftso.getFeedsById(feedIds);
    
    const priceMap = new Map<string, number>();
    
    for (let i = 0; i < feedIds.length; i++) {
      const price = Number(values[i]) / Math.pow(10, Number(decimals[i]));
      priceMap.set(feedIds[i], price);
    }
    
    return priceMap;
  } catch (error) {
    console.error("Failed to fetch FTSO prices:", error);
    return new Map();
  }
}
