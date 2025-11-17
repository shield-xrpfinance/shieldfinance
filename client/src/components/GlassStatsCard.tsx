import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface GlassStatsCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  change?: {
    value: number;
    positive: boolean;
  };
}

export default function GlassStatsCard({ label, value, icon, change }: GlassStatsCardProps) {
  return (
    <div className="relative rounded-2xl border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 overflow-hidden hover-elevate transition-all duration-200">
      {/* Glowing Icon */}
      <div className="absolute top-6 left-6 rounded-xl bg-primary/20 p-4 backdrop-blur-sm">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl" />
          <div className="relative text-primary">
            {icon}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-24 space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-4xl font-bold tabular-nums" data-testid={`stats-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </p>
        {change && (
          <div className="flex items-center gap-1 pt-1">
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
    </div>
  );
}
