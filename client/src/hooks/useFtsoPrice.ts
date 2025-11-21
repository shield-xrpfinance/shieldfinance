import { useState, useEffect } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { ethers } from "ethers";
import { getFtsoPrices, FTSO_FEED_IDS } from "@/lib/ftso";

/**
 * Hook to fetch real-time prices from FTSO (Flare Time Series Oracle)
 * Updates every 30 seconds with latest price data from 100+ data providers
 */
export interface FtsoPrices {
  flrUsd: number;
  xrpUsd: number;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
}

export function useFtsoPrice() {
  const { walletConnectProvider, isEvmConnected } = useWallet();
  const { isTestnet } = useNetwork();
  const [prices, setPrices] = useState<FtsoPrices>({
    flrUsd: 0,
    xrpUsd: 0,
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  useEffect(() => {
    if (!isEvmConnected || !walletConnectProvider) {
      setPrices({
        flrUsd: 0,
        xrpUsd: 0,
        isLoading: false,
        error: null,
        lastUpdate: null,
      });
      return;
    }

    const fetchPrices = async () => {
      try {
        setPrices(prev => ({ ...prev, isLoading: true, error: null }));

        const provider = new ethers.BrowserProvider(walletConnectProvider);
        
        // Fetch both prices at once (more efficient)
        const priceMap = await getFtsoPrices(
          provider,
          [FTSO_FEED_IDS.FLR_USD, FTSO_FEED_IDS.XRP_USD],
          isTestnet
        );

        setPrices({
          flrUsd: priceMap.get(FTSO_FEED_IDS.FLR_USD) || 0,
          xrpUsd: priceMap.get(FTSO_FEED_IDS.XRP_USD) || 0,
          isLoading: false,
          error: null,
          lastUpdate: Date.now(),
        });
      } catch (error) {
        console.error("Failed to fetch FTSO prices:", error);
        setPrices(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch prices",
        }));
      }
    };

    fetchPrices();

    // Refresh prices every 30 seconds (FTSO updates ~every 1.8 seconds)
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [walletConnectProvider, isEvmConnected, isTestnet]);

  return prices;
}
