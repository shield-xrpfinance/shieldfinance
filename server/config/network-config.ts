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
 * Strategy type identifiers for address-to-type mapping
 */
export type StrategyType = "kinetic" | "firelight" | "buffer" | "unknown";

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
    vaultController: string | null;
    firelightStXRP: string | null;
    fxrpToken: string | null;
  };
  strategies: {
    /** Map of strategy contract address (lowercase) to type */
    addressToType: Record<string, StrategyType>;
    /** Known strategy addresses by type */
    kinetic: string | null;
    firelight: string | null;
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
  const vaultController = process.env.VAULT_CONTROLLER_ADDRESS || null;
  
  // Known strategy addresses from environment (set after deployment)
  const kineticStrategy = process.env.KINETIC_STRATEGY_ADDRESS || null;
  const firelightStrategy = process.env.FIRELIGHT_STRATEGY_ADDRESS || null;
  
  // Build address-to-type mapping
  const addressToType: Record<string, StrategyType> = {};
  if (kineticStrategy) {
    addressToType[kineticStrategy.toLowerCase()] = "kinetic";
  }
  if (firelightStrategy) {
    addressToType[firelightStrategy.toLowerCase()] = "firelight";
  }
  
  if (network === "mainnet") {
    return {
      network,
      chainId: flareConfig.chainId,
      rpcUrl: process.env.FLARE_RPC_URL || flareConfig.rpcUrl,
      explorer: flareConfig.explorer,
      contracts: {
        shXRPVault,
        vaultController,
        firelightStXRP: flareConfig.firelight.stXRPVault,
        fxrpToken: flareConfig.fassets.fxrpToken,
      },
      strategies: {
        addressToType,
        kinetic: kineticStrategy,
        firelight: firelightStrategy,
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
      vaultController,
      firelightStXRP: null, // Firelight not available on testnet
      fxrpToken: flareConfig.fassets.fxrpToken,
    },
    strategies: {
      addressToType,
      kinetic: kineticStrategy,
      firelight: null, // Firelight mainnet only
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
 * Get strategy type from address using configuration mapping
 * Falls back to string matching on name if not in config
 */
export function getStrategyType(address: string, name?: string): StrategyType {
  const config = getNetworkConfig();
  const normalized = address.toLowerCase();
  
  // First check config mapping (most reliable)
  if (config.strategies.addressToType[normalized]) {
    return config.strategies.addressToType[normalized];
  }
  
  // Fallback to name-based matching
  if (name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("kinetic")) return "kinetic";
    if (lowerName.includes("firelight")) return "firelight";
  }
  
  return "unknown";
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
