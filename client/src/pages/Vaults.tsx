import { useState } from "react";
import VaultCard from "@/components/VaultCard";
import DepositModal from "@/components/DepositModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Vaults() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("apy");
  const { toast } = useToast();

  const allVaults = [
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
    {
      id: "vault-4",
      name: "XRP Conservative",
      apy: "5.2",
      tvl: "$12.5M",
      liquidity: "$4.2M",
      lockPeriod: 14,
      riskLevel: "low" as const,
      depositors: 2341,
      status: "Active",
    },
    {
      id: "vault-5",
      name: "XRP Balanced Growth",
      apy: "10.5",
      tvl: "$6.8M",
      liquidity: "$1.8M",
      lockPeriod: 60,
      riskLevel: "medium" as const,
      depositors: 1156,
      status: "Active",
    },
    {
      id: "vault-6",
      name: "XRP Aggressive",
      apy: "22.3",
      tvl: "$2.4M",
      liquidity: "$520K",
      lockPeriod: 365,
      riskLevel: "high" as const,
      depositors: 234,
      status: "Active",
    },
  ];

  const filteredVaults = allVaults
    .filter((vault) =>
      vault.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "apy") return parseFloat(b.apy) - parseFloat(a.apy);
      if (sortBy === "tvl")
        return (
          parseFloat(b.tvl.replace(/[$MK,]/g, "")) -
          parseFloat(a.tvl.replace(/[$MK,]/g, ""))
        );
      if (sortBy === "depositors") return b.depositors - a.depositors;
      return 0;
    });

  const handleDeposit = (vaultId: string) => {
    const vault = allVaults.find((v) => v.id === vaultId);
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
        <h1 className="text-3xl font-bold tracking-tight mb-2">Vaults</h1>
        <p className="text-muted-foreground">
          Browse and deposit into high-yield XRP vaults
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vaults..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-vaults"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apy">Highest APY</SelectItem>
            <SelectItem value="tvl">Highest TVL</SelectItem>
            <SelectItem value="depositors">Most Depositors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVaults.map((vault) => (
          <VaultCard key={vault.id} {...vault} onDeposit={handleDeposit} />
        ))}
      </div>

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
