import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";

// Environment variables are already loaded by the application
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Flare Coston2 Testnet
    coston2: {
      type: "http" as const,
      url: process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 25000000000, // 25 gwei
    },
    // Flare Mainnet
    flare: {
      type: "http" as const,
      url: process.env.FLARE_MAINNET_RPC_URL || "https://flare-api.flare.network/ext/C/rpc",
      chainId: 14,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      gasPrice: 25000000000,
    },
    // Local Hardhat network for testing
    hardhat: {
      type: "edr-simulated" as const,
      chainId: 31337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      // Flare block explorer API key (optional for verification)
      coston2: process.env.FLARE_API_KEY || "",
      flare: process.env.FLARE_API_KEY || "",
    },
    customChains: [
      {
        network: "coston2",
        chainId: 114,
        urls: {
          apiURL: "https://coston2-explorer.flare.network/api",
          browserURL: "https://coston2-explorer.flare.network",
        },
      },
      {
        network: "flare",
        chainId: 14,
        urls: {
          apiURL: "https://flare-explorer.flare.network/api",
          browserURL: "https://flare-explorer.flare.network",
        },
      },
    ],
  },
};

export default config;
