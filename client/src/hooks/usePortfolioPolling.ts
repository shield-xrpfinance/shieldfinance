import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePortfolioPolling(
  hasActiveWithdrawals: boolean,
  walletAddress: string | null | undefined
) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!hasActiveWithdrawals || !walletAddress) return;
    
    // Poll every 5 seconds while there are active withdrawals
    // Note: TanStack Query automatically deduplicates refetches, so if a query
    // is already fetching, this invalidation will be queued and executed once complete
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/positions', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', walletAddress] });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [hasActiveWithdrawals, walletAddress, queryClient]);
}
