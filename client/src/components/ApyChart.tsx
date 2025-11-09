import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getTooltipContent } from "@/lib/tooltipCopy";
import { useNetwork } from "@/lib/networkContext";

interface ApyChartProps {
  data: Array<{
    date: string;
    [key: string]: number | string;
  }>;
  vaultNames: string[];
}

const timeRanges = ["7D", "30D", "90D", "All"] as const;

export default function ApyChart({ data, vaultNames }: ApyChartProps) {
  const [selectedRange, setSelectedRange] = useState<typeof timeRanges[number]>("30D");
  const { isTestnet } = useNetwork();

  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle>APY Historical Trends</CardTitle>
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" data-testid="icon-apy-chart-info" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{getTooltipContent("apy", isTestnet ? "simulated" : "historical")}</p>
            </TooltipContent>
          </UITooltip>
        </div>
        <div className="flex items-center gap-2">
          {timeRanges.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={selectedRange === range ? "default" : "outline"}
              onClick={() => setSelectedRange(range)}
              data-testid={`button-range-${range}`}
              className="toggle-elevate"
              data-state={selectedRange === range ? "on" : "off"}
            >
              {range}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              {vaultNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  name={name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
