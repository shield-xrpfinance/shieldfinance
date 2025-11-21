import { useState, useEffect } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { ethers } from "ethers";
import { ERC20_ABI } from "@/lib/sparkdex";

/**
 * Comprehensive wallet balance hook
 * Fetches all token balances: FLR, SHIELD, shXRP, and XRP
 */
export interface ComprehensiveBalances {
  flr: string;
  shield: string;
  shxrp: string;
  xrp: string;
  isLoading: boolean;
  error: string | null;
}

export function useComprehensiveBalance() {
  const { address, evmAddress, walletConnectProvider, isConnected, isEvmConnected } = useWallet();
  const { network } = useNetwork();
  const [balances, setBalances] = useState<ComprehensiveBalances>({
    flr: "0",
    shield: "0",
    shxrp: "0",
    xrp: "0",
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

        setBalances({
          ...results,
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
  }, [address, evmAddress, walletConnectProvider, isConnected, isEvmConnected, network]);

  return balances;
}
