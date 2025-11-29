import { storage } from "../storage";
import type { Vault } from "@shared/schema";

export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  riskLevel: "conservative" | "balanced" | "aggressive";
  expectedApy: number;
  allocations: Array<{
    vaultId: string;
    vaultName: string;
    asset: string;
    percentage: number;
    apy: number;
  }>;
  minInvestment: number;
  lockPeriod: number;
  tags: string[];
}

export interface MarketConditions {
  overallSentiment: "bullish" | "neutral" | "bearish";
  volatility: "low" | "medium" | "high";
  recommendedStrategy: string;
  riskScore: number;
}

class YieldOptimizerService {
  private strategies: OptimizationStrategy[] = [];
  private lastUpdate: number = 0;
  private readonly CACHE_TTL_MS = 60_000;

  async getMarketConditions(): Promise<MarketConditions> {
    const vaults = await storage.getVaults();
    const avgApy = vaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / vaults.length;
    
    let sentiment: "bullish" | "neutral" | "bearish" = "neutral";
    let volatility: "low" | "medium" | "high" = "medium";
    let recommendedStrategy = "balanced-growth";
    let riskScore = 50;
    
    if (avgApy > 12) {
      sentiment = "bullish";
      riskScore = 65;
      recommendedStrategy = "aggressive-yield";
    } else if (avgApy < 6) {
      sentiment = "bearish";
      riskScore = 35;
      recommendedStrategy = "capital-preservation";
    }

    const highRiskVaults = vaults.filter(v => v.riskLevel === "high");
    const highRiskTvl = highRiskVaults.reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    const totalTvl = vaults.reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    
    if (totalTvl > 0) {
      const highRiskRatio = highRiskTvl / totalTvl;
      if (highRiskRatio > 0.3) volatility = "high";
      else if (highRiskRatio < 0.1) volatility = "low";
    }

    return {
      overallSentiment: sentiment,
      volatility,
      recommendedStrategy,
      riskScore,
    };
  }

  async getOptimizationStrategies(): Promise<OptimizationStrategy[]> {
    const now = Date.now();
    if (this.strategies.length > 0 && (now - this.lastUpdate) < this.CACHE_TTL_MS) {
      return this.strategies;
    }

    const vaults = await storage.getVaults();
    const activeVaults = vaults.filter(v => v.status === "active" && !v.comingSoon);
    
    this.strategies = [
      this.buildConservativeStrategy(activeVaults),
      this.buildBalancedStrategy(activeVaults),
      this.buildAggressiveStrategy(activeVaults),
      this.buildStablecoinStrategy(activeVaults),
      this.buildMaxYieldStrategy(activeVaults),
    ].filter(s => s.allocations.length > 0);
    
    this.lastUpdate = now;
    return this.strategies;
  }

  private buildConservativeStrategy(vaults: Vault[]): OptimizationStrategy {
    const lowRiskVaults = vaults.filter(v => v.riskLevel === "low");
    const sortedVaults = lowRiskVaults.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    const selectedVaults = sortedVaults.slice(0, 3);
    
    const totalWeight = selectedVaults.length;
    const allocations = selectedVaults.map((v, i) => ({
      vaultId: v.id,
      vaultName: v.name,
      asset: v.asset,
      percentage: Math.round(100 / totalWeight),
      apy: parseFloat(v.apy),
    }));
    
    const expectedApy = allocations.reduce((sum, a) => sum + (a.apy * a.percentage / 100), 0);
    const maxLockPeriod = Math.max(...selectedVaults.map(v => v.lockPeriod), 0);

    return {
      id: "capital-preservation",
      name: "Capital Preservation",
      description: "Prioritize safety with low-risk vaults offering stable yields. Ideal for risk-averse investors seeking steady returns.",
      riskLevel: "conservative",
      expectedApy: parseFloat(expectedApy.toFixed(2)),
      allocations,
      minInvestment: 100,
      lockPeriod: maxLockPeriod,
      tags: ["Low Risk", "Stable", "Beginner Friendly"],
    };
  }

  private buildBalancedStrategy(vaults: Vault[]): OptimizationStrategy {
    const lowRiskVaults = vaults.filter(v => v.riskLevel === "low").slice(0, 2);
    const mediumRiskVaults = vaults.filter(v => v.riskLevel === "medium").slice(0, 2);
    
    const selectedVaults = [...lowRiskVaults, ...mediumRiskVaults];
    
    const allocations = selectedVaults.map((v, i) => {
      const isLowRisk = v.riskLevel === "low";
      return {
        vaultId: v.id,
        vaultName: v.name,
        asset: v.asset,
        percentage: isLowRisk ? 30 : 20,
        apy: parseFloat(v.apy),
      };
    });
    
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage !== 100 && allocations.length > 0) {
      allocations[0].percentage += (100 - totalPercentage);
    }
    
    const expectedApy = allocations.reduce((sum, a) => sum + (a.apy * a.percentage / 100), 0);
    const maxLockPeriod = Math.max(...selectedVaults.map(v => v.lockPeriod), 0);

    return {
      id: "balanced-growth",
      name: "Balanced Growth",
      description: "Mix of stable and growth assets for moderate returns with managed risk. Good balance of yield and security.",
      riskLevel: "balanced",
      expectedApy: parseFloat(expectedApy.toFixed(2)),
      allocations,
      minInvestment: 250,
      lockPeriod: maxLockPeriod,
      tags: ["Balanced", "Diversified", "Medium Term"],
    };
  }

  private buildAggressiveStrategy(vaults: Vault[]): OptimizationStrategy {
    const highRiskVaults = vaults.filter(v => v.riskLevel === "high");
    const mediumRiskVaults = vaults.filter(v => v.riskLevel === "medium");
    
    const sortedHigh = highRiskVaults.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    const sortedMedium = mediumRiskVaults.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    
    const selectedVaults = [...sortedHigh.slice(0, 2), ...sortedMedium.slice(0, 1)];
    
    const allocations = selectedVaults.map((v, i) => ({
      vaultId: v.id,
      vaultName: v.name,
      asset: v.asset,
      percentage: i < 2 ? 40 : 20,
      apy: parseFloat(v.apy),
    }));
    
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage !== 100 && allocations.length > 0) {
      allocations[0].percentage += (100 - totalPercentage);
    }
    
    const expectedApy = allocations.reduce((sum, a) => sum + (a.apy * a.percentage / 100), 0);
    const maxLockPeriod = Math.max(...selectedVaults.map(v => v.lockPeriod), 0);

    return {
      id: "aggressive-yield",
      name: "Aggressive Yield",
      description: "Maximum yield potential through high-APY vaults. Higher risk but significantly better returns for experienced investors.",
      riskLevel: "aggressive",
      expectedApy: parseFloat(expectedApy.toFixed(2)),
      allocations,
      minInvestment: 500,
      lockPeriod: maxLockPeriod,
      tags: ["High Yield", "Advanced", "Long Term"],
    };
  }

  private buildStablecoinStrategy(vaults: Vault[]): OptimizationStrategy {
    const stablecoinVaults = vaults.filter(v => 
      v.asset.includes("USDC") || v.asset.includes("RLUSD") || v.asset.includes("USDT")
    );
    
    const sortedVaults = stablecoinVaults.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    const selectedVaults = sortedVaults.slice(0, 3);
    
    const totalWeight = selectedVaults.length;
    const allocations = selectedVaults.map((v) => ({
      vaultId: v.id,
      vaultName: v.name,
      asset: v.asset,
      percentage: Math.round(100 / totalWeight),
      apy: parseFloat(v.apy),
    }));
    
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage !== 100 && allocations.length > 0) {
      allocations[0].percentage += (100 - totalPercentage);
    }
    
    const expectedApy = allocations.reduce((sum, a) => sum + (a.apy * a.percentage / 100), 0);
    const maxLockPeriod = Math.max(...selectedVaults.map(v => v.lockPeriod), 0);

    return {
      id: "stablecoin-yield",
      name: "Stablecoin Yield",
      description: "Earn yield on stablecoins with minimal price volatility. Perfect for preserving USD value while earning passive income.",
      riskLevel: "conservative",
      expectedApy: parseFloat(expectedApy.toFixed(2)),
      allocations,
      minInvestment: 100,
      lockPeriod: maxLockPeriod,
      tags: ["Stablecoins", "Low Volatility", "USD Denominated"],
    };
  }

  private buildMaxYieldStrategy(vaults: Vault[]): OptimizationStrategy {
    const sortedVaults = [...vaults].sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    const selectedVaults = sortedVaults.slice(0, 3);
    
    const allocations = selectedVaults.map((v, i) => ({
      vaultId: v.id,
      vaultName: v.name,
      asset: v.asset,
      percentage: i === 0 ? 50 : 25,
      apy: parseFloat(v.apy),
    }));
    
    const expectedApy = allocations.reduce((sum, a) => sum + (a.apy * a.percentage / 100), 0);
    const maxLockPeriod = Math.max(...selectedVaults.map(v => v.lockPeriod), 0);

    return {
      id: "max-yield",
      name: "Maximum Returns",
      description: "Concentrated allocation in top-performing vaults regardless of risk level. For users seeking the highest possible APY.",
      riskLevel: "aggressive",
      expectedApy: parseFloat(expectedApy.toFixed(2)),
      allocations,
      minInvestment: 1000,
      lockPeriod: maxLockPeriod,
      tags: ["Maximum APY", "Concentrated", "Expert Level"],
    };
  }

  async getStrategyById(strategyId: string): Promise<OptimizationStrategy | null> {
    const strategies = await this.getOptimizationStrategies();
    return strategies.find(s => s.id === strategyId) || null;
  }
}

export const yieldOptimizerService = new YieldOptimizerService();
