import { useQuery } from "@tanstack/react-query";

interface AnalyticsOverview {
  tvl: string;
  avgApy: string;
  activeVaults: number;
  totalStakers: number;
}

interface FormattedMetrics {
  tvl: string;
  apy: string;
  stakers: string;
  isLoading: boolean;
}

/**
 * Custom hook to fetch and format analytics metrics from the backend
 * Used by the landing page hero section to display live platform metrics
 */
export function useAnalyticsMetrics(): FormattedMetrics {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/analytics/overview"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const overview = data as AnalyticsOverview | undefined;

  if (isLoading || !overview) {
    return {
      tvl: "—",
      apy: "—",
      stakers: "—",
      isLoading: true,
    };
  }

  // Format TVL: Show appropriate scale based on actual value
  const tvlValue = parseFloat(overview.tvl);
  let tvlFormatted: string;
  if (tvlValue >= 1_000_000) {
    tvlFormatted = `$${(tvlValue / 1_000_000).toFixed(1)}M`;
  } else if (tvlValue >= 1_000) {
    tvlFormatted = `$${(tvlValue / 1_000).toFixed(1)}K`;
  } else {
    tvlFormatted = `$${tvlValue.toFixed(0)}`;
  }

  // Format APY: Ensure percentage format
  const apyValue = parseFloat(overview.avgApy);
  const apyFormatted = `${apyValue.toFixed(1)}%`;

  // Format Stakers: Show actual count, abbreviate only for large numbers
  const stakersValue = parseInt(overview.totalStakers.toString());
  let stakersFormatted: string;
  if (stakersValue >= 1_000_000) {
    stakersFormatted = `${(stakersValue / 1_000_000).toFixed(1)}M+`;
  } else if (stakersValue >= 1_000) {
    stakersFormatted = `${(stakersValue / 1_000).toFixed(1)}K+`;
  } else {
    stakersFormatted = `${stakersValue}`;
  }

  return {
    tvl: tvlFormatted,
    apy: apyFormatted,
    stakers: stakersFormatted,
    isLoading: false,
  };
}
