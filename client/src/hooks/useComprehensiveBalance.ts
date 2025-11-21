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
    if (!isConnected) {
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
      setBalances(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const results = {
          flr: "0",
          shield: "0",
          shxrp: "0",
          xrp: "0",
        };

        // Fetch all balances in parallel
        const promises: Promise<void>[] = [];

        // 1. Fetch FLR balance (native token on Flare)
        if (evmAddress && walletConnectProvider && isEvmConnected) {
          promises.push(
            (async () => {
              try {
                const provider = new ethers.BrowserProvider(walletConnectProvider);
                const balanceWei = await provider.getBalance(evmAddress);
                results.flr = ethers.formatUnits(balanceWei, 18);
              } catch (err) {
                console.error("Failed to fetch FLR balance:", err);
              }
            })()
          );

          // 2. Fetch SHIELD token balance (ERC20)
          const shieldAddress = import.meta.env.VITE_SHIELD_TOKEN_ADDRESS;
          if (shieldAddress && shieldAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              (async () => {
                try {
                  const provider = new ethers.BrowserProvider(walletConnectProvider);
                  const shieldContract = new ethers.Contract(shieldAddress, ERC20_ABI, provider);
                  const balanceWei = await shieldContract.balanceOf(evmAddress);
                  results.shield = ethers.formatUnits(balanceWei, 18);
                } catch (err) {
                  console.error("Failed to fetch SHIELD balance:", err);
                }
              })()
            );
          }

          // 3. Fetch shXRP vault shares balance (ERC20)
          const vaultAddress = import.meta.env.VITE_SHXRP_VAULT_ADDRESS;
          if (vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              (async () => {
                try {
                  const provider = new ethers.BrowserProvider(walletConnectProvider);
                  const vaultContract = new ethers.Contract(vaultAddress, ERC20_ABI, provider);
                  const balanceWei = await vaultContract.balanceOf(evmAddress);
                  results.shxrp = ethers.formatUnits(balanceWei, 18);
                } catch (err) {
                  console.error("Failed to fetch shXRP balance:", err);
                }
              })()
            );
          }
        }

        // 4. Fetch XRP balance (from XRPL via API)
        if (address) {
          promises.push(
            (async () => {
              try {
                const response = await fetch(`/api/wallet/balance/${encodeURIComponent(address)}?network=${network}`);
                if (response.ok) {
                  const data = await response.json();
                  results.xrp = data.balances?.XRP?.toString() || "0";
                }
              } catch (err) {
                console.error("Failed to fetch XRP balance:", err);
              }
            })()
          );
        }

        // Wait for all balance fetches to complete
        await Promise.all(promises);

        // Calculate USD values using FTSO prices
        console.log('🔢 Calculating USD values:');
        console.log('   FTSO prices:', ftsoPrices);
        console.log('   Balances:', results);
        
        const flrUsd = parseFloat(results.flr) * ftsoPrices.flrUsd;
        const xrpUsd = parseFloat(results.xrp) * ftsoPrices.xrpUsd;
        // shXRP tracks XRP 1:1 (vault shares backed by FXRP which is backed by XRP)
        const shxrpUsd = parseFloat(results.shxrp) * ftsoPrices.xrpUsd;
        // SHIELD price would need SparkDEX integration - for now set to 0
        const shieldUsd = 0;
        const totalUsd = flrUsd + xrpUsd + shxrpUsd + shieldUsd;
        
        console.log('   USD values: FLR=$' + flrUsd.toFixed(2) + ', XRP=$' + xrpUsd.toFixed(2) + ', shXRP=$' + shxrpUsd.toFixed(2));
        console.log('   Total USD: $' + totalUsd.toFixed(2));

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
