export interface VaultYieldProjection {
  vaultId: string;
  vaultName: string;
  simulatedYield: string;
  projectedEarnings: {
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
  };
  disclaimer: string;
}

export const DEMO_VAULT_YIELD_STATS: Record<string, VaultYieldProjection> = {
  "vault-1": {
    vaultId: "vault-1",
    vaultName: "Shield XRP",
    simulatedYield: "6.2%",
    projectedEarnings: {
      daily: "0.017",
      weekly: "0.119",
      monthly: "0.517",
      yearly: "6.20",
    },
    disclaimer: "Simulated yield based on Spark LP rewards + demo incentives. Actual yields may vary.",
  },
  "vault-2": {
    vaultId: "vault-2",
    vaultName: "XRP Stable Yield",
    simulatedYield: "7.5%",
    projectedEarnings: {
      daily: "0.021",
      weekly: "0.144",
      monthly: "0.625",
      yearly: "7.50",
    },
    disclaimer: "Simulated yield for demonstration purposes. Actual yields depend on market conditions.",
  },
  "vault-3": {
    vaultId: "vault-3",
    vaultName: "RLUSD + USDC Pool",
    simulatedYield: "12.8%",
    projectedEarnings: {
      daily: "0.035",
      weekly: "0.246",
      monthly: "1.067",
      yearly: "12.80",
    },
    disclaimer: "Dual-asset pool with simulated yields. Demo environment only.",
  },
  "vault-4": {
    vaultId: "vault-4",
    vaultName: "XRP Maximum Returns",
    simulatedYield: "18.5%",
    projectedEarnings: {
      daily: "0.051",
      weekly: "0.356",
      monthly: "1.542",
      yearly: "18.50",
    },
    disclaimer: "High-risk strategy with simulated returns. Not representative of actual yields.",
  },
  "vault-5": {
    vaultId: "vault-5",
    vaultName: "XRP + RLUSD Balanced",
    simulatedYield: "9.2%",
    projectedEarnings: {
      daily: "0.025",
      weekly: "0.177",
      monthly: "0.767",
      yearly: "9.20",
    },
    disclaimer: "Balanced strategy simulation for testnet demonstration.",
  },
};

export function getVaultYieldProjection(vaultId: string): VaultYieldProjection | null {
  return DEMO_VAULT_YIELD_STATS[vaultId] || null;
}

export function calculateProjectedEarnings(depositAmount: number, apy: number): {
  daily: string;
  weekly: string;
  monthly: string;
  yearly: string;
} {
  const yearlyEarning = (depositAmount * apy) / 100;
  const monthlyEarning = yearlyEarning / 12;
  const weeklyEarning = yearlyEarning / 52;
  const dailyEarning = yearlyEarning / 365;

  return {
    daily: dailyEarning.toFixed(2),
    weekly: weeklyEarning.toFixed(2),
    monthly: monthlyEarning.toFixed(2),
    yearly: yearlyEarning.toFixed(2),
  };
}
