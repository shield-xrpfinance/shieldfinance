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

  // Format TVL: Convert from raw value to millions
  const tvlValue = parseFloat(overview.tvl);
  const tvlFormatted = tvlValue >= 1_000_000 
    ? `$${(tvlValue / 1_000_000).toFixed(1)}M`
    : `$${tvlValue.toFixed(0)}K`;

  // Format APY: Ensure percentage format
  const apyValue = parseFloat(overview.avgApy);
  const apyFormatted = `${apyValue.toFixed(1)}%`;

  // Format Stakers: Add comma separator and + suffix
  const stakersValue = parseInt(overview.totalStakers.toString());
  const stakersFormatted = stakersValue > 0 
    ? `${(stakersValue / 1000).toFixed(1)}K+`
    : "0+";

  return {
    tvl: tvlFormatted,
    apy: apyFormatted,
    stakers: stakersFormatted,
    isLoading: false,
  };
}
