import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useBridgeTracking(
  hasActiveBridges: boolean,
  walletAddress: string | null | undefined
) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!hasActiveBridges || !walletAddress) return;
    
    // Poll every 5 seconds while there are active bridges
    // Note: TanStack Query automatically deduplicates refetches, so if a query
    // is already fetching, this invalidation will be queued and executed once complete
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/bridges/wallet/${walletAddress}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/bridge-history/${walletAddress}`] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [hasActiveBridges, walletAddress, queryClient]);
}
