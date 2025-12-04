import { useQuery } from "@tanstack/react-query";

export interface UserPointsData {
  walletAddress: string;
  totalPoints: number;
  tier: "bronze" | "silver" | "gold" | "diamond";
  airdropMultiplier: number;
  rank: number;
  nextTierProgress: {
    nextTier: "bronze" | "silver" | "gold" | "diamond" | null;
    pointsNeeded: number;
    progressPercent: number;
  };
  estimatedAirdrop: string;
  isOg: boolean;
}

interface UseUserPointsOptions {
  walletAddress: string | null | undefined;
  enabled?: boolean;
  refetchInterval?: number;
}

export function useUserPoints({ 
  walletAddress, 
  enabled = true,
  refetchInterval = 30000 
}: UseUserPointsOptions) {
  return useQuery<UserPointsData>({
    queryKey: ["/api/points", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address required");
      }
      const response = await fetch(`/api/points/${encodeURIComponent(walletAddress)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user points");
      }
      return response.json();
    },
    enabled: enabled && !!walletAddress,
    refetchInterval,
    staleTime: 10000,
    retry: 2,
  });
}
