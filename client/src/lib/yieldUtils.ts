export interface VaultYieldProjection {
  projectedEarnings: {
    daily: string;
    monthly: string;
  };
  disclaimer: string;
}

export function getVaultYieldProjection(vaultId: string): VaultYieldProjection | null {
  return {
    projectedEarnings: {
      daily: "0.05",
      monthly: "1.50",
    },
    disclaimer: "Projected earnings are estimates based on current APY rates. Actual returns may vary based on market conditions and vault performance.",
  };
}
