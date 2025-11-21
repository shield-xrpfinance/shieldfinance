import { useState, useEffect } from "react";
import { useWallet } from "@/lib/walletContext";
import { ethers } from "ethers";

/**
 * Hook to fetch and monitor user's FLR balance on Flare Network
 * Returns balance in FLR (human-readable format)
 */
export function useFlrBalance() {
  const { evmAddress, walletConnectProvider, isEvmConnected } = useWallet();
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!evmAddress || !walletConnectProvider || !isEvmConnected) {
      setBalance("0");
      return;
    }

    const fetchBalance = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const provider = new ethers.BrowserProvider(walletConnectProvider);
        const balanceWei = await provider.getBalance(evmAddress);
        
        // Convert wei to FLR (18 decimals)
        const balanceFLR = ethers.formatUnits(balanceWei, 18);
        setBalance(balanceFLR);
      } catch (err) {
        console.error("Failed to fetch FLR balance:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch balance");
        setBalance("0");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [evmAddress, walletConnectProvider, isEvmConnected]);

  return { balance, isLoading, error };
}
