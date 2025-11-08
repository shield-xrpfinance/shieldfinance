import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Percent, Users, Vault } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const apyData = [
  { date: "Jan", stable: 4.5, high: 8.2, maximum: 12.5 },
  { date: "Feb", stable: 4.7, high: 8.5, maximum: 13.1 },
  { date: "Mar", stable: 4.6, high: 8.3, maximum: 12.8 },
  { date: "Apr", stable: 4.8, high: 8.7, maximum: 13.5 },
  { date: "May", stable: 4.9, high: 9.0, maximum: 14.2 },
  { date: "Jun", stable: 5.0, high: 9.2, maximum: 14.8 },
];

const tvlData = [
  { date: "Jan", value: 15000000 },
  { date: "Feb", value: 17000000 },
  { date: "Mar", value: 19000000 },
  { date: "Apr", value: 21000000 },
  { date: "May", value: 23000000 },
  { date: "Jun", value: 24500000 },
];

export default function Analytics() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Track protocol performance and vault metrics
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-tvl">
              $24.5M
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <TrendingUp className="h-3 w-3 text-chart-2" />
              <span className="text-chart-2 font-medium">+12.5%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-avg-apy">
              8.2%
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <TrendingUp className="h-3 w-3 text-chart-2" />
              <span className="text-chart-2 font-medium">+0.8%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vaults</CardTitle>
            <Vault className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-active-vaults">
              12
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 3 risk tiers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stakers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-total-stakers">
              3,421
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              <TrendingUp className="h-3 w-3 text-chart-2" />
              <span className="text-chart-2 font-medium">+5.2%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
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
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={apyData}>
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
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tvlData}>
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
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vault Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-chart-1" />
                  <span className="text-sm">Stable Yield Pools</span>
                </div>
                <span className="text-sm font-mono font-bold">45%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-chart-2" />
                  <span className="text-sm">High Yield Vaults</span>
                </div>
                <span className="text-sm font-mono font-bold">35%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-chart-3" />
                  <span className="text-sm">Maximum Returns</span>
                </div>
                <span className="text-sm font-mono font-bold">20%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Vaults</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">XRP Ultra High Yield</div>
                  <div className="text-xs text-muted-foreground">Maximum Returns Tier</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-chart-3">18.5%</div>
                  <div className="text-xs text-muted-foreground">APY</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Dual Asset Optimizer</div>
                  <div className="text-xs text-muted-foreground">High Yield Tier</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-chart-2">12.3%</div>
                  <div className="text-xs text-muted-foreground">APY</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Conservative Growth</div>
                  <div className="text-xs text-muted-foreground">Stable Yield Tier</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-chart-1">5.8%</div>
                  <div className="text-xs text-muted-foreground">APY</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
