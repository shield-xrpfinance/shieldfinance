/**
 * Flare Network Contract Addresses
 * 
 * FAssets Protocol & Firelight.finance Integration
 * Last Updated: November 11, 2025
 * 
 * IMPORTANT NOTES:
 * - AssetManager addresses should be retrieved dynamically from FlareContractRegistry
 * - Firelight contract addresses are being announced post-launch (Nov 11, 2025)
 * - Always verify addresses on block explorers before use
 * - Never hardcode addresses in production; use environment variables
 */

export const FLARE_CONTRACTS = {
  mainnet: {
    // Flare Mainnet (Chain ID: 14)
    chainId: 14,
    rpcUrl: "https://flare-api.flare.network/ext/C/rpc",
    explorer: "https://flarescan.com",
    
    // FAssets Protocol
    fassets: {
      // Flare Contract Registry (use this to get AssetManager address)
      contractRegistry: "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
      
      // FXRP Token (ERC-20)
      // Primary address (verified on Flarescan)
      fxrpToken: "0xAf7278D382323A865734f93B687b300005B8b60E",
      
      // Alternative FXRP address (verify before use)
      fxrpTokenAlt: "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",
      
      // AssetManager Contract
      // ⚠️ DO NOT HARDCODE - Retrieve dynamically via contractRegistry
      // Use: registry.getContractAddressByName("AssetManager")
      assetManager: null, // Retrieved dynamically
      
      // Minting dApps (off-chain)
      mintingDapps: [
        "https://fassets.au.cc/mint",
        "https://fasset.oracle-daemon.com/flare"
      ]
    },
    
    // Firelight.finance (Launched Nov 11, 2025)
    firelight: {
      // Launch Vault Contract (ERC-4626)
      // ⚠️ To be announced - Check firelight.finance app
      // Visit app and connect wallet to get official address
      launchVault: null, // Check firelight.finance/vaults
      
      // stXRP Token (same as Launch Vault for ERC-4626)
      stXRP: null, // Same address as launchVault
      
      // FXRP Token (for deposits)
      fxrpToken: "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",
      
      // Firelight App
      appUrl: "https://firelight.finance"
    }
  },
  
  coston2: {
    // Coston2 Testnet (Chain ID: 114)
    chainId: 114,
    rpcUrl: "https://coston2-api.flare.network/ext/C/rpc",
    explorer: "https://coston2-explorer.flare.network",
    
    // FAssets Protocol (Testnet)
    fassets: {
      // Flare Contract Registry (same address across all networks)
      contractRegistry: "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
      
      // FXRP Token (Testnet) - ⚠️ DEPRECATED: Use FlareClient.getFAssetTokenAddress() instead
      // This address is WRONG - only kept for backwards compatibility
      fxrpToken: "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3", // DEPRECATED - DO NOT USE
      
      // AssetManager Contract
      // ⚠️ DO NOT HARDCODE - Retrieve dynamically via contractRegistry
      assetManager: null, // Retrieved dynamically
      
      // Minting dApps (testnet mode)
      mintingDapps: [
        "https://fassets.au.cc/mint?network=coston2",
        "https://fasset.oracle-daemon.com/coston2"
      ]
    },
    
    // Firelight.finance (Testnet)
    firelight: {
      // ⚠️ Firelight Phase 1 is mainnet-only
      // No testnet deployment available yet
      launchVault: null, // Not available
      stXRP: null, // Not available
      fxrpToken: "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3",
      
      // For testing, use mock contracts or wait for testnet announcement
      appUrl: null
    }
  }
} as const;

/**
 * Helper function to retrieve AssetManager address from Flare Contract Registry
 * 
 * @param network - 'mainnet' or 'coston2'
 * @param provider - Ethers provider instance
 * @returns AssetManager contract address
 * 
 * @example
 * ```typescript
 * import { ethers } from 'ethers';
 * import { getAssetManagerAddress } from './flare-contracts';
 * 
 * const provider = new ethers.JsonRpcProvider(FLARE_CONTRACTS.mainnet.rpcUrl);
 * const assetManagerAddress = await getAssetManagerAddress('mainnet', provider);
 * ```
 */
export async function getAssetManagerAddress(
  network: 'mainnet' | 'coston2',
  provider: any
): Promise<string> {
  const registryAddress = FLARE_CONTRACTS[network].fassets.contractRegistry;
  
  const registryABI = [
    "function getContractAddressByName(string calldata) external view returns (address)"
  ];
  
  // Create contract instance (using provider's Contract constructor)
  const Contract = provider.Contract || (await import('ethers')).Contract;
  const registry = new Contract(registryAddress, registryABI, provider);
  
  // Get AssetManager address
  const assetManagerAddress = await registry.getContractAddressByName("AssetManager");
  
  return assetManagerAddress;
}

/**
 * Network configuration helper
 * 
 * @param network - 'mainnet' or 'coston2'
 * @returns Network configuration object
 */
export function getNetworkConfig(network: 'mainnet' | 'coston2') {
  return {
    chainId: FLARE_CONTRACTS[network].chainId,
    rpcUrl: FLARE_CONTRACTS[network].rpcUrl,
    explorer: FLARE_CONTRACTS[network].explorer,
    nativeCurrency: {
      name: 'Flare',
      symbol: 'FLR',
      decimals: 18
    }
  };
}

/**
 * Verification URLs for block explorers
 */
export const VERIFICATION_URLS = {
  mainnet: {
    fxrp: "https://flarescan.com/token/0xAf7278D382323A865734f93B687b300005B8b60E",
    contractRegistry: "https://flarescan.com/address/0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"
  },
  coston2: {
    fxrp: "https://coston2-explorer.flare.network/token/0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3",
    contractRegistry: "https://coston2-explorer.flare.network/address/0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019"
  }
} as const;

/**
 * Contract deployment status
 */
export const CONTRACT_STATUS = {
  mainnet: {
    fxrp: "✅ Verified on Flarescan (Sep 2024)",
    assetManager: "🔄 Retrieve via Contract Registry",
    firelightVault: "🔄 Announced Nov 11, 2025 - Check firelight.finance",
    stXRP: "🔄 Announced Nov 11, 2025 - Check firelight.finance"
  },
  coston2: {
    fxrp: "✅ Confirmed from deployment",
    assetManager: "🔄 Retrieve via Contract Registry",
    firelightVault: "❌ Mainnet only (Phase 1)",
    stXRP: "❌ Mainnet only (Phase 1)"
  }
} as const;

/**
 * Risk Notes
 */
export const RISK_NOTES = {
  fassets: [
    "Always retrieve AssetManager address dynamically from Contract Registry",
    "Verify FXRP token address on block explorer before use",
    "FAssets v1.2 launched Sep 2024 - production ready",
    "AssetManager uses Diamond Pattern (EIP-2535) - may upgrade"
  ],
  firelight: [
    "Firelight launched Nov 11, 2025 - early stage protocol",
    "Contract addresses to be announced on firelight.finance",
    "Testnet not available in Phase 1 - mainnet only",
    "Always verify addresses on Flarescan before depositing funds",
    "Start with small test amounts"
  ]
} as const;

/**
 * Type exports for TypeScript
 */
export type Network = 'mainnet' | 'coston2';
export type FAssetsContracts = typeof FLARE_CONTRACTS.mainnet.fassets;
export type FirelightContracts = typeof FLARE_CONTRACTS.mainnet.firelight;
