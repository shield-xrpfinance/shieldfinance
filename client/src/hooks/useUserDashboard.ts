import { useQuery } from "@tanstack/react-query";

export interface DashboardSummary {
  totalValueUsd: number;
  stakedValueUsd: number;
  shieldStakedValueUsd: number;
  rewardsValueUsd: number;
  effectiveApy: number;
  baseApy: number;
  boostPercentage: number;
  positionCount: number;
  assetBreakdown: Record<string, number>;
}

interface DashboardSummaryResponse {
  success: boolean;
  summary: DashboardSummary;
  timestamp: number;
}

interface UseUserDashboardOptions {
  walletAddress: string | null | undefined;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useUserDashboard({
  walletAddress,
  enabled = true,
  refetchInterval = 30000,
}: UseUserDashboardOptions) {
  return useQuery<DashboardSummaryResponse>({
    queryKey: ["/api/user/dashboard-summary", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address required");
      }
      const response = await fetch(
        `/api/user/dashboard-summary?walletAddress=${encodeURIComponent(walletAddress)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard summary");
      }
      return response.json();
    },
    enabled: enabled && !!walletAddress,
    refetchInterval,
    staleTime: 10000,
    retry: 2,
  });
}

export function formatUsdValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function calculateBoostDelta(baseApy: number, effectiveApy: number): {
  delta: number;
  percentIncrease: number;
} {
  const delta = effectiveApy - baseApy;
  const percentIncrease = baseApy > 0 ? (delta / baseApy) * 100 : 0;
  return { delta, percentIncrease };
}
