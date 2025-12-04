import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLTIP_CONTENT } from "@/lib/tooltipCopy";
import { useUserDashboard, formatUsdValue, formatPercentage } from "@/hooks/useUserDashboard";
import { useUserPoints } from "@/hooks/useUserPoints";
import { TrendingUp, Wallet, Zap, Info, Award } from "lucide-react";

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
  subtext?: string;
}

function MetricCard({ label, value, icon, tooltip, testId, isLoading, subtext }: MetricCardProps) {
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
              <>
                <p
                  className="text-3xl font-bold tracking-tight font-mono tabular-nums"
                  data-testid={`${testId}-value`}
                >
                  {value}
                </p>
                {subtext && (
                  <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
                )}
              </>
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

const tierColors: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  silver: "bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-slate-200",
  gold: "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300",
  diamond: "bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300",
};

export function PortfolioSummaryCard({ walletAddress }: PortfolioSummaryCardProps) {
  const { data, isLoading } = useUserDashboard({
    walletAddress,
    enabled: !!walletAddress,
  });

  const { data: pointsData, isLoading: pointsLoading } = useUserPoints({
    walletAddress,
    enabled: !!walletAddress,
  });

  const summary = data?.summary;
  const vaultValue = summary?.stakedValueUsd ?? 0;
  const shieldValue = summary?.shieldStakedValueUsd ?? 0;
  const compositionText = `${formatUsdValue(vaultValue)} in vaults • ${formatUsdValue(shieldValue)} SHIELD`;

  const tierBgColor = tierColors[pointsData?.tier || "bronze"] || tierColors.bronze;

  return (
    <div className="space-y-6" data-testid="portfolio-summary-card">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Portfolio Value with composition breakdown */}
        <MetricCard
          label="Portfolio Value"
          value={formatUsdValue(summary?.totalValueUsd ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.totalValue}
          testId="card-total-value"
          isLoading={isLoading}
          subtext={compositionText}
        />

        {/* Card 2: Earnings & APY (combined) */}
        <MetricCard
          label="Earnings & APY"
          value={formatUsdValue(summary?.rewardsValueUsd ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tooltip={TOOLTIP_CONTENT.portfolio.rewards}
          testId="card-earnings-apy"
          isLoading={isLoading}
          subtext={`${formatPercentage(summary?.effectiveApy ?? 0)} effective APY`}
        />

        {/* Card 3: Airdrop Progress */}
        {pointsData ? (
          <Card data-testid="card-airdrop-progress">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Airdrop Progress
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          data-testid="card-airdrop-progress-info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="More info about airdrop progress"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{TOOLTIP_CONTENT.airdrop.tier}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {pointsLoading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <>
                      <Badge 
                        className={`${tierBgColor} capitalize text-xs font-medium`}
                        data-testid="badge-tier"
                      >
                        {pointsData.tier} Tier
                        {pointsData.isOg && " • OG"}
                      </Badge>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {pointsData.totalPoints.toLocaleString()} / {(pointsData.totalPoints + (pointsData.nextTierProgress?.pointsNeeded || 0)).toLocaleString()} pts
                        </p>
                        <Progress 
                          value={pointsData.nextTierProgress?.progressPercent ?? 0} 
                          className="h-2"
                          data-testid="progress-tier"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <Award className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="card-airdrop-progress">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Airdrop Progress
                    </p>
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <Award className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default PortfolioSummaryCard;
