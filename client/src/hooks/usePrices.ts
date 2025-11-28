/**
 * usePrices Hook - Centralized Token Price Fetching
 * 
 * Uses backend PriceService API instead of direct FTSO calls.
 * Benefits:
 * - Single source of truth for prices
 * - Proper caching and fallback handling on server
 * - Reduces frontend RPC calls
 * - Works correctly on testnet
 */

import { useQuery } from "@tanstack/react-query";

interface PricesResponse {
  success: boolean;
  prices: {
    [symbol: string]: number;
  };
  timestamp: number;
  source: string;
}

interface PriceInfo {
  success: boolean;
  symbol: string;
  price: number;
  source: string;
  timestamp: number;
}

const DEFAULT_SYMBOLS = ['XRP', 'FLR', 'FXRP', 'SHIELD', 'shXRP'];

/**
 * Hook to get multiple token prices from backend
 * @param symbols Array of token symbols to fetch
 * @param refreshInterval Refresh interval in milliseconds (default 30s)
 */
export function usePrices(
  symbols: string[] = DEFAULT_SYMBOLS,
  refreshInterval: number = 30000
) {
  return useQuery<PricesResponse>({
    queryKey: ['/api/prices', symbols.sort().join(',')],
    queryFn: async () => {
      const response = await fetch(`/api/prices?symbols=${symbols.join(',')}`);
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      return response.json();
    },
    refetchInterval: refreshInterval,
    staleTime: refreshInterval / 2,
    retry: 3,
  });
}

/**
 * Hook to get a single token price
 * @param symbol Token symbol (e.g., "XRP", "FLR")
 */
export function usePrice(symbol: string) {
  return useQuery<PriceInfo>({
    queryKey: ['/api/prices', symbol.toUpperCase()],
    queryFn: async () => {
      const response = await fetch(`/api/prices/${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price for ${symbol}`);
      }
      return response.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 3,
    enabled: !!symbol,
  });
}

/**
 * Helper to format prices with proper decimals
 */
export function formatPrice(price: number | undefined, decimals: number = 2): string {
  if (price === undefined || price === null) return '$0.00';
  
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }
  
  if (price >= 1) {
    return `$${price.toFixed(decimals)}`;
  }
  
  // For very small prices, show more decimals
  return `$${price.toFixed(Math.max(4, decimals))}`;
}

/**
 * Calculate USD value from token amount and price
 */
export function calculateUsdValue(amount: number | string, price: number): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || !price) return 0;
  return numAmount * price;
}
