/**
 * PriceService - Centralized Token Price Feeds
 * 
 * Provides reliable token prices with multi-source fallback:
 * 1. Primary: Flare FTSO (on-chain oracle, ~1.8s updates)
 * 2. Fallback: CoinGecko API (rate-limited, 30s cache)
 * 
 * Features:
 * - In-memory cache with 30s TTL for performance
 * - Automatic failover between price sources
 * - Testnet-aware (uses mock prices for test tokens)
 * - Thread-safe singleton pattern
 */

import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "@shared/flare-contracts";

interface CachedPrice {
  price: number;
  timestamp: number;
  source: 'ftso' | 'coingecko' | 'fallback';
}

interface PriceCache {
  [symbol: string]: CachedPrice;
}

// FTSO V2 Contract Registry (same on mainnet and Coston2)
const CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

// FTSO Feed IDs (21 bytes) - from https://dev.flare.network/ftso/feeds
const FTSO_FEED_IDS: { [symbol: string]: string } = {
  FLR: "0x01464c522f55534400000000000000000000000000",
  XRP: "0x015852502f55534400000000000000000000000000",
  BTC: "0x014254432f55534400000000000000000000000000",
  ETH: "0x014554482f55534400000000000000000000000000",
};

// CoinGecko IDs for fallback
const COINGECKO_IDS: { [symbol: string]: string } = {
  FLR: "flare-networks",
  XRP: "ripple",
  FXRP: "ripple", // FXRP is wrapped XRP
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
};

// Fallback prices for testnet or when all sources fail
const FALLBACK_PRICES: { [symbol: string]: number } = {
  FLR: 0.015,
  XRP: 2.40,
  FXRP: 2.40,
  BTC: 97500,
  ETH: 3750,
  USDT: 1.0,
  USDC: 1.0,
  SHIELD: 0.25, // Protocol token placeholder
  shXRP: 2.40, // 1:1 with XRP initially
};

export class PriceService {
  private cache: PriceCache = {};
  private cacheTTL: number;
  private isTestnet: boolean;
  private provider: ethers.JsonRpcProvider | null = null;
  private ftsoContractAddress: string | null = null;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private lastCoinGeckoFetch: number = 0;
  private coinGeckoRateLimit: number = 10000; // 10s between CoinGecko calls

  constructor(options?: { cacheTTL?: number }) {
    this.cacheTTL = options?.cacheTTL || 30000; // 30 second default
    this.isTestnet = (process.env.FLARE_NETWORK || 'coston2') !== 'mainnet';
  }

  /**
   * Initialize the price service (async)
   * Sets up RPC provider and discovers FTSO contract address
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log("📊 Initializing PriceService...");
      console.log(`   Network: ${this.isTestnet ? 'Coston2 Testnet' : 'Flare Mainnet'}`);

      const networkConfig = this.isTestnet 
        ? FLARE_CONTRACTS.coston2 
        : FLARE_CONTRACTS.mainnet;

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

      // Try to get FTSO contract address from registry
      try {
        const registry = new ethers.Contract(
          CONTRACT_REGISTRY_ADDRESS,
          ["function getContractAddressByName(string) external view returns (address)"],
          this.provider
        );

        const contractName = this.isTestnet ? "TestFtsoV2" : "FtsoV2";
        this.ftsoContractAddress = await registry.getContractAddressByName(contractName);
        console.log(`   FTSO Address: ${this.ftsoContractAddress}`);
      } catch (err) {
        console.warn("   ⚠️ Could not get FTSO contract address, will use fallback prices");
        this.ftsoContractAddress = null;
      }

      this.initialized = true;
      console.log("✅ PriceService initialized");
    } catch (error) {
      console.error("❌ PriceService initialization failed:", error);
      this.initialized = true; // Mark as initialized anyway to prevent retries
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get price for a token symbol
   * @param symbol Token symbol (e.g., "XRP", "FLR", "FXRP")
   * @returns Price in USD
   */
  async getPrice(symbol: string): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const upperSymbol = symbol.toUpperCase();
    
    // Check cache first
    const cached = this.cache[upperSymbol];
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.price;
    }

    // Try FTSO first
    const ftsoPrice = await this.tryFtsoPrice(upperSymbol);
    if (ftsoPrice > 0) {
      this.cache[upperSymbol] = {
        price: ftsoPrice,
        timestamp: Date.now(),
        source: 'ftso'
      };
      return ftsoPrice;
    }

    // Try CoinGecko fallback
    const cgPrice = await this.tryCoinGeckoPrice(upperSymbol);
    if (cgPrice > 0) {
      this.cache[upperSymbol] = {
        price: cgPrice,
        timestamp: Date.now(),
        source: 'coingecko'
      };
      return cgPrice;
    }

    // Use fallback price
    const fallback = FALLBACK_PRICES[upperSymbol] || 0;
    this.cache[upperSymbol] = {
      price: fallback,
      timestamp: Date.now(),
      source: 'fallback'
    };
    return fallback;
  }

  /**
   * Get multiple prices at once
   * @param symbols Array of token symbols
   * @returns Map of symbol to price
   */
  async getPrices(symbols: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    
    // Fetch all prices in parallel
    const pricePromises = symbols.map(async (symbol) => {
      const price = await this.getPrice(symbol);
      return { symbol: symbol.toUpperCase(), price };
    });

    const prices = await Promise.all(pricePromises);
    prices.forEach(({ symbol, price }) => results.set(symbol, price));

    return results;
  }

  /**
   * Get all cached prices with metadata
   */
  getAllCachedPrices(): { [symbol: string]: CachedPrice } {
    return { ...this.cache };
  }

  /**
   * Try to get price from FTSO oracle
   */
  private async tryFtsoPrice(symbol: string): Promise<number> {
    if (!this.provider || !this.ftsoContractAddress) {
      return 0;
    }

    const feedId = FTSO_FEED_IDS[symbol];
    if (!feedId) {
      return 0; // No FTSO feed for this token
    }

    try {
      const ftso = new ethers.Contract(
        this.ftsoContractAddress,
        ["function getFeedById(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp)"],
        this.provider
      );

      const [value, decimals] = await ftso.getFeedById(feedId);
      const price = Number(value) / Math.pow(10, Number(decimals));
      
      if (price > 0) {
        return price;
      }
    } catch (error) {
      // FTSO call failed, will use fallback
    }

    return 0;
  }

  /**
   * Try to get price from CoinGecko API
   */
  private async tryCoinGeckoPrice(symbol: string): Promise<number> {
    const coinId = COINGECKO_IDS[symbol];
    if (!coinId) {
      return 0;
    }

    // Rate limit CoinGecko calls
    const now = Date.now();
    if (now - this.lastCoinGeckoFetch < this.coinGeckoRateLimit) {
      return 0;
    }

    try {
      this.lastCoinGeckoFetch = now;
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000), // 5s timeout
        }
      );

      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      const price = data[coinId]?.usd;
      
      if (typeof price === 'number' && price > 0) {
        return price;
      }
    } catch (error) {
      // CoinGecko call failed
    }

    return 0;
  }

  /**
   * Force refresh a specific token's price
   */
  async refreshPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();
    delete this.cache[upperSymbol];
    return this.getPrice(upperSymbol);
  }

  /**
   * Clear all cached prices
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    cacheSize: number;
    ftsoHits: number;
    coingeckoHits: number;
    fallbackHits: number;
    entries: { symbol: string; source: string; age: number }[];
  } {
    const entries = Object.entries(this.cache).map(([symbol, data]) => ({
      symbol,
      source: data.source,
      age: Math.round((Date.now() - data.timestamp) / 1000),
    }));

    return {
      cacheSize: entries.length,
      ftsoHits: entries.filter(e => e.source === 'ftso').length,
      coingeckoHits: entries.filter(e => e.source === 'coingecko').length,
      fallbackHits: entries.filter(e => e.source === 'fallback').length,
      entries,
    };
  }
}

// Singleton instance
let priceServiceInstance: PriceService | null = null;

export function getPriceService(): PriceService {
  if (!priceServiceInstance) {
    priceServiceInstance = new PriceService();
  }
  return priceServiceInstance;
}
