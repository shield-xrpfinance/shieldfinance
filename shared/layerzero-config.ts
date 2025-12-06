/**
 * LayerZero V2 Configuration for Multi-Chain SHIELD Token
 * 
 * This file contains all endpoint IDs, contract addresses, and configuration
 * for the LayerZero OFT (Omnichain Fungible Token) integration.
 * 
 * Architecture:
 * - Flare (home chain): ShieldOFTAdapter wraps existing SHIELD token with lock/unlock
 * - Base, Arbitrum, Ethereum: ShieldOFT contracts with mint/burn capability
 * 
 * All chains share the same canonical SHIELD supply via LayerZero messaging.
 */

export const LAYERZERO_ENDPOINTS = {
  // Mainnets
  flare: {
    chainId: 14,
    endpointId: 30295, // LayerZero Endpoint ID for Flare
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c", // LayerZero V2 Endpoint
    sendLibrary: "0xC17BaBeF02a937093363220b0FB57De04A535D5E",
    receiveLibrary: "0xe1Dd69A2D08dF4eA6a30a91cC061ac70F98aAbe3",
    dvn: "0x8ddf05F9A5c488b4973897E278B58895bF87Cb24", // LayerZero DVN
  },
  base: {
    chainId: 8453,
    endpointId: 30184,
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    sendLibrary: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
    receiveLibrary: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf",
    dvn: "0x9e059a54699a285714207b43B055483E78FAac25",
  },
  arbitrum: {
    chainId: 42161,
    endpointId: 30110,
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    sendLibrary: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
    receiveLibrary: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6",
    dvn: "0x2f55C492897526677C5B68fb199ea31E2c126416",
  },
  ethereum: {
    chainId: 1,
    endpointId: 30101,
    endpoint: "0x1a44076050125825900e736c501f859c50fE728c",
    sendLibrary: "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1",
    receiveLibrary: "0xc02Ab410f0734EFa3F14628780e6e695156024C2",
    dvn: "0x589dEDbD617e0CBcB916A9223F4d1300c294236b",
  },

  // Testnets
  coston2: {
    chainId: 114,
    endpointId: 40295, // LayerZero testnet endpoint for Coston2
    endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f", // V2 testnet endpoint
    sendLibrary: "0x0000000000000000000000000000000000000000", // TBD
    receiveLibrary: "0x0000000000000000000000000000000000000000",
    dvn: "0x0000000000000000000000000000000000000000",
  },
  baseSepolia: {
    chainId: 84532,
    endpointId: 40245,
    endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    sendLibrary: "0x0000000000000000000000000000000000000000",
    receiveLibrary: "0x0000000000000000000000000000000000000000",
    dvn: "0x0000000000000000000000000000000000000000",
  },
  arbitrumSepolia: {
    chainId: 421614,
    endpointId: 40231,
    endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    sendLibrary: "0x0000000000000000000000000000000000000000",
    receiveLibrary: "0x0000000000000000000000000000000000000000",
    dvn: "0x0000000000000000000000000000000000000000",
  },
  sepolia: {
    chainId: 11155111,
    endpointId: 40161,
    endpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    sendLibrary: "0x0000000000000000000000000000000000000000",
    receiveLibrary: "0x0000000000000000000000000000000000000000",
    dvn: "0x0000000000000000000000000000000000000000",
  },
} as const;

// Deployed contract addresses (to be updated after deployment)
export const SHIELD_CONTRACTS = {
  // Mainnet deployments
  mainnet: {
    flare: {
      shieldToken: "0x0000000000000000000000000000000000000000", // Existing SHIELD token
      oftAdapter: "0x0000000000000000000000000000000000000000", // OFT Adapter to deploy
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    base: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    arbitrum: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    ethereum: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
  },
  // Testnet deployments
  testnet: {
    coston2: {
      shieldToken: "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616", // Existing testnet SHIELD
      oftAdapter: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    baseSepolia: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    arbitrumSepolia: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
    sepolia: {
      shieldOFT: "0x0000000000000000000000000000000000000000",
      presale: "0x0000000000000000000000000000000000000000",
      zapPresale: "0x0000000000000000000000000000000000000000",
    },
  },
} as const;

// Presale configuration
export const PRESALE_CONFIG = {
  stages: [
    { price: "0.005", name: "Stage 1", allocation: 2500000 }, // $0.005, 25% of presale
    { price: "0.0075", name: "Stage 2", allocation: 2500000 }, // $0.0075, 25%
    { price: "0.01", name: "Stage 3", allocation: 2500000 }, // $0.01, 25%
    { price: "0.015", name: "Stage 4", allocation: 2500000 }, // $0.015, 25%
  ],
  listingPrice: "0.02", // $0.02 target listing price
  vestingTGE: 20, // 20% at TGE
  vestingDuration: 180 * 24 * 60 * 60, // 180 days linear vesting for remaining 80%
  hardCap: 50000, // $50,000 USD
  minPurchase: 50, // $50 USD minimum
  maxPurchase: 5000, // $5,000 USD maximum per wallet
  referralBonus: 5, // 5% bonus for valid referral codes
  whitelistEnabled: true,
} as const;

// DEX Router addresses for ZapPresale
export const DEX_ROUTERS = {
  mainnet: {
    flare: {
      sparkdex: "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781", // SparkDEX V3
      wflr: "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",
    },
    base: {
      uniswapV3: "0x2626664c2603336E57B271c5C0b26F421741e481", // Uniswap V3 SwapRouter02
      weth: "0x4200000000000000000000000000000000000006",
    },
    arbitrum: {
      uniswapV3: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 SwapRouter02
      weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
    ethereum: {
      uniswapV3: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 SwapRouter02
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
  },
  testnet: {
    coston2: {
      sparkdex: "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781",
      wflr: "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",
    },
    baseSepolia: {
      uniswapV3: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Testnet router
      weth: "0x4200000000000000000000000000000000000006",
    },
    arbitrumSepolia: {
      uniswapV3: "0x101F443B4d1b059569D643917553c771E1b9663E",
      weth: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
    },
    sepolia: {
      uniswapV3: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
      weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    },
  },
} as const;

// Rate limiting configuration for security
export const RATE_LIMITS = {
  maxTransferPerHour: "1000000", // 1M SHIELD per hour per address
  maxTransferPerDay: "5000000", // 5M SHIELD per day per address
  globalDailyLimit: "50000000", // 50M SHIELD global daily limit
  pauseThreshold: "10000000", // Pause if single transfer > 10M
} as const;

export type ChainName = keyof typeof LAYERZERO_ENDPOINTS;
export type MainnetChain = "flare" | "base" | "arbitrum" | "ethereum";
export type TestnetChain = "coston2" | "baseSepolia" | "arbitrumSepolia" | "sepolia";

// Simplified exports for deployment scripts
export const LZ_EID = {
  testnets: {
    coston2: LAYERZERO_ENDPOINTS.coston2.endpointId,
    baseSepolia: LAYERZERO_ENDPOINTS.baseSepolia.endpointId,
    arbitrumSepolia: LAYERZERO_ENDPOINTS.arbitrumSepolia.endpointId,
    sepolia: LAYERZERO_ENDPOINTS.sepolia.endpointId,
  },
  mainnets: {
    flare: LAYERZERO_ENDPOINTS.flare.endpointId,
    base: LAYERZERO_ENDPOINTS.base.endpointId,
    arbitrum: LAYERZERO_ENDPOINTS.arbitrum.endpointId,
    mainnet: LAYERZERO_ENDPOINTS.ethereum.endpointId,
  },
} as const;

// Payment tokens (USDC) per chain
export const PAYMENT_TOKENS = {
  testnets: {
    coston2: "0x4BA749C96F6B0c9adDf3a339eB7E79A5f92C7C39", // Mock USDC on Coston2
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    arbitrumSepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC on Arbitrum Sepolia
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
  },
  mainnets: {
    flare: "0xFbDa5F676cB37624f28265A144A48B0d6e87d3b6", // USDC on Flare
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
    mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
  },
} as const;

// Wrapped native tokens
export const WRAPPED_NATIVE = {
  testnets: {
    coston2: DEX_ROUTERS.testnet.coston2.wflr,
    baseSepolia: DEX_ROUTERS.testnet.baseSepolia.weth,
    arbitrumSepolia: DEX_ROUTERS.testnet.arbitrumSepolia.weth,
    sepolia: DEX_ROUTERS.testnet.sepolia.weth,
  },
  mainnets: {
    flare: DEX_ROUTERS.mainnet.flare.wflr,
    base: DEX_ROUTERS.mainnet.base.weth,
    arbitrum: DEX_ROUTERS.mainnet.arbitrum.weth,
    mainnet: DEX_ROUTERS.mainnet.ethereum.weth,
  },
} as const;
