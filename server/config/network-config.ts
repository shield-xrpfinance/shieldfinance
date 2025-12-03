/**
 * Network Configuration for Flare Network
 * 
 * Supports mainnet and coston2 (testnet) with environment variable control.
 * Use FLARE_NETWORK=mainnet or FLARE_NETWORK=coston2 (default)
 */

import { FLARE_CONTRACTS } from "../../shared/flare-contracts";

export type Network = "mainnet" | "coston2";

/**
 * Get the current network from environment
 * Defaults to coston2 (testnet) for safety
 */
export function getCurrentNetwork(): Network {
  const network = process.env.FLARE_NETWORK?.toLowerCase();
  if (network === "mainnet") {
    return "mainnet";
  }
  return "coston2";
}

/**
 * Network-specific configuration
 */
export interface NetworkConfig {
  network: Network;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  contracts: {
    shXRPVault: string | null;
    firelightStXRP: string | null;
    fxrpToken: string | null;
  };
  features: {
    firelightEnabled: boolean;
    mainnetContracts: boolean;
  };
}

/**
 * Get network configuration based on current environment
 */
export function getNetworkConfig(): NetworkConfig {
  const network = getCurrentNetwork();
  const flareConfig = FLARE_CONTRACTS[network];
  
  // Get our deployed vault address from environment or deployments
  const shXRPVault = process.env.VITE_SHXRP_VAULT_ADDRESS || null;
  
  if (network === "mainnet") {
    return {
      network,
      chainId: flareConfig.chainId,
      rpcUrl: process.env.FLARE_RPC_URL || flareConfig.rpcUrl,
      explorer: flareConfig.explorer,
      contracts: {
        shXRPVault,
        firelightStXRP: flareConfig.firelight.stXRPVault,
        fxrpToken: flareConfig.fassets.fxrpToken,
      },
      features: {
        firelightEnabled: true,
        mainnetContracts: true,
      },
    };
  }
  
  // Coston2 (testnet)
  return {
    network,
    chainId: flareConfig.chainId,
    rpcUrl: process.env.FLARE_RPC_URL || flareConfig.rpcUrl,
    explorer: flareConfig.explorer,
    contracts: {
      shXRPVault,
      firelightStXRP: null, // Firelight not available on testnet
      fxrpToken: flareConfig.fassets.fxrpToken,
    },
    features: {
      firelightEnabled: false, // Firelight mainnet only
      mainnetContracts: false,
    },
  };
}

/**
 * Get Firelight stXRP vault address for current network
 * Returns null if Firelight is not available on current network
 */
export function getFirelightVaultAddress(): string | null {
  const config = getNetworkConfig();
  return config.contracts.firelightStXRP;
}

/**
 * Check if Firelight is enabled for current network
 */
export function isFirelightEnabled(): boolean {
  const config = getNetworkConfig();
  return config.features.firelightEnabled;
}

/**
 * Get FXRP token address for current network
 */
export function getFxrpTokenAddress(): string | null {
  const config = getNetworkConfig();
  return config.contracts.fxrpToken;
}

/**
 * Get block explorer URL for a transaction/address
 */
export function getExplorerUrl(type: "tx" | "address" | "token", hash: string): string {
  const config = getNetworkConfig();
  return `${config.explorer}/${type}/${hash}`;
}

/**
 * Log current network configuration (for debugging)
 */
export function logNetworkConfig(): void {
  const config = getNetworkConfig();
  console.log(`🌐 Network Configuration:`);
  console.log(`   Network: ${config.network} (Chain ID: ${config.chainId})`);
  console.log(`   RPC: ${config.rpcUrl}`);
  console.log(`   Explorer: ${config.explorer}`);
  console.log(`   Firelight: ${config.features.firelightEnabled ? "✅ Enabled" : "❌ Disabled (testnet)"}`);
  if (config.contracts.firelightStXRP) {
    console.log(`   Firelight stXRP: ${config.contracts.firelightStXRP}`);
  }
  if (config.contracts.shXRPVault) {
    console.log(`   ShXRP Vault: ${config.contracts.shXRPVault}`);
  }
}

// Export singleton config for easy access
export const networkConfig = getNetworkConfig();
