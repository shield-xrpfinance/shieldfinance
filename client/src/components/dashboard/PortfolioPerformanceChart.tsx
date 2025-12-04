import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { usePortfolioHistory, TimeRange } from "@/hooks/usePortfolioHistory";
import { TrendingUp, TrendingDown, Wallet, History, Clock, ArrowRightLeft } from "lucide-react";
import { AssetIcon } from "@/components/AssetIcon";
import { format } from "date-fns";
import type { AssetKey } from "@shared/assetConfig";

interface PortfolioPerformanceChartProps {
  walletAddress: string | null | undefined;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

interface PositionHistoryItem {
  id: string;
  vaultId: string;
  vaultName: string;
  vaultAsset: string;
  currentAmount: number;
  rewards: number;
  status: string;
  createdAt: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netChange: number;
  transactionCount: number;
  lastActivity: string;
}

interface PositionHistoryResponse {
  walletAddress: string;
  activePositions: PositionHistoryItem[];
  closedPositions: PositionHistoryItem[];
  totalPositions: number;
  summary: {
    totalActiveValue: number;
    totalHistoricalDeposits: number;
    totalHistoricalWithdrawals: number;
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function ChartSkeleton() {
  return (
    <div className="space-y-4" data-testid="skeleton-chart">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="flex gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-32" />
      </div>
    </div>
  );
}

function PositionHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-48 text-center"
      data-testid="empty-state-chart"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Wallet className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No Activity Yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Start depositing into vaults to track your portfolio performance and position history.
      </p>
    </div>
  );
}

function PositionCard({ position }: { position: PositionHistoryItem }) {
  const isProfit = position.netChange >= 0;
  const isClosed = position.status !== 'active' || position.currentAmount === 0;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg bg-card/50 hover-elevate transition-all"
      data-testid={`position-history-item-${position.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <AssetIcon asset={position.vaultAsset as AssetKey} size={32} />
          {isClosed && (
            <div className="absolute -bottom-1 -right-1 bg-muted rounded-full p-0.5">
              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm" data-testid={`text-vault-name-${position.id}`}>
              {position.vaultName}
            </p>
            <Badge
              variant={isClosed ? "secondary" : "default"}
              className="text-xs px-1.5 py-0"
              data-testid={`badge-status-${position.id}`}
            >
              {isClosed ? "Closed" : "Active"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{position.transactionCount} txns</span>
            <span>·</span>
            <span>{format(new Date(position.lastActivity), "MMM d")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-chart-2 font-mono">
              +{position.totalDeposited.toFixed(2)}
            </span>
            <ArrowRightLeft className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-destructive font-mono">
              -{position.totalWithdrawn.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="text-right min-w-[70px]">
          <div className="flex items-center justify-end gap-1">
            {isProfit ? (
              <TrendingUp className="h-3.5 w-3.5 text-chart-2" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={`text-sm font-medium font-mono ${isProfit ? "text-chart-2" : "text-destructive"}`}
              data-testid={`text-net-change-${position.id}`}
            >
              {isProfit ? "+" : ""}{position.netChange.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PositionHistorySectionProps {
  data: PositionHistoryResponse | undefined;
  isLoading: boolean;
  isError: boolean;
}

function PositionHistorySection({ data, isLoading, isError }: PositionHistorySectionProps) {
  const hasClosedPositions = data && data.closedPositions.length > 0;
  const hasActivePositions = data && data.activePositions.length > 0;
  const hasAnyData = hasClosedPositions || hasActivePositions;

  if (isLoading) {
    return <PositionHistorySkeleton />;
  }

  if (isError || !hasAnyData) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Position History</h4>
        </div>
        {data && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              In: <span className="font-mono text-chart-2">{data.summary.totalHistoricalDeposits.toFixed(2)}</span>
            </span>
            <span>
              Out: <span className="font-mono text-destructive">{data.summary.totalHistoricalWithdrawals.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {hasClosedPositions && data.closedPositions.map((position) => (
          <PositionCard key={position.id} position={position} />
        ))}
        {hasActivePositions && data.activePositions.map((position) => (
          <PositionCard key={position.id} position={position} />
        ))}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-popover border border-border rounded-md p-3 shadow-lg"
      data-testid="chart-tooltip"
    >
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono font-medium text-foreground">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioPerformanceChart({
  walletAddress,
}: PortfolioPerformanceChartProps) {
  const { chartData, stats, timeRange, setTimeRange, isLoading: chartLoading, isError: chartError } =
    usePortfolioHistory({
      walletAddress,
      enabled: !!walletAddress,
    });

  const { data: positionData, isLoading: positionLoading, isError: positionError } = useQuery<PositionHistoryResponse>({
    queryKey: ["/api/positions/history", walletAddress],
    enabled: !!walletAddress,
  });

  const isPositiveChange = stats.change >= 0;
  const hasChartData = chartData && chartData.length > 0;
  const hasPositionData = positionData && (positionData.activePositions.length > 0 || positionData.closedPositions.length > 0);
  const hasAnyData = hasChartData || hasPositionData;
  const isLoading = chartLoading || positionLoading;

  if (isLoading) {
    return (
      <Card data-testid="card-portfolio-performance">
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-portfolio-performance">
      <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle>Portfolio Performance</CardTitle>
          {hasChartData && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {isPositiveChange ? (
                  <TrendingUp
                    className="h-4 w-4 text-chart-2"
                    data-testid="icon-trending-up"
                  />
                ) : (
                  <TrendingDown
                    className="h-4 w-4 text-destructive"
                    data-testid="icon-trending-down"
                  />
                )}
                <span
                  className={`text-sm font-medium font-mono tabular-nums ${
                    isPositiveChange ? "text-chart-2" : "text-destructive"
                  }`}
                  data-testid="text-period-change"
                >
                  {isPositiveChange ? "+" : ""}
                  {formatCurrency(Math.abs(stats.change))} (
                  {formatPercentage(stats.changePercent)})
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Avg APY: </span>
                <span
                  className="font-mono tabular-nums text-chart-2"
                  data-testid="text-avg-apy"
                >
                  {stats.avgApy.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
        {hasChartData && (
          <div className="flex items-center gap-2">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.value}
                size="sm"
                variant={timeRange === range.value ? "default" : "outline"}
                onClick={() => setTimeRange(range.value)}
                data-testid={`button-range-${range.label.toLowerCase()}`}
                className="toggle-elevate"
                data-state={timeRange === range.value ? "on" : "off"}
              >
                {range.label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {hasChartData && (
              <>
                <div className="h-64" data-testid="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="displayDate"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => formatCurrency(value)}
                        width={60}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-sm text-muted-foreground">
                            {value}
                          </span>
                        )}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalValueUsd"
                        name="Total Portfolio"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "hsl(var(--chart-1))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="stakedValueUsd"
                        name="Staked Value"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "hsl(var(--chart-2))",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div
                  className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
                  data-testid="chart-legend-summary"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-chart-1" />
                    <span>Total Portfolio</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-chart-2 border-dashed" style={{ borderTop: '2px dashed hsl(var(--chart-2))', height: 0 }} />
                    <span>Staked Value</span>
                  </div>
                </div>
              </>
            )}

            {hasPositionData && hasChartData && <Separator />}

            <PositionHistorySection 
              data={positionData} 
              isLoading={positionLoading} 
              isError={positionError} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioPerformanceChart;
