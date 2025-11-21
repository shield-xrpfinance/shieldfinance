import { useState, useEffect } from "react";
import { useNetwork } from "@/lib/networkContext";
import { ethers } from "ethers";
import { getFtsoPrices, FTSO_FEED_IDS } from "@/lib/ftso";
import { FLARE_CONTRACTS } from "@shared/flare-contracts";

/**
 * Hook to fetch real-time prices from FTSO (Flare Time Series Oracle)
 * Uses a read-only JsonRpcProvider for oracle queries (no wallet needed)
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
  const { isTestnet } = useNetwork();
  const [prices, setPrices] = useState<FtsoPrices>({
    flrUsd: 0,
    xrpUsd: 0,
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setPrices(prev => ({ ...prev, isLoading: true, error: null }));

        console.log('🔍 useFtsoPrice: Fetching prices...');
        console.log('   isTestnet:', isTestnet);
        
        // Create read-only JsonRpcProvider for Flare network
        // No wallet needed - this is just for reading oracle data
        const rpcUrl = isTestnet 
          ? FLARE_CONTRACTS.coston2.rpcUrl 
          : FLARE_CONTRACTS.mainnet.rpcUrl;
        
        console.log('   RPC URL:', rpcUrl);
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Fetch both prices at once (more efficient)
        const priceMap = await getFtsoPrices(
          provider,
          [FTSO_FEED_IDS.FLR_USD, FTSO_FEED_IDS.XRP_USD],
          isTestnet
        );
        
        const flrUsd = priceMap.get(FTSO_FEED_IDS.FLR_USD) || 0;
        const xrpUsd = priceMap.get(FTSO_FEED_IDS.XRP_USD) || 0;
        
        console.log('✅ Price map size:', priceMap.size);
        console.log('   FLR/USD:', flrUsd);
        console.log('   XRP/USD:', xrpUsd);

        setPrices({
          flrUsd,
          xrpUsd,
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
  }, [isTestnet]);

  return prices;
}
