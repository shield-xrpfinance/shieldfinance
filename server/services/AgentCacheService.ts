import { ethers } from "ethers";
import type { FlareClient } from "../utils/flare-client";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";
import { readFileSync } from "fs";
import { join } from "path";

export interface CachedAgentInfo {
  vaultAddress: string;
  underlyingAddress: string;
  feeBIPS: bigint;
  freeCollateralLots: bigint;
  status: bigint;
  lastUpdated: number;
}

export interface AgentCacheConfig {
  network: "mainnet" | "coston2";
  flareClient: FlareClient;
  refreshIntervalMs?: number; // Default: 60 seconds
}

/**
 * AgentCacheService preloads and caches FAssets agent data to eliminate
 * the 8-10 second agent discovery bottleneck during collateral reservation.
 * 
 * Performance Impact:
 * - Without cache: ~16 seconds (8-10s agent discovery + 6-8s transaction)
 * - With cache: ~6-8 seconds (transaction only)
 * 
 * Cache Strategy:
 * - Preloads all available agents at startup
 * - Refreshes asynchronously every 60 seconds
 * - Falls back to live fetch if cache is stale or empty
 */
export class AgentCacheService {
  private config: AgentCacheConfig;
  private cachedAgents: CachedAgentInfo[] = [];
  private lastCacheUpdate: number = 0;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private assetManagerAddress: string | null = null;
  private assetManagerABI: any = null;

  constructor(config: AgentCacheConfig) {
    this.config = {
      ...config,
      refreshIntervalMs: config.refreshIntervalMs || 60000, // Default: 60s
    };
    
    console.log("📦 AgentCacheService initialized");
    console.log(`   Network: ${this.config.network}`);
    console.log(`   Refresh interval: ${this.config.refreshIntervalMs}ms`);
  }

  /**
   * Start the agent cache with initial load and periodic refresh
   */
  async start(): Promise<void> {
    console.log("🚀 Starting AgentCacheService...");
    
    // Initial load
    await this.refreshCache();
    
    // Schedule periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshCache().catch(error => {
        console.error("❌ Agent cache refresh error:", error);
      });
    }, this.config.refreshIntervalMs);
    
    console.log("✅ AgentCacheService started successfully");
  }

  /**
   * Stop the cache refresh scheduler
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log("⏹️  AgentCacheService stopped");
    }
  }

  /**
   * Get AssetManager ABI (cached for reuse)
   */
  private getAssetManagerABI(): any {
    if (this.assetManagerABI) {
      return this.assetManagerABI;
    }

    try {
      const networkFolder = this.config.network === "mainnet" ? "flare" : "coston2";
      const artifactPath = join(
        process.cwd(),
        "node_modules",
        "@flarenetwork",
        "flare-periphery-contract-artifacts",
        networkFolder,
        "artifacts",
        "contracts",
        "IAssetManager.sol",
        "IAssetManager.json"
      );
      
      const abiJson = readFileSync(artifactPath, "utf8");
      this.assetManagerABI = JSON.parse(abiJson);
      return this.assetManagerABI;
    } catch (error) {
      console.error(`Failed to load AssetManager ABI:`, error);
      throw new Error(`Failed to load AssetManager ABI for network ${this.config.network}`);
    }
  }

  /**
   * Get AssetManager address from Flare Contract Registry (cached)
   */
  private async getAssetManagerAddress(): Promise<string> {
    if (this.assetManagerAddress) {
      return this.assetManagerAddress;
    }

    try {
      const networkName = this.config.network === "mainnet" ? "flare" : "coston2";
      const address = await nameToAddress(
        "AssetManagerFXRP",
        networkName,
        this.config.flareClient.provider
      );
      
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(
          `Contract Registry returned zero address for "AssetManagerFXRP" on ${this.config.network}`
        );
      }
      
      this.assetManagerAddress = address;
      console.log(`✅ Cached AssetManager address: ${address}`);
      return address;
    } catch (error) {
      console.error("Failed to get AssetManager address:", error);
      throw error;
    }
  }

  /**
   * Get AssetManager contract instance
   */
  private async getAssetManager(): Promise<ethers.Contract> {
    const address = await this.getAssetManagerAddress();
    const abi = this.getAssetManagerABI();
    const signer = this.config.flareClient.getContractSigner();
    
    return new ethers.Contract(address, abi, signer);
  }

  /**
   * Refresh the agent cache by fetching latest data from AssetManager
   */
  private async refreshCache(): Promise<void> {
    if (this.isRefreshing) {
      console.log("⏭️  Cache refresh already in progress, skipping...");
      return;
    }

    this.isRefreshing = true;
    const startTime = Date.now();

    try {
      console.log("\n🔄 Refreshing agent cache...");
      const assetManager = await this.getAssetManager();
      
      // Fetch available agents list
      const agentListStart = Date.now();
      const { _agents: agents } = await assetManager.getAvailableAgentsDetailedList(0, 100);
      console.log(`   ⏱️  Agent list fetch: ${Date.now() - agentListStart}ms`);
      console.log(`   📋 Found ${agents.length} agents`);
      
      // Fetch detailed info for each agent IN PARALLEL (key optimization!)
      const agentInfoStart = Date.now();
      const agentInfoPromises = agents.map(async (agent: any) => {
        try {
          const info = await assetManager.getAgentInfo(agent.agentVault);
          return {
            vaultAddress: agent.agentVault,
            underlyingAddress: info.underlyingAddress,
            feeBIPS: info.feeBIPS,
            freeCollateralLots: agent.freeCollateralLots,
            status: info.status,
            lastUpdated: Date.now(),
          };
        } catch (error) {
          console.error(`   ⚠️  Failed to fetch info for agent ${agent.agentVault}:`, error);
          return null;
        }
      });
      
      const agentInfoResults = await Promise.all(agentInfoPromises);
      const validAgents = agentInfoResults.filter((a): a is CachedAgentInfo => a !== null);
      
      console.log(`   ⏱️  Agent info fetch (parallel): ${Date.now() - agentInfoStart}ms`);
      console.log(`   ✅ Cached ${validAgents.length} valid agents`);
      
      // Update cache
      this.cachedAgents = validAgents;
      this.lastCacheUpdate = Date.now();
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Agent cache refreshed in ${totalTime}ms`);
      
      // Log agent summary
      const activeAgents = validAgents.filter(a => Number(a.status) === 0);
      console.log(`   📊 Active agents: ${activeAgents.length}/${validAgents.length}`);
      if (activeAgents.length > 0) {
        const minFee = Math.min(...activeAgents.map(a => Number(a.feeBIPS)));
        const maxFee = Math.max(...activeAgents.map(a => Number(a.feeBIPS)));
        console.log(`   💰 Fee range: ${minFee}-${maxFee} BIPS`);
      }
    } catch (error) {
      console.error("❌ Failed to refresh agent cache:", error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get cached agents, optionally forcing a refresh if cache is stale
   */
  async getCachedAgents(forceRefresh: boolean = false): Promise<CachedAgentInfo[]> {
    const cacheAge = Date.now() - this.lastCacheUpdate;
    const isStale = cacheAge > (this.config.refreshIntervalMs || 60000);
    
    if (forceRefresh || isStale || this.cachedAgents.length === 0) {
      console.log(`🔄 Cache ${forceRefresh ? 'forced' : isStale ? 'stale' : 'empty'}, refreshing...`);
      await this.refreshCache();
    }
    
    return this.cachedAgents;
  }

  /**
   * Find best agent from cache for given lot requirement
   * Returns null if no suitable agent found
   */
  async findBestAgentFromCache(lotsRequired: number): Promise<CachedAgentInfo | null> {
    const agents = await this.getCachedAgents();
    
    // Filter agents with enough free lots
    const agentsWithLots = agents.filter(
      agent => Number(agent.freeCollateralLots) >= lotsRequired
    );
    
    if (agentsWithLots.length === 0) {
      console.log(`⚠️  No agents found with ${lotsRequired} lots available`);
      return null;
    }
    
    // Sort by fee (lowest first) and find first active agent
    agentsWithLots.sort((a, b) => Number(a.feeBIPS) - Number(b.feeBIPS));
    
    const activeAgent = agentsWithLots.find(agent => Number(agent.status) === 0);
    
    if (!activeAgent) {
      console.log(`⚠️  No active agents found with ${lotsRequired} lots available`);
      return null;
    }
    
    console.log(`✅ Found cached agent: ${activeAgent.vaultAddress}`);
    console.log(`   Fee: ${activeAgent.feeBIPS} BIPS`);
    console.log(`   Free lots: ${activeAgent.freeCollateralLots}`);
    console.log(`   Cache age: ${Date.now() - activeAgent.lastUpdated}ms`);
    
    return activeAgent;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      totalAgents: this.cachedAgents.length,
      activeAgents: this.cachedAgents.filter(a => Number(a.status) === 0).length,
      lastUpdate: this.lastCacheUpdate,
      cacheAge: Date.now() - this.lastCacheUpdate,
      isRefreshing: this.isRefreshing,
    };
  }
}
