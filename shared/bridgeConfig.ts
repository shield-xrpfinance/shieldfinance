/**
 * Multi-Chain Bridge Configuration
 * 
 * Static metadata for supported networks and tokens across LayerZero, Stargate, and FAssets protocols.
 * User-specific preferences (enabled networks, tokens) are stored in the database.
 * 
 * Supported Chains: Ethereum, Base, Optimism, Arbitrum, Polygon, Flare, HyperEVM, Plasma, XRPL
 */

export type ChainType = "evm" | "xrpl";

export type NetworkId = 
  | "ethereum" | "base" | "optimism" | "arbitrum" | "polygon" 
  | "flare" | "hyperevm" | "plasma" | "xrpl";

export type BridgeTokenId = 
  | "USDC" | "USDT" | "ETH" | "WETH" | "XRP" | "FXRP" | "FLR" | "WFLR" 
  | "sFLR" | "flrETH" | "SPRK" | "SHIELD" | "shXRP";

export type BridgeProtocol = "layerzero" | "stargate" | "fassets" | "native" | "swap";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  shortName: string;
  chainType: ChainType;
  chainId: number | null; // null for non-EVM chains like XRPL
  lzEndpointId?: number; // LayerZero v2 endpoint ID
  stargatePoolId?: number; // Stargate pool ID
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    mainnet: string[];
    testnet: string[];
  };
  explorerUrls: {
    mainnet: string;
    testnet: string;
  };
  bridgeContracts?: {
    mainnet?: {
      router?: string; // QyroLabRouter or equivalent
      stargate?: string;
      layerzero?: string;
    };
    testnet?: {
      router?: string;
      stargate?: string;
      layerzero?: string;
    };
  };
  color: string; // Brand color for UI
  isTestnetOnly: boolean;
  isMainnetReady: boolean;
  supportedProtocols: BridgeProtocol[];
}

export interface TokenConfig {
  id: BridgeTokenId;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
  isStablecoin: boolean;
  color: string;
  addresses: Partial<Record<NetworkId, {
    mainnet?: string;
    testnet?: string;
  }>>;
}

export interface BridgeRouteConfig {
  from: NetworkId;
  to: NetworkId;
  tokens: BridgeTokenId[];
  protocols: BridgeProtocol[];
  estimatedTimeMinutes: number;
  feePercentage: number;
  isEnabled: boolean;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    chainType: "evm",
    chainId: 1,
    lzEndpointId: 30101,
    stargatePoolId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      mainnet: ["https://eth.llamarpc.com", "https://rpc.ankr.com/eth"],
      testnet: ["https://rpc.sepolia.org"],
    },
    explorerUrls: {
      mainnet: "https://etherscan.io",
      testnet: "https://sepolia.etherscan.io",
    },
    bridgeContracts: {
      mainnet: {
        router: "0xA2237B2e44F6ec0F42A52E62C6edCBFf93a53BEf",
        stargate: "0x6694340fc020c5E6B96567843da2df01b2CE1eb6",
        layerzero: "0x1a44076050125825900e736c501f859c50fE728c",
      },
    },
    color: "#627EEA",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "stargate"],
  },
  
  base: {
    id: "base",
    name: "Base",
    shortName: "BASE",
    chainType: "evm",
    chainId: 8453,
    lzEndpointId: 30184,
    stargatePoolId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      mainnet: ["https://mainnet.base.org", "https://rpc.ankr.com/base"],
      testnet: ["https://sepolia.base.org"],
    },
    explorerUrls: {
      mainnet: "https://basescan.org",
      testnet: "https://sepolia.basescan.org",
    },
    bridgeContracts: {
      mainnet: {
        router: "0x7B35eae20fD88e69Be8D141C6aebCdBB8b2E42FA",
        stargate: "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
        layerzero: "0x1a44076050125825900e736c501f859c50fE728c",
      },
    },
    color: "#0052FF",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "stargate"],
  },
  
  optimism: {
    id: "optimism",
    name: "Optimism",
    shortName: "OP",
    chainType: "evm",
    chainId: 10,
    lzEndpointId: 30111,
    stargatePoolId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      mainnet: ["https://mainnet.optimism.io", "https://rpc.ankr.com/optimism"],
      testnet: ["https://sepolia.optimism.io"],
    },
    explorerUrls: {
      mainnet: "https://optimistic.etherscan.io",
      testnet: "https://sepolia-optimism.etherscan.io",
    },
    color: "#FF0420",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "stargate"],
  },
  
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    shortName: "ARB",
    chainType: "evm",
    chainId: 42161,
    lzEndpointId: 30110,
    stargatePoolId: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      mainnet: ["https://arb1.arbitrum.io/rpc", "https://rpc.ankr.com/arbitrum"],
      testnet: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
    explorerUrls: {
      mainnet: "https://arbiscan.io",
      testnet: "https://sepolia.arbiscan.io",
    },
    bridgeContracts: {
      mainnet: {
        router: "0x7B35eae20fD88e69Be8D141C6aebCdBB8b2E42FA",
        stargate: "0xA45B5130f36CDcA45AF5fce7c77ed6e23B80E529",
        layerzero: "0x1a44076050125825900e736c501f859c50fE728c",
      },
    },
    color: "#28A0F0",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "stargate"],
  },
  
  polygon: {
    id: "polygon",
    name: "Polygon",
    shortName: "MATIC",
    chainType: "evm",
    chainId: 137,
    lzEndpointId: 30109,
    stargatePoolId: 1,
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: {
      mainnet: ["https://polygon-rpc.com", "https://rpc.ankr.com/polygon"],
      testnet: ["https://rpc-amoy.polygon.technology"],
    },
    explorerUrls: {
      mainnet: "https://polygonscan.com",
      testnet: "https://amoy.polygonscan.com",
    },
    color: "#8247E5",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "stargate"],
  },
  
  flare: {
    id: "flare",
    name: "Flare",
    shortName: "FLR",
    chainType: "evm",
    chainId: 14,
    lzEndpointId: 30295,
    nativeCurrency: { name: "Flare", symbol: "FLR", decimals: 18 },
    rpcUrls: {
      mainnet: [
        "https://flare-api.flare.network/ext/C/rpc",
        "https://rpc.ankr.com/flare",
      ],
      testnet: [
        "https://coston2-api.flare.network/ext/C/rpc",
        "https://coston2.enosys.global/ext/bc/C/rpc",
      ],
    },
    explorerUrls: {
      mainnet: "https://flarescan.com",
      testnet: "https://coston2-explorer.flare.network",
    },
    bridgeContracts: {
      mainnet: {
        router: "0x3c47fBfBbAc6e3d45cda89e133bC26C4fC5ca40D",
        layerzero: "0x1a44076050125825900e736c501f859c50fE728c",
      },
      testnet: {
        layerzero: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      },
    },
    color: "#E62058",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["layerzero", "fassets"],
  },
  
  hyperevm: {
    id: "hyperevm",
    name: "HyperEVM",
    shortName: "HYPER",
    chainType: "evm",
    chainId: 998, // Placeholder - confirm actual chain ID
    nativeCurrency: { name: "HyperEVM", symbol: "HYPE", decimals: 18 },
    rpcUrls: {
      mainnet: [],
      testnet: [],
    },
    explorerUrls: {
      mainnet: "",
      testnet: "",
    },
    color: "#00D4AA",
    isTestnetOnly: true,
    isMainnetReady: false,
    supportedProtocols: [],
  },
  
  plasma: {
    id: "plasma",
    name: "Plasma",
    shortName: "PLASMA",
    chainType: "evm",
    chainId: 999, // Placeholder - confirm actual chain ID
    nativeCurrency: { name: "Plasma", symbol: "PLASMA", decimals: 18 },
    rpcUrls: {
      mainnet: [],
      testnet: [],
    },
    explorerUrls: {
      mainnet: "",
      testnet: "",
    },
    color: "#9945FF",
    isTestnetOnly: true,
    isMainnetReady: false,
    supportedProtocols: [],
  },
  
  xrpl: {
    id: "xrpl",
    name: "XRP Ledger",
    shortName: "XRPL",
    chainType: "xrpl",
    chainId: null, // Not an EVM chain
    nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 6 },
    rpcUrls: {
      mainnet: [
        "wss://xrplcluster.com",
        "wss://s1.ripple.com",
        "wss://s2.ripple.com",
      ],
      testnet: [
        "wss://s.altnet.rippletest.net:51233",
        "wss://testnet.xrpl-labs.com",
      ],
    },
    explorerUrls: {
      mainnet: "https://livenet.xrpl.org",
      testnet: "https://testnet.xrpl.org",
    },
    color: "#23292F",
    isTestnetOnly: false,
    isMainnetReady: true,
    supportedProtocols: ["fassets"],
  },
};

export const BRIDGE_TOKENS: Record<BridgeTokenId, TokenConfig> = {
  USDC: {
    id: "USDC",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    isNative: false,
    isStablecoin: true,
    color: "#2775CA",
    addresses: {
      ethereum: { mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      base: { mainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      optimism: { mainnet: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
      arbitrum: { mainnet: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
      polygon: { mainnet: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
      flare: { mainnet: "0xFbDa5F676cB37624f28265A144A48B0d6e87d3b6" },
    },
  },
  
  USDT: {
    id: "USDT",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    isNative: false,
    isStablecoin: true,
    color: "#26A17B",
    addresses: {
      ethereum: { mainnet: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
      arbitrum: { mainnet: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
      polygon: { mainnet: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
      flare: { mainnet: "0x9C3046C0DaA60b6F061f123CccfC29B7920d0d4f" },
    },
  },
  
  ETH: {
    id: "ETH",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    isNative: true,
    isStablecoin: false,
    color: "#627EEA",
    addresses: {
      ethereum: { mainnet: undefined }, // Native
      base: { mainnet: undefined },
      optimism: { mainnet: undefined },
      arbitrum: { mainnet: undefined },
    },
  },
  
  WETH: {
    id: "WETH",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#627EEA",
    addresses: {
      ethereum: { mainnet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
      base: { mainnet: "0x4200000000000000000000000000000000000006" },
      optimism: { mainnet: "0x4200000000000000000000000000000000000006" },
      arbitrum: { mainnet: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
      flare: { mainnet: "0x1502FA4be69d526124D28A82E0c01bB4b2Ee0F9A" },
    },
  },
  
  XRP: {
    id: "XRP",
    symbol: "XRP",
    name: "XRP",
    decimals: 6,
    isNative: true,
    isStablecoin: false,
    color: "#23292F",
    addresses: {
      xrpl: { mainnet: undefined }, // Native
    },
  },
  
  FXRP: {
    id: "FXRP",
    symbol: "FXRP",
    name: "FAssets XRP",
    decimals: 6,
    isNative: false,
    isStablecoin: false,
    color: "#E62058",
    addresses: {
      flare: {
        mainnet: "0xAf7278D382323A865734f93B687b300005B8b60E",
        testnet: "0x0b6A3645c240605887a5532109323A3E12273dc7",
      },
    },
  },
  
  FLR: {
    id: "FLR",
    symbol: "FLR",
    name: "Flare",
    decimals: 18,
    isNative: true,
    isStablecoin: false,
    color: "#E62058",
    addresses: {
      flare: { mainnet: undefined }, // Native
    },
  },
  
  WFLR: {
    id: "WFLR",
    symbol: "WFLR",
    name: "Wrapped Flare",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#E62058",
    addresses: {
      flare: {
        mainnet: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
        testnet: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",
      },
    },
  },
  
  sFLR: {
    id: "sFLR",
    symbol: "sFLR",
    name: "Staked Flare",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#FF6B35",
    addresses: {
      flare: { mainnet: "0x12e605bc104e93B45e1aD99F9e555f659051c2BB" },
    },
  },
  
  flrETH: {
    id: "flrETH",
    symbol: "flrETH",
    name: "Flare ETH",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#627EEA",
    addresses: {
      flare: { mainnet: "0x26A1faB310bd080c44A2F5238a97Ca54Aa7E35E8" },
    },
  },
  
  SPRK: {
    id: "SPRK",
    symbol: "SPRK",
    name: "SparkDEX",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#FF4500",
    addresses: {
      flare: { mainnet: "0xBD5d1F6F7F0e5F5D5E5E5D5C5B5A5555555555555" },
    },
  },
  
  SHIELD: {
    id: "SHIELD",
    symbol: "SHIELD",
    name: "Shield Token",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#4CAF50",
    addresses: {
      flare: {
        mainnet: "0x0000000000000000000000000000000000000000",
        testnet: "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616",
      },
    },
  },
  
  shXRP: {
    id: "shXRP",
    symbol: "shXRP",
    name: "Liquid Staked XRP",
    decimals: 18,
    isNative: false,
    isStablecoin: false,
    color: "#2196F3",
    addresses: {
      flare: { testnet: "0x..." },
    },
  },
};

export const DEFAULT_BRIDGE_ROUTES: BridgeRouteConfig[] = [
  // XRPL <-> Flare (FAssets)
  {
    from: "xrpl",
    to: "flare",
    tokens: ["XRP"],
    protocols: ["fassets"],
    estimatedTimeMinutes: 5,
    feePercentage: 0.5,
    isEnabled: true,
  },
  {
    from: "flare",
    to: "xrpl",
    tokens: ["FXRP"],
    protocols: ["fassets"],
    estimatedTimeMinutes: 15,
    feePercentage: 0.5,
    isEnabled: true,
  },
  
  // Flare <-> Ethereum (LayerZero/Stargate)
  {
    from: "flare",
    to: "ethereum",
    tokens: ["USDC", "USDT"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 10,
    feePercentage: 0.3,
    isEnabled: true,
  },
  {
    from: "ethereum",
    to: "flare",
    tokens: ["USDC", "USDT"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 10,
    feePercentage: 0.3,
    isEnabled: true,
  },
  
  // Flare <-> Base
  {
    from: "flare",
    to: "base",
    tokens: ["USDC"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 5,
    feePercentage: 0.25,
    isEnabled: true,
  },
  {
    from: "base",
    to: "flare",
    tokens: ["USDC"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 5,
    feePercentage: 0.25,
    isEnabled: true,
  },
  
  // Flare <-> Arbitrum
  {
    from: "flare",
    to: "arbitrum",
    tokens: ["USDC", "USDT"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 5,
    feePercentage: 0.25,
    isEnabled: true,
  },
  {
    from: "arbitrum",
    to: "flare",
    tokens: ["USDC", "USDT"],
    protocols: ["stargate", "layerzero"],
    estimatedTimeMinutes: 5,
    feePercentage: 0.25,
    isEnabled: true,
  },
];

export function getNetwork(id: NetworkId): NetworkConfig {
  return NETWORKS[id];
}

export function getToken(id: BridgeTokenId): TokenConfig {
  return BRIDGE_TOKENS[id];
}

export function getEnabledNetworks(): NetworkConfig[] {
  return Object.values(NETWORKS).filter(n => n.isMainnetReady);
}

export function getTokensForNetwork(networkId: NetworkId): TokenConfig[] {
  return Object.values(BRIDGE_TOKENS).filter(
    token => token.addresses[networkId] !== undefined
  );
}

export function getRoutesFromNetwork(fromNetworkId: NetworkId): BridgeRouteConfig[] {
  return DEFAULT_BRIDGE_ROUTES.filter(
    route => route.from === fromNetworkId && route.isEnabled
  );
}

export function getRouteBetweenNetworks(
  from: NetworkId,
  to: NetworkId
): BridgeRouteConfig | undefined {
  return DEFAULT_BRIDGE_ROUTES.find(
    route => route.from === from && route.to === to && route.isEnabled
  );
}

export const DEFAULT_ENABLED_NETWORKS: NetworkId[] = ["flare", "xrpl"];
export const DEFAULT_ENABLED_TOKENS: Record<NetworkId, BridgeTokenId[]> = {
  flare: ["FXRP", "FLR", "WFLR", "USDC", "sFLR", "flrETH", "WETH", "SHIELD", "shXRP"],
  xrpl: ["XRP"],
  ethereum: ["USDC", "USDT", "ETH", "WETH"],
  base: ["USDC", "ETH"],
  optimism: ["USDC", "ETH"],
  arbitrum: ["USDC", "USDT", "ETH"],
  polygon: ["USDC", "USDT"],
  hyperevm: [],
  plasma: [],
};
