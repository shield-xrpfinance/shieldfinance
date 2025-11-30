/**
 * WalletBalanceService - Token Balance Aggregation API
 * 
 * Fetches ERC-20 token balances from Flare/Coston2 networks
 * and integrates with PriceService for USD conversions.
 * 
 * Designed for consumption by vote.shyield.finance and other integrations.
 */

import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "@shared/flare-contracts";
import { getAssetAddress, getAssetDecimals, getAssetMetadata } from "@shared/assetConfig";
import type { PriceService } from "./PriceService";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

export interface TokenBalance {
  symbol: string;
  name: string;
  address: string | null;
  chain: "flare" | "xrpl";
  balance: string;
  balanceRaw: string;
  balanceUsd: string;
  decimals: number;
  source: "on-chain" | "cached";
}

export interface WalletBalanceResponse {
  walletAddress: string;
  network: "mainnet" | "testnet";
  tokens: TokenBalance[];
  totals: {
    nativeUsd: string;
    stakingUsd: string;
    totalUsd: string;
  };
  refreshedAt: string;
}

export interface WalletBalanceServiceConfig {
  priceService: PriceService;
}

const SHIELD_VAULT_ADDRESS_TESTNET = "0x8fe09217445e90DA692D29F30859dafA4eb281d1";
const SHIELD_TOKEN_ADDRESS_TESTNET = "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616";

export class WalletBalanceService {
  private priceService: PriceService;
  private isTestnet: boolean;
  private provider: ethers.JsonRpcProvider;
  private networkConfig: typeof FLARE_CONTRACTS.mainnet | typeof FLARE_CONTRACTS.coston2;

  constructor(config: WalletBalanceServiceConfig) {
    this.priceService = config.priceService;
    this.isTestnet = (process.env.FLARE_NETWORK || "coston2") !== "mainnet";
    
    this.networkConfig = this.isTestnet 
      ? FLARE_CONTRACTS.coston2 
      : FLARE_CONTRACTS.mainnet;
    
    this.provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);
    
    console.log(`✅ WalletBalanceService initialized (${this.isTestnet ? "testnet" : "mainnet"})`);
  }

  /**
   * Check if the provided address is a valid EVM address
   */
  private isValidEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Format balance with proper decimals
   */
  private formatBalance(balance: bigint, decimals: number): string {
    const divisor = BigInt("1" + "0".repeat(decimals));
    const integerPart = balance / divisor;
    const fractionalPart = balance % divisor;
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.slice(0, 6).replace(/0+$/, "") || "0";
    
    if (trimmedFractional === "0") {
      return integerPart.toString();
    }
    return `${integerPart}.${trimmedFractional}`;
  }

  /**
   * Fetch native FLR balance
   */
  private async getFLRBalance(address: string): Promise<TokenBalance> {
    try {
      const balance = await this.provider.getBalance(address);
      const balanceFormatted = this.formatBalance(balance, 18);
      
      const price = await this.priceService.getPrice("FLR");
      const balanceUsd = (parseFloat(balanceFormatted) * price).toFixed(2);
      
      return {
        symbol: this.isTestnet ? "C2FLR" : "FLR",
        name: this.isTestnet ? "Coston2 Flare" : "Flare",
        address: null,
        chain: "flare",
        balance: balanceFormatted,
        balanceRaw: balance.toString(),
        balanceUsd,
        decimals: 18,
        source: "on-chain",
      };
    } catch (error) {
      console.error("Error fetching FLR balance:", error);
      return {
        symbol: this.isTestnet ? "C2FLR" : "FLR",
        name: this.isTestnet ? "Coston2 Flare" : "Flare",
        address: null,
        chain: "flare",
        balance: "0",
        balanceRaw: "0",
        balanceUsd: "0.00",
        decimals: 18,
        source: "on-chain",
      };
    }
  }

  /**
   * Fetch ERC-20 token balance
   */
  private async getERC20Balance(
    walletAddress: string,
    tokenAddress: string,
    symbol: string,
    name: string,
    decimals: number
  ): Promise<TokenBalance | null> {
    try {
      if (tokenAddress === "0x0000000000000000000000000000000000000000") {
        return null;
      }

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      const balanceFormatted = this.formatBalance(balance, decimals);
      
      const priceSymbol = symbol.replace("Test", "").replace("C2", "");
      const price = await this.priceService.getPrice(priceSymbol);
      const balanceUsd = (parseFloat(balanceFormatted) * price).toFixed(2);
      
      return {
        symbol,
        name,
        address: tokenAddress,
        chain: "flare",
        balance: balanceFormatted,
        balanceRaw: balance.toString(),
        balanceUsd,
        decimals,
        source: "on-chain",
      };
    } catch (error) {
      console.error(`Error fetching ${symbol} balance:`, error);
      return null;
    }
  }

  /**
   * Get all balances for a wallet address
   */
  async getBalances(walletAddress: string): Promise<WalletBalanceResponse> {
    if (!this.isValidEvmAddress(walletAddress)) {
      throw new Error(`Invalid EVM address: ${walletAddress}`);
    }

    const network = this.isTestnet ? "testnet" : "mainnet";
    const tokens: TokenBalance[] = [];
    
    const flrBalance = await this.getFLRBalance(walletAddress);
    tokens.push(flrBalance);
    
    const tokensToFetch = [
      {
        key: "FXRP",
        address: getAssetAddress("FXRP", network),
        symbol: this.isTestnet ? "FTestXRP" : "FXRP",
        name: this.isTestnet ? "FTestXRP" : "FXRP",
        decimals: getAssetDecimals("FXRP", network),
      },
      {
        key: "SHIELD",
        address: this.isTestnet ? SHIELD_TOKEN_ADDRESS_TESTNET : getAssetAddress("SHIELD", network),
        symbol: "SHIELD",
        name: "Shield",
        decimals: 18,
      },
      {
        key: "shXRP",
        address: this.isTestnet ? SHIELD_VAULT_ADDRESS_TESTNET : getAssetAddress("shXRP", network),
        symbol: "shXRP",
        name: "Liquid Staked XRP",
        decimals: 18,
      },
      {
        key: "WFLR",
        address: getAssetAddress("WFLR", network),
        symbol: this.isTestnet ? "WC2FLR" : "WFLR",
        name: this.isTestnet ? "Wrapped Coston2 Flare" : "Wrapped Flare",
        decimals: 18,
      },
    ];

    const balancePromises = tokensToFetch.map(async (token) => {
      if (!token.address || token.address === "0x0000000000000000000000000000000000000000") {
        return null;
      }
      return this.getERC20Balance(
        walletAddress,
        token.address,
        token.symbol,
        token.name,
        token.decimals
      );
    });

    const balances = await Promise.all(balancePromises);
    
    for (const balance of balances) {
      if (balance) {
        tokens.push(balance);
      }
    }

    let nativeUsd = 0;
    let stakingUsd = 0;
    let totalUsd = 0;

    for (const token of tokens) {
      const usdValue = parseFloat(token.balanceUsd);
      totalUsd += usdValue;
      
      if (token.symbol === "FLR" || token.symbol === "C2FLR" || 
          token.symbol === "WFLR" || token.symbol === "WC2FLR") {
        nativeUsd += usdValue;
      } else if (token.symbol === "shXRP" || token.symbol === "SHIELD") {
        stakingUsd += usdValue;
      }
    }

    return {
      walletAddress,
      network,
      tokens,
      totals: {
        nativeUsd: nativeUsd.toFixed(2),
        stakingUsd: stakingUsd.toFixed(2),
        totalUsd: totalUsd.toFixed(2),
      },
      refreshedAt: new Date().toISOString(),
    };
  }

  /**
   * Get balances for multiple tokens by address (custom query)
   */
  async getTokenBalances(
    walletAddress: string,
    tokenAddresses: string[]
  ): Promise<TokenBalance[]> {
    if (!this.isValidEvmAddress(walletAddress)) {
      throw new Error(`Invalid EVM address: ${walletAddress}`);
    }

    const balancePromises = tokenAddresses.map(async (tokenAddress) => {
      try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
        
        const [balance, decimals, symbol, name] = await Promise.all([
          contract.balanceOf(walletAddress),
          contract.decimals().catch(() => 18),
          contract.symbol().catch(() => "UNKNOWN"),
          contract.name().catch(() => "Unknown Token"),
        ]);

        const balanceFormatted = this.formatBalance(balance, decimals);
        
        return {
          symbol,
          name,
          address: tokenAddress,
          chain: "flare" as const,
          balance: balanceFormatted,
          balanceRaw: balance.toString(),
          balanceUsd: "0.00",
          decimals,
          source: "on-chain" as const,
        };
      } catch (error) {
        console.error(`Error fetching token ${tokenAddress}:`, error);
        return null;
      }
    });

    const balances = await Promise.all(balancePromises);
    return balances.filter((b): b is TokenBalance => b !== null);
  }
}
