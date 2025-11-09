import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Position, Vault, Escrow } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PortfolioTable from "@/components/PortfolioTable";
import PendingRequestsTable from "@/components/PendingRequestsTable";
import WithdrawModal from "@/components/WithdrawModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import EmptyState from "@/components/EmptyState";
import { PortfolioStatsSkeleton, PortfolioTableSkeleton, PendingRequestsSkeleton } from "@/components/skeletons/PortfolioSkeleton";
import { TrendingUp, Coins, Gift, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useLocation } from "wouter";

export default function Portfolio() {
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: "withdraw" | "claim"; positionId: string; amount: string; asset: string; vaultName: string } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{
    id: string;
    vaultName: string;
    asset: string;
    depositedAmount: string;
    rewards: string;
  } | null>(null);
  const { toast } = useToast();
  const { isConnected, address } = useWallet();
  const { network } = useNetwork();
  const [, navigate] = useLocation();

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/positions?walletAddress=${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
    enabled: !!address,
  });

  const { data: vaults = [] } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const { data: escrows = [] } = useQuery<Escrow[]>({
    queryKey: ["/api/escrows", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/escrows?walletAddress=${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch escrows');
      return response.json();
    },
    enabled: !!address,
  });

  interface WithdrawalRequest {
    id: string;
    walletAddress: string;
    vaultId: string;
    positionId: string | null;
    type: string;
    amount: string;
    asset: string;
    status: string;
    network: string;
    requestedAt: string;
    processedAt: string | null;
    txHash: string | null;
    rejectionReason: string | null;
  }

  const { data: withdrawalRequests = [] } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/withdrawal-requests", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/withdrawal-requests?walletAddress=${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch withdrawal requests');
      return response.json();
    },
    enabled: !!address,
    refetchInterval: 5000, // Refresh every 5 seconds to show status updates
  });

  const getVaultById = (vaultId: string) => vaults.find((v) => v.id === vaultId);

  const formattedPositions = positions.map((pos) => {
    const vault = getVaultById(pos.vaultId);
    const amount = parseFloat(pos.amount);
    const rewards = parseFloat(pos.rewards);
    return {
      id: pos.id,
      vaultId: pos.vaultId,
      vaultName: vault?.name || "Unknown Vault",
      asset: vault?.asset || "XRP",
      depositedAmount: amount.toLocaleString(),
      currentValue: (amount + rewards).toLocaleString(),
      rewards: rewards.toLocaleString(),
      apy: vault?.apy || "0",
      depositDate: new Date(pos.depositedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
  });

  const totalValue = formattedPositions.reduce(
    (sum, pos) => sum + parseFloat(pos.currentValue.replace(/,/g, "")),
    0
  );
  const totalRewards = formattedPositions.reduce(
    (sum, pos) => sum + parseFloat(pos.rewards.replace(/,/g, "")),
    0
  );
  const avgApy = formattedPositions.length > 0 
    ? formattedPositions.reduce((sum, pos) => sum + parseFloat(pos.apy), 0) / formattedPositions.length
    : 0;

  const deleteMutation = useMutation({
    mutationFn: async ({ positionId, network, txHash }: { positionId: string; network: string; txHash?: string }) => {
      const res = await apiRequest("POST", `/api/positions/${positionId}/withdraw`, { network, txHash });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async ({ positionId, network, txHash }: { positionId: string; network: string; txHash?: string }) => {
      const res = await apiRequest("PATCH", `/api/positions/${positionId}/claim`, { network, txHash });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });

  const handleWithdraw = (positionId: string) => {
    const position = formattedPositions.find((p) => p.id === positionId);
    if (position) {
      setSelectedPosition({
        id: position.id,
        vaultName: position.vaultName,
        asset: position.asset || "XRP",
        depositedAmount: position.depositedAmount,
        rewards: position.rewards,
      });
      setWithdrawModalOpen(true);
    }
  };

  const handleClaim = async (positionId: string) => {
    const position = formattedPositions.find((p) => p.id === positionId);
    if (!position || !address) return;

    const assetSymbol = position.asset?.split(",")[0] || "XRP";
    const rewardAmount = parseFloat(position.rewards.replace(/,/g, ""));

    if (rewardAmount <= 0) {
      toast({
        title: "No Rewards",
        description: "You don't have any rewards to claim yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/claim-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: rewardAmount.toString(),
          asset: assetSymbol,
          userAddress: address,
          network: network,
          positionId: position.id,
          vaultId: position.vaultId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create claim request");
      }

      toast({
        title: "Claim Request Submitted",
        description: "A vault operator will review and approve your claim request shortly.",
      });
    } catch (error) {
      console.error("Error creating claim request:", error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to create claim request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmWithdraw = async (amount: string) => {
    if (!selectedPosition || !address) return;

    const assetSymbol = selectedPosition.asset?.split(",")[0] || "XRP";
    const vaultId = formattedPositions.find((p) => p.id === selectedPosition.id)?.vaultId || "";

    try {
      const response = await fetch("/api/withdrawal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          asset: assetSymbol,
          userAddress: address,
          network: network,
          positionId: selectedPosition.id,
          vaultId: vaultId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create withdrawal request");
      }

      setWithdrawModalOpen(false);
      
      // Invalidate withdrawal requests cache to show the new request immediately
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-requests"] });
      
      toast({
        title: "Withdrawal Request Submitted",
        description: "A vault operator will review and approve your withdrawal request shortly.",
      });
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to create withdrawal request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleXamanSuccess = async (txHash: string) => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "withdraw") {
        await deleteMutation.mutateAsync({ positionId: pendingAction.positionId, network, txHash });
        toast({
          title: "Withdrawal Successful",
          description: `Successfully withdrew ${pendingAction.amount} ${pendingAction.asset} from ${pendingAction.vaultName} on ${network}`,
        });
      } else if (pendingAction.type === "claim") {
        await claimMutation.mutateAsync({ positionId: pendingAction.positionId, network, txHash });
        toast({
          title: "Rewards Claimed",
          description: `Successfully claimed ${pendingAction.amount} ${pendingAction.asset} from ${pendingAction.vaultName} on ${network}`,
        });
      }

      // Clear pending action
      setPendingAction(null);
      setXamanPayload(null);
    } catch (error) {
      console.error("Transaction completion error:", error);
      toast({
        title: "Transaction Failed",
        description: "Transaction signed but failed to complete. Please contact support.",
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
    setPendingAction(null);
    setXamanPayload(null);
  };

  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            Track your staking positions and rewards
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Coins className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-muted-foreground">
                Please connect your wallet to view your portfolio and staking positions
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Create vault names map for PendingRequestsTable
  const vaultNames = vaults.reduce((acc, vault) => {
    acc[vault.id] = vault.name;
    return acc;
  }, {} as Record<string, string>);

  // Count pending requests
  const pendingRequestsCount = withdrawalRequests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio</h1>
        <p className="text-muted-foreground">
          Track your staking positions and rewards
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums">
                  {totalValue.toLocaleString()} XRP
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ ${(totalValue * 2.45).toLocaleString()} USD
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rewards Earned</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums text-chart-2">
                  +{totalRewards.toLocaleString()} XRP
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ ${(totalRewards * 2.45).toLocaleString()} USD
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums">
                  {avgApy.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {formattedPositions.length} positions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {positionsLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold font-mono tabular-nums text-chart-4">
                  {pendingRequestsCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting approval
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Active Positions</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!isConnected) {
                  toast({
                    title: "Wallet Not Connected",
                    description: "Please connect your wallet to claim rewards",
                    variant: "destructive",
                  });
                  return;
                }
                toast({
                  title: "Claim All Rewards",
                  description: `Claiming ${totalRewards.toLocaleString()} XRP from all positions`,
                });
              }}
              data-testid="button-claim-all"
            >
              Claim All Rewards
            </Button>
          </div>
        </div>

        {positionsLoading ? (
          <PortfolioTableSkeleton />
        ) : formattedPositions.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Active Positions"
            description="You haven't staked any assets yet. Head to the Vaults page to start earning yield on your XRP, RLUSD, and USDC."
            actionButton={{
              label: "Browse Vaults",
              onClick: () => navigate("/vaults"),
              testId: "button-browse-vaults"
            }}
            testId="empty-state-positions"
          />
        ) : (
          <PortfolioTable
            positions={formattedPositions}
            escrows={escrows}
            network={network}
            onWithdraw={handleWithdraw}
            onClaim={handleClaim}
          />
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Pending Requests</h2>
          <p className="text-sm text-muted-foreground">
            Track your withdrawal and claim requests
          </p>
        </div>

        {positionsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <PendingRequestsTable
            requests={withdrawalRequests}
            vaultNames={vaultNames}
            network={network}
          />
        )}
      </div>

      {selectedPosition && (
        <WithdrawModal
          open={withdrawModalOpen}
          onOpenChange={setWithdrawModalOpen}
          vaultName={selectedPosition.vaultName}
          asset={selectedPosition.asset}
          depositedAmount={selectedPosition.depositedAmount}
          rewards={selectedPosition.rewards}
          escrow={escrows.find((e) => e.positionId === selectedPosition.id)}
          network={network}
          onConfirm={handleConfirmWithdraw}
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
        title={pendingAction?.type === "claim" ? "Sign Reward Claim" : "Sign Withdrawal Transaction"}
        description={pendingAction?.type === "claim" 
          ? "Scan the QR code with your Xaman wallet to claim your rewards"
          : "Scan the QR code with your Xaman wallet to complete the withdrawal"}
      />
    </div>
  );
}
