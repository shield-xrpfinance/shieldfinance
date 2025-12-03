/**
 * FirelightDataService
 * 
 * Service for querying OUR vault's allocation in Firelight stXRP vault.
 * 
 * IMPORTANT: This service tracks OUR PROTOCOL's deployment to Firelight,
 * NOT Firelight's global TVL (~$35M). We only show what our vault has allocated.
 * 
 * Data Flow:
 * 1. Our ShXRPVault → FirelightStrategy contract → Firelight stXRP vault
 * 2. FirelightStrategy holds stXRP shares
 * 3. stXRP shares can be converted to FXRP value using ERC-4626 convertToAssets
 */

import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "../../shared/flare-contracts";
import { FIRELIGHT_VAULT_ABI, ERC20_ABI } from "../../shared/flare-abis";
import { getCurrentNetwork, getFirelightVaultAddress, isFirelightEnabled } from "../config/network-config";

export interface FirelightAllocation {
  stXRPBalance: string;
  fxrpValue: string;
  exchangeRate: string;
  lastUpdated: number;
}

/**
 * DEPRECATED: Removed to prevent leaking Firelight global TVL
 * Use getOurAllocation() instead which only returns our strategy's position
 */
// export interface FirelightMetrics - REMOVED

export interface StrategyAllocation {
  name: string;
  slug: string;
  deployed: string;
  percentage: number;
  apy: number;
  enabled: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class FirelightDataService {
  private provider: ethers.JsonRpcProvider;
  private network: "mainnet" | "coston2";
  private firelightVaultAddress: string | null;
  private allocationCache: CacheEntry<FirelightAllocation> | null = null;
  private readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds
  private ready: boolean = false;

  constructor() {
    this.network = getCurrentNetwork();
    this.firelightVaultAddress = getFirelightVaultAddress();
    
    const rpcUrl = this.network === "mainnet" 
      ? FLARE_CONTRACTS.mainnet.rpcUrl 
      : FLARE_CONTRACTS.coston2.rpcUrl;
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  async initialize(): Promise<void> {
    console.log("🔥 Initializing FirelightDataService...");
    
    if (!isFirelightEnabled()) {
      console.log("   Firelight disabled (testnet mode - mainnet only feature)");
      this.ready = false;
      return;
    }
    
    if (!this.firelightVaultAddress) {
      console.log("   Firelight vault address not configured");
      this.ready = false;
      return;
    }
    
    try {
      const vault = new ethers.Contract(
        this.firelightVaultAddress,
        FIRELIGHT_VAULT_ABI,
        this.provider
      );
      
      const name = await vault.name().catch(() => "Firelight stXRP");
      
      console.log(`   Connected to: ${name}`);
      console.log(`   Vault address: ${this.firelightVaultAddress}`);
      console.log("✅ FirelightDataService initialized (mainnet mode)");
      this.ready = true;
    } catch (error) {
      console.warn("⚠️  FirelightDataService initialization failed:", error);
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready && isFirelightEnabled();
  }

  /**
   * Get OUR strategy's allocation in Firelight
   * 
   * @param strategyAddress - Address of our FirelightStrategy contract
   * @returns Our allocation data (NOT Firelight's global TVL)
   */
  async getOurAllocation(strategyAddress: string): Promise<FirelightAllocation | null> {
    if (!this.isReady() || !this.firelightVaultAddress) {
      return null;
    }

    const cacheKey = strategyAddress.toLowerCase();
    if (this.allocationCache && 
        Date.now() - this.allocationCache.timestamp < this.CACHE_TTL_MS) {
      return this.allocationCache.data;
    }

    try {
      const vault = new ethers.Contract(
        this.firelightVaultAddress,
        FIRELIGHT_VAULT_ABI,
        this.provider
      );

      // Get OUR stXRP balance (shares held by our strategy)
      const stXRPBalance = await vault.balanceOf(strategyAddress) as bigint;
      
      // Convert our stXRP shares to FXRP value
      let fxrpValue = BigInt(0);
      if (stXRPBalance > BigInt(0)) {
        fxrpValue = await vault.convertToAssets(stXRPBalance) as bigint;
      }
      
      // Calculate exchange rate (1 stXRP = ? FXRP)
      const oneShare = BigInt(10 ** 6);
      const exchangeRate = await vault.convertToAssets(oneShare) as bigint;

      // NOTE: We intentionally do NOT calculate or return our percentage of Firelight's global TVL
      // This is to avoid leaking Firelight's global TVL to the frontend

      const allocation: FirelightAllocation = {
        stXRPBalance: ethers.formatUnits(stXRPBalance, 6),
        fxrpValue: ethers.formatUnits(fxrpValue, 6),
        exchangeRate: ethers.formatUnits(exchangeRate, 6),
        lastUpdated: Date.now()
      };

      this.allocationCache = { data: allocation, timestamp: Date.now() };
      return allocation;
    } catch (error) {
      console.error("Failed to get Firelight allocation:", error);
      return null;
    }
  }

  /**
   * DEPRECATED: getFirelightMetrics has been removed
   * This method exposed Firelight's global TVL which violates our requirement
   * to only show our vault's allocation, not Firelight's global metrics.
   * 
   * Use getOurAllocation() instead which returns only our strategy's position.
   */
  // getFirelightMetrics - REMOVED TO PREVENT GLOBAL TVL LEAKAGE

  /**
   * Get all strategy allocations for our vault
   * Returns the breakdown of buffer, Kinetic, and Firelight allocations
   * 
   * @param vaultTotalAssets - Total assets in our ShXRP vault
   * @param firelightStrategyAddress - Address of our Firelight strategy
   * @param kineticStrategyAddress - Address of our Kinetic strategy (if deployed)
   */
  async getStrategyAllocations(
    vaultTotalAssets: string,
    firelightStrategyAddress?: string,
    kineticStrategyAddress?: string
  ): Promise<StrategyAllocation[]> {
    const allocations: StrategyAllocation[] = [];
    const totalAssets = parseFloat(vaultTotalAssets) || 0;

    // Buffer (idle FXRP in vault)
    // For now, calculate as remaining after strategies
    let deployedToStrategies = 0;

    // Firelight allocation - ONLY add if strategy is deployed and Firelight is available
    // Do NOT add a disabled row - that would be misleading on testnet
    if (firelightStrategyAddress && this.isReady()) {
      const firelightAllocation = await this.getOurAllocation(firelightStrategyAddress);
      const firelightValue = parseFloat(firelightAllocation?.fxrpValue || "0");
      deployedToStrategies += firelightValue;
      
      // Only include if we actually have allocation
      if (firelightValue > 0) {
        allocations.push({
          name: "Firelight stXRP",
          slug: "firelight",
          deployed: firelightAllocation?.fxrpValue || "0",
          percentage: totalAssets > 0 ? (firelightValue / totalAssets) * 100 : 0,
          apy: 8.5, // Estimated Firelight APY (Phase 2)
          enabled: true
        });
      }
    }
    // NOTE: When Firelight is disabled (testnet) or no strategy deployed,
    // we intentionally do NOT add a Firelight row. This prevents showing
    // misleading 0% allocations on testnet.

    // Kinetic allocation - ONLY add if deployed (currently not available)
    // NOTE: We do NOT add disabled placeholder rows to avoid misleading the user

    // Buffer calculation
    const bufferValue = Math.max(0, totalAssets - deployedToStrategies);
    allocations.unshift({
      name: "Liquidity Buffer",
      slug: "buffer",
      deployed: bufferValue.toFixed(6),
      percentage: totalAssets > 0 ? (bufferValue / totalAssets) * 100 : 100,
      apy: 0, // Buffer doesn't earn yield
      enabled: true
    });

    return allocations;
  }

  /**
   * Get the Firelight vault contract for direct queries
   */
  getFirelightVaultContract(): ethers.Contract | null {
    if (!this.firelightVaultAddress) {
      return null;
    }
    return new ethers.Contract(
      this.firelightVaultAddress,
      FIRELIGHT_VAULT_ABI,
      this.provider
    );
  }

  /**
   * Check if we can deposit to Firelight (capacity check)
   * 
   * NOTE: This method only checks if Firelight is available.
   * We intentionally do NOT fetch or expose global TVL/capacity data.
   * Deposit limits are enforced at the smart contract level.
   */
  async canDeposit(amount: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.isReady()) {
      return { allowed: false, reason: "Firelight not available on testnet" };
    }

    if (!this.firelightVaultAddress) {
      return { allowed: false, reason: "Firelight vault not configured" };
    }

    try {
      const vault = new ethers.Contract(
        this.firelightVaultAddress,
        FIRELIGHT_VAULT_ABI,
        this.provider
      );

      // Only check if vault is paused - don't expose global TVL/capacity
      const paused = await vault.paused().catch(() => false) as boolean;
      if (paused) {
        return { allowed: false, reason: "Firelight vault is paused" };
      }

      // Deposit limits are enforced at the smart contract level
      // We don't check here to avoid exposing global capacity info
      return { allowed: true };
    } catch (error) {
      console.error("Failed to check Firelight deposit eligibility:", error);
      return { allowed: false, reason: "Cannot verify Firelight vault status" };
    }
  }
}

// Singleton instance
let firelightDataService: FirelightDataService | null = null;

export function getFirelightDataService(): FirelightDataService {
  if (!firelightDataService) {
    firelightDataService = new FirelightDataService();
  }
  return firelightDataService;
}
