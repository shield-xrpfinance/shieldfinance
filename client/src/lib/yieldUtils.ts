export interface VaultYieldProjection {
  projectedEarnings: {
    daily: string;
    monthly: string;
  };
  disclaimer: string;
}

const VAULT_PROJECTIONS: Record<string, { daily: string; monthly: string }> = {
  "1": { daily: "0.05", monthly: "1.50" },
  "2": { daily: "0.08", monthly: "2.40" },
  "3": { daily: "0.12", monthly: "3.60" },
  "4": { daily: "0.04", monthly: "1.20" },
  "5": { daily: "0.06", monthly: "1.80" },
};

export function getVaultYieldProjection(vaultId: string): VaultYieldProjection | null {
  const projection = VAULT_PROJECTIONS[vaultId];
  
  if (!projection) {
    return {
      projectedEarnings: {
        daily: "0.05",
        monthly: "1.50",
      },
      disclaimer: "Projected earnings are estimates based on current APY rates. Actual returns may vary based on market conditions and vault performance.",
    };
  }
  
  return {
    projectedEarnings: projection,
    disclaimer: "Projected earnings are estimates based on current APY rates. Actual returns may vary based on market conditions and vault performance.",
  };
}
