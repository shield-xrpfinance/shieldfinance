import { FlareClient, VaultMetrics } from "../utils/flare-client";
import type { IStorage } from "../storage";
import type { Vault } from "@shared/schema";
import fs from "fs";
import path from "path";

export interface VaultDataServiceConfig {
  storage: IStorage;
  flareClient: FlareClient;
}

export interface EnrichedVault extends Vault {
  contractAddress?: string;
  onChainTvl?: string;
  onChainTotalSupply?: string;
  pricePerShare?: string;
  utilization?: number;
  depositLimit?: string;
  paused?: boolean;
  isLive?: boolean;
  onChainLiquidity?: string;
  onChainDepositors?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class VaultDataService {
  private config: VaultDataServiceConfig;
  private metricsCache: CacheEntry<VaultMetrics> | null = null;
  private enrichedVaultsCache: CacheEntry<EnrichedVault[]> | null = null;
  private readonly METRICS_CACHE_TTL_MS = 15 * 1000; // 15 seconds for TVL
  private readonly VAULTS_CACHE_TTL_MS = 30 * 1000; // 30 seconds for full vault list
  private ready: boolean = false;

  constructor(config: VaultDataServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log("📊 Initializing VaultDataService...");
      const vaultAddress = this.getVaultAddress();
      console.log(`   Vault address: ${vaultAddress}`);
      this.ready = true;
      console.log("✅ VaultDataService initialized");
    } catch (error) {
      console.warn("⚠️  VaultDataService initialization warning:", error);
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private getVaultAddress(): string {
    let vaultAddress: string | undefined;
    
    try {
      const deploymentsDir = path.join(process.cwd(), "deployments");
      const files = fs.readdirSync(deploymentsDir)
        .filter(f => 
          f.startsWith("coston2-") && 
          f.endsWith(".json") && 
          f !== "coston2-latest.json" &&
          f !== "coston2-deployment.json" &&
          /coston2-\d+\.json/.test(f)
        )
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestDeployment = JSON.parse(
          fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
        );
        vaultAddress = latestDeployment.contracts?.ShXRPVault?.address;
      }
    } catch (error) {
      vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
    }
    
    if (!vaultAddress || vaultAddress === "0x...") {
      vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
    }
    
    if (!vaultAddress || vaultAddress === "0x...") {
      throw new Error("ShXRP Vault not deployed");
    }
    
    return vaultAddress;
  }

  async getOnChainMetrics(forceRefresh: boolean = false): Promise<VaultMetrics | null> {
    if (!forceRefresh && this.metricsCache && 
        Date.now() - this.metricsCache.timestamp < this.METRICS_CACHE_TTL_MS) {
      return this.metricsCache.data;
    }

    try {
      const vaultAddress = this.getVaultAddress();
      const metrics = await this.config.flareClient.getVaultMetrics(vaultAddress);
      
      if (metrics) {
        this.metricsCache = {
          data: metrics,
          timestamp: Date.now()
        };
      }
      
      return metrics;
    } catch (error) {
      console.error("Failed to fetch on-chain metrics:", error);
      return this.metricsCache?.data || null;
    }
  }

  async getEnrichedVaults(forceRefresh: boolean = false): Promise<EnrichedVault[]> {
    if (!forceRefresh && this.enrichedVaultsCache && 
        Date.now() - this.enrichedVaultsCache.timestamp < this.VAULTS_CACHE_TTL_MS) {
      return this.enrichedVaultsCache.data;
    }

    try {
      const dbVaults = await this.config.storage.getVaults();
      let vaultAddress: string;
      let onChainMetrics: VaultMetrics | null = null;
      let depositLimit: string | null = null;
      let paused: boolean | null = null;
      let bufferLiquidity: string | null = null;
      let depositorCount: number = 0;

      try {
        vaultAddress = this.getVaultAddress();
        onChainMetrics = await this.getOnChainMetrics(forceRefresh);
        
        const vaultContract = this.config.flareClient.getVaultReadContract(vaultAddress) as any;
        const { ethers } = await import("ethers");
        
        // Fetch vault state in parallel
        const [depositLimitRaw, pausedVal, fxrpBalance] = await Promise.all([
          vaultContract.depositLimit().catch(() => null),
          vaultContract.paused().catch(() => null),
          this.getVaultBufferBalance(vaultAddress).catch(() => null)
        ]);
        
        if (depositLimitRaw !== null) {
          depositLimit = ethers.formatUnits(depositLimitRaw, 6);
        }
        paused = pausedVal;
        bufferLiquidity = fxrpBalance;
        
        // Get unique depositors count from database
        depositorCount = await this.config.storage.getUniqueDepositorsCount();
      } catch (error) {
        console.warn("Could not fetch on-chain vault data:", error);
        vaultAddress = "";
      }

      const enrichedVaults: EnrichedVault[] = dbVaults.map((vault, index) => {
        const isShXRPVault = vault.asset === "FXRP" || vault.name.toLowerCase().includes("fxrp") || index === 0;
        
        const enriched: EnrichedVault = {
          ...vault,
          contractAddress: vaultAddress || undefined,
          isLive: isShXRPVault && !!vaultAddress
        };

        if (isShXRPVault && onChainMetrics) {
          enriched.onChainTvl = onChainMetrics.totalAssets;
          enriched.onChainTotalSupply = onChainMetrics.totalSupply;
          enriched.pricePerShare = onChainMetrics.pricePerShare;
          enriched.utilization = onChainMetrics.utilization;
          enriched.tvl = onChainMetrics.totalAssets;
        }

        if (isShXRPVault && depositLimit !== null) {
          enriched.depositLimit = depositLimit;
        }
        
        if (isShXRPVault && paused !== null) {
          enriched.paused = paused;
        }
        
        if (isShXRPVault && bufferLiquidity !== null) {
          enriched.onChainLiquidity = bufferLiquidity;
          (enriched as any).liquidity = bufferLiquidity;
        }
        
        if (isShXRPVault) {
          enriched.onChainDepositors = depositorCount;
        }

        return enriched;
      });

      this.enrichedVaultsCache = {
        data: enrichedVaults,
        timestamp: Date.now()
      };

      return enrichedVaults;
    } catch (error) {
      console.error("Failed to get enriched vaults:", error);
      if (this.enrichedVaultsCache) {
        return this.enrichedVaultsCache.data;
      }
      const dbVaults = await this.config.storage.getVaults();
      return dbVaults.map(v => ({ ...v, isLive: false }));
    }
  }

  async getLiveTVL(): Promise<string> {
    const metrics = await this.getOnChainMetrics();
    if (metrics) {
      return metrics.totalAssets;
    }
    const vaults = await this.config.storage.getVaults();
    const fxrpVault = vaults.find(v => v.asset === "FXRP" || v.name.toLowerCase().includes("fxrp"));
    return fxrpVault?.tvl || "0";
  }

  async getLiveAPY(): Promise<string> {
    const vaults = await this.getEnrichedVaults();
    const fxrpVault = vaults.find(v => v.asset === "FXRP" || v.name.toLowerCase().includes("fxrp") || v.isLive);
    return fxrpVault?.apy || "0";
  }

  /**
   * Get the vault's buffer balance (idle FXRP available for withdrawals)
   * This queries the FXRP token balance of the vault contract
   */
  async getVaultBufferBalance(vaultAddress: string): Promise<string | null> {
    try {
      const { ethers } = await import("ethers");
      const provider = this.config.flareClient.getProvider();
      
      // Get FXRP token address
      const fxrpAddress = await this.config.flareClient.getFAssetTokenAddress();
      if (!fxrpAddress) {
        console.warn("Could not get FXRP token address for buffer balance");
        return null;
      }
      
      // Simple ERC20 balanceOf ABI
      const erc20Abi = ["function balanceOf(address owner) view returns (uint256)"];
      const fxrpContract = new ethers.Contract(fxrpAddress, erc20Abi, provider);
      
      const balance = await fxrpContract.balanceOf(vaultAddress);
      return ethers.formatUnits(balance, 6); // FXRP has 6 decimals
    } catch (error) {
      console.warn("Failed to get vault buffer balance:", error);
      return null;
    }
  }

  invalidateCache(): void {
    this.metricsCache = null;
    this.enrichedVaultsCache = null;
  }

  /**
   * Get the vault address (public accessor)
   */
  getVaultAddressPublic(): string {
    return this.getVaultAddress();
  }

  /**
   * Get the provider from FlareClient
   */
  getFlareProvider() {
    return this.config.flareClient.getProvider();
  }
}

// Singleton instance
let vaultDataServiceInstance: VaultDataService | null = null;

export function setVaultDataService(service: VaultDataService): void {
  vaultDataServiceInstance = service;
}

export function getVaultDataService(): VaultDataService | null {
  return vaultDataServiceInstance;
}

// Helper functions for external use
export function getVaultAddress(): string {
  const service = getVaultDataService();
  if (!service) {
    // Fallback to environment variable
    const addr = process.env.VITE_SHXRP_VAULT_ADDRESS;
    return addr || "0x0000000000000000000000000000000000000000";
  }
  return service.getVaultAddressPublic();
}

export function getProvider() {
  const service = getVaultDataService();
  if (!service) return null;
  return service.getFlareProvider();
}
