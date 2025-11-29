/**
 * Network-aware asset configuration
 * Single source of truth for token metadata across mainnet and testnet
 */

export type AssetKey = 
  | "XRP" | "FXRP" | "RLUSD" | "USDC" | "FLR" | "WFLR" | "USDT" | "SHIELD" | "shXRP"
  // RWA Assets
  | "T-BILLS" | "T-BONDS" | "PRIV-CREDIT" | "RE-DEBT" | "GOLD" | "SILVER" 
  | "IG-BONDS" | "HY-BONDS" | "MM-FUND"
  // Tokenized Securities
  | "SPX-TOKEN" | "NDX-TOKEN" | "DIV-TOKEN";
export type Network = "mainnet" | "testnet";

export interface AssetMetadata {
  displayName: string;
  symbol: string;
  address?: string; // ERC-20 contract address (for EVM tokens)
  decimals: number;
  icon?: string; // Icon path or URL
}

/**
 * Asset configuration by network
 * Maps canonical asset keys to network-specific metadata
 */
const ASSET_CONFIG: Record<Network, Record<AssetKey, AssetMetadata>> = {
  mainnet: {
    XRP: {
      displayName: "XRP",
      symbol: "XRP",
      decimals: 6,
    },
    FXRP: {
      displayName: "FXRP",
      symbol: "FXRP",
      address: "0x0000000000000000000000000000000000000000", // TODO: Update with mainnet FXRP address
      decimals: 6,
    },
    RLUSD: {
      displayName: "Ripple USD",
      symbol: "RLUSD",
      decimals: 6,
    },
    USDC: {
      displayName: "USD Coin",
      symbol: "USDC",
      decimals: 6,
    },
    FLR: {
      displayName: "Flare",
      symbol: "FLR",
      decimals: 18,
    },
    WFLR: {
      displayName: "Wrapped Flare",
      symbol: "WFLR",
      address: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d", // Mainnet WFLR
      decimals: 18,
    },
    USDT: {
      displayName: "Bridged USDT",
      symbol: "USDT",
      address: "0x9C3046C0DaA60b6F061f123CccfC29B7920d0d4f", // Stargate USDT on Flare
      decimals: 6,
    },
    SHIELD: {
      displayName: "Shield",
      symbol: "SHIELD",
      address: "0x0000000000000000000000000000000000000000", // TODO: Update with mainnet SHIELD address
      decimals: 18,
    },
    shXRP: {
      displayName: "Liquid Staked XRP",
      symbol: "shXRP",
      decimals: 18,
    },
    // RWA Assets
    "T-BILLS": {
      displayName: "US Treasury Bills",
      symbol: "T-BILLS",
      decimals: 6,
    },
    "T-BONDS": {
      displayName: "US Treasury Bonds",
      symbol: "T-BONDS",
      decimals: 6,
    },
    "PRIV-CREDIT": {
      displayName: "Private Credit",
      symbol: "PRIV-CREDIT",
      decimals: 6,
    },
    "RE-DEBT": {
      displayName: "Real Estate Debt",
      symbol: "RE-DEBT",
      decimals: 6,
    },
    "GOLD": {
      displayName: "Gold",
      symbol: "GOLD",
      decimals: 6,
    },
    "SILVER": {
      displayName: "Silver",
      symbol: "SILVER",
      decimals: 6,
    },
    "IG-BONDS": {
      displayName: "Investment Grade Bonds",
      symbol: "IG-BONDS",
      decimals: 6,
    },
    "HY-BONDS": {
      displayName: "High Yield Bonds",
      symbol: "HY-BONDS",
      decimals: 6,
    },
    "MM-FUND": {
      displayName: "Money Market Fund",
      symbol: "MM-FUND",
      decimals: 6,
    },
    // Tokenized Securities
    "SPX-TOKEN": {
      displayName: "S&P 500 Token",
      symbol: "SPX",
      decimals: 18,
    },
    "NDX-TOKEN": {
      displayName: "NASDAQ-100 Token",
      symbol: "NDX",
      decimals: 18,
    },
    "DIV-TOKEN": {
      displayName: "Dividend Portfolio Token",
      symbol: "DIV",
      decimals: 18,
    },
  },
  testnet: {
    XRP: {
      displayName: "Test XRP",
      symbol: "XRP",
      decimals: 6,
    },
    FXRP: {
      displayName: "FTestXRP",
      symbol: "FTestXRP",
      address: "0x0b6A3645c240605887a5532109323A3E12273dc7", // FTestXRP on Coston2 (verified via AssetManager)
      decimals: 6,
    },
    RLUSD: {
      displayName: "Test Ripple USD",
      symbol: "RLUSD",
      decimals: 6,
    },
    USDC: {
      displayName: "Test USD Coin",
      symbol: "USDC",
      decimals: 6,
    },
    FLR: {
      displayName: "Coston2 Flare",
      symbol: "C2FLR",
      decimals: 18,
    },
    WFLR: {
      displayName: "Wrapped Coston2 Flare",
      symbol: "WC2FLR",
      address: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273", // Testnet WFLR on Coston2
      decimals: 18,
    },
    USDT: {
      displayName: "Test Bridged USDT",
      symbol: "USDT",
      address: "0x3E8B8d9B9ee8C1E0D6d10Ea03e1F6eB8e3d1e8a0", // Testnet USDT
      decimals: 6,
    },
    SHIELD: {
      displayName: "Test Shield",
      symbol: "SHIELD",
      address: "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616", // SHIELD token on Coston2
      decimals: 18,
    },
    shXRP: {
      displayName: "Test Liquid Staked XRP",
      symbol: "shXRP",
      decimals: 18,
    },
    // RWA Assets (same as mainnet for testnet)
    "T-BILLS": {
      displayName: "US Treasury Bills",
      symbol: "T-BILLS",
      decimals: 6,
    },
    "T-BONDS": {
      displayName: "US Treasury Bonds",
      symbol: "T-BONDS",
      decimals: 6,
    },
    "PRIV-CREDIT": {
      displayName: "Private Credit",
      symbol: "PRIV-CREDIT",
      decimals: 6,
    },
    "RE-DEBT": {
      displayName: "Real Estate Debt",
      symbol: "RE-DEBT",
      decimals: 6,
    },
    "GOLD": {
      displayName: "Gold",
      symbol: "GOLD",
      decimals: 6,
    },
    "SILVER": {
      displayName: "Silver",
      symbol: "SILVER",
      decimals: 6,
    },
    "IG-BONDS": {
      displayName: "Investment Grade Bonds",
      symbol: "IG-BONDS",
      decimals: 6,
    },
    "HY-BONDS": {
      displayName: "High Yield Bonds",
      symbol: "HY-BONDS",
      decimals: 6,
    },
    "MM-FUND": {
      displayName: "Money Market Fund",
      symbol: "MM-FUND",
      decimals: 6,
    },
    // Tokenized Securities
    "SPX-TOKEN": {
      displayName: "S&P 500 Token",
      symbol: "SPX",
      decimals: 18,
    },
    "NDX-TOKEN": {
      displayName: "NASDAQ-100 Token",
      symbol: "NDX",
      decimals: 18,
    },
    "DIV-TOKEN": {
      displayName: "Dividend Portfolio Token",
      symbol: "DIV",
      decimals: 18,
    },
  },
};

/**
 * Get asset metadata for a specific network
 * Returns undefined if asset is not configured
 */
export function getAssetMetadata(assetKey: AssetKey | string, network: Network): AssetMetadata | undefined {
  return ASSET_CONFIG[network][assetKey as AssetKey];
}

/**
 * Get display name for an asset on a specific network
 * E.g., "FXRP" on mainnet, "FTestXRP" on testnet
 * Returns the asset key if not configured (defensive)
 */
export function getAssetDisplayName(assetKey: AssetKey | string, network: Network): string {
  const config = ASSET_CONFIG[network][assetKey as AssetKey];
  return config?.displayName ?? assetKey;
}

/**
 * Get symbol for an asset on a specific network
 * Returns the asset key if not configured (defensive)
 */
export function getAssetSymbol(assetKey: AssetKey | string, network: Network): string {
  const config = ASSET_CONFIG[network][assetKey as AssetKey];
  return config?.symbol ?? assetKey;
}

/**
 * Get contract address for an asset on a specific network
 * Returns undefined for non-ERC20 assets like XRP
 */
export function getAssetAddress(assetKey: AssetKey | string, network: Network): string | undefined {
  const config = ASSET_CONFIG[network][assetKey as AssetKey];
  return config?.address;
}

/**
 * Get decimals for an asset on a specific network
 * Returns 18 as default if not configured
 */
export function getAssetDecimals(assetKey: AssetKey | string, network: Network): number {
  const config = ASSET_CONFIG[network][assetKey as AssetKey];
  return config?.decimals ?? 18;
}

/**
 * Check if an asset is available on a specific network
 */
export function isAssetAvailable(assetKey: AssetKey | string, network: Network): boolean {
  const config = ASSET_CONFIG[network][assetKey as AssetKey];
  if (!config) return false;
  const address = config.address;
  // Asset is available if it doesn't require an address, or has a valid address
  return !address || address !== "0x0000000000000000000000000000000000000000";
}
