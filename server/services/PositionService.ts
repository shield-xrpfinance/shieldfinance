/**
 * PositionService - Reconciles database positions with on-chain shXRP balances
 * 
 * This service:
 * 1. Fetches user positions from database
 * 2. Verifies on-chain shXRP balance from vault contract
 * 3. Calculates real-time USD values using PriceService
 * 4. Returns enriched position data with verification status
 */

import { ethers } from "ethers";
import { storage } from "../storage";
import { getPriceService } from "./PriceService";
import { getVaultAddress, getProvider } from "./VaultDataService";
import { ERC4626_ABI } from "@shared/flare-abis";
import type { Position } from "@shared/schema";

interface EnrichedPosition extends Position {
  onChainBalance: string;
  balanceVerified: boolean;
  discrepancy: string | null;
  usdValue: number;
  rewards: string;
  rewardsUsd: number;
  vault: {
    name: string;
    asset: string;
    apy: string;
  } | null;
}

interface PositionSummary {
  positions: EnrichedPosition[];
  totalValue: number;
  totalRewards: number;
  totalRewardsUsd: number;
  onChainTotalBalance: string;
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
    
    // Get XRP price for calculating USD values
    let xrpPrice = 0;
    try {
      if (!priceService.isReady()) {
        await priceService.initialize();
      }
      xrpPrice = await priceService.getPrice('XRP');
    } catch (error) {
      console.warn('Failed to get XRP price for positions:', error);
    }

    // Fetch on-chain shXRP balance for EVM wallets
    let onChainBalance = "0";
    let balanceVerified = false;
    
    if (walletAddress.startsWith("0x")) {
      try {
        const provider = getProvider();
        const vaultAddress = getVaultAddress();
        
        if (provider && vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000") {
          const vaultContract = new ethers.Contract(vaultAddress, ERC4626_ABI, provider);
          const balance = await vaultContract.balanceOf(walletAddress);
          const decimals = await vaultContract.decimals();
          onChainBalance = ethers.formatUnits(balance, decimals);
          balanceVerified = true;
        }
      } catch (error) {
        console.warn(`Failed to fetch on-chain balance for ${walletAddress}:`, error);
      }
    }

    const enrichedPositions: EnrichedPosition[] = await Promise.all(
      positions.map(async (position) => {
        // Get vault info
        let vaultInfo = null;
        try {
          const vault = await storage.getVault(position.vaultId);
          if (vault) {
            vaultInfo = {
              name: vault.name,
              asset: vault.asset,
              apy: vault.apy,
            };
          }
        } catch (e) {
          console.warn(`Failed to get vault for position ${position.id}:`, e);
        }

        const positionAmount = parseFloat(position.amount) || 0;
        const positionRewards = parseFloat(position.rewards) || 0;
        const onChainBalanceNum = parseFloat(onChainBalance) || 0;
        
        // For FXRP vaults (EVM), check discrepancy
        // For XRP vaults (XRPL), we trust the database
        let discrepancy: string | null = null;
        if (walletAddress.startsWith("0x") && vaultInfo?.asset === "FXRP") {
          const diff = onChainBalanceNum - positionAmount;
          if (Math.abs(diff) > 0.000001) {
            discrepancy = diff > 0 ? `+${diff.toFixed(6)}` : diff.toFixed(6);
          }
        }

        return {
          ...position,
          onChainBalance: walletAddress.startsWith("0x") ? onChainBalance : position.amount,
          balanceVerified,
          discrepancy,
          usdValue: positionAmount * xrpPrice,
          rewardsUsd: positionRewards * xrpPrice,
          vault: vaultInfo,
        };
      })
    );

    // Calculate totals
    const totalValue = enrichedPositions.reduce((sum, p) => sum + p.usdValue, 0);
    const totalRewards = enrichedPositions.reduce((sum, p) => sum + parseFloat(p.rewards), 0);
    const totalRewardsUsd = totalRewards * xrpPrice;

    return {
      positions: enrichedPositions,
      totalValue,
      totalRewards,
      totalRewardsUsd,
      onChainTotalBalance: onChainBalance,
      lastUpdated: Date.now(),
    };
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
export type { EnrichedPosition, PositionSummary };
