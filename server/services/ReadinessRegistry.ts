/**
 * ReadinessRegistry tracks the initialization status of all services.
 * Used for health checks and graceful degradation during startup.
 */

export interface ServiceStatus {
  name: string;
  ready: boolean;
  error?: string;
  lastUpdated: Date;
}

export class ReadinessRegistry {
  private services: Map<string, ServiceStatus> = new Map();
  private criticalServices: Set<string> = new Set([
    'storage',
    'flareClient',
    'vaultService',
    'bridgeService',
  ]);

  /**
   * Mark a service as ready
   */
  setReady(name: string): void {
    this.services.set(name, {
      name,
      ready: true,
      lastUpdated: new Date(),
    });
    console.log(`✅ ${name} ready`);
  }

  /**
   * Mark a service as failed with error details
   */
  setError(name: string, error: string): void {
    this.services.set(name, {
      name,
      ready: false,
      error,
      lastUpdated: new Date(),
    });
    console.error(`❌ ${name} failed: ${error}`);
  }

  /**
   * Check if a specific service is ready
   */
  isReady(name: string): boolean {
    const status = this.services.get(name);
    return status?.ready ?? false;
  }

  /**
   * Check if all critical services are ready
   */
  allCriticalServicesReady(): boolean {
    const criticalServiceNames = Array.from(this.criticalServices);
    for (const serviceName of criticalServiceNames) {
      if (!this.isReady(serviceName)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get detailed status of all services
   */
  getStatus(): {
    ready: boolean;
    services: Record<string, { status: string; error?: string; lastUpdated: string }>;
  } {
    const services: Record<string, { status: string; error?: string; lastUpdated: string }> = {};
    
    const serviceEntries = Array.from(this.services.entries());
    for (const [name, status] of serviceEntries) {
      services[name] = {
        status: status.ready ? 'ready' : 'error',
        error: status.error,
        lastUpdated: status.lastUpdated.toISOString(),
      };
    }

    // Add services that haven't been initialized yet
    const allServiceNames = [
      'storage',
      'flareClient',
      'vaultService',
      'yieldService',
      'compoundingService',
      'xrplListener',
      'bridgeService',
    ];

    for (const name of allServiceNames) {
      if (!services[name]) {
        services[name] = {
          status: 'initializing',
          lastUpdated: new Date().toISOString(),
        };
      }
    }

    return {
      ready: this.allCriticalServicesReady(),
      services,
    };
  }

  /**
   * Mark a service as critical (must be ready for system to be considered ready)
   */
  markAsCritical(name: string): void {
    this.criticalServices.add(name);
  }

  /**
   * Reset all service statuses (useful for testing)
   */
  reset(): void {
    this.services.clear();
  }
}

// Global singleton instance
export const readinessRegistry = new ReadinessRegistry();
