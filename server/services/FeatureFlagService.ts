/**
 * FeatureFlagService - Dynamic Feature Control for Graceful Degradation
 * 
 * Enables/disables features at runtime based on service health,
 * providing graceful degradation during outages.
 * 
 * Features:
 * - Runtime feature toggling
 * - Health-based automatic disabling
 * - Dependency tracking between features
 * - API for frontend feature awareness
 */

import { readinessRegistry } from "./ReadinessRegistry";
import { serviceSupervisor } from "./ServiceSupervisor";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  dependencies?: string[];
  autoDisableOnFailure?: boolean;
  healthCheck?: () => Promise<boolean>;
  disabledReason?: string;
  lastUpdated: Date;
}

export interface FeatureFlagConfig {
  features: Omit<FeatureFlag, "enabled" | "lastUpdated" | "disabledReason">[];
  healthCheckInterval?: number;
}

export class FeatureFlagService {
  private features: Map<string, FeatureFlag> = new Map();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: number;

  constructor(config: FeatureFlagConfig) {
    this.healthCheckInterval = config.healthCheckInterval ?? 30000;

    for (const feature of config.features) {
      this.features.set(feature.name, {
        ...feature,
        enabled: true,
        lastUpdated: new Date(),
      });
    }

    console.log(`🚩 FeatureFlagService: Initialized with ${this.features.size} features`);
  }

  /**
   * Start health-based feature monitoring
   */
  start(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.evaluateFeatures();
    }, this.healthCheckInterval);

    this.evaluateFeatures();
    console.log("🚩 FeatureFlagService: Started health monitoring");
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    console.log("🛑 FeatureFlagService: Stopped");
  }

  /**
   * Evaluate all features based on health
   */
  private async evaluateFeatures(): Promise<void> {
    const entries = Array.from(this.features.entries());
    
    for (const [name, feature] of entries) {
      try {
        const shouldBeEnabled = await this.shouldFeatureBeEnabled(feature);
        
        if (feature.enabled !== shouldBeEnabled) {
          feature.enabled = shouldBeEnabled;
          feature.lastUpdated = new Date();
          feature.disabledReason = shouldBeEnabled 
            ? undefined 
            : "Automatically disabled due to service health";
          
          console.log(
            `🚩 FeatureFlagService: ${name} ${shouldBeEnabled ? "enabled" : "disabled"}`
          );
        }
      } catch (error) {
        console.error(`❌ FeatureFlagService: Error evaluating ${name}:`, error);
      }
    }
  }

  /**
   * Determine if a feature should be enabled
   */
  private async shouldFeatureBeEnabled(feature: FeatureFlag): Promise<boolean> {
    if (feature.dependencies) {
      for (const dep of feature.dependencies) {
        if (!readinessRegistry.isReady(dep)) {
          return false;
        }
      }
    }

    if (feature.autoDisableOnFailure && feature.healthCheck) {
      try {
        const healthy = await feature.healthCheck();
        return healthy;
      } catch (error) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(name: string): boolean {
    const feature = this.features.get(name);
    return feature?.enabled ?? false;
  }

  /**
   * Manually enable a feature
   */
  enable(name: string): void {
    const feature = this.features.get(name);
    if (feature) {
      feature.enabled = true;
      feature.disabledReason = undefined;
      feature.lastUpdated = new Date();
      console.log(`🚩 FeatureFlagService: ${name} manually enabled`);
    }
  }

  /**
   * Manually disable a feature
   */
  disable(name: string, reason?: string): void {
    const feature = this.features.get(name);
    if (feature) {
      feature.enabled = false;
      feature.disabledReason = reason ?? "Manually disabled";
      feature.lastUpdated = new Date();
      console.log(`🚩 FeatureFlagService: ${name} manually disabled`);
    }
  }

  /**
   * Get all feature flags
   */
  getAll(): Record<string, {
    enabled: boolean;
    description: string;
    disabledReason?: string;
    lastUpdated: string;
  }> {
    const result: Record<string, any> = {};
    
    const entries = Array.from(this.features.entries());
    for (const [name, feature] of entries) {
      result[name] = {
        enabled: feature.enabled,
        description: feature.description,
        disabledReason: feature.disabledReason,
        lastUpdated: feature.lastUpdated.toISOString(),
      };
    }
    
    return result;
  }

  /**
   * Get a specific feature flag
   */
  get(name: string): FeatureFlag | undefined {
    return this.features.get(name);
  }

  /**
   * Register a new feature at runtime
   */
  register(feature: Omit<FeatureFlag, "enabled" | "lastUpdated">): void {
    this.features.set(feature.name, {
      ...feature,
      enabled: true,
      lastUpdated: new Date(),
    });
    console.log(`🚩 FeatureFlagService: Registered new feature "${feature.name}"`);
  }
}

export const defaultFeatureFlags: FeatureFlagConfig = {
  features: [
    {
      name: "staking",
      description: "XRP liquid staking functionality",
      dependencies: ["vaultService", "flareClient"],
      autoDisableOnFailure: true,
    },
    {
      name: "bridge",
      description: "XRP to FXRP bridge operations",
      dependencies: ["bridgeService", "xrplListener"],
      autoDisableOnFailure: true,
    },
    {
      name: "withdrawals",
      description: "Withdrawal requests and processing",
      dependencies: ["vaultService"],
      autoDisableOnFailure: true,
    },
    {
      name: "swaps",
      description: "Token swap functionality",
      dependencies: ["flareClient"],
      autoDisableOnFailure: true,
    },
    {
      name: "analytics",
      description: "Analytics and dashboard data",
      dependencies: ["storage"],
      autoDisableOnFailure: false,
    },
    {
      name: "priceFeeds",
      description: "Real-time price data",
      dependencies: [],
      autoDisableOnFailure: true,
    },
    {
      name: "governance",
      description: "SHIELD token governance features",
      dependencies: ["storage"],
      autoDisableOnFailure: false,
    },
    {
      name: "airdrop",
      description: "SHIELD token airdrop claims",
      dependencies: ["flareClient"],
      autoDisableOnFailure: true,
    },
  ],
};

export const featureFlagService = new FeatureFlagService(defaultFeatureFlags);
