import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Percent, Users, Vault, Flame, Info } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { MultiAssetIcon } from "@/components/AssetIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import MonitoringDashboard from "@/components/MonitoringDashboard";

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

export default function Analytics() {
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track protocol performance and vault metrics
        </p>
      </div>

      {/* Revenue Transparency Hero Section - Convex Style */}
      <div className="space-y-6">
        {/* Main Hero Card with Massive Numbers */}
        <Card className="bg-shield-dark border-primary/20 backdrop-blur-md overflow-hidden">
          <CardContent className="p-8 md:p-12">
            {revenueLoading ? (
              <div className="space-y-8">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-8 text-center">
                {/* Total Platform Revenue */}
                <div data-testid="revenue-hero-platform-revenue">
                  <div className="text-base font-semibold text-muted-foreground-light uppercase tracking-wide mb-2 flex items-center justify-center gap-2">
                    Total Platform Revenue Generated
                    <button
                      type="button"
                      onClick={() => setRevenueModalOpen(true)}
                      className="hover-elevate active-elevate-2 rounded-full p-1 transition-all"
                      data-testid="button-revenue-info"
                      aria-label="View revenue breakdown"
                    >
                      <Info className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                  <div className="text-5xl md:text-6xl lg:text-7xl font-bold font-mono tabular-nums text-primary">
                    ${(parseFloat(revenueData?.totalFeesCollected || "0") / 1000000).toFixed(2)}m
                  </div>
                </div>

                {/* Total SHIELD Burned */}
                <div data-testid="revenue-hero-shield-burned">
                  <div className="text-base font-semibold text-muted-foreground-light uppercase tracking-wide mb-2">
                    Total $SHIELD Burned Forever
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Flame className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                    <div className="text-5xl md:text-6xl lg:text-7xl font-bold font-mono tabular-nums text-shield-foreground">
                      {parseFloat(revenueData?.totalShieldBurned || "0").toLocaleString()}
                    </div>
                    <span className="text-3xl md:text-4xl font-bold text-primary">$SHIELD</span>
                  </div>
                  <div className="text-lg md:text-xl text-primary/80 font-medium mt-2">
                    (${(parseFloat(revenueData?.totalShieldBurnedUsd || "0") / 1000).toFixed(1)}k)
                  </div>
                </div>

                {/* Extra Yield Distributed */}
                <div data-testid="revenue-hero-extra-yield">
                  <div className="text-base font-semibold text-muted-foreground-light uppercase tracking-wide mb-2">
                    Extra Yield Distributed to Stakers
                  </div>
                  <div className="text-5xl md:text-6xl lg:text-7xl font-bold font-mono tabular-nums text-primary">
                    ${(parseFloat(revenueData?.extraYieldDistributed || "0") / 1000000).toFixed(2)}m
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Three Breakdown Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Total Fees Collected */}
          <Card className="bg-card/50 backdrop-blur-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-base font-medium text-foreground">
                Total Fees Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums" data-testid="revenue-fees-collected">
                  ${(parseFloat(revenueData?.totalFeesCollected || "0") / 1000000).toFixed(2)}m
                </div>
              )}
            </CardContent>
          </Card>

          {/* Burned Amount */}
          <Card className="bg-card/50 backdrop-blur-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-base font-medium text-foreground">
                Burned: 50% of Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div data-testid="revenue-burned-amount">
                  <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums flex items-center gap-2">
                    <Flame className="h-6 w-6 text-primary" />
                    ${(parseFloat(revenueData?.burnedAmountUsd || "0") / 1000000).toFixed(2)}m
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    → $SHIELD Burned Forever
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extra Yield Paid */}
          <Card className="bg-card/50 backdrop-blur-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-base font-medium text-foreground">
                Extra Yield Paid to Stakers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums" data-testid="revenue-extra-yield-paid">
                  ${(parseFloat(revenueData?.extraYieldDistributed || "0") / 1000000).toFixed(2)}m
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Monitoring Dashboard */}
      <MonitoringDashboard />

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
        <DialogContent className="max-w-2xl bg-shield-dark border-primary/20 backdrop-blur-md" aria-describedby="revenue-breakdown-description">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary">
              How SHIELD Creates Value for Users
            </DialogTitle>
            <DialogDescription id="revenue-breakdown-description" className="sr-only">
              Detailed breakdown of Shield Finance's revenue distribution model, including platform fees, buyback-burn mechanism, protocol reserves, and staking boost rewards
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4" data-testid="revenue-breakdown-modal">
            {/* Platform Fees */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-shield-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Platform Fees Collected
              </h3>
              <p className="text-sm text-muted-foreground-light">
                Shield Finance charges a minimal 0.2% fee on deposits and withdrawals to the shXRP vault.
              </p>
              <div className="bg-primary/5 rounded-md p-4 border border-primary/10 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground-light">Total Fees Collected</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-primary">
                    ${(parseFloat(revenueData?.totalFeesCollected || "0") / 1000000).toFixed(2)}m
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue Split */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-shield-foreground flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                Revenue Distribution (50/50 Split)
              </h3>
              <p className="text-sm text-muted-foreground-light">
                100% of platform fees are distributed to create ecosystem value:
              </p>
              <div className="grid gap-3 mt-3">
                <div className="bg-primary/5 rounded-md p-4 border border-primary/10 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground-light">50% Buyback & Burn</span>
                    </div>
                    <span className="text-lg font-bold font-mono tabular-nums text-primary">
                      ${(parseFloat(revenueData?.burnedAmountUsd || "0") / 1000000).toFixed(2)}m
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground-light">
                    Swapped to $SHIELD via SparkDEX V3 and burned forever, creating deflationary pressure
                  </p>
                </div>
                <div className="bg-primary/5 rounded-md p-4 border border-primary/10 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Vault className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground-light">50% Protocol Reserves</span>
                    </div>
                    <span className="text-lg font-bold font-mono tabular-nums text-primary">
                      ${(parseFloat(revenueData?.totalFeesCollected || "0") / 2000000).toFixed(2)}m
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground-light">
                    Accumulated for protocol development, security audits, and future expansions
                  </p>
                </div>
              </div>
            </div>

            {/* Staking Boost Extra Yield */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-shield-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Staking Boost Extra Yield
              </h3>
              <p className="text-sm text-muted-foreground-light">
                Users who stake 100+ $SHIELD tokens receive bonus APY on their shXRP positions (+1% per 100 SHIELD).
              </p>
              <div className="bg-primary/5 rounded-md p-4 border border-primary/10 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground-light">Extra Yield Distributed</span>
                  <span className="text-xl font-bold font-mono tabular-nums text-primary">
                    ${(parseFloat(revenueData?.extraYieldDistributed || "0") / 1000000).toFixed(2)}m
                  </span>
                </div>
                <p className="text-xs text-muted-foreground-light mt-2">
                  This additional yield is paid directly to SHIELD stakers on top of their base shXRP APY
                </p>
              </div>
            </div>

            {/* Total Ecosystem Value */}
            <div className="border-t border-primary/20 pt-4">
              <div className="bg-primary/5 rounded-md p-4 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground-light">Total SHIELD Tokens Burned</div>
                    <p className="text-xs text-muted-foreground-light mt-1">Permanently removed from supply</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono tabular-nums text-shield-foreground flex items-center gap-2">
                      <Flame className="h-6 w-6 text-primary" />
                      {parseFloat(revenueData?.totalShieldBurned || "0").toLocaleString()}
                    </div>
                    <div className="text-sm text-primary/80">
                      ${(parseFloat(revenueData?.totalShieldBurnedUsd || "0") / 1000).toFixed(1)}k USD
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
