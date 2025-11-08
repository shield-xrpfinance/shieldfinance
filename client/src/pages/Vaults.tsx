import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Vault as VaultType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import VaultCard from "@/components/VaultCard";
import DepositModal from "@/components/DepositModal";
import XamanSigningModal from "@/components/XamanSigningModal";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";

export default function Vaults() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ amounts: { [asset: string]: string }; vaultId: string; vaultName: string } | null>(null);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string; depositAssets: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("apy");
  const { toast } = useToast();
  const { address } = useWallet();
  const { network } = useNetwork();

  const { data: apiVaults, isLoading } = useQuery<VaultType[]>({
    queryKey: ["/api/vaults"],
  });

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  const allVaults = apiVaults?.map(vault => ({
    id: vault.id,
    name: vault.name,
    asset: vault.asset || "XRP",
    apy: vault.apy,
    tvl: formatCurrency(vault.tvl),
    liquidity: formatCurrency(vault.liquidity),
    lockPeriod: vault.lockPeriod,
    riskLevel: vault.riskLevel as "low" | "medium" | "high",
    depositors: 0,
    status: vault.status.charAt(0).toUpperCase() + vault.status.slice(1),
    depositAssets: (vault.asset || "XRP").split(",").map(a => a.trim()),
  })) || [];


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
      setSelectedVault({ 
        id: vault.id, 
        name: vault.name, 
        apy: vault.apy,
        depositAssets: vault.depositAssets || ["XRP"],
      });
      setDepositModalOpen(true);
    }
  };

  const depositMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; vaultId: string; amount: string; network: string }) => {
      console.log("depositMutation.mutationFn called with data:", data);
      const res = await apiRequest("POST", "/api/positions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });

  const handleConfirmDeposit = async (amounts: { [asset: string]: string }) => {
    if (!selectedVault || !address) return;

    const totalAmount = Object.values(amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    // For single-asset vaults, use that asset. For multi-asset, use first asset for payment
    const paymentAsset = selectedVault.depositAssets[0];
    const paymentAmount = amounts[paymentAsset] || totalAmount.toString();

    try {
      // Step 1: Create Xaman payment payload
      const payloadResponse = await fetch("/api/wallet/xaman/payment/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          asset: paymentAsset,
          vaultId: selectedVault.id,
          network: network,
        }),
      });

      const payloadData = await payloadResponse.json();

      if (!payloadData.uuid) {
        throw new Error("Failed to create payment payload");
      }

      // Step 2: Store pending deposit and show Xaman signing modal
      setPendingDeposit({
        amounts,
        vaultId: selectedVault.id,
        vaultName: selectedVault.name,
      });
      setXamanPayload({
        uuid: payloadData.uuid,
        qrUrl: payloadData.qrUrl,
        deepLink: payloadData.deepLink,
      });
      setDepositModalOpen(false);
      setXamanSigningModalOpen(true);
    } catch (error) {
      console.error("Error creating payment payload:", error);
      toast({
        title: "Payment Failed",
        description: "Failed to create payment request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleXamanSuccess = async (txHash: string) => {
    if (!pendingDeposit || !address) return;

    const assetList = Object.entries(pendingDeposit.amounts)
      .filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .map(([asset, amt]) => `${amt} ${asset}`)
      .join(", ");

    const totalAmount = Object.values(pendingDeposit.amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    const depositData = {
      walletAddress: address,
      vaultId: pendingDeposit.vaultId,
      amount: totalAmount.toString(),
      network: network,
      txHash: txHash, // Include real transaction hash
    };

    try {
      await depositMutation.mutateAsync(depositData);

      toast({
        title: "Deposit Successful",
        description: `Successfully deposited ${assetList} to ${pendingDeposit.vaultName} on ${network}`,
      });

      // Clear pending deposit
      setPendingDeposit(null);
      setXamanPayload(null);
    } catch (error) {
      console.error("Deposit mutation error:", error);
      toast({
        title: "Deposit Failed",
        description: "Transaction signed but failed to create position. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleXamanError = (error: string) => {
    toast({
      title: "Signing Failed",
      description: error,
      variant: "destructive",
    });
    setPendingDeposit(null);
    setXamanPayload(null);
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
          depositAssets={selectedVault.depositAssets}
          onConfirm={handleConfirmDeposit}
        />
      )}

      <XamanSigningModal
        open={xamanSigningModalOpen}
        onOpenChange={setXamanSigningModalOpen}
        payloadUuid={xamanPayload?.uuid || null}
        qrUrl={xamanPayload?.qrUrl || null}
        deepLink={xamanPayload?.deepLink || null}
        onSuccess={handleXamanSuccess}
        onError={handleXamanError}
        title="Sign Deposit Transaction"
        description="Scan the QR code with your Xaman wallet to complete the deposit"
      />
    </div>
  );
}
