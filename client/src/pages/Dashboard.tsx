import { useState } from "react";
import StatsCard from "@/components/StatsCard";
import VaultCard from "@/components/VaultCard";
import ApyChart from "@/components/ApyChart";
import DepositModal from "@/components/DepositModal";
import { Coins, TrendingUp, Vault, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string } | null>(null);
  const { toast } = useToast();

  const vaults = [
    {
      id: "vault-1",
      name: "XRP Stable Yield",
      apy: "7.5",
      tvl: "$8.2M",
      liquidity: "$2.1M",
      lockPeriod: 30,
      riskLevel: "low" as const,
      depositors: 1245,
      status: "Active",
    },
    {
      id: "vault-2",
      name: "XRP High Yield",
      apy: "12.8",
      tvl: "$5.4M",
      liquidity: "$1.3M",
      lockPeriod: 90,
      riskLevel: "medium" as const,
      depositors: 892,
      status: "Active",
    },
    {
      id: "vault-3",
      name: "XRP Maximum Returns",
      apy: "18.5",
      tvl: "$3.1M",
      liquidity: "$750K",
      lockPeriod: 180,
      riskLevel: "high" as const,
      depositors: 423,
      status: "Active",
    },
  ];

  const chartData = [
    { date: "Oct 1", "Stable Yield": 7.2, "High Yield": 12.5, "Maximum Returns": 18.2 },
    { date: "Oct 8", "Stable Yield": 7.3, "High Yield": 12.7, "Maximum Returns": 18.5 },
    { date: "Oct 15", "Stable Yield": 7.4, "High Yield": 12.6, "Maximum Returns": 18.3 },
    { date: "Oct 22", "Stable Yield": 7.5, "High Yield": 12.8, "Maximum Returns": 18.5 },
    { date: "Oct 29", "Stable Yield": 7.5, "High Yield": 12.9, "Maximum Returns": 18.7 },
    { date: "Nov 5", "Stable Yield": 7.5, "High Yield": 12.8, "Maximum Returns": 18.5 },
  ];

  const handleDeposit = (vaultId: string) => {
    const vault = vaults.find((v) => v.id === vaultId);
    if (vault) {
      setSelectedVault({ id: vault.id, name: vault.name, apy: vault.apy });
      setDepositModalOpen(true);
    }
  };

  const handleConfirmDeposit = (amount: string) => {
    toast({
      title: "Deposit Successful",
      description: `Successfully deposited ${amount} XRP to ${selectedVault?.name}`,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your liquid staking protocol performance
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Value Locked"
          value="$24.5M"
          change={{ value: 12.5, positive: true }}
          icon={<Coins className="h-6 w-6" />}
        />
        <StatsCard
          label="Average APY"
          value="8.2%"
          change={{ value: 0.8, positive: true }}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <StatsCard label="Active Vaults" value="12" icon={<Vault className="h-6 w-6" />} />
        <StatsCard
          label="Total Stakers"
          value="3,421"
          change={{ value: 5.2, positive: true }}
          icon={<Users className="h-6 w-6" />}
        />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-6">Featured Vaults</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vaults.map((vault) => (
            <VaultCard key={vault.id} {...vault} onDeposit={handleDeposit} />
          ))}
        </div>
      </div>

      <ApyChart
        data={chartData}
        vaultNames={["Stable Yield", "High Yield", "Maximum Returns"]}
      />

      {selectedVault && (
        <DepositModal
          open={depositModalOpen}
          onOpenChange={setDepositModalOpen}
          vaultName={selectedVault.name}
          vaultApy={selectedVault.apy}
          onConfirm={handleConfirmDeposit}
        />
      )}
    </div>
  );
}
