import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Percent, Users, Vault, Flame, Info, Activity, AlertTriangle, ExternalLink, Radio } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { MultiAssetIcon } from "@/components/AssetIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import MonitoringDashboard from "@/components/MonitoringDashboard";
import { useNetwork } from "@/lib/networkContext";

interface ProtocolOverview {
  tvl: string;
  avgApy: string;
  activeVaults: number;
  totalStakers: number;
}

interface ApyDataPoint {
  date: string;
  stable: number;
  high: number;
  maximum: number;
}

interface TvlDataPoint {
  date: string;
  value: number;
}

interface VaultDistribution {
  name: string;
  percentage: number;
}

interface TopVault {
  name: string;
  apy: string;
  riskLevel: string;
  asset: string;
}

interface RevenueTransparency {
  totalFeesCollected: string;
  totalShieldBurned: string;
  totalShieldBurnedUsd: string;
  extraYieldDistributed: string;
  burnedAmountUsd: string;
}

interface OnChainEvent {
  id: number;
  contractName: string;
  contractAddress: string;
  eventName: string;
  severity: 'info' | 'warning' | 'critical';
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, any>;
  timestamp: string;
  notified: boolean;
}

interface OnChainEventsSummary {
  last24Hours: {
    bySeverity: Record<string, number>;
    byContract: Record<string, number>;
    total: number;
  };
  recentCriticalEvents: OnChainEvent[];
  source?: 'database' | 'blockchain';
  currentBlock?: number;
}

interface RecentEventsResponse {
  events: OnChainEvent[];
  source?: 'database' | 'blockchain';
  currentBlock?: number;
  contractsMonitored?: string[];
}

interface MonitorStatus {
  status: 'active' | 'inactive' | 'realtime';
  isRunning: boolean;
  lastProcessedBlock: number;
  contractsMonitored: string[];
  eventsConfigured: number;
  message?: string;
}

interface AllTimeTotals {
  vault: {
    totalDeposits: string;
    totalDepositsUsd: string;
    totalWithdraws: string;
    totalWithdrawsUsd: string;
    netDeposits: string;
    netDepositsUsd: string;
    depositCount: number;
    withdrawCount: number;
    uniqueDepositors: number;
  };
  staking: {
    totalStaked: string;
    totalStakedUsd: string;
    totalUnstaked: string;
    netStaked: string;
    stakeCount: number;
    unstakeCount: number;
    uniqueStakers: number;
  };
  totals: {
    totalEvents: number;
    uniqueUsers: number;
  };
  lastUpdated: string;
}

export default function Analytics() {
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const { isTestnet } = useNetwork();

  const getExplorerUrl = (event: OnChainEvent): string => {
    const isXrplTransaction = event.contractAddress === "XRPL" || event.contractName === "BridgeRedemption";
    
    if (isXrplTransaction) {
      const baseUrl = isTestnet
        ? "https://testnet.xrpl.org/transactions"
        : "https://livenet.xrpl.org/transactions";
      return `${baseUrl}/${event.transactionHash}`;
    } else {
      const baseUrl = isTestnet
        ? "https://coston2-explorer.flare.network/tx"
        : "https://flare-explorer.flare.network/tx";
      return `${baseUrl}/${event.transactionHash}`;
    }
  };

  const getExplorerName = (event: OnChainEvent): string => {
    const isXrplTransaction = event.contractAddress === "XRPL" || event.contractName === "BridgeRedemption";
    return isXrplTransaction ? "XRPL" : "Flare";
  };

  const { data: overview, isLoading: overviewLoading } = useQuery<ProtocolOverview>({
    queryKey: ["/api/analytics/overview"],
  });

  const { data: apyHistory = [], isLoading: apyLoading } = useQuery<ApyDataPoint[]>({
    queryKey: ["/api/analytics/apy"],
  });

  const { data: tvlHistory = [], isLoading: tvlLoading } = useQuery<TvlDataPoint[]>({
    queryKey: ["/api/analytics/tvl"],
  });

  const { data: distribution = [], isLoading: distributionLoading } = useQuery<VaultDistribution[]>({
    queryKey: ["/api/analytics/distribution"],
  });

  const { data: topVaults = [], isLoading: topVaultsLoading } = useQuery<TopVault[]>({
    queryKey: ["/api/analytics/top-vaults"],
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueTransparency>({
    queryKey: ["/api/analytics/revenue-transparency"],
  });

  const { data: eventsSummary, isLoading: eventsSummaryLoading } = useQuery<OnChainEventsSummary>({
    queryKey: ["/api/analytics/on-chain-events/summary"],
    refetchInterval: 30000,
  });

  const { data: recentEvents, isLoading: recentEventsLoading } = useQuery<RecentEventsResponse>({
    queryKey: ["/api/analytics/on-chain-events"],
    refetchInterval: 30000,
  });

  const { data: monitorStatus } = useQuery<MonitorStatus>({
    queryKey: ["/api/analytics/monitor-status"],
    refetchInterval: 30000,
  });

  const { data: allTimeTotals, isLoading: allTimeTotalsLoading } = useQuery<AllTimeTotals>({
    queryKey: ["/api/analytics/all-time-totals"],
    refetchInterval: 60000,
  });

  const getRiskTierLabel = (riskLevel: string) => {
    const labels: Record<string, string> = {
      low: "Stable Yield Tier",
      medium: "High Yield Tier",
      high: "Maximum Returns Tier",
    };
    return labels[riskLevel] || "Unknown Tier";
  };

  const getChartColor = (riskLevel: string) => {
    const colors: Record<string, string> = {
      low: "hsl(var(--chart-1))",
      medium: "hsl(var(--chart-2))",
      high: "hsl(var(--chart-3))",
    };
    return colors[riskLevel] || "hsl(var(--chart-1))";
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'outline';
      default: return 'secondary';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">Protocol Analytics</h1>
          <Badge variant="outline" className="text-xs">
            Network-Wide Data
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2">
          Aggregate metrics across all users and transactions on the network (not wallet-specific)
        </p>
      </div>

      {/* Revenue Transparency Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Revenue Transparency
              <button
                type="button"
                onClick={() => setRevenueModalOpen(true)}
                className="hover-elevate active-elevate-2 rounded-full p-1 transition-all"
                data-testid="button-revenue-info"
                aria-label="View revenue breakdown"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Live on-chain data from Coston2 testnet
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Total Fees Collected */}
              <div className="p-4 rounded-md bg-muted/50" data-testid="revenue-fees-collected">
                <div className="text-sm text-muted-foreground mb-1">Total Fees Collected</div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  ${parseFloat(revenueData?.totalFeesCollected || "0").toLocaleString()}
                </div>
              </div>

              {/* SHIELD Burned */}
              <div className="p-4 rounded-md bg-muted/50" data-testid="revenue-shield-burned">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  SHIELD Burned (50%)
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {parseFloat(revenueData?.totalShieldBurned || "0").toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  ${parseFloat(revenueData?.totalShieldBurnedUsd || "0").toLocaleString()} USD
                </div>
              </div>

              {/* Extra Yield Distributed */}
              <div className="p-4 rounded-md bg-muted/50" data-testid="revenue-extra-yield">
                <div className="text-sm text-muted-foreground mb-1">Extra Yield to Stakers</div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  ${parseFloat(revenueData?.extraYieldDistributed || "0").toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All-Time Totals Section */}
      <Card data-testid="all-time-totals-panel">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              All-Time Totals
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cumulative protocol activity from all recorded events
            </p>
          </div>
          {allTimeTotals && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" data-testid="badge-total-events">
                {allTimeTotals.totals.totalEvents} events
              </Badge>
              <Badge variant="outline" data-testid="badge-unique-users">
                {allTimeTotals.totals.uniqueUsers} unique users
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {allTimeTotalsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vault Activity */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Vault className="h-4 w-4" />
                  Vault Activity
                </h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-md bg-muted/50" data-testid="total-deposits">
                    <div className="text-sm text-muted-foreground mb-1">Total Deposits</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {parseFloat(allTimeTotals?.vault.totalDeposits || "0").toLocaleString()} FXRP
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${parseFloat(allTimeTotals?.vault.totalDepositsUsd || "0").toLocaleString()} USD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="total-withdraws">
                    <div className="text-sm text-muted-foreground mb-1">Total Withdrawals</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {parseFloat(allTimeTotals?.vault.totalWithdraws || "0").toLocaleString()} FXRP
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${parseFloat(allTimeTotals?.vault.totalWithdrawsUsd || "0").toLocaleString()} USD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="net-deposits">
                    <div className="text-sm text-muted-foreground mb-1">Net Deposits</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-chart-2">
                      {parseFloat(allTimeTotals?.vault.netDeposits || "0").toLocaleString()} FXRP
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${parseFloat(allTimeTotals?.vault.netDepositsUsd || "0").toLocaleString()} USD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="unique-depositors">
                    <div className="text-sm text-muted-foreground mb-1">Unique Depositors</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {allTimeTotals?.vault.uniqueDepositors || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {allTimeTotals?.vault.depositCount || 0} deposits, {allTimeTotals?.vault.withdrawCount || 0} withdrawals
                    </div>
                  </div>
                </div>
              </div>

              {/* Staking Activity */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  SHIELD Staking Activity
                </h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-md bg-muted/50" data-testid="total-staked">
                    <div className="text-sm text-muted-foreground mb-1">Total Staked</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {parseFloat(allTimeTotals?.staking.totalStaked || "0").toLocaleString()} SHIELD
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${parseFloat(allTimeTotals?.staking.totalStakedUsd || "0").toLocaleString()} USD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="total-unstaked">
                    <div className="text-sm text-muted-foreground mb-1">Total Unstaked</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {parseFloat(allTimeTotals?.staking.totalUnstaked || "0").toLocaleString()} SHIELD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="net-staked">
                    <div className="text-sm text-muted-foreground mb-1">Net Staked</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-chart-2">
                      {parseFloat(allTimeTotals?.staking.netStaked || "0").toLocaleString()} SHIELD
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50" data-testid="unique-stakers">
                    <div className="text-sm text-muted-foreground mb-1">Unique Stakers</div>
                    <div className="text-2xl font-bold font-mono tabular-nums">
                      {allTimeTotals?.staking.uniqueStakers || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {allTimeTotals?.staking.stakeCount || 0} stakes, {allTimeTotals?.staking.unstakeCount || 0} unstakes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Monitoring Dashboard */}
      <MonitoringDashboard />

      {/* On-Chain Events Panel */}
      <Card data-testid="on-chain-events-panel">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              On-Chain Events
              {monitorStatus?.isRunning && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground font-normal">Live</span>
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time contract activity from monitored contracts
            </p>
          </div>
          {eventsSummary && eventsSummary.last24Hours.total > 0 && (
            <Badge variant="secondary" data-testid="badge-events-count">
              {eventsSummary.last24Hours.total} events (24h)
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {eventsSummaryLoading || recentEventsLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Event Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-3 rounded-md bg-muted/50">
                  <div className="text-sm text-muted-foreground">Total Events</div>
                  <div className="text-xl font-bold font-mono">
                    {eventsSummary?.last24Hours.total || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Last 24 hours</div>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    Critical
                  </div>
                  <div className="text-xl font-bold font-mono text-red-500">
                    {eventsSummary?.last24Hours.bySeverity?.critical || 0}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    Warnings
                  </div>
                  <div className="text-xl font-bold font-mono text-yellow-500">
                    {eventsSummary?.last24Hours.bySeverity?.warning || 0}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Radio className="h-3 w-3" />
                    Block
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {monitorStatus?.lastProcessedBlock?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Recent Events List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Recent Events</h4>
                  {monitorStatus?.contractsMonitored && (
                    <span className="text-xs text-muted-foreground">
                      Monitoring {monitorStatus.contractsMonitored.length} contracts
                    </span>
                  )}
                </div>
                {/* Data Source Indicator */}
                {(eventsSummary?.source || recentEvents?.source) && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {(eventsSummary?.source || recentEvents?.source) === 'blockchain' 
                        ? 'Live from Coston2' 
                        : 'From Database'}
                    </Badge>
                    {(eventsSummary?.currentBlock || recentEvents?.currentBlock) && (
                      <span className="text-xs text-muted-foreground">
                        Latest block: {(eventsSummary?.currentBlock || recentEvents?.currentBlock)?.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {recentEvents?.events && recentEvents.events.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {recentEvents.events.slice(0, 10).map((event) => (
                      <div 
                        key={event.id} 
                        className="p-3 rounded-md bg-muted/50 flex flex-wrap items-start justify-between gap-2"
                        data-testid={`event-row-${event.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Badge 
                            variant={getSeverityBadgeVariant(event.severity) as any}
                            className="text-xs uppercase"
                          >
                            {event.severity}
                          </Badge>
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {event.eventName}
                              <span className="text-muted-foreground font-normal text-xs">
                                on {event.contractName}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                              {event.blockNumber > 0 && (
                                <>
                                  <span>Block {event.blockNumber.toLocaleString()}</span>
                                  <span>|</span>
                                </>
                              )}
                              <a
                                href={getExplorerUrl(event)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-1"
                                data-testid={`link-tx-${event.id}`}
                              >
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                  {getExplorerName(event)}
                                </Badge>
                                {truncateAddress(event.transactionHash)}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(event.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No recent events detected</p>
                    <p className="text-xs mt-1">
                      {monitorStatus?.isRunning ? (
                        <>Actively monitoring {monitorStatus?.contractsMonitored?.length || 4} contracts on Coston2 testnet</>
                      ) : (
                        <>Events will appear when contract activity is detected</>
                      )}
                    </p>
                    {(eventsSummary?.currentBlock || recentEvents?.currentBlock) && (
                      <p className="text-xs mt-2 text-muted-foreground/60">
                        Scanning last 500 blocks up to #{(eventsSummary?.currentBlock || recentEvents?.currentBlock)?.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-tvl">
                  ${parseFloat(overview?.tvl || "0").toLocaleString()}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-chart-2" />
                  <span className="text-chart-2 font-medium">Protocol Total</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-avg-apy">
                  {overview?.avgApy || "0"}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all vaults
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vaults</CardTitle>
            <Vault className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-active-vaults">
                  {overview?.activeVaults || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across 3 risk tiers
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stakers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-total-stakers">
                  {overview?.totalStakers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active positions
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>APY Performance by Vault</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Historical APY trends across different vault types
          </p>
        </CardHeader>
        <CardContent>
          {apyLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={apyHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="stable"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  name="Stable Yield"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="High Yield"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="maximum"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Maximum Returns"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Value Locked Growth</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            TVL growth over the last 6 months
          </p>
        </CardHeader>
        <CardContent>
          {tvlLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={tvlHistory}>
                <defs>
                  <linearGradient id="colorTVL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => `$${(value / 1000000).toFixed(1)}M`}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#colorTVL)"
                  name="TVL"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vault Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {distributionLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {distribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full bg-chart-${index + 1}`} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-mono font-bold">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Vaults</CardTitle>
          </CardHeader>
          <CardContent>
            {topVaultsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {topVaults.map((vault, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MultiAssetIcon assets={vault.asset} size={28} />
                      <div>
                        <div className="font-medium text-sm">{vault.name}</div>
                        <div className="text-xs text-muted-foreground">{getRiskTierLabel(vault.riskLevel)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold" style={{ color: getChartColor(vault.riskLevel) }}>
                        {vault.apy}%
                      </div>
                      <div className="text-xs text-muted-foreground">APY</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown Modal */}
      <Dialog open={revenueModalOpen} onOpenChange={setRevenueModalOpen}>
        <DialogContent className="max-w-2xl" aria-describedby="revenue-breakdown-description">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              How SHIELD Creates Value
            </DialogTitle>
            <DialogDescription id="revenue-breakdown-description">
              Revenue distribution model: 50% buyback-burn, 50% reserves
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4" data-testid="revenue-breakdown-modal">
            {/* Platform Fees */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Platform Fees (0.2%)
              </h3>
              <p className="text-sm text-muted-foreground">
                Charged on deposits and withdrawals to the shXRP vault.
              </p>
              <div className="bg-muted/50 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Collected</span>
                  <span className="text-lg font-bold font-mono tabular-nums">
                    ${parseFloat(revenueData?.totalFeesCollected || "0").toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue Split */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-muted-foreground" />
                Revenue Distribution
              </h3>
              <div className="grid gap-3">
                <div className="bg-muted/50 rounded-md p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">50% Buyback & Burn</span>
                    <span className="font-bold font-mono tabular-nums">
                      ${parseFloat(revenueData?.burnedAmountUsd || "0").toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Swapped to SHIELD via SparkDEX and burned forever
                  </p>
                </div>
                <div className="bg-muted/50 rounded-md p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">50% Protocol Reserves</span>
                    <span className="font-bold font-mono tabular-nums">
                      ${(parseFloat(revenueData?.totalFeesCollected || "0") / 2).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    For development, audits, and expansion
                  </p>
                </div>
              </div>
            </div>

            {/* Staking Boost */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Staking Boost Rewards
              </h3>
              <p className="text-sm text-muted-foreground">
                SHIELD stakers receive extra yield on shXRP positions.
              </p>
              <div className="bg-muted/50 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Extra Yield Distributed</span>
                  <span className="text-lg font-bold font-mono tabular-nums">
                    ${parseFloat(revenueData?.extraYieldDistributed || "0").toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Burned */}
            <div className="border-t pt-4">
              <div className="bg-muted/50 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">SHIELD Tokens Burned</div>
                    <p className="text-xs text-muted-foreground">Permanently removed from supply</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono tabular-nums flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      {parseFloat(revenueData?.totalShieldBurned || "0").toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${parseFloat(revenueData?.totalShieldBurnedUsd || "0").toLocaleString()} USD
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
