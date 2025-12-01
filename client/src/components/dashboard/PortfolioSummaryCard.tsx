import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TOOLTIP_CONTENT } from "@/lib/tooltipCopy";
import { useUserDashboard, formatUsdValue, formatPercentage } from "@/hooks/useUserDashboard";
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

function ApySection({
  baseApy,
  effectiveApy,
  boostPercentage,
  isLoading,
}: {
  baseApy: number;
  effectiveApy: number;
  boostPercentage: number;
  isLoading?: boolean;
}) {
  return (
    <Card data-testid="card-apy-section">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Yield Performance</CardTitle>
        {!isLoading && boostPercentage > 0 && (
          <Badge variant="default" data-testid="badge-boost">
            +{formatPercentage(boostPercentage, 0)} Boost
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-muted-foreground">Base APY</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="button-base-apy-info"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="More info about Base APY"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{TOOLTIP_CONTENT.apy.base}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p
                className="text-2xl font-semibold font-mono tabular-nums"
                data-testid="text-base-apy"
              >
                {formatPercentage(baseApy)}
              </p>
            )}
          </div>
          <div className="hidden sm:block h-12 w-px bg-border" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-muted-foreground">Effective APY</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="button-effective-apy-info"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="More info about Effective APY"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{TOOLTIP_CONTENT.apy.effective}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p
                className="text-2xl font-semibold font-mono tabular-nums text-chart-2"
                data-testid="text-effective-apy"
              >
                {formatPercentage(effectiveApy)}
              </p>
            )}
          </div>
          {boostPercentage > 0 && (
            <>
              <div className="hidden sm:block h-12 w-px bg-border" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-muted-foreground">APY Boost</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-testid="button-apy-boost-info"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="More info about APY Boost"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{TOOLTIP_CONTENT.shield.boostEffect}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-chart-2" />
                    <p
                      className="text-2xl font-semibold font-mono tabular-nums text-chart-2"
                      data-testid="text-boost-percentage"
                    >
                      +{formatPercentage(boostPercentage)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
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

      <ApySection
        baseApy={summary?.baseApy ?? 0}
        effectiveApy={summary?.effectiveApy ?? 0}
        boostPercentage={summary?.boostPercentage ?? 0}
        isLoading={isLoading}
      />
    </div>
  );
}

export default PortfolioSummaryCard;
