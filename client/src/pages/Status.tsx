import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Server, 
  Database, 
  Wifi, 
  Shield,
  Zap,
  ArrowLeft,
  Clock,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ServiceStatus {
  status: "ready" | "error" | "initializing";
  error?: string;
  lastUpdated: string;
}

interface SelfHealingStatus {
  initialized: boolean;
  flareRpc?: { healthy: boolean; endpoints: number } | null;
  xrplPool?: { healthy: boolean; connections: number } | null;
  circuitBreakers?: Record<string, { state: string; failures: number }>;
  featureFlags?: Record<string, { enabled: boolean }>;
  reconciliation?: { running: boolean };
  cacheStats?: { entries: number; queueSize: number };
}

interface SystemHealthResponse {
  healthy: boolean;
  timestamp: string;
  selfHealing: SelfHealingStatus;
  readiness: Record<string, ServiceStatus>;
}

function StatusIcon({ status }: { status: "ready" | "error" | "initializing" | "healthy" | "degraded" | "idle" }) {
  switch (status) {
    case "ready":
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "error":
    case "degraded":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "initializing":
      return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
    case "idle":
      return <Clock className="h-5 w-5 text-blue-400" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const getVariant = () => {
    switch (status) {
      case "ready":
      case "healthy":
      case "closed":
      case "idle":
        return "default";
      case "error":
      case "degraded":
      case "open":
        return "destructive";
      case "initializing":
      case "half-open":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getLabel = () => {
    switch (status) {
      case "ready":
        return "Operational";
      case "error":
        return "Error";
      case "initializing":
        return "Starting";
      case "healthy":
        return "Healthy";
      case "degraded":
        return "Degraded";
      case "closed":
        return "Closed";
      case "open":
        return "Open";
      case "half-open":
        return "Recovering";
      case "idle":
        return "Idle";
      default:
        return status;
    }
  };

  return (
    <Badge variant={getVariant()} className="text-xs" data-testid={`badge-status-${status}`}>
      {getLabel()}
    </Badge>
  );
}

function getServiceIcon(name: string) {
  const iconMap: Record<string, typeof Server> = {
    storage: Database,
    flareClient: Zap,
    vaultService: Shield,
    yieldService: Activity,
    xrplListener: Wifi,
    bridgeService: RefreshCw,
  };
  return iconMap[name] || Server;
}

function getServiceDisplayName(name: string): string {
  const nameMap: Record<string, string> = {
    storage: "Database Storage",
    flareClient: "Flare Network RPC",
    vaultService: "Vault Service",
    yieldService: "Yield Service",
    compoundingService: "Auto-Compounding",
    xrplListener: "XRPL Connection",
    bridgeService: "Bridge Service",
  };
  return nameMap[name] || name.replace(/([A-Z])/g, " $1").trim();
}

function ServiceCard({ name, status }: { name: string; status: ServiceStatus }) {
  const Icon = getServiceIcon(name);
  const displayName = getServiceDisplayName(name);

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10" data-testid={`service-card-${name}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-white">{displayName}</p>
          {status.error && (
            <p className="text-xs text-red-400 mt-0.5">{status.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusIcon status={status.status} />
        <StatusBadge status={status.status} />
      </div>
    </div>
  );
}

function InfrastructureCard({ 
  title, 
  healthy, 
  detail 
}: { 
  title: string; 
  healthy: boolean; 
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10" data-testid={`infra-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5">
          <Server className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-xs text-white/50 mt-0.5">{detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusIcon status={healthy ? "healthy" : "error"} />
        <StatusBadge status={healthy ? "healthy" : "degraded"} />
      </div>
    </div>
  );
}

function CircuitBreakerCard({ name, state, failures }: { name: string; state: string; failures: number }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10" data-testid={`circuit-breaker-${name}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-xs text-white/50 mt-0.5">
            {failures > 0 ? `${failures} failure${failures > 1 ? 's' : ''}` : 'No failures'}
          </p>
        </div>
      </div>
      <StatusBadge status={state} />
    </div>
  );
}

function ReconciliationCard({ running }: { running: boolean }) {
  const status = running ? "healthy" : "idle";
  const detail = running ? "Running reconciliation cycle" : "Idle - waiting for next scheduled run";
  
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10" data-testid="infra-card-reconciliation-service">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/5">
          <RefreshCw className={`h-5 w-5 text-primary ${running ? 'animate-spin' : ''}`} />
        </div>
        <div>
          <p className="font-medium text-white">Reconciliation Service</p>
          <p className="text-xs text-white/50 mt-0.5">{detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function Status() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<SystemHealthResponse>({
    queryKey: ["/api/system/health"],
    refetchInterval: 30000,
  });

  const overallHealthy = data?.healthy ?? false;
  const servicesCount = data?.readiness ? Object.keys(data.readiness).length : 0;
  const healthyServicesCount = data?.readiness 
    ? Object.values(data.readiness).filter(s => s.status === "ready").length 
    : 0;

  return (
    <div className="min-h-screen bg-[#030303]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white mb-4" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white" data-testid="heading-status">
                System Status
              </h1>
              <p className="text-white/60 mt-2">
                Real-time health monitoring for Shield Finance services
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-white border-white/20"
                data-testid="button-refresh-status"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Card className="glass-card border-white/10 mb-8" data-testid="card-overall-status">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${overallHealthy ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  {isLoading ? (
                    <RefreshCw className="h-8 w-8 text-white/50 animate-spin" />
                  ) : overallHealthy ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white" data-testid="text-overall-health">
                    {isLoading ? "Checking..." : overallHealthy ? "All Systems Operational" : "Some Services Degraded"}
                  </h2>
                  <p className="text-white/60 text-sm mt-1" data-testid="text-services-count">
                    {healthyServicesCount} of {servicesCount} services healthy
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-white/40 text-sm">
                <Clock className="h-4 w-4" />
                <span data-testid="text-last-updated">
                  {data?.timestamp 
                    ? `Updated ${new Date(data.timestamp).toLocaleTimeString()}` 
                    : 'Loading...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-500/30 bg-red-500/10 mb-8" data-testid="card-error">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-red-400">Failed to fetch system status. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-8">
          <Card className="glass-card border-white/10" data-testid="card-core-services">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Core Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <LoadingSkeleton />
              ) : data?.readiness ? (
                Object.entries(data.readiness).map(([name, status]) => (
                  <ServiceCard key={name} name={name} status={status} />
                ))
              ) : (
                <p className="text-white/50 text-center py-4">No service data available</p>
              )}
            </CardContent>
          </Card>

          {data?.selfHealing?.initialized && (data.selfHealing.flareRpc || data.selfHealing.xrplPool || data.selfHealing.cacheStats || data.selfHealing.reconciliation) && (
            <Card className="glass-card border-white/10" data-testid="card-infrastructure">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-primary" />
                  Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.selfHealing.flareRpc && (
                  <InfrastructureCard 
                    title="Flare RPC" 
                    healthy={data.selfHealing.flareRpc.healthy}
                    detail={`${data.selfHealing.flareRpc.endpoints} endpoint${data.selfHealing.flareRpc.endpoints > 1 ? 's' : ''} available`}
                  />
                )}
                {data.selfHealing.xrplPool && (
                  <InfrastructureCard 
                    title="XRPL Connection Pool" 
                    healthy={data.selfHealing.xrplPool.healthy}
                    detail={`${data.selfHealing.xrplPool.connections} active connection${data.selfHealing.xrplPool.connections !== 1 ? 's' : ''}`}
                  />
                )}
                {data.selfHealing.cacheStats && (
                  <InfrastructureCard 
                    title="Cache System" 
                    healthy={true}
                    detail={`${data.selfHealing.cacheStats.entries} entries, ${data.selfHealing.cacheStats.queueSize} queued`}
                  />
                )}
                {data.selfHealing.reconciliation !== undefined && (
                  <ReconciliationCard running={data.selfHealing.reconciliation.running} />
                )}
              </CardContent>
            </Card>
          )}

          {data?.selfHealing?.initialized && data?.selfHealing?.circuitBreakers && Object.keys(data.selfHealing.circuitBreakers).length > 0 && (
            <Card className="glass-card border-white/10" data-testid="card-circuit-breakers">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Circuit Breakers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(data.selfHealing.circuitBreakers).map(([name, breaker]) => (
                  <CircuitBreakerCard 
                    key={name} 
                    name={name} 
                    state={breaker.state} 
                    failures={breaker.failures} 
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {data?.selfHealing?.initialized && data?.selfHealing?.featureFlags && Object.keys(data.selfHealing.featureFlags).length > 0 && (
            <Card className="glass-card border-white/10" data-testid="card-feature-flags">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Feature Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.selfHealing.featureFlags).map(([name, flag]) => (
                    <Badge 
                      key={name} 
                      variant={flag.enabled ? "default" : "secondary"}
                      className="text-xs"
                      data-testid={`feature-flag-${name}`}
                    >
                      {name}: {flag.enabled ? "ON" : "OFF"}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-12 text-center text-white/40 text-sm">
          <p>Status page auto-refreshes every 30 seconds</p>
          <p className="mt-1">
            Need help? Join our <a href="https://discord.gg/Vzs3KbzU" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Discord community</a>
          </p>
        </div>
      </div>
    </div>
  );
}
