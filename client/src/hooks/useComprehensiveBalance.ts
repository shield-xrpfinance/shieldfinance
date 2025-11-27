import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { ethers } from "ethers";
import { ERC20_ABI } from "@/lib/sparkdex";
import { useFtsoPrice } from "./useFtsoPrice";
import { getAssetAddress, getAssetDecimals, type Network } from "@shared/assetConfig";

/**
 * Comprehensive wallet balance hook
 * Fetches all token balances: FLR, WFLR, SHIELD, shXRP, XRP, FXRP, USDT
 * Includes USD values calculated from FTSO price feeds
 */
export interface ComprehensiveBalances {
  flr: string;
  wflr: string;
  shield: string;
  shxrp: string;
  xrp: string;
  fxrp: string;
  usdt: string;
  flrUsd: number;
  wflrUsd: number;
  shieldUsd: number;
  shxrpUsd: number;
  xrpUsd: number;
  fxrpUsd: number;
  usdtUsd: number;
  totalUsd: number;
  isLoading: boolean;
  error: string | null;
}

export function useComprehensiveBalance() {
  const { address, evmAddress, isConnected, isEvmConnected } = useWallet();
  const { network } = useNetwork();
  const ftsoPrices = useFtsoPrice();
  
  // Memoize the JsonRpcProvider to avoid creating new instances on every refresh
  const provider = useMemo(() => {
    try {
      const isTestnet = network === 'testnet';
      const rpcUrl = isTestnet 
        ? 'https://coston2-api.flare.network/ext/C/rpc'
        : 'https://flare-api.flare.network/ext/C/rpc';
      
      if (!rpcUrl) {
        console.error("Failed to create provider: Invalid RPC URL");
        return null;
      }
      
      return new ethers.JsonRpcProvider(rpcUrl);
    } catch (error) {
      console.error("Failed to instantiate JsonRpcProvider:", error);
      return null;
    }
  }, [network]);
  
  const [balances, setBalances] = useState<ComprehensiveBalances>({
    flr: "0",
    wflr: "0",
    shield: "0",
    shxrp: "0",
    xrp: "0",
    fxrp: "0",
    usdt: "0",
    flrUsd: 0,
    wflrUsd: 0,
    shieldUsd: 0,
    shxrpUsd: 0,
    xrpUsd: 0,
    fxrpUsd: 0,
    usdtUsd: 0,
    totalUsd: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!isConnected) {
      setBalances({
        flr: "0",
        wflr: "0",
        shield: "0",
        shxrp: "0",
        xrp: "0",
        fxrp: "0",
        usdt: "0",
        flrUsd: 0,
        wflrUsd: 0,
        shieldUsd: 0,
        shxrpUsd: 0,
        xrpUsd: 0,
        fxrpUsd: 0,
        usdtUsd: 0,
        totalUsd: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    const fetchBalances = async () => {
      setBalances(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // Check if provider instantiation failed
        if (!provider) {
          throw new Error("RPC provider not available");
        }

        const results = {
          flr: "0",
          wflr: "0",
          shield: "0",
          shxrp: "0",
          xrp: "0",
          fxrp: "0",
          usdt: "0",
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
        if (evmAddress && isEvmConnected) {
          promises.push(
            withTimeout(
              (async () => {
                try {
                  const balanceWei = await provider.getBalance(evmAddress);
                  results.flr = ethers.formatUnits(balanceWei, 18);
                } catch (err) {
                  results.flr = "0";
                }
              })(),
              5000
            ).then((result) => {
              if (result === null) {
                results.flr = "0";
              }
              return result;
            })
          );

          // 2. Fetch SHIELD token balance (ERC20) - using asset config
          const shieldAddress = getAssetAddress("SHIELD", network as Network);
          if (shieldAddress && shieldAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const shieldContract = new ethers.Contract(shieldAddress, ERC20_ABI, provider);
                    const balanceWei = await shieldContract.balanceOf(evmAddress);
                    const decimals = getAssetDecimals("SHIELD", network as Network);
                    results.shield = ethers.formatUnits(balanceWei, decimals);
                  } catch (err: any) {
                    // Handle BAD_DATA error gracefully (contract not deployed or no balance)
                    console.warn("Failed to fetch SHIELD balance:", err.message);
                    results.shield = "0";
                  }
                })(),
                5000
              ).then((result) => {
                if (result === null) {
                  results.shield = "0";
                }
                return result;
              })
            );
          }

          // 3. Fetch shXRP vault shares balance (ERC20)
          const vaultAddress = import.meta.env.VITE_SHXRP_VAULT_ADDRESS;
          if (vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const vaultContract = new ethers.Contract(vaultAddress, ERC20_ABI, provider);
                    // Query vault decimals dynamically (ERC-4626 shares inherit vault decimals)
                    const [balanceWei, decimals] = await Promise.all([
                      vaultContract.balanceOf(evmAddress),
                      vaultContract.decimals()
                    ]);
                    results.shxrp = ethers.formatUnits(balanceWei, decimals);
                  } catch (err: any) {
                    // Handle BAD_DATA error gracefully (contract not deployed or no balance)
                    results.shxrp = "0";
                  }
                })(),
                5000
              ).then((result) => {
                if (result === null) {
                  results.shxrp = "0";
                }
                return result;
              })
            );
          }

          // 3b. Fetch WFLR balance (ERC20)
          const wflrAddress = getAssetAddress("WFLR", network as Network);
          if (wflrAddress && wflrAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const wflrContract = new ethers.Contract(wflrAddress, ERC20_ABI, provider);
                    const balanceWei = await wflrContract.balanceOf(evmAddress);
                    const decimals = getAssetDecimals("WFLR", network as Network);
                    results.wflr = ethers.formatUnits(balanceWei, decimals);
                  } catch (err: any) {
                    results.wflr = "0";
                  }
                })(),
                5000
              ).then((result) => {
                if (result === null) {
                  results.wflr = "0";
                }
                return result;
              })
            );
          }

          // 3c. Fetch USDT balance (ERC20) - Stargate USDT
          const usdtAddress = getAssetAddress("USDT", network as Network);
          if (usdtAddress && usdtAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, provider);
                    const balanceWei = await usdtContract.balanceOf(evmAddress);
                    const decimals = getAssetDecimals("USDT", network as Network);
                    results.usdt = ethers.formatUnits(balanceWei, decimals);
                  } catch (err: any) {
                    results.usdt = "0";
                  }
                })(),
                5000
              ).then((result) => {
                if (result === null) {
                  results.usdt = "0";
                }
                return result;
              })
            );
          }

          // 3d. Fetch FXRP balance (ERC20) - FAssets XRP (network-aware: FXRP on mainnet, FTestXRP on testnet)
          const fxrpAddress = getAssetAddress("FXRP", network as Network);
          if (fxrpAddress && fxrpAddress !== "0x0000000000000000000000000000000000000000") {
            promises.push(
              withTimeout(
                (async () => {
                  try {
                    const fxrpContract = new ethers.Contract(fxrpAddress, ERC20_ABI, provider);
                    const balanceWei = await fxrpContract.balanceOf(evmAddress);
                    const decimals = getAssetDecimals("FXRP", network as Network);
                    results.fxrp = ethers.formatUnits(balanceWei, decimals);
                  } catch (err: any) {
                    results.fxrp = "0";
                  }
                })(),
                5000
              ).then((result) => {
                if (result === null) {
                  results.fxrp = "0";
                }
                return result;
              })
            );
          }
        }

        // 4. Fetch XRP balance (from XRPL via API)
        if (address) {
          promises.push(
            withTimeout(
              (async () => {
                try {
                  const response = await fetch(`/api/wallet/balance/${encodeURIComponent(address)}?network=${network}`);
                  if (response.ok) {
                    const data = await response.json();
                    results.xrp = data.balances?.XRP?.toString() || "0";
                  } else {
                    results.xrp = "0";
                  }
                } catch (err) {
                  results.xrp = "0";
                }
              })(),
              5000
            )
          );
        }

        // Wait for all balance fetches to complete (with timeouts guaranteed)
        await Promise.all(promises);

        // Calculate USD values using FTSO prices
        const flrUsd = parseFloat(results.flr) * ftsoPrices.flrUsd;
        const xrpUsd = parseFloat(results.xrp) * ftsoPrices.xrpUsd;
        // shXRP tracks XRP 1:1 (vault shares backed by FXRP which is backed by XRP)
        const shxrpUsd = parseFloat(results.shxrp) * ftsoPrices.xrpUsd;
        // WFLR tracks FLR 1:1
        const wflrUsd = parseFloat(results.wflr) * ftsoPrices.flrUsd;
        // FXRP tracks XRP 1:1 (FAssets wraps XRP on Flare)
        const fxrpUsd = parseFloat(results.fxrp) * ftsoPrices.xrpUsd;
        // SHIELD and USDT prices would need SparkDEX/Oracle integration - for now set to 0
        const shieldUsd = 0;
        const usdtUsd = 0;
        const totalUsd = flrUsd + xrpUsd + shxrpUsd + wflrUsd + fxrpUsd + shieldUsd + usdtUsd;

        setBalances({
          ...results,
          flrUsd,
          wflrUsd,
          shieldUsd,
          shxrpUsd,
          xrpUsd,
          fxrpUsd,
          usdtUsd,
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
  }, [address, evmAddress, isConnected, isEvmConnected, network, ftsoPrices.flrUsd, ftsoPrices.xrpUsd, ftsoPrices.lastUpdate, provider]);

  return balances;
}
