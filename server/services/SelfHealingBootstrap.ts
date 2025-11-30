/**
 * SelfHealingBootstrap - Initializes and wires up self-healing infrastructure
 * 
 * This module bootstraps all self-healing services and integrates them
 * with the existing application infrastructure.
 */

import { serviceSupervisor } from "./ServiceSupervisor";
import { featureFlagService } from "./FeatureFlagService";
import { reconciliationService } from "./ReconciliationService";
import { readinessRegistry } from "./ReadinessRegistry";
import { createFlareRpcAdapter, ResilientRpcAdapter } from "./ResilientRpcAdapter";
import { createXrplPool, XrplConnectionPool } from "./XrplConnectionPool";
import { cacheFallbackService, CacheFallbackService } from "./CacheFallbackService";

let flareRpcAdapter: ResilientRpcAdapter | null = null;
let xrplPool: XrplConnectionPool | null = null;
let isInitialized = false;

export interface SelfHealingConfig {
  enableReconciliation?: boolean;
  enableFeatureFlags?: boolean;
  network?: "mainnet" | "testnet";
}

/**
 * Initialize the self-healing infrastructure
 */
export async function initializeSelfHealing(config: SelfHealingConfig = {}): Promise<void> {
  if (isInitialized) {
    console.log("⚠️ SelfHealingBootstrap: Already initialized");
    return;
  }

  console.log("🛡️ SelfHealingBootstrap: Initializing self-healing infrastructure...");

  const network = config.network ?? (process.env.FLARE_NETWORK === "mainnet" ? "mainnet" : "testnet");

  try {
    flareRpcAdapter = createFlareRpcAdapter(network === "mainnet" ? "mainnet" : "coston2");
    flareRpcAdapter.startHealthChecks();
    console.log("✅ SelfHealingBootstrap: Flare RPC adapter initialized");
  } catch (error) {
    console.warn("⚠️ SelfHealingBootstrap: Failed to initialize Flare RPC adapter:", error);
  }

  try {
    xrplPool = createXrplPool(network === "mainnet" ? "mainnet" : "testnet");
    await xrplPool.initialize();
    console.log("✅ SelfHealingBootstrap: XRPL connection pool initialized");
  } catch (error) {
    console.warn("⚠️ SelfHealingBootstrap: Failed to initialize XRPL pool:", error);
  }

  serviceSupervisor.createCircuitBreaker({
    name: "flare-rpc",
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenRequests: 2,
  });

  serviceSupervisor.createCircuitBreaker({
    name: "xrpl-ws",
    failureThreshold: 3,
    resetTimeout: 30000,
    halfOpenRequests: 1,
  });

  serviceSupervisor.createCircuitBreaker({
    name: "price-feed",
    failureThreshold: 5,
    resetTimeout: 120000,
    halfOpenRequests: 2,
  });

  console.log("✅ SelfHealingBootstrap: Circuit breakers configured");

  if (config.enableFeatureFlags !== false) {
    featureFlagService.start();
    console.log("✅ SelfHealingBootstrap: Feature flag service started");
  }

  if (config.enableReconciliation !== false) {
    reconciliationService.start();
    console.log("✅ SelfHealingBootstrap: Reconciliation service started");
  }

  cacheFallbackService.registerWarmup("prices", async () => {
    console.log("🔥 Warming up price cache...");
  });

  isInitialized = true;
  console.log("🛡️ SelfHealingBootstrap: Self-healing infrastructure ready");
}

/**
 * Shutdown the self-healing infrastructure gracefully
 */
export async function shutdownSelfHealing(): Promise<void> {
  console.log("🛑 SelfHealingBootstrap: Shutting down...");

  if (flareRpcAdapter) {
    flareRpcAdapter.stopHealthChecks();
  }

  if (xrplPool) {
    await xrplPool.shutdown();
  }

  featureFlagService.stop();
  reconciliationService.stop();
  cacheFallbackService.shutdown();

  isInitialized = false;
  console.log("🛑 SelfHealingBootstrap: Shutdown complete");
}

/**
 * Get the Flare RPC adapter instance
 */
export function getFlareRpcAdapter(): ResilientRpcAdapter | null {
  return flareRpcAdapter;
}

/**
 * Get the XRPL connection pool instance
 */
export function getXrplPool(): XrplConnectionPool | null {
  return xrplPool;
}

/**
 * Get the cache fallback service instance
 */
export function getCacheFallbackService(): CacheFallbackService {
  return cacheFallbackService;
}

/**
 * Check if self-healing is initialized
 */
export function isSelfHealingInitialized(): boolean {
  return isInitialized;
}

/**
 * Get comprehensive self-healing status
 */
export function getSelfHealingStatus(): {
  initialized: boolean;
  flareRpc: { healthy: boolean; endpoints: number } | null;
  xrplPool: { healthy: boolean; connections: number } | null;
  circuitBreakers: Record<string, { state: string; failures: number }>;
  featureFlags: Record<string, { enabled: boolean }>;
  reconciliation: { running: boolean };
  cacheStats: { entries: number; queueSize: number };
} {
  const supervisorStatus = serviceSupervisor.getStatus();

  return {
    initialized: isInitialized,
    flareRpc: flareRpcAdapter 
      ? { 
          healthy: flareRpcAdapter.getHealthStatus().healthy,
          endpoints: flareRpcAdapter.getHealthStatus().endpoints.length,
        }
      : null,
    xrplPool: xrplPool 
      ? {
          healthy: xrplPool.getHealthStatus().healthy,
          connections: xrplPool.getHealthStatus().activeConnections,
        }
      : null,
    circuitBreakers: Object.fromEntries(
      Object.entries(supervisorStatus.circuitBreakers).map(([k, v]) => [k, { state: v.state, failures: v.failures }])
    ),
    featureFlags: Object.fromEntries(
      Object.entries(featureFlagService.getAll()).map(([k, v]) => [k, { enabled: v.enabled }])
    ),
    reconciliation: { running: reconciliationService.getStatus().running },
    cacheStats: {
      entries: cacheFallbackService.getStats().memoryEntries,
      queueSize: cacheFallbackService.getStats().revalidationQueueSize,
    },
  };
}
