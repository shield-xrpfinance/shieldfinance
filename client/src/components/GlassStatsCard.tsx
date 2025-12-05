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
  compact?: boolean;
}

export default function GlassStatsCard({ label, value, icon, change, compact }: GlassStatsCardProps) {
  if (compact) {
    return (
      <div className="relative rounded-lg sm:rounded-xl lg:rounded-2xl border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background overflow-hidden hover-elevate transition-all duration-200 p-2.5 sm:p-3 lg:p-4">
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 lg:top-3 lg:left-3 rounded-lg bg-primary/20 backdrop-blur-sm p-1.5 sm:p-2">
          <div className="relative text-primary">
            {icon}
          </div>
        </div>

        <div className="mt-9 sm:mt-10 lg:mt-12 space-y-0.5">
          <p className="text-[9px] sm:text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-base sm:text-lg lg:text-xl font-bold tabular-nums truncate" data-testid={`stats-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-0.5 pt-0.5">
              {change.positive ? (
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-chart-2" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-destructive" />
              )}
              <span className={`text-[10px] sm:text-xs font-medium ${change.positive ? "text-chart-2" : "text-destructive"}`}>
                {change.positive ? "+" : ""}{change.value}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl sm:rounded-2xl border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background overflow-hidden hover-elevate transition-all duration-200 p-4 sm:p-6 lg:p-8">
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 lg:top-6 lg:left-6 rounded-lg sm:rounded-xl bg-primary/20 backdrop-blur-sm p-2 sm:p-3 lg:p-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-primary/30 blur-xl" />
          <div className="relative text-primary">
            {icon}
          </div>
        </div>
      </div>

      <div className="mt-14 sm:mt-16 lg:mt-24 space-y-1 sm:space-y-2">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xl sm:text-2xl lg:text-4xl font-bold tabular-nums" data-testid={`stats-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </p>
        {change && (
          <div className="flex items-center gap-1 pt-0.5 sm:pt-1">
            {change.positive ? (
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-chart-2" />
            ) : (
              <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
            )}
            <span
              className={`text-xs sm:text-sm font-medium ${
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
