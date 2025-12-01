import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";

export interface PortfolioSnapshot {
  date: string;
  totalValueUsd: number;
  stakedValueUsd: number;
  shieldStakedValueUsd: number;
  rewardsValueUsd: number;
  effectiveApy: number;
  boostPercentage: number;
}

interface PortfolioHistoryResponse {
  success: boolean;
  history: PortfolioSnapshot[];
  period: {
    from: string;
    to: string;
  };
}

export type TimeRange = "7d" | "30d" | "90d";

interface UsePortfolioHistoryOptions {
  walletAddress: string | null | undefined;
  enabled?: boolean;
}

export function usePortfolioHistory({
  walletAddress,
  enabled = true,
}: UsePortfolioHistoryOptions) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const days = useMemo(() => {
    switch (timeRange) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  }, [timeRange]);

  const query = useQuery<PortfolioHistoryResponse>({
    queryKey: ["/api/user/portfolio-history", walletAddress, days],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address required");
      }
      const response = await fetch(
        `/api/user/portfolio-history?walletAddress=${encodeURIComponent(walletAddress)}&days=${days}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch portfolio history");
      }
      return response.json();
    },
    enabled: enabled && !!walletAddress,
    staleTime: 60000,
    retry: 2,
  });

  const chartData = useMemo(() => {
    if (!query.data?.history) return [];
    return query.data.history.map((snapshot) => ({
      ...snapshot,
      displayDate: formatChartDate(snapshot.date, timeRange),
    }));
  }, [query.data?.history, timeRange]);

  const stats = useMemo(() => {
    if (!query.data?.history || query.data.history.length === 0) {
      return {
        startValue: 0,
        endValue: 0,
        change: 0,
        changePercent: 0,
        avgApy: 0,
        maxApy: 0,
        minApy: 0,
      };
    }

    const history = query.data.history;
    const startValue = history[0]?.totalValueUsd || 0;
    const endValue = history[history.length - 1]?.totalValueUsd || 0;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

    const apyValues = history.map((h) => h.effectiveApy).filter((v) => v > 0);
    const avgApy = apyValues.length > 0 
      ? apyValues.reduce((a, b) => a + b, 0) / apyValues.length 
      : 0;
    const maxApy = apyValues.length > 0 ? Math.max(...apyValues) : 0;
    const minApy = apyValues.length > 0 ? Math.min(...apyValues) : 0;

    return {
      startValue,
      endValue,
      change,
      changePercent,
      avgApy,
      maxApy,
      minApy,
    };
  }, [query.data?.history]);

  return {
    ...query,
    chartData,
    stats,
    timeRange,
    setTimeRange,
  };
}

function formatChartDate(dateStr: string, range: TimeRange): string {
  const date = new Date(dateStr);
  
  switch (range) {
    case "7d":
      return date.toLocaleDateString("en-US", { weekday: "short" });
    case "30d":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    case "90d":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    default:
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}
