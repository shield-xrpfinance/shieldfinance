/**
 * useEnrichedPositions Hook - Fetch positions with on-chain verification
 * 
 * Uses backend PositionService API for:
 * - Database positions with on-chain balance verification
 * - Real-time USD values from PriceService
 * - Discrepancy detection for FXRP vault positions
 * - Pending bridge activities for unified position lifecycle tracking
 * 
 * Benefits:
 * - Single API call for position + price + verification data
 * - Proper caching (15s on server, 30s in React Query)
 * - Works for both EVM and XRPL wallets
 * - Shows pending deposits immediately after signing
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";

// Position lifecycle stages that combine bridge and vault states
export type PositionLifecycleStage = 
  | "signing"
  | "awaiting_payment"
  | "bridging"
  | "minting"
  | "earning"
  | "failed"
  | "cancelled";

interface VaultInfo {
  name: string;
  asset: string;
  apy: string;
}

// Health metric for position/bridge status
interface PositionHealthMetric {
  label: string;
  value: string;
  status: "success" | "pending" | "error" | "neutral";
  txHash?: string;
}

interface EnrichedPosition {
  id: string;
  walletAddress: string;
  vaultId: string;
  amount: string;
  rewards: string;
  status: string;
  createdAt: string;
  onChainBalance: string;
  // balanceVerified tri-state:
  // - true: on-chain verification succeeded (FXRP vault)
  // - false: on-chain verification failed (FXRP vault)
  // - null: verification not applicable (XRPL positions, non-FXRP EVM vaults)
  balanceVerified: boolean | null;
  discrepancy: string | null;
  usdValue: number;
  rewardsUsd: number;
  vault: VaultInfo | null;
  // Unified lifecycle tracking
  lifecycleStage: PositionLifecycleStage;
  progress: number;
}

// Pending activity represents an in-progress bridge that will become a position
interface PendingActivity {
  id: string;
  type: "bridge";
  walletAddress: string;
  vaultId: string | null;
  amount: string;
  fxrpExpected: string;
  usdValue: number;
  lifecycleStage: PositionLifecycleStage;
  progress: number;
  bridgeStatus: string;
  createdAt: string;
  errorMessage?: string;
  xrplTxHash?: string;
  flareTxHash?: string;
  metrics: PositionHealthMetric[];
  vault: VaultInfo | null;
}

interface PositionSummary {
  success: boolean;
  positions: EnrichedPosition[];
  pendingActivities: PendingActivity[];
  totalValue: number;
  totalRewards: number;
  totalRewardsUsd: number;
  onChainTotalBalance: string;
  onChainVerified: boolean;
  totalDbFxrpBalance: string;
  lastUpdated: number;
}

/**
 * Hook to get enriched positions with on-chain verification
 * @param walletAddress The wallet address to fetch positions for
 * @param options Optional configuration
 */
export function useEnrichedPositions(
  walletAddress: string | null | undefined,
  options?: {
    refreshInterval?: number;
    enabled?: boolean;
  }
) {
  const { refreshInterval = 30000, enabled = true } = options || {};
  
  return useQuery<PositionSummary>({
    queryKey: ['/api/positions/enriched', walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error('Wallet address required');
      }
      
      const response = await fetch(`/api/positions/enriched?walletAddress=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch enriched positions');
      }
      return response.json();
    },
    enabled: enabled && !!walletAddress,
    refetchInterval: refreshInterval,
    staleTime: refreshInterval / 2,
    retry: 2,
  });
}

/**
 * Hook to invalidate position cache after mutations
 */
export function useInvalidatePositions() {
  const queryClient = useQueryClient();
  
  return (walletAddress?: string) => {
    if (walletAddress) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/positions/enriched', walletAddress] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/positions', walletAddress] 
      });
    } else {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === '/api/positions/enriched' ||
          query.queryKey[0] === '/api/positions'
      });
    }
  };
}

/**
 * Format position for display in table
 */
export function formatPositionForTable(position: EnrichedPosition) {
  return {
    id: position.id,
    vaultName: position.vault?.name || 'Unknown Vault',
    asset: position.vault?.asset || 'XRP',
    depositedAmount: parseFloat(position.amount).toFixed(4),
    currentValue: `$${position.usdValue.toFixed(2)}`,
    rewards: parseFloat(position.rewards).toFixed(4),
    rewardsUsd: `$${position.rewardsUsd.toFixed(2)}`,
    apy: position.vault?.apy || '0.00',
    depositDate: new Date(position.createdAt).toLocaleDateString(),
    balanceVerified: position.balanceVerified,
    discrepancy: position.discrepancy,
    onChainBalance: position.onChainBalance,
  };
}

export type { EnrichedPosition, PositionSummary, VaultInfo, PendingActivity, PositionHealthMetric };
