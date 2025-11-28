/**
 * PositionService - Reconciles database positions with on-chain shXRP balances
 * 
 * This service:
 * 1. Fetches user positions from database
 * 2. Verifies on-chain shXRP balance from vault contract
 * 3. Calculates real-time USD values using PriceService (asset-specific)
 * 4. Returns enriched position data with verification status
 * 5. Includes pending bridges as "pending positions" for unified lifecycle tracking
 * 
 * IMPORTANT: For EVM wallets with FXRP vault positions:
 * - The on-chain balance represents TOTAL vault shares for the wallet
 * - When multiple FXRP positions exist, we compare total DB amounts to on-chain balance
 * - Individual position discrepancies are not meaningful (shares are fungible)
 */

import { ethers } from "ethers";
import { storage } from "../storage";
import { getPriceService } from "./PriceService";
import { getVaultAddress, getProvider } from "./VaultDataService";
import { ERC4626_ABI } from "@shared/flare-abis";
import type { Position } from "@shared/schema";

// Position lifecycle stages that combine bridge and vault states
export type PositionLifecycleStage = 
  | "signing"
  | "awaiting_payment"
  | "bridging"
  | "minting"
  | "earning"
  | "failed"
  | "cancelled";

/**
 * Maps bridge status to unified position lifecycle stage
 */
export function mapBridgeStatusToLifecycleStage(bridgeStatus: string): PositionLifecycleStage {
  switch (bridgeStatus) {
    case "pending":
    case "reserving_collateral":
      return "signing";
    case "awaiting_payment":
      return "awaiting_payment";
    case "bridging":
    case "xrpl_confirmed":
    case "generating_proof":
    case "fdc_timeout":
    case "proof_generated":
    case "fdc_proof_generated":
      return "bridging";
    case "minting":
    case "vault_minting":
      return "minting";
    case "vault_minted":
    case "completed":
      return "earning";
    case "vault_mint_failed":
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "bridging";
  }
}

/**
 * Calculate progress percentage for a bridge operation
 */
export function calculateBridgeProgress(bridgeStatus: string): number {
  const progressMap: Record<string, number> = {
    "pending": 5,
    "reserving_collateral": 10,
    "awaiting_payment": 15,
    "bridging": 20,
    "xrpl_confirmed": 40,
    "generating_proof": 50,
    "fdc_timeout": 55,
    "proof_generated": 60,
    "fdc_proof_generated": 70,
    "minting": 80,
    "vault_minting": 90,
    "vault_minted": 100,
    "completed": 100,
    "vault_mint_failed": 0,
    "failed": 0,
    "cancelled": 0,
  };
  return progressMap[bridgeStatus] ?? 25;
}

interface EnrichedPosition extends Position {
  onChainBalance: string;
  // balanceVerified tri-state:
  // - true: on-chain verification succeeded (FXRP vault)
  // - false: on-chain verification failed (FXRP vault)
  // - null: verification not applicable (XRPL positions, non-FXRP EVM vaults)
  balanceVerified: boolean | null;
  discrepancy: string | null;
  usdValue: number;
  rewards: string;
  rewardsUsd: number;
  vault: {
    name: string;
    asset: string;
    apy: string;
  } | null;
  // Unified lifecycle tracking
  lifecycleStage: PositionLifecycleStage;
  progress: number; // 0-100
}

// Health metric for position/bridge status
interface PositionHealthMetric {
  label: string;
  value: string;
  status: "success" | "pending" | "error" | "neutral";
  txHash?: string;
}

// Pending activity represents an in-progress bridge that will become a position
interface PendingActivity {
  id: string;
  type: "bridge";
  walletAddress: string;
  vaultId: string | null;
  amount: string;
  fxrpExpected: string;
  usdValue: number;
  lifecycleStage: PositionLifecycleStage;
  progress: number;
  bridgeStatus: string;
  createdAt: string;
  errorMessage?: string;
  xrplTxHash?: string;
  flareTxHash?: string;
  metrics: PositionHealthMetric[];
  vault: {
    name: string;
    asset: string;
    apy: string;
  } | null;
}

interface PositionSummary {
  positions: EnrichedPosition[];
  pendingActivities: PendingActivity[];
  totalValue: number;
  totalRewards: number;
  totalRewardsUsd: number;
  onChainTotalBalance: string;
  onChainVerified: boolean;
  totalDbFxrpBalance: string;
  lastUpdated: number;
}

class PositionService {
  private cache: Map<string, { data: PositionSummary; timestamp: number }> = new Map();
  private cacheTTL = 15000; // 15 second cache

  async getEnrichedPositions(walletAddress: string): Promise<PositionSummary> {
    const cacheKey = walletAddress.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const summary = await this.fetchEnrichedPositions(walletAddress);
    this.cache.set(cacheKey, { data: summary, timestamp: Date.now() });
    return summary;
  }

  private async fetchEnrichedPositions(walletAddress: string): Promise<PositionSummary> {
    const positions = await storage.getPositions(walletAddress);
    const priceService = getPriceService();
    
    // Get prices for all relevant assets
    const prices: Record<string, number> = {};
    try {
      if (!priceService.isReady()) {
        await priceService.initialize();
      }
      // Fetch prices for common assets
      prices['XRP'] = await priceService.getPrice('XRP');
      prices['FXRP'] = prices['XRP']; // FXRP tracks XRP price
      prices['FLR'] = await priceService.getPrice('FLR');
    } catch (error) {
      console.warn('Failed to get prices for positions:', error);
    }

    // Fetch on-chain shXRP balance for EVM wallets
    let onChainBalance = "0";
    let onChainVerified = false;
    const isEvmWallet = walletAddress.startsWith("0x");
    
    if (isEvmWallet) {
      try {
        const provider = getProvider();
        const vaultAddress = getVaultAddress();
        
        if (provider && vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
          const vaultContract = new ethers.Contract(vaultAddress, ERC4626_ABI, provider);
          const balance = await vaultContract.balanceOf(walletAddress);
          const decimals = await vaultContract.decimals();
          onChainBalance = ethers.formatUnits(balance, decimals);
          onChainVerified = true;
        }
      } catch (error) {
        console.warn(`Failed to fetch on-chain balance for ${walletAddress}:`, error);
        onChainVerified = false;
      }
    }

    // Pre-fetch vault metadata for all positions to enable proper filtering
    const vaultInfoMap: Map<string, { name: string; asset: string; apy: string }> = new Map();
    for (const position of positions) {
      try {
        const vault = await storage.getVault(position.vaultId);
        if (vault) {
          vaultInfoMap.set(position.vaultId, {
            name: vault.name,
            asset: vault.asset,
            apy: vault.apy,
          });
        }
      } catch (e) {
        console.warn(`Failed to get vault for position ${position.id}:`, e);
      }
    }

    // Calculate total FXRP balance from database - ONLY positions in FXRP vaults
    const totalDbFxrpBalance = positions
      .filter(p => p.status === 'active')
      .reduce((sum, p) => {
        const vaultInfo = vaultInfoMap.get(p.vaultId);
        // Only sum FXRP vault positions (not all EVM positions)
        if (vaultInfo?.asset === 'FXRP') {
          return sum + (parseFloat(p.amount) || 0);
        }
        return sum;
      }, 0);

    const onChainBalanceNum = parseFloat(onChainBalance) || 0;
    
    // Calculate global discrepancy for FXRP positions combined
    let globalFxrpDiscrepancy: string | null = null;
    if (isEvmWallet && onChainVerified) {
      const diff = onChainBalanceNum - totalDbFxrpBalance;
      if (Math.abs(diff) > 0.000001) {
        globalFxrpDiscrepancy = diff > 0 ? `+${diff.toFixed(6)}` : diff.toFixed(6);
      }
    }

    const enrichedPositions: EnrichedPosition[] = positions.map((position) => {
      // Get vault info from pre-fetched map
      const vaultInfo = vaultInfoMap.get(position.vaultId) || null;

      const positionAmount = parseFloat(position.amount) || 0;
      const positionRewards = parseFloat(position.rewards) || 0;
      const asset = vaultInfo?.asset || 'XRP';
      
      // Get asset-specific price (default to XRP if unknown)
      const assetPrice = prices[asset] || prices['XRP'] || 0;
      
      // Determine if this is an FXRP vault position
      const isFxrpPosition = vaultInfo?.asset === 'FXRP';
      
      // balanceVerified:
      // - FXRP positions on EVM: true if on-chain verification succeeded
      // - Non-FXRP EVM positions: null (not applicable - different vault)
      // - XRPL positions: null (verification not supported for XRPL)
      let balanceVerifiedStatus: boolean | null = null;
      if (isFxrpPosition && isEvmWallet) {
        balanceVerifiedStatus = onChainVerified;
      }
      
      return {
        ...position,
        // For FXRP positions, show proportional on-chain balance (position's share of total)
        onChainBalance: isFxrpPosition && onChainVerified && totalDbFxrpBalance > 0
          ? ((positionAmount / totalDbFxrpBalance) * onChainBalanceNum).toFixed(6)
          : position.amount,
        // Keep null for non-FXRP positions (not applicable)
        balanceVerified: balanceVerifiedStatus,
        // Individual position discrepancy only makes sense for single-position case
        discrepancy: isFxrpPosition && onChainVerified ? globalFxrpDiscrepancy : null,
        usdValue: positionAmount * assetPrice,
        rewardsUsd: positionRewards * assetPrice,
        vault: vaultInfo,
        // Active positions are always "earning" state
        lifecycleStage: position.status === "active" ? "earning" : "cancelled",
        progress: position.status === "active" ? 100 : 0,
      };
    });

    // Fetch pending bridges for this wallet and convert to pending activities
    const pendingActivities = await this.fetchPendingActivities(walletAddress, prices, vaultInfoMap);

    // Calculate totals with proper asset prices
    const totalValue = enrichedPositions.reduce((sum, p) => sum + p.usdValue, 0);
    const totalRewards = enrichedPositions.reduce((sum, p) => sum + parseFloat(p.rewards), 0);
    const totalRewardsUsd = enrichedPositions.reduce((sum, p) => sum + p.rewardsUsd, 0);

    return {
      positions: enrichedPositions,
      pendingActivities,
      totalValue,
      totalRewards,
      totalRewardsUsd,
      onChainTotalBalance: onChainBalance,
      onChainVerified,
      totalDbFxrpBalance: totalDbFxrpBalance.toFixed(6),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Fetch pending bridges for a wallet and convert to PendingActivity format
   */
  private async fetchPendingActivities(
    walletAddress: string,
    prices: Record<string, number>,
    vaultInfoMap: Map<string, { name: string; asset: string; apy: string }>
  ): Promise<PendingActivity[]> {
    try {
      // Fetch active bridges for this wallet (pending, in-progress, not completed/cancelled/failed)
      const bridges = await storage.getBridgesByWallet(walletAddress);
      
      // Filter to only include in-progress bridges (not completed, cancelled, or failed)
      const activeBridges = bridges.filter(bridge => {
        const bridgeStatus = bridge.status;
        return bridgeStatus && 
          bridgeStatus !== "completed" && 
          bridgeStatus !== "vault_minted" && 
          bridgeStatus !== "cancelled" && 
          bridgeStatus !== "failed";
      });
      
      // Get XRP vault info for bridges
      const vaults = await storage.getVaults();
      const xrpVault = vaults.find(v => v.asset === "XRP");
      const vaultInfo = xrpVault ? {
        name: xrpVault.name,
        asset: xrpVault.asset,
        apy: xrpVault.apy,
      } : null;
      
      return activeBridges.map(bridge => {
        const xrpAmount = parseFloat(bridge.xrpAmount) || 0;
        const fxrpExpected = parseFloat(bridge.fxrpExpected) || 0;
        const assetPrice = prices['XRP'] || 0;
        const bridgeStatus = bridge.status;
        const lifecycleStage = mapBridgeStatusToLifecycleStage(bridgeStatus);
        const progress = calculateBridgeProgress(bridgeStatus);
        
        // Build health metrics based on bridge state
        const metrics: PositionHealthMetric[] = [
          {
            label: "XRP Payment",
            value: bridge.xrplTxHash ? "Confirmed" : "Pending",
            status: bridge.xrplTxHash ? "success" : "pending",
            txHash: bridge.xrplTxHash || undefined,
          },
          {
            label: "Bridge Status",
            value: bridgeStatus.replace(/_/g, " "),
            status: lifecycleStage === "failed" ? "error" : 
                   lifecycleStage === "earning" ? "success" : "pending",
          },
        ];
        
        // Add vault minting status if relevant
        if (["minting", "vault_minting", "vault_minted", "vault_mint_failed"].includes(bridgeStatus)) {
          metrics.push({
            label: "Vault Shares",
            value: bridge.vaultMintTxHash ? "Minted" : "Minting",
            status: bridge.vaultMintTxHash ? "success" : 
                   bridgeStatus === "vault_mint_failed" ? "error" : "pending",
            txHash: bridge.vaultMintTxHash || undefined,
          });
        }
        
        return {
          id: bridge.id,
          type: "bridge" as const,
          walletAddress: bridge.walletAddress,
          vaultId: bridge.vaultId || null,
          amount: xrpAmount.toFixed(6),
          fxrpExpected: fxrpExpected.toFixed(6),
          usdValue: xrpAmount * assetPrice,
          lifecycleStage,
          progress,
          bridgeStatus,
          createdAt: bridge.createdAt?.toISOString() || new Date().toISOString(),
          errorMessage: bridge.errorMessage || undefined,
          xrplTxHash: bridge.xrplTxHash || undefined,
          flareTxHash: bridge.flareTxHash || undefined,
          metrics,
          vault: vaultInfo,
        };
      });
    } catch (error) {
      // Log with more context for debugging, but don't fail the main request
      console.error('[PositionService] Failed to fetch pending activities for wallet:', walletAddress);
      console.error('[PositionService] Error details:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Reconcile a single position with on-chain data
   * Updates database if discrepancy is found (for FXRP vaults only)
   */
  async reconcilePosition(positionId: string): Promise<{
    success: boolean;
    position: Position | null;
    onChainBalance: string;
    updated: boolean;
  }> {
    const position = await storage.getPosition(positionId);
    if (!position) {
      return { success: false, position: null, onChainBalance: "0", updated: false };
    }

    // Only reconcile EVM wallets with FXRP vaults
    if (!position.walletAddress.startsWith("0x")) {
      return { success: true, position, onChainBalance: position.amount, updated: false };
    }

    try {
      const provider = getProvider();
      const vaultAddress = getVaultAddress();
      
      if (!provider || !vaultAddress) {
        return { success: false, position, onChainBalance: "0", updated: false };
      }

      const vaultContract = new ethers.Contract(vaultAddress, ERC4626_ABI, provider);
      const balance = await vaultContract.balanceOf(position.walletAddress);
      const decimals = await vaultContract.decimals();
      const onChainBalance = ethers.formatUnits(balance, decimals);

      // Check if there's a significant discrepancy (> 0.000001)
      const diff = Math.abs(parseFloat(onChainBalance) - parseFloat(position.amount));
      if (diff > 0.000001) {
        console.log(`[RECONCILE] Position ${positionId}: DB=${position.amount}, OnChain=${onChainBalance}`);
        
        // Update position with on-chain balance
        const updatedPosition = await storage.updatePosition(positionId, {
          amount: onChainBalance,
        });
        
        return { success: true, position: updatedPosition, onChainBalance, updated: true };
      }

      return { success: true, position, onChainBalance, updated: false };
    } catch (error) {
      console.error(`Failed to reconcile position ${positionId}:`, error);
      return { success: false, position, onChainBalance: "0", updated: false };
    }
  }

  /**
   * Discover positions for a wallet that exist on-chain but not in database
   * This handles cases where deposits were made but position wasn't recorded
   */
  async discoverOnChainPositions(walletAddress: string): Promise<{
    discovered: number;
    positions: Position[];
  }> {
    if (!walletAddress.startsWith("0x")) {
      return { discovered: 0, positions: [] };
    }

    try {
      const provider = getProvider();
      const vaultAddress = getVaultAddress();
      
      if (!provider || !vaultAddress) {
        return { discovered: 0, positions: [] };
      }

      const vaultContract = new ethers.Contract(vaultAddress, ERC4626_ABI, provider);
      const balance = await vaultContract.balanceOf(walletAddress);
      
      if (balance === BigInt(0)) {
        return { discovered: 0, positions: [] };
      }

      const decimals = await vaultContract.decimals();
      const balanceFormatted = ethers.formatUnits(balance, decimals);

      // Check if position exists in database
      const vaults = await storage.getVaults();
      const fxrpVault = vaults.find(v => v.asset === "FXRP");
      
      if (!fxrpVault) {
        return { discovered: 0, positions: [] };
      }

      const existingPosition = await storage.getPositionByWalletAndVault(walletAddress, fxrpVault.id);
      
      if (!existingPosition) {
        // Create new position from on-chain data
        console.log(`[DISCOVER] Found on-chain position for ${walletAddress}: ${balanceFormatted} shXRP`);
        
        const newPosition = await storage.createPosition({
          walletAddress,
          vaultId: fxrpVault.id,
          amount: balanceFormatted,
          rewards: "0",
          status: "active",
        });

        return { discovered: 1, positions: [newPosition] };
      }

      return { discovered: 0, positions: [] };
    } catch (error) {
      console.error(`Failed to discover positions for ${walletAddress}:`, error);
      return { discovered: 0, positions: [] };
    }
  }

  clearCache(walletAddress?: string) {
    if (walletAddress) {
      this.cache.delete(walletAddress.toLowerCase());
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
let positionServiceInstance: PositionService | null = null;

export function getPositionService(): PositionService {
  if (!positionServiceInstance) {
    positionServiceInstance = new PositionService();
  }
  return positionServiceInstance;
}

export { PositionService };
export type { EnrichedPosition, PositionSummary, PendingActivity, PositionHealthMetric };
