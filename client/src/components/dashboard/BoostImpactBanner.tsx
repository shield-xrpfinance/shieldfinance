import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TOOLTIP_CONTENT } from "@/lib/tooltipCopy";
import { useUserDashboard, formatPercentage, calculateBoostDelta } from "@/hooks/useUserDashboard";
import { Shield, ArrowRight, Zap, Info } from "lucide-react";
import { Link } from "wouter";

interface BoostImpactBannerProps {
  walletAddress: string | null | undefined;
  showCta?: boolean;
}

const MAX_BOOST_PERCENTAGE = 25;

export function BoostImpactBanner({
  walletAddress,
  showCta = true,
}: BoostImpactBannerProps) {
  const { data, isLoading } = useUserDashboard({
    walletAddress,
    enabled: !!walletAddress,
  });

  const summary = data?.summary;
  const boostPercentage = summary?.boostPercentage ?? 0;
  const baseApy = summary?.baseApy ?? 0;
  const effectiveApy = summary?.effectiveApy ?? 0;
  const isBoosted = boostPercentage > 0;
  const { delta } = calculateBoostDelta(baseApy, effectiveApy);
  const boostProgress = Math.min((boostPercentage / MAX_BOOST_PERCENTAGE) * 100, 100);

  if (isLoading) {
    return (
      <Card
        className="relative overflow-visible bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20"
        data-testid="boost-impact-banner"
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isBoosted) {
    return (
      <Card
        className="relative overflow-visible bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20"
        data-testid="boost-impact-banner"
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold" data-testid="text-banner-title">
                  Boost Your Yields with SHIELD
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-testid="button-boost-info"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Learn how boost works"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="mb-2">{TOOLTIP_CONTENT.shield.boost}</p>
                    <p className="text-xs text-muted-foreground">
                      {TOOLTIP_CONTENT.shield.boostFormula}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-banner-description">
                Stake SHIELD tokens to receive up to {MAX_BOOST_PERCENTAGE}% APY boost on all your vault deposits.
              </p>
            </div>
            {showCta && (
              <Link href="/app/staking">
                <Button data-testid="button-stake-shield">
                  <Zap className="h-4 w-4" />
                  Stake SHIELD
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="relative overflow-visible bg-gradient-to-r from-chart-2/5 via-chart-2/10 to-primary/5 border-chart-2/30"
      data-testid="boost-impact-banner"
    >
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div
            className="rounded-full bg-chart-2/20 p-3 text-chart-2 shadow-[0_0_20px_rgba(0,212,180,0.3)]"
            data-testid="icon-shield-boosted"
          >
            <Shield className="h-6 w-6" />
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold" data-testid="text-banner-title">
                SHIELD Boost Active
              </h3>
              <Badge
                variant="default"
                className="bg-chart-2 text-chart-2-foreground border-transparent"
                data-testid="badge-boost-active"
              >
                +{formatPercentage(boostPercentage, 0)} Boost
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid="button-boost-info"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Learn how boost works"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="mb-2">{TOOLTIP_CONTENT.shield.boostEffect}</p>
                  <p className="text-xs text-muted-foreground">
                    {TOOLTIP_CONTENT.apy.formula}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Base APY
                  </p>
                  <p
                    className="text-xl font-semibold font-mono tabular-nums"
                    data-testid="text-base-apy"
                  >
                    {formatPercentage(baseApy)}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Boosted APY
                  </p>
                  <div className="flex items-center gap-2">
                    <p
                      className="text-xl font-semibold font-mono tabular-nums text-chart-2"
                      data-testid="text-boosted-apy"
                    >
                      {formatPercentage(effectiveApy)}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-chart-2 border-chart-2/50"
                      data-testid="badge-apy-delta"
                    >
                      +{formatPercentage(delta)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block h-10 w-px bg-border" />

              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Boost Level
                  </p>
                  <p className="text-sm font-medium tabular-nums" data-testid="text-boost-level">
                    {formatPercentage(boostPercentage, 0)} / {MAX_BOOST_PERCENTAGE}%
                  </p>
                </div>
                <Progress
                  value={boostProgress}
                  className="h-2 bg-muted"
                  data-testid="progress-boost-level"
                />
              </div>
            </div>
          </div>

          {showCta && (
            <Link href="/app/staking">
              <Button variant="outline" data-testid="button-stake-more-shield">
                <Zap className="h-4 w-4" />
                Stake More SHIELD
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default BoostImpactBanner;
