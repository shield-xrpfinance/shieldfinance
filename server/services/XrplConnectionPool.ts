/**
 * XrplConnectionPool - Resilient XRPL WebSocket Connection Management
 * 
 * Features:
 * - Connection pooling with automatic reconnection
 * - Multiple endpoint failover
 * - Health monitoring and rotation
 * - Request queuing during reconnection
 * - Graceful degradation with cached data
 */

import { Client, type SubmitResponse, type AccountInfoResponse } from "xrpl";

export interface XrplEndpoint {
  url: string;
  priority: number;
  network: "mainnet" | "testnet";
}

export interface XrplConnectionPoolConfig {
  endpoints: XrplEndpoint[];
  poolSize?: number;
  maxRetries?: number;
  reconnectDelay?: number;
  healthCheckInterval?: number;
  requestTimeout?: number;
}

interface PooledConnection {
  client: Client;
  endpoint: XrplEndpoint;
  connected: boolean;
  lastUsed: Date;
  inFlight: number;
  consecutiveFailures: number;
}

interface CachedData {
  data: any;
  timestamp: Date;
  ttl: number;
}

export class XrplConnectionPool {
  private connections: PooledConnection[] = [];
  private endpoints: XrplEndpoint[];
  private config: Required<Omit<XrplConnectionPoolConfig, "endpoints">>;
  private cache: Map<string, CachedData> = new Map();
  private requestQueue: Array<{
    resolve: (client: Client) => void;
    reject: (error: Error) => void;
  }> = [];
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(config: XrplConnectionPoolConfig) {
    this.endpoints = config.endpoints.sort((a, b) => a.priority - b.priority);
    this.config = {
      poolSize: config.poolSize ?? 3,
      maxRetries: config.maxRetries ?? 3,
      reconnectDelay: config.reconnectDelay ?? 5000,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      requestTimeout: config.requestTimeout ?? 15000,
    };

    console.log(`🔗 XrplConnectionPool: Initialized with ${this.endpoints.length} endpoints`);
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    const connectPromises: Promise<void>[] = [];

    for (let i = 0; i < Math.min(this.config.poolSize, this.endpoints.length); i++) {
      const endpoint = this.endpoints[i % this.endpoints.length];
      connectPromises.push(this.createConnection(endpoint));
    }

    await Promise.allSettled(connectPromises);

    const connectedCount = this.connections.filter(c => c.connected).length;
    console.log(`🔗 XrplConnectionPool: ${connectedCount}/${this.config.poolSize} connections established`);

    this.startHealthChecks();
  }

  /**
   * Create a new pooled connection
   */
  private async createConnection(endpoint: XrplEndpoint): Promise<void> {
    const client = new Client(endpoint.url);

    const pooledConnection: PooledConnection = {
      client,
      endpoint,
      connected: false,
      lastUsed: new Date(),
      inFlight: 0,
      consecutiveFailures: 0,
    };

    this.connections.push(pooledConnection);

    try {
      await client.connect();
      pooledConnection.connected = true;
      pooledConnection.consecutiveFailures = 0;

      client.on("disconnected", () => {
        pooledConnection.connected = false;
        console.warn(`⚠️ XrplConnectionPool: Connection to ${endpoint.url} lost`);
        
        if (!this.isShuttingDown) {
          this.scheduleReconnect(pooledConnection);
        }
      });

      client.on("error", (error) => {
        console.error(`❌ XrplConnectionPool: Error on ${endpoint.url}:`, error);
        pooledConnection.consecutiveFailures++;
      });

      console.log(`✅ XrplConnectionPool: Connected to ${endpoint.url}`);
    } catch (error) {
      console.error(`❌ XrplConnectionPool: Failed to connect to ${endpoint.url}:`, error);
      pooledConnection.consecutiveFailures++;
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(connection: PooledConnection): void {
    const delay = this.config.reconnectDelay * Math.pow(2, Math.min(connection.consecutiveFailures, 5));
    
    setTimeout(async () => {
      if (this.isShuttingDown || connection.connected) return;

      console.log(`🔄 XrplConnectionPool: Reconnecting to ${connection.endpoint.url}...`);

      try {
        await connection.client.connect();
        connection.connected = true;
        connection.consecutiveFailures = 0;
        console.log(`✅ XrplConnectionPool: Reconnected to ${connection.endpoint.url}`);
        
        this.processQueue();
      } catch (error) {
        connection.consecutiveFailures++;
        console.error(`❌ XrplConnectionPool: Reconnection failed for ${connection.endpoint.url}`);
        
        if (connection.consecutiveFailures >= 5) {
          await this.replaceConnection(connection);
        } else {
          this.scheduleReconnect(connection);
        }
      }
    }, delay);
  }

  /**
   * Replace a consistently failing connection with a new endpoint
   */
  private async replaceConnection(connection: PooledConnection): Promise<void> {
    const usedUrls = new Set(this.connections.map(c => c.endpoint.url));
    const alternativeEndpoint = this.endpoints.find(e => !usedUrls.has(e.url));

    if (alternativeEndpoint) {
      console.log(`🔄 XrplConnectionPool: Replacing ${connection.endpoint.url} with ${alternativeEndpoint.url}`);
      
      try {
        await connection.client.disconnect();
      } catch (e) {}

      const idx = this.connections.indexOf(connection);
      if (idx > -1) {
        this.connections.splice(idx, 1);
      }

      await this.createConnection(alternativeEndpoint);
    } else {
      this.scheduleReconnect(connection);
    }
  }

  /**
   * Get an available connection from the pool
   */
  private async getConnection(): Promise<Client> {
    const availableConnections = this.connections
      .filter(c => c.connected && c.inFlight < 5)
      .sort((a, b) => a.inFlight - b.inFlight);

    if (availableConnections.length > 0) {
      const connection = availableConnections[0];
      connection.inFlight++;
      connection.lastUsed = new Date();
      return connection.client;
    }

    const pendingConnections = this.connections.filter(c => !c.connected);
    if (pendingConnections.length > 0 || this.connections.length === 0) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const idx = this.requestQueue.findIndex(r => r.resolve === resolve);
          if (idx > -1) this.requestQueue.splice(idx, 1);
          reject(new Error("Connection timeout"));
        }, this.config.requestTimeout);

        this.requestQueue.push({
          resolve: (client) => {
            clearTimeout(timeout);
            resolve(client);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    }

    throw new Error("No XRPL connections available");
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(client: Client): void {
    const connection = this.connections.find(c => c.client === client);
    if (connection) {
      connection.inFlight = Math.max(0, connection.inFlight - 1);
    }
  }

  /**
   * Process queued requests when connections become available
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const availableConnection = this.connections.find(c => c.connected && c.inFlight < 5);
      
      if (!availableConnection) break;

      const request = this.requestQueue.shift();
      if (request) {
        availableConnection.inFlight++;
        availableConnection.lastUsed = new Date();
        request.resolve(availableConnection.client);
      }
    }
  }

  /**
   * Execute a request with automatic retry and failover
   */
  async request<T>(
    method: string,
    params: Record<string, any>,
    options?: { cache?: boolean; cacheTtl?: number }
  ): Promise<T> {
    const cacheKey = `${method}:${JSON.stringify(params)}`;

    if (options?.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
        return cached.data as T;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      let client: Client | null = null;

      try {
        client = await this.getConnection();

        const result = await Promise.race([
          client.request({ command: method, ...params } as any),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), this.config.requestTimeout)
          ),
        ]);

        if (options?.cacheTtl) {
          this.cache.set(cacheKey, {
            data: result,
            timestamp: new Date(),
            ttl: options.cacheTtl,
          });
        }

        return result as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (client) {
          const connection = this.connections.find(c => c.client === client);
          if (connection) {
            connection.consecutiveFailures++;
          }
        }

        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      } finally {
        if (client) {
          this.releaseConnection(client);
        }
      }
    }

    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.warn(`⚠️ XrplConnectionPool: Using stale cache for ${method}`);
      return cached.data as T;
    }

    throw lastError || new Error("XRPL request failed");
  }

  /**
   * Get account info with caching
   */
  async getAccountInfo(account: string): Promise<AccountInfoResponse> {
    return this.request<AccountInfoResponse>("account_info", {
      account,
      ledger_index: "validated",
    }, { cache: true, cacheTtl: 10000 });
  }

  /**
   * Get account balance in drops
   */
  async getBalance(account: string): Promise<string> {
    const info = await this.getAccountInfo(account);
    return info.result.account_data.Balance;
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      for (const connection of this.connections) {
        if (!connection.connected) continue;

        try {
          await Promise.race([
            connection.client.request({ command: "server_info" }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
          ]);
          connection.consecutiveFailures = 0;
        } catch (error) {
          connection.consecutiveFailures++;
          if (connection.consecutiveFailures >= 3) {
            connection.connected = false;
            this.scheduleReconnect(connection);
          }
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Get pool health status
   */
  getHealthStatus(): {
    healthy: boolean;
    totalConnections: number;
    activeConnections: number;
    connections: Array<{
      url: string;
      connected: boolean;
      inFlight: number;
      consecutiveFailures: number;
    }>;
  } {
    const connections = this.connections.map(c => ({
      url: c.endpoint.url,
      connected: c.connected,
      inFlight: c.inFlight,
      consecutiveFailures: c.consecutiveFailures,
    }));

    const activeConnections = this.connections.filter(c => c.connected).length;

    return {
      healthy: activeConnections > 0,
      totalConnections: this.connections.length,
      activeConnections,
      connections,
    };
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    for (const request of this.requestQueue) {
      request.reject(new Error("Pool shutting down"));
    }
    this.requestQueue = [];

    for (const connection of this.connections) {
      try {
        await connection.client.disconnect();
      } catch (e) {}
    }

    this.connections = [];
    console.log("🛑 XrplConnectionPool: Shutdown complete");
  }
}

/**
 * Create an XRPL connection pool with default endpoints
 */
export function createXrplPool(network: "mainnet" | "testnet"): XrplConnectionPool {
  const endpoints: XrplEndpoint[] = network === "mainnet"
    ? [
        { url: "wss://xrplcluster.com", priority: 1, network: "mainnet" },
        { url: "wss://s1.ripple.com", priority: 2, network: "mainnet" },
        { url: "wss://s2.ripple.com", priority: 3, network: "mainnet" },
      ]
    : [
        { url: "wss://s.altnet.rippletest.net:51233", priority: 1, network: "testnet" },
        { url: "wss://testnet.xrpl-labs.com", priority: 2, network: "testnet" },
      ];

  return new XrplConnectionPool({ endpoints });
}
