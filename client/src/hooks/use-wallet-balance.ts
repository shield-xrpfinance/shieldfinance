import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";

export interface WalletBalances {
  address: string;
  network: string;
  balances: {
    XRP: number;
    RLUSD: number;
    USDC: number;
  };
  balancesFormatted: {
    XRP: string;
    RLUSD: string;
    USDC: string;
  };
  prices: {
    XRP: number;
    RLUSD: number;
    USDC: number;
  };
  totalUSD: string;
  error?: string;
}

export function useWalletBalances() {
  const { address, isConnected } = useWallet();
  const { network } = useNetwork();

  const { data, isLoading, error, refetch } = useQuery<WalletBalances>({
    queryKey: ["/api/wallet/balance", address, `?network=${network}`],
    enabled: isConnected && !!address,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  return {
    balances: data,
    isLoading,
    error,
    hasBalances: data && !data.error,
    refetch,
    // Helper getters for individual assets
    getBalance: (asset: "XRP" | "RLUSD" | "USDC") => data?.balances[asset] || 0,
    getBalanceFormatted: (asset: "XRP" | "RLUSD" | "USDC") => data?.balancesFormatted[asset] || "0.00",
  };
}

// Legacy hook for backwards compatibility
export function useWalletBalance() {
  const { balances, isLoading, error } = useWalletBalances();

  return {
    balance: balances ? {
      address: balances.address,
      balanceXRP: balances.balancesFormatted.XRP,
      balanceUSD: balances.totalUSD,
      xrpPriceUSD: balances.prices.XRP,
      error: balances.error
    } : undefined,
    isLoading,
    error,
    hasBalance: balances && !balances.error,
  };
}
