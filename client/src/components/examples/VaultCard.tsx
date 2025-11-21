import VaultCard from "../VaultCard";

export default function VaultCardExample() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 p-6">
      <VaultCard
        id="vault-1"
        name="XRP Stable Yield"
        apy="7.5"
        tvl="$8.2M"
        liquidity="$2.1M"
        lockPeriod={30}
        riskLevel="low"
        depositors={1245}
        status="Active"
        depositAssets={["XRP"]}
        onDeposit={(id) => {}}
      />
      <VaultCard
        id="vault-2"
        name="RLUSD + USDC Pool"
        apy="12.8"
        tvl="$5.4M"
        liquidity="$1.3M"
        lockPeriod={90}
        riskLevel="medium"
        depositors={892}
        status="Active"
        depositAssets={["RLUSD", "USDC"]}
        onDeposit={(id) => {}}
      />
      <VaultCard
        id="vault-3"
        name="Triple Asset Pool"
        apy="15.5"
        tvl="$3.1M"
        liquidity="$750K"
        lockPeriod={60}
        riskLevel="medium"
        depositors={423}
        status="Active"
        depositAssets={["XRP", "RLUSD", "USDC"]}
        onDeposit={(id) => {}}
      />
    </div>
  );
}
