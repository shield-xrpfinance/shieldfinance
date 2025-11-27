/**
 * RPC Failover Configuration for Flare/Coston2 Networks
 * 
 * Provides multiple RPC endpoints with automatic failover for improved reliability.
 * Useful for testnet environments where individual RPC nodes may be temporarily unavailable.
 */

import { ethers } from 'ethers';

export type NetworkType = 'mainnet' | 'coston2';

/**
 * RPC endpoints for each network, ordered by priority (primary first)
 */
export const RPC_ENDPOINTS: Record<NetworkType, string[]> = {
  mainnet: [
    'https://flare-api.flare.network/ext/C/rpc',
    'https://rpc.ankr.com/flare',
    'https://flare.public-rpc.com',
  ],
  coston2: [
    'https://coston2-api.flare.network/ext/C/rpc',
    'https://coston2.enosys.global/ext/bc/C/rpc',
    'https://flare-testnet-coston2.rpc.thirdweb.com',
  ],
};

/**
 * Timeout for RPC connection testing (in milliseconds)
 */
const RPC_TIMEOUT_MS = 5000;

/**
 * Get an RPC endpoint for a specific network
 * 
 * @param network - 'mainnet' or 'coston2'
 * @param index - Index of the endpoint (0 = primary, 1+ = fallbacks)
 * @returns The RPC endpoint URL
 * 
 * @example
 * const primaryRpc = getRpcEndpoint('coston2'); // Primary endpoint
 * const fallbackRpc = getRpcEndpoint('coston2', 1); // First fallback
 */
export function getRpcEndpoint(network: NetworkType, index: number = 0): string {
  const endpoints = RPC_ENDPOINTS[network];
  if (index < 0 || index >= endpoints.length) {
    console.warn(`[RPC] Invalid endpoint index ${index} for ${network}, using primary`);
    return endpoints[0];
  }
  return endpoints[index];
}

/**
 * Get all RPC endpoints for a network
 * 
 * @param network - 'mainnet' or 'coston2'
 * @returns Array of all RPC endpoint URLs
 */
export function getAllEndpoints(network: NetworkType): string[] {
  return [...RPC_ENDPOINTS[network]];
}

/**
 * Test if an RPC endpoint is working by calling eth_blockNumber
 * 
 * @param rpcUrl - The RPC URL to test
 * @param timeoutMs - Timeout in milliseconds
 * @returns True if the endpoint responds successfully
 */
async function testRpcConnection(rpcUrl: string, timeoutMs: number = RPC_TIMEOUT_MS): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.result !== undefined && !data.error;
  } catch (error) {
    return false;
  }
}

/**
 * Get a working JsonRpcProvider by testing endpoints in order
 * Falls back to next endpoint if the current one fails
 * 
 * @param network - 'mainnet' or 'coston2'
 * @returns A connected JsonRpcProvider
 * @throws Error if all endpoints fail
 * 
 * @example
 * const provider = await getWorkingProvider('coston2');
 * const blockNumber = await provider.getBlockNumber();
 */
export async function getWorkingProvider(network: NetworkType): Promise<ethers.JsonRpcProvider> {
  const endpoints = RPC_ENDPOINTS[network];
  const errors: string[] = [];

  for (let i = 0; i < endpoints.length; i++) {
    const rpcUrl = endpoints[i];
    
    console.log(`[RPC] Testing ${network} endpoint ${i + 1}/${endpoints.length}: ${rpcUrl}`);
    
    const isWorking = await testRpcConnection(rpcUrl);
    
    if (isWorking) {
      console.log(`[RPC] ✓ Connected to ${network} via: ${rpcUrl}`);
      return new ethers.JsonRpcProvider(rpcUrl);
    } else {
      const errorMsg = `Endpoint ${rpcUrl} failed or timed out`;
      errors.push(errorMsg);
      console.warn(`[RPC] ✗ ${errorMsg}`);
    }
  }

  // All endpoints failed
  const errorMessage = `[RPC] All ${network} endpoints failed:\n${errors.join('\n')}`;
  console.error(errorMessage);
  throw new Error(`No working RPC endpoints available for ${network}`);
}

/**
 * Create a failover provider that tries endpoints in order
 * Alias for getWorkingProvider for backwards compatibility
 * 
 * @param network - 'mainnet' or 'coston2'
 * @returns A connected JsonRpcProvider
 */
export const createFailoverProvider = getWorkingProvider;

/**
 * Get network configuration including chain ID
 * 
 * @param network - 'mainnet' or 'coston2'
 * @returns Network configuration object
 */
export function getNetworkInfo(network: NetworkType) {
  const configs = {
    mainnet: {
      chainId: 14,
      name: 'Flare Mainnet',
      explorer: 'https://flarescan.com',
    },
    coston2: {
      chainId: 114,
      name: 'Coston2 Testnet',
      explorer: 'https://coston2-explorer.flare.network',
    },
  };
  return configs[network];
}
