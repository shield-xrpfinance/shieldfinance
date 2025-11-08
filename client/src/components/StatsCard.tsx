import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  change?: {
    value: number;
    positive: boolean;
  };
  icon?: React.ReactNode;
}

export default function StatsCard({ label, value, change, icon }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {label}
            </p>
            <p className="text-4xl font-bold tracking-tight font-mono tabular-nums">
              {value}
            </p>
            {change && (
              <div className="flex items-center gap-1 mt-2">
                {change.positive ? (
                  <TrendingUp className="h-4 w-4 text-chart-2" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={`text-sm font-medium ${
                    change.positive ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {change.positive ? "+" : ""}
                  {change.value}%
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-md bg-primary/10 p-3 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
