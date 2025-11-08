import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Vault as VaultType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import StatsCard from "@/components/StatsCard";
import VaultCard from "@/components/VaultCard";
import ApyChart from "@/components/ApyChart";
import DepositModal from "@/components/DepositModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import { Coins, TrendingUp, Vault, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";

export default function Dashboard() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ amounts: { [asset: string]: string }; vaultId: string; vaultName: string } | null>(null);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string; depositAssets: string[] } | null>(null);
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

  const vaults = apiVaults?.slice(0, 3).map(vault => ({
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
    mutationFn: async (data: { walletAddress: string; vaultId: string; amount: string; network: string; txHash?: string }) => {
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
      txHash: txHash,
    };

    try {
      await depositMutation.mutateAsync(depositData);

      toast({
        title: "Deposit Successful",
        description: `Successfully deposited ${assetList} to ${pendingDeposit.vaultName} on ${network}`,
      });

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
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96" data-testid={`skeleton-vault-${i}`} />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} {...vault} onDeposit={handleDeposit} />
            ))}
          </div>
        )}
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
