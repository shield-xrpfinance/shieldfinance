import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLTIP_CONTENT } from "@/lib/tooltipCopy";
import { useUserDashboard, formatUsdValue } from "@/hooks/useUserDashboard";
import { TrendingUp, Wallet, Shield, Gift, Info } from "lucide-react";

interface PortfolioSummaryCardProps {
  walletAddress: string | null | undefined;
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tooltip: string;
  testId: string;
  isLoading?: boolean;
}

function MetricCard({ label, value, icon, tooltip, testId, isLoading }: MetricCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid={`${testId}-info`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`More info about ${label}`}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p
                className="text-3xl font-bold tracking-tight font-mono tabular-nums"
                data-testid={`${testId}-value`}
              >
                {value}
              </p>
            )}
          </div>
          <div className="rounded-md bg-primary/10 p-3 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PortfolioSummaryCard({ walletAddress }: PortfolioSummaryCardProps) {
  const { data, isLoading } = useUserDashboard({
    walletAddress,
    enabled: !!walletAddress,
  });

  const summary = data?.summary;

  return (
    <div className="space-y-6" data-testid="portfolio-summary-card">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Total Portfolio Value"
          value={formatUsdValue(summary?.totalValueUsd ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.totalValue}
          testId="card-total-value"
          isLoading={isLoading}
        />
        <MetricCard
          label="Staked Value"
          value={formatUsdValue(summary?.stakedValueUsd ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.stakedValue}
          testId="card-staked-value"
          isLoading={isLoading}
        />
        <MetricCard
          label="SHIELD Staked"
          value={formatUsdValue(summary?.shieldStakedValueUsd ?? 0)}
          icon={<Shield className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.shieldValue}
          testId="card-shield-staked"
          isLoading={isLoading}
        />
        <MetricCard
          label="Pending Rewards"
          value={formatUsdValue(summary?.rewardsValueUsd ?? 0)}
          icon={<Gift className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.rewards}
          testId="card-pending-rewards"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export default PortfolioSummaryCard;
