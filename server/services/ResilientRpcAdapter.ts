/**
 * ResilientRpcAdapter - Multi-Endpoint RPC with Automatic Failover
 * 
 * Provides fault-tolerant JSON-RPC connections with:
 * - Multiple endpoint rotation
 * - Exponential backoff on failures
 * - Health-based endpoint selection
 * - Connection pooling
 * - Request deduplication
 * - Cached fallback during outages
 */

import { ethers } from "ethers";

export interface RpcEndpoint {
  url: string;
  priority: number;
  weight?: number;
  maxRetries?: number;
}

export interface ResilientRpcConfig {
  endpoints: RpcEndpoint[];
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
  healthCheckInterval?: number;
}

interface EndpointHealth {
  url: string;
  healthy: boolean;
  latency: number;
  lastCheck: Date;
  consecutiveFailures: number;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
}

interface CachedResponse {
  data: any;
  timestamp: Date;
  ttl: number;
}

export class ResilientRpcAdapter {
  private endpoints: RpcEndpoint[];
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private health: Map<string, EndpointHealth> = new Map();
  private currentEndpointIndex = 0;
  private cache: Map<string, CachedResponse> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  private config: Required<Omit<ResilientRpcConfig, "endpoints">> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    timeout: 10000,
    healthCheckInterval: 30000,
  };

  constructor(config: ResilientRpcConfig) {
    this.endpoints = config.endpoints.sort((a, b) => a.priority - b.priority);
    
    if (config.maxRetries !== undefined) this.config.maxRetries = config.maxRetries;
    if (config.baseDelay !== undefined) this.config.baseDelay = config.baseDelay;
    if (config.maxDelay !== undefined) this.config.maxDelay = config.maxDelay;
    if (config.timeout !== undefined) this.config.timeout = config.timeout;
    if (config.healthCheckInterval !== undefined) this.config.healthCheckInterval = config.healthCheckInterval;

    for (const endpoint of this.endpoints) {
      this.providers.set(endpoint.url, new ethers.JsonRpcProvider(endpoint.url));
      this.health.set(endpoint.url, {
        url: endpoint.url,
        healthy: true,
        latency: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        successRate: 1,
        totalRequests: 0,
        failedRequests: 0,
      });
    }

    console.log(`🌐 ResilientRpcAdapter: Initialized with ${this.endpoints.length} endpoints`);
  }

  /**
   * Start background health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.checkAllEndpoints();
    }, this.config.healthCheckInterval);

    this.checkAllEndpoints();
  }

  /**
   * Stop background health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Check health of all endpoints
   */
  private async checkAllEndpoints(): Promise<void> {
    const checks = this.endpoints.map(async (endpoint) => {
      const start = Date.now();
      const health = this.health.get(endpoint.url)!;

      try {
        const provider = this.providers.get(endpoint.url)!;
        await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 5000)
          ),
        ]);

        health.healthy = true;
        health.latency = Date.now() - start;
        health.consecutiveFailures = 0;
        health.lastCheck = new Date();
      } catch (error) {
        health.consecutiveFailures++;
        health.healthy = health.consecutiveFailures < 3;
        health.lastCheck = new Date();
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Get the best available endpoint
   */
  private getBestEndpoint(): RpcEndpoint {
    const healthyEndpoints = this.endpoints.filter(e => {
      const health = this.health.get(e.url);
      return health?.healthy;
    });

    if (healthyEndpoints.length === 0) {
      console.warn("⚠️ ResilientRpcAdapter: No healthy endpoints, using first available");
      return this.endpoints[0];
    }

    healthyEndpoints.sort((a, b) => {
      const healthA = this.health.get(a.url)!;
      const healthB = this.health.get(b.url)!;
      
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      return healthA.latency - healthB.latency;
    });

    return healthyEndpoints[0];
  }

  /**
   * Rotate to next endpoint
   */
  private rotateEndpoint(): RpcEndpoint {
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    
    for (let i = 0; i < this.endpoints.length; i++) {
      const idx = (this.currentEndpointIndex + i) % this.endpoints.length;
      const endpoint = this.endpoints[idx];
      const health = this.health.get(endpoint.url);
      
      if (health?.healthy) {
        this.currentEndpointIndex = idx;
        return endpoint;
      }
    }

    return this.endpoints[this.currentEndpointIndex];
  }

  /**
   * Calculate backoff delay with jitter
   */
  private getBackoffDelay(attempt: number): number {
    const baseDelay = this.config.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * baseDelay;
    return Math.min(baseDelay + jitter, this.config.maxDelay);
  }

  /**
   * Execute an RPC call with automatic failover
   */
  async call<T>(
    method: string,
    params: any[] = [],
    options?: {
      cache?: boolean;
      cacheTtl?: number;
      dedupe?: boolean;
    }
  ): Promise<T> {
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    
    if (options?.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
        return cached.data as T;
      }
    }

    if (options?.dedupe) {
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) {
        return pending as Promise<T>;
      }
    }

    const promise = this.executeWithRetry<T>(method, params, cacheKey, options?.cacheTtl);
    
    if (options?.dedupe) {
      this.pendingRequests.set(cacheKey, promise);
      promise.finally(() => this.pendingRequests.delete(cacheKey));
    }

    return promise;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    method: string,
    params: any[],
    cacheKey: string,
    cacheTtl?: number
  ): Promise<T> {
    let lastError: Error | null = null;
    const triedEndpoints = new Set<string>();

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const endpoint = attempt === 0 ? this.getBestEndpoint() : this.rotateEndpoint();
      
      if (triedEndpoints.has(endpoint.url) && triedEndpoints.size < this.endpoints.length) {
        continue;
      }
      triedEndpoints.add(endpoint.url);

      const health = this.health.get(endpoint.url)!;
      health.totalRequests++;

      try {
        const provider = this.providers.get(endpoint.url)!;
        const result = await Promise.race([
          provider.send(method, params),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), this.config.timeout)
          ),
        ]);

        if (cacheTtl) {
          this.cache.set(cacheKey, {
            data: result,
            timestamp: new Date(),
            ttl: cacheTtl,
          });
        }

        return result as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        health.failedRequests++;
        health.consecutiveFailures++;
        health.successRate = 1 - (health.failedRequests / health.totalRequests);

        if (health.consecutiveFailures >= 3) {
          health.healthy = false;
          console.warn(`⚠️ ResilientRpcAdapter: Endpoint ${endpoint.url} marked unhealthy`);
        }

        if (attempt < this.config.maxRetries - 1) {
          const delay = this.getBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.warn(`⚠️ ResilientRpcAdapter: Using stale cache for ${method}`);
      return cached.data as T;
    }

    throw lastError || new Error("All RPC endpoints failed");
  }

  /**
   * Get a provider for direct ethers.js operations
   */
  getProvider(): ethers.JsonRpcProvider {
    const endpoint = this.getBestEndpoint();
    return this.providers.get(endpoint.url)!;
  }

  /**
   * Get block number with caching
   */
  async getBlockNumber(): Promise<number> {
    return this.call<number>("eth_blockNumber", [], { cache: true, cacheTtl: 2000, dedupe: true })
      .then(hex => parseInt(hex as any, 16));
  }

  /**
   * Get balance with short cache
   */
  async getBalance(address: string): Promise<bigint> {
    const result = await this.call<string>("eth_getBalance", [address, "latest"], {
      cache: true,
      cacheTtl: 5000,
    });
    return BigInt(result);
  }

  /**
   * Call a contract method
   */
  async callContract(to: string, data: string): Promise<string> {
    return this.call<string>("eth_call", [{ to, data }, "latest"]);
  }

  /**
   * Get endpoint health status
   */
  getHealthStatus(): {
    healthy: boolean;
    endpoints: Array<{
      url: string;
      healthy: boolean;
      latency: number;
      successRate: number;
      consecutiveFailures: number;
    }>;
  } {
    const endpoints = this.endpoints.map(e => {
      const health = this.health.get(e.url)!;
      return {
        url: e.url,
        healthy: health.healthy,
        latency: health.latency,
        successRate: health.successRate,
        consecutiveFailures: health.consecutiveFailures,
      };
    });

    const anyHealthy = endpoints.some(e => e.healthy);

    return {
      healthy: anyHealthy,
      endpoints,
    };
  }

  /**
   * Manually mark an endpoint as healthy/unhealthy
   */
  setEndpointHealth(url: string, healthy: boolean): void {
    const health = this.health.get(url);
    if (health) {
      health.healthy = healthy;
      health.consecutiveFailures = healthy ? 0 : health.consecutiveFailures;
      console.log(`🌐 ResilientRpcAdapter: Endpoint ${url} marked ${healthy ? "healthy" : "unhealthy"}`);
    }
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log("🌐 ResilientRpcAdapter: Cache cleared");
  }
}

/**
 * Create a Flare network RPC adapter with default endpoints
 */
export function createFlareRpcAdapter(network: "mainnet" | "coston2"): ResilientRpcAdapter {
  const endpoints: RpcEndpoint[] = network === "mainnet"
    ? [
        { url: "https://flare-api.flare.network/ext/C/rpc", priority: 1 },
        { url: "https://flare.rpc.thirdweb.com", priority: 2 },
        { url: "https://rpc.ankr.com/flare", priority: 3 },
      ]
    : [
        { url: "https://coston2-api.flare.network/ext/C/rpc", priority: 1 },
        { url: "https://coston2.enosys.global/ext/C/rpc", priority: 2 },
      ];

  return new ResilientRpcAdapter({ endpoints });
}
