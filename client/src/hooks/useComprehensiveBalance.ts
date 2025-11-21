import { useState, useEffect } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { ethers } from "ethers";
import { ERC20_ABI } from "@/lib/sparkdex";
import { useFtsoPrice } from "./useFtsoPrice";

/**
 * Comprehensive wallet balance hook
 * Fetches all token balances: FLR, SHIELD, shXRP, and XRP
 * Includes USD values calculated from FTSO price feeds
 */
export interface ComprehensiveBalances {
  flr: string;
  shield: string;
  shxrp: string;
  xrp: string;
  flrUsd: number;
  shieldUsd: number;
  shxrpUsd: number;
  xrpUsd: number;
  totalUsd: number;
  isLoading: boolean;
  error: string | null;
}

export function useComprehensiveBalance() {
  const { address, evmAddress, walletConnectProvider, isConnected, isEvmConnected } = useWallet();
  const { network } = useNetwork();
  const ftsoPrices = useFtsoPrice();
  const [balances, setBalances] = useState<ComprehensiveBalances>({
    flr: "0",
    shield: "0",
    shxrp: "0",
    xrp: "0",
    flrUsd: 0,
    shieldUsd: 0,
    shxrpUsd: 0,
    xrpUsd: 0,
    totalUsd: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    console.log('📊 useComprehensiveBalance effect running:', {
      isConnected,
      address: address?.slice(0, 6),
      evmAddress: evmAddress?.slice(0, 6),
      isEvmConnected,
      ftsoReady: ftsoPrices.flrUsd > 0,
    });

    if (!isConnected) {
      console.log('📊 Not connected, resetting balances');
      setBalances({
        flr: "0",
        shield: "0",
        shxrp: "0",
        xrp: "0",
        flrUsd: 0,
        shieldUsd: 0,
        shxrpUsd: 0,
        xrpUsd: 0,
        totalUsd: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    const fetchBalances = async () => {
      console.log('📊 Starting fetchBalances...');
      setBalances(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const results = {
          flr: "0",
          shield: "0",
          shxrp: "0",
          xrp: "0",
        };

        // Helper function to wrap promises with timeout
        const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
          ]);
        };

        // Fetch all balances in parallel
        const promises: Promise<any>[] = [];

        // 1. Fetch FLR balance (native token on Flare)
        if (evmAddress && walletConnectProvider && isEvmConnected) {
          console.log('📊 Fetching EVM balances for:', evmAddress?.slice(0, 6));
          promises.push(
            withTimeout(
              (async () => {
                try {
                  const provider = new ethers.BrowserProvider(walletConnectProvider);
                  const balanceWei = await provider.getBalance(evmAddress);
                  results.flr = ethers.formatUnits(balanceWei, 18);
                  console.log('✅ FLR balance fetched:', results.flr);
                } catch (err) {
                  console.error("Failed to fetch FLR balance:", err);
                  results.flr = "0";
                }
              })(),
              5000
            )
          );

          // 2. Fetch SHIELD token balance (ERC20)
          const shieldAddress = import.meta.env.VITE_SHIELD_TOKEN_ADDRESS;
          if (shieldAddress && shieldAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const provider = new ethers.BrowserProvider(walletConnectProvider);
                    const shieldContract = new ethers.Contract(shieldAddress, ERC20_ABI, provider);
                    const balanceWei = await shieldContract.balanceOf(evmAddress);
                    results.shield = ethers.formatUnits(balanceWei, 18);
                    console.log('✅ SHIELD balance fetched:', results.shield);
                  } catch (err) {
                    console.error("Failed to fetch SHIELD balance:", err);
                    results.shield = "0";
                  }
                })(),
                5000
              )
            );
          }

          // 3. Fetch shXRP vault shares balance (ERC20)
          const vaultAddress = import.meta.env.VITE_SHXRP_VAULT_ADDRESS;
          if (vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const provider = new ethers.BrowserProvider(walletConnectProvider);
                    const vaultContract = new ethers.Contract(vaultAddress, ERC20_ABI, provider);
                    const balanceWei = await vaultContract.balanceOf(evmAddress);
                    results.shxrp = ethers.formatUnits(balanceWei, 18);
                    console.log('✅ shXRP balance fetched:', results.shxrp);
                  } catch (err) {
                    console.error("Failed to fetch shXRP balance:", err);
                    results.shxrp = "0";
                  }
                })(),
                5000
              )
            );
          }
        } else {
          console.log('📊 Skipping EVM balances:', { hasEvmAddress: !!evmAddress, hasProvider: !!walletConnectProvider, isEvmConnected });
        }

        // 4. Fetch XRP balance (from XRPL via API)
        if (address) {
          console.log('📊 Fetching XRP balance for:', address?.slice(0, 6));
          promises.push(
            withTimeout(
              (async () => {
                try {
                  const response = await fetch(`/api/wallet/balance/${encodeURIComponent(address)}?network=${network}`);
                  if (response.ok) {
                    const data = await response.json();
                    results.xrp = data.balances?.XRP?.toString() || "0";
                    console.log('✅ XRP balance fetched:', results.xrp);
                  } else {
                    console.error("XRP balance fetch returned non-ok status:", response.status);
                    results.xrp = "0";
                  }
                } catch (err) {
                  console.error("Failed to fetch XRP balance:", err);
                  results.xrp = "0";
                }
              })(),
              5000
            )
          );
        }

        // Wait for all balance fetches to complete (with timeouts guaranteed)
        console.log('📊 Waiting for', promises.length, 'balance fetches...');
        await Promise.all(promises);
        console.log('📊 All balances fetched:', results);

        // Calculate USD values using FTSO prices
        console.log('📊 FTSO prices available:', { flr: ftsoPrices.flrUsd, xrp: ftsoPrices.xrpUsd });
        const flrUsd = parseFloat(results.flr) * ftsoPrices.flrUsd;
        const xrpUsd = parseFloat(results.xrp) * ftsoPrices.xrpUsd;
        // shXRP tracks XRP 1:1 (vault shares backed by FXRP which is backed by XRP)
        const shxrpUsd = parseFloat(results.shxrp) * ftsoPrices.xrpUsd;
        // SHIELD price would need SparkDEX integration - for now set to 0
        const shieldUsd = 0;
        const totalUsd = flrUsd + xrpUsd + shxrpUsd + shieldUsd;

        console.log('📊 Calculated USD values:', { flrUsd, xrpUsd, shxrpUsd, shieldUsd, totalUsd });

        setBalances({
          ...results,
          flrUsd,
          shieldUsd,
          shxrpUsd,
          xrpUsd,
          totalUsd,
          isLoading: false,
          error: null,
        });
        console.log('📊 Balance state updated, isLoading set to false');
      } catch (error) {
        console.error("Failed to fetch comprehensive balances:", error);
        setBalances(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to fetch balances",
        }));
      }
    };

    fetchBalances();

    // Refresh balances every 15 seconds
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [address, evmAddress, walletConnectProvider, isConnected, isEvmConnected, network, ftsoPrices.flrUsd, ftsoPrices.xrpUsd]);

  return balances;
}
