import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wifi,
  Shield,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

// TypeScript interfaces for API responses - FIXED to match backend response format
interface VaultMetrics {
  tvl: string;                    // FIXED: string not number
  apy: number;                    // FIXED: renamed from avgApy
  activeUsers: number;
  totalDeposits: string;          // FIXED: string not number
  totalWithdrawals: string;       // FIXED: string not number
  shieldBurned: string;
  stakingAdoption: {
    totalStakers: number;
    avgBoostPercentage: number;   // FIXED: renamed from avgBoost
    totalShieldStaked: string;    // FIXED: string not number
  };
}

interface BridgeStatus {
  pendingOperations: number;
  avgRedemptionTime: number;
  stuckTransactions: number;
  failureRate: number;
  successfulBridges24h: number;
  failuresByType: {
    fdcProof: number;
    xrplPayment: number;
    confirmation: number;
    other: number;
  };
}

interface RevenueStats {
  totalRevenue: number;
  revenueGrowth: number;
}

// FIXED: Utility functions now handle undefined/null/NaN
const formatNumber = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

const formatCurrency = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(num)) return '$0';
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(2)}`;
};

const formatDuration = (value: number | undefined | null): string => {
  if (value === undefined || value === null || !isFinite(value)) return '0s';
  const seconds = value;
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

export default function MonitoringDashboard() {
  const { data: vaultMetrics, isLoading: vaultLoading, error: vaultError } = useQuery<VaultMetrics>({
    queryKey: ['/api/analytics/vault-metrics'],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: bridgeStatus, isLoading: bridgeLoading, error: bridgeError } = useQuery<BridgeStatus>({
    queryKey: ['/api/analytics/bridge-status'],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: revenueStats, isLoading: revenueLoading, error: revenueError } = useQuery<RevenueStats>({
    queryKey: ['/api/analytics/revenue-stats'],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // FIXED: System health now properly handles missing/error states using useMemo
  const systemHealth = useMemo(() => {
    // If data is missing, show degraded status
    if (!bridgeStatus || bridgeLoading || bridgeError) {
      return { status: 'degraded' as const, label: 'Degraded', variant: 'secondary' as const };
    }

    const { failureRate, stuckTransactions } = bridgeStatus;

    if (failureRate > 20 || stuckTransactions > 10) {
      return { status: 'critical' as const, label: 'Critical', variant: 'destructive' as const };
    } else if (failureRate > 10 || stuckTransactions > 0) {
      return { status: 'degraded' as const, label: 'Degraded', variant: 'secondary' as const };
    }
    return { status: 'healthy' as const, label: 'Healthy', variant: 'default' as const };
  }, [bridgeStatus, bridgeLoading, bridgeError]);

  const isLoading = vaultLoading || bridgeLoading || revenueLoading;
  const hasError = vaultError || bridgeError || revenueError;

  // FIXED: Loading state uses same grid layout to prevent layout shifts
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">System Monitoring</h2>
          <p className="text-muted-foreground mt-1">
            Real-time testnet metrics and operational health
          </p>
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Vault Metrics Skeleton */}
          <Card data-testid="card-vault-metrics">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Skeleton className="h-3 w-24 mb-1" />
                <Skeleton className="h-9 w-32" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
              <div className="pt-3 border-t space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </CardContent>
          </Card>

          {/* Bridge Status Skeleton */}
          <Card data-testid="card-bridge-status">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <div className="pt-3 border-t">
                <Skeleton className="h-6 w-full" />
              </div>
            </CardContent>
          </Card>

          {/* System Health Skeleton */}
          <Card data-testid="card-system-health">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-5 w-full" />
              <div className="pt-3 border-t space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-2xl font-bold">System Monitoring</h2>
        <p className="text-muted-foreground mt-1">
          Real-time testnet metrics and operational health
        </p>
      </div>

      {/* Error State */}
      {hasError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Unable to load monitoring data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please check your connection and try again
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Cards Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Vault Metrics Card */}
        <Card data-testid="card-vault-metrics">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Vault Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vaultMetrics ? (
              <>
                {/* TVL - Large and prominent */}
                <div data-testid="vault-tvl">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Total Value Locked
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-primary" data-testid="text-tvl-value">
                    {formatCurrency(vaultMetrics.tvl)}
                  </div>
                </div>

                {/* APY - FIXED: using apy instead of avgApy */}
                <div className="flex items-center justify-between" data-testid="vault-apy">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-chart-2" />
                    <span className="text-sm font-medium">Average APY</span>
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums" data-testid="text-apy-value">
                    {vaultMetrics.apy?.toFixed(2) ?? '0.00'}%
                  </span>
                </div>

                {/* Active Users */}
                <div className="flex items-center justify-between" data-testid="vault-active-users">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Active Users</span>
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums" data-testid="text-active-users-value">
                    {formatNumber(vaultMetrics.activeUsers)}
                  </span>
                </div>

                {/* Deposits/Withdrawals */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm" data-testid="vault-deposits">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-chart-2" />
                      <span className="text-muted-foreground">Total Deposits</span>
                    </div>
                    <span className="font-mono tabular-nums" data-testid="text-deposits-value">
                      {formatCurrency(vaultMetrics.totalDeposits)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm" data-testid="vault-withdrawals">
                    <div className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Total Withdrawals</span>
                    </div>
                    <span className="font-mono tabular-nums" data-testid="text-withdrawals-value">
                      {formatCurrency(vaultMetrics.totalWithdrawals)}
                    </span>
                  </div>
                </div>

                {/* Staking Adoption */}
                <div className="pt-3 border-t space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Staking Adoption
                  </div>
                  <div className="flex items-center justify-between text-sm" data-testid="staking-total-stakers">
                    <span className="text-muted-foreground">Total Stakers</span>
                    <span className="font-mono tabular-nums font-medium" data-testid="text-total-stakers-value">
                      {formatNumber(vaultMetrics.stakingAdoption?.totalStakers)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm" data-testid="staking-avg-boost">
                    <span className="text-muted-foreground">Avg Boost</span>
                    <span className="font-mono tabular-nums font-medium" data-testid="text-avg-boost-value">
                      {vaultMetrics.stakingAdoption?.avgBoostPercentage?.toFixed(2) ?? '0.00'}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Bridge Status Card */}
        <Card data-testid="card-bridge-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              Bridge Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bridgeStatus ? (
              <>
                {/* Pending Operations */}
                <div className="flex items-center justify-between" data-testid="bridge-pending-ops">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Pending Operations</span>
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums" data-testid="text-pending-ops-value">
                    {formatNumber(bridgeStatus.pendingOperations)}
                  </span>
                </div>

                {/* Average Redemption Time */}
                <div className="flex items-center justify-between" data-testid="bridge-redemption-time">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Avg Redemption Time</span>
                  </div>
                  <span className="text-lg font-bold font-mono tabular-nums" data-testid="text-redemption-time-value">
                    {formatDuration(bridgeStatus.avgRedemptionTime)}
                  </span>
                </div>

                {/* Stuck Transactions - Highlight if > 0 */}
                <div className="flex items-center justify-between" data-testid="bridge-stuck-txs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${bridgeStatus.stuckTransactions > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">Stuck Transactions</span>
                  </div>
                  <span className={`text-lg font-bold font-mono tabular-nums ${bridgeStatus.stuckTransactions > 0 ? 'text-warning' : ''}`} data-testid="text-stuck-txs-value">
                    {formatNumber(bridgeStatus.stuckTransactions)}
                  </span>
                </div>

                {/* Failure Rate - Highlight if > 10% */}
                <div className="flex items-center justify-between" data-testid="bridge-failure-rate">
                  <div className="flex items-center gap-2">
                    <XCircle className={`h-4 w-4 ${bridgeStatus.failureRate > 10 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">Failure Rate</span>
                  </div>
                  <span className={`text-lg font-bold font-mono tabular-nums ${bridgeStatus.failureRate > 10 ? 'text-destructive' : ''}`} data-testid="text-failure-rate-value">
                    {bridgeStatus.failureRate?.toFixed(2) ?? '0.00'}%
                  </span>
                </div>

                {/* Successful Bridges (24h) */}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between" data-testid="bridge-successful-24h">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-chart-2" />
                      <span className="text-sm font-medium">Successful (24h)</span>
                    </div>
                    <span className="text-lg font-bold font-mono tabular-nums text-chart-2" data-testid="text-successful-24h-value">
                      {formatNumber(bridgeStatus.successfulBridges24h)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* System Health Card */}
        <Card data-testid="card-system-health">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall Status Badge */}
            <div data-testid="system-overall-status">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                Overall Status
              </div>
              <Badge 
                variant={systemHealth.variant} 
                className="text-base px-4 py-1.5"
                data-testid="badge-system-health"
              >
                {systemHealth.status === 'healthy' && <CheckCircle className="h-4 w-4 mr-1.5" />}
                {systemHealth.status === 'degraded' && <AlertTriangle className="h-4 w-4 mr-1.5" />}
                {systemHealth.status === 'critical' && <XCircle className="h-4 w-4 mr-1.5" />}
                {systemHealth.label}
              </Badge>
            </div>

            {/* RPC Status */}
            <div className="flex items-center justify-between" data-testid="system-rpc-status">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-chart-2" />
                <span className="text-sm font-medium">RPC Status</span>
              </div>
              <Badge variant="default" className="bg-chart-2 text-white" data-testid="badge-rpc-status">
                <CheckCircle className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>

            {/* Last Update */}
            <div className="flex items-center justify-between text-sm" data-testid="system-last-update">
              <span className="text-muted-foreground">Last Update</span>
              <span className="font-mono tabular-nums" data-testid="text-last-update-value">
                {new Date().toLocaleTimeString()}
              </span>
            </div>

            {/* Quick Metrics - FIXED: Added null guard for failureRate */}
            {bridgeStatus && (
              <div className="pt-3 border-t space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quick Metrics
                </div>
                <div className="flex items-center justify-between text-sm" data-testid="system-success-rate">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-mono tabular-nums font-medium text-chart-2" data-testid="text-success-rate-value">
                    {(100 - (bridgeStatus.failureRate ?? 0)).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm" data-testid="system-pending-ops">
                  <span className="text-muted-foreground">Pending Ops</span>
                  <span className="font-mono tabular-nums font-medium" data-testid="text-pending-ops-quick-value">
                    {formatNumber(bridgeStatus.pendingOperations)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
