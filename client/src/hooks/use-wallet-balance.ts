import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";

interface WalletBalance {
  address: string;
  balanceXRP: string;
  balanceUSD: string;
  xrpPriceUSD: number;
  error?: string;
}

export function useWalletBalance() {
  const { address, isConnected } = useWallet();
  const { network } = useNetwork();

  const { data, isLoading, error } = useQuery<WalletBalance>({
    queryKey: ["/api/wallet/balance", address, `?network=${network}`],
    enabled: isConnected && !!address,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  return {
    balance: data,
    isLoading,
    error,
    hasBalance: data && !data.error,
  };
}
