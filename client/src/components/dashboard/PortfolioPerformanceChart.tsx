import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface PortfolioPerformanceChartProps {
  walletAddress: string | null | undefined;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

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

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center h-64 text-center"
      data-testid="empty-state-chart"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Wallet className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No Portfolio History</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Start depositing into vaults to track your portfolio performance over time.
      </p>
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
  const { chartData, stats, timeRange, setTimeRange, isLoading, isError } =
    usePortfolioHistory({
      walletAddress,
      enabled: !!walletAddress,
    });

  const isPositiveChange = stats.change >= 0;
  const hasData = chartData && chartData.length > 0;

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
          {hasData && (
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
      </CardHeader>
      <CardContent>
        {!hasData || isError ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioPerformanceChart;
