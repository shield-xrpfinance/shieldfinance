/**
 * ServiceSupervisor - Self-Healing Service Management
 * 
 * Monitors service health, automatically restarts failed services,
 * and coordinates graceful degradation during outages.
 * 
 * Features:
 * - Automatic restart with exponential backoff
 * - Health check heartbeats
 * - Circuit breaker pattern for external dependencies
 * - ReadinessRegistry integration for system-wide visibility
 */

import { readinessRegistry } from "./ReadinessRegistry";

export type ServiceState = "stopped" | "starting" | "running" | "degraded" | "failed";

export interface ServiceHealthCheck {
  (): Promise<boolean>;
}

export interface ServiceStartFn {
  (): Promise<void>;
}

export interface ServiceStopFn {
  (): Promise<void>;
}

export interface ManagedService {
  name: string;
  start: ServiceStartFn;
  stop?: ServiceStopFn;
  healthCheck?: ServiceHealthCheck;
  critical?: boolean;
  restartOnFailure?: boolean;
  maxRestarts?: number;
  healthCheckInterval?: number;
  restartDelay?: number;
}

interface ServiceRecord {
  config: ManagedService;
  state: ServiceState;
  restartCount: number;
  lastHealthCheck: Date | null;
  lastError: string | null;
  healthCheckTimer: ReturnType<typeof setInterval> | null;
  consecutiveFailures: number;
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerRecord {
  config: CircuitBreakerConfig;
  state: CircuitState;
  failures: number;
  lastFailure: Date | null;
  halfOpenSuccesses: number;
}

export class ServiceSupervisor {
  private services: Map<string, ServiceRecord> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerRecord> = new Map();
  private globalHealthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  private defaultConfig = {
    maxRestarts: 5,
    healthCheckInterval: 30000,
    restartDelay: 5000,
    backoffMultiplier: 2,
    maxBackoff: 300000,
  };

  constructor() {
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log("\n🛑 ServiceSupervisor: Initiating graceful shutdown...");
      await this.stopAll();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }

  /**
   * Register a service with the supervisor
   */
  register(service: ManagedService): void {
    const record: ServiceRecord = {
      config: {
        ...service,
        restartOnFailure: service.restartOnFailure ?? true,
        maxRestarts: service.maxRestarts ?? this.defaultConfig.maxRestarts,
        healthCheckInterval: service.healthCheckInterval ?? this.defaultConfig.healthCheckInterval,
        restartDelay: service.restartDelay ?? this.defaultConfig.restartDelay,
      },
      state: "stopped",
      restartCount: 0,
      lastHealthCheck: null,
      lastError: null,
      healthCheckTimer: null,
      consecutiveFailures: 0,
    };

    this.services.set(service.name, record);
    
    if (service.critical) {
      readinessRegistry.markAsCritical(service.name);
    }

    console.log(`📋 ServiceSupervisor: Registered service "${service.name}"`);
  }

  /**
   * Start a registered service with automatic restart on failure
   */
  async start(name: string): Promise<void> {
    const record = this.services.get(name);
    if (!record) {
      throw new Error(`Service "${name}" not registered`);
    }

    if (record.state === "running") {
      console.log(`⚠️ Service "${name}" is already running`);
      return;
    }

    record.state = "starting";
    
    try {
      await record.config.start();
      record.state = "running";
      record.consecutiveFailures = 0;
      readinessRegistry.setReady(name);
      
      if (record.config.healthCheck) {
        this.startHealthChecks(name);
      }

      console.log(`✅ ServiceSupervisor: Started "${name}"`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      record.state = "failed";
      record.lastError = errorMsg;
      readinessRegistry.setError(name, errorMsg);
      
      console.error(`❌ ServiceSupervisor: Failed to start "${name}": ${errorMsg}`);
      
      if (record.config.restartOnFailure) {
        await this.scheduleRestart(name);
      }
    }
  }

  /**
   * Stop a service
   */
  async stop(name: string): Promise<void> {
    const record = this.services.get(name);
    if (!record) {
      throw new Error(`Service "${name}" not registered`);
    }

    if (record.healthCheckTimer) {
      clearInterval(record.healthCheckTimer);
      record.healthCheckTimer = null;
    }

    if (record.config.stop) {
      try {
        await record.config.stop();
      } catch (error) {
        console.error(`⚠️ Error stopping "${name}":`, error);
      }
    }

    record.state = "stopped";
    console.log(`🛑 ServiceSupervisor: Stopped "${name}"`);
  }

  /**
   * Start all registered services
   */
  async startAll(): Promise<void> {
    const serviceNames = Array.from(this.services.keys());
    
    const criticalServices = serviceNames.filter(
      name => this.services.get(name)?.config.critical
    );
    const nonCriticalServices = serviceNames.filter(
      name => !this.services.get(name)?.config.critical
    );

    console.log(`🚀 ServiceSupervisor: Starting ${criticalServices.length} critical services...`);
    for (const name of criticalServices) {
      await this.start(name);
    }

    console.log(`🚀 ServiceSupervisor: Starting ${nonCriticalServices.length} non-critical services...`);
    await Promise.allSettled(nonCriticalServices.map(name => this.start(name)));

    this.startGlobalHealthCheck();
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<void> {
    if (this.globalHealthCheckInterval) {
      clearInterval(this.globalHealthCheckInterval);
      this.globalHealthCheckInterval = null;
    }

    const serviceNames = Array.from(this.services.keys());
    await Promise.allSettled(serviceNames.map(name => this.stop(name)));
    
    console.log("🛑 ServiceSupervisor: All services stopped");
  }

  /**
   * Start health checks for a service
   */
  private startHealthChecks(name: string): void {
    const record = this.services.get(name);
    if (!record || !record.config.healthCheck) return;

    if (record.healthCheckTimer) {
      clearInterval(record.healthCheckTimer);
    }

    record.healthCheckTimer = setInterval(async () => {
      await this.runHealthCheck(name);
    }, record.config.healthCheckInterval);
  }

  /**
   * Run a single health check
   */
  private async runHealthCheck(name: string): Promise<boolean> {
    const record = this.services.get(name);
    if (!record || !record.config.healthCheck) return true;

    try {
      const healthy = await record.config.healthCheck();
      record.lastHealthCheck = new Date();
      
      if (healthy) {
        if (record.state === "degraded") {
          record.state = "running";
          record.consecutiveFailures = 0;
          readinessRegistry.setReady(name);
          console.log(`✅ ServiceSupervisor: "${name}" recovered`);
        }
        return true;
      } else {
        record.consecutiveFailures++;
        if (record.consecutiveFailures >= 3) {
          record.state = "degraded";
          readinessRegistry.setError(name, "Health check failing");
          console.warn(`⚠️ ServiceSupervisor: "${name}" is degraded`);
          
          if (record.config.restartOnFailure && record.consecutiveFailures >= 5) {
            await this.scheduleRestart(name);
          }
        }
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      record.consecutiveFailures++;
      record.lastError = errorMsg;
      
      if (record.consecutiveFailures >= 3) {
        record.state = "degraded";
        readinessRegistry.setError(name, errorMsg);
        
        if (record.config.restartOnFailure && record.consecutiveFailures >= 5) {
          await this.scheduleRestart(name);
        }
      }
      
      return false;
    }
  }

  /**
   * Schedule a service restart with exponential backoff
   */
  private async scheduleRestart(name: string): Promise<void> {
    const record = this.services.get(name);
    if (!record) return;

    if (record.restartCount >= (record.config.maxRestarts ?? this.defaultConfig.maxRestarts)) {
      console.error(`❌ ServiceSupervisor: "${name}" exceeded max restarts (${record.restartCount})`);
      record.state = "failed";
      return;
    }

    const delay = Math.min(
      (record.config.restartDelay ?? this.defaultConfig.restartDelay) * 
        Math.pow(this.defaultConfig.backoffMultiplier, record.restartCount),
      this.defaultConfig.maxBackoff
    );

    console.log(`🔄 ServiceSupervisor: Scheduling restart for "${name}" in ${delay}ms (attempt ${record.restartCount + 1})`);
    
    record.restartCount++;

    setTimeout(async () => {
      if (this.isShuttingDown) return;
      
      console.log(`🔄 ServiceSupervisor: Restarting "${name}"...`);
      await this.stop(name);
      await this.start(name);
    }, delay);
  }

  /**
   * Reset restart counter for a service (call after manual intervention)
   */
  resetRestarts(name: string): void {
    const record = this.services.get(name);
    if (record) {
      record.restartCount = 0;
      record.consecutiveFailures = 0;
      console.log(`🔄 ServiceSupervisor: Reset restart counter for "${name}"`);
    }
  }

  /**
   * Start global health monitoring
   */
  private startGlobalHealthCheck(): void {
    this.globalHealthCheckInterval = setInterval(() => {
      const status = this.getStatus();
      
      const degradedServices = Object.entries(status.services)
        .filter(([, s]) => s.state === "degraded" || s.state === "failed")
        .map(([name]) => name);

      if (degradedServices.length > 0) {
        console.warn(`⚠️ ServiceSupervisor: Degraded services: ${degradedServices.join(", ")}`);
      }
    }, 60000);
  }

  /**
   * Create a circuit breaker for external dependencies
   */
  createCircuitBreaker(config: CircuitBreakerConfig): void {
    this.circuitBreakers.set(config.name, {
      config,
      state: "closed",
      failures: 0,
      lastFailure: null,
      halfOpenSuccesses: 0,
    });
    
    console.log(`🔌 ServiceSupervisor: Created circuit breaker "${config.name}"`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) {
      return fn();
    }

    if (breaker.state === "open") {
      const timeSinceLastFailure = breaker.lastFailure 
        ? Date.now() - breaker.lastFailure.getTime()
        : Infinity;

      if (timeSinceLastFailure >= breaker.config.resetTimeout) {
        breaker.state = "half-open";
        breaker.halfOpenSuccesses = 0;
        console.log(`🔌 Circuit breaker "${name}" entering half-open state`);
      } else {
        if (fallback) {
          console.log(`🔌 Circuit breaker "${name}" is open, using fallback`);
          return fallback();
        }
        throw new Error(`Circuit breaker "${name}" is open`);
      }
    }

    try {
      const result = await fn();
      
      if (breaker.state === "half-open") {
        breaker.halfOpenSuccesses++;
        if (breaker.halfOpenSuccesses >= breaker.config.halfOpenRequests) {
          breaker.state = "closed";
          breaker.failures = 0;
          console.log(`🔌 Circuit breaker "${name}" closed after recovery`);
        }
      } else {
        breaker.failures = 0;
      }
      
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.failures >= breaker.config.failureThreshold) {
        breaker.state = "open";
        console.error(`🔌 Circuit breaker "${name}" opened after ${breaker.failures} failures`);
      }
      
      if (fallback && breaker.state === "open") {
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Get the current status of all services
   */
  getStatus(): {
    healthy: boolean;
    services: Record<string, {
      state: ServiceState;
      restartCount: number;
      lastHealthCheck: string | null;
      lastError: string | null;
    }>;
    circuitBreakers: Record<string, {
      state: CircuitState;
      failures: number;
    }>;
  } {
    const services: Record<string, any> = {};
    
    const serviceEntries = Array.from(this.services.entries());
    for (const [name, record] of serviceEntries) {
      services[name] = {
        state: record.state,
        restartCount: record.restartCount,
        lastHealthCheck: record.lastHealthCheck?.toISOString() || null,
        lastError: record.lastError,
      };
    }

    const circuitBreakers: Record<string, any> = {};
    
    const breakerEntries = Array.from(this.circuitBreakers.entries());
    for (const [name, breaker] of breakerEntries) {
      circuitBreakers[name] = {
        state: breaker.state,
        failures: breaker.failures,
      };
    }

    const allRunning = Array.from(this.services.values())
      .filter(r => r.config.critical)
      .every(r => r.state === "running");

    return {
      healthy: allRunning,
      services,
      circuitBreakers,
    };
  }

  /**
   * Force restart a specific service
   */
  async forceRestart(name: string): Promise<void> {
    const record = this.services.get(name);
    if (!record) {
      throw new Error(`Service "${name}" not registered`);
    }

    console.log(`🔄 ServiceSupervisor: Force restarting "${name}"...`);
    record.restartCount = 0;
    record.consecutiveFailures = 0;
    
    await this.stop(name);
    await this.start(name);
  }
}

export const serviceSupervisor = new ServiceSupervisor();

export function getServiceSupervisor(): ServiceSupervisor {
  return serviceSupervisor;
}
