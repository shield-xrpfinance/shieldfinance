import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Position, Vault } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PortfolioTable from "@/components/PortfolioTable";
import WithdrawModal from "@/components/WithdrawModal";
import { TrendingUp, Coins, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function Portfolio() {
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{
    id: string;
    vaultName: string;
    depositedAmount: string;
    rewards: string;
  } | null>(null);
  const { toast } = useToast();

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: vaults = [] } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const getVaultById = (vaultId: string) => vaults.find((v) => v.id === vaultId);

  const formattedPositions = positions.map((pos) => {
    const vault = getVaultById(pos.vaultId);
    const amount = parseFloat(pos.amount);
    const rewardsEarned = amount * 0.065;
    return {
      id: pos.id,
      vaultName: vault?.name || "Unknown Vault",
      depositedAmount: amount.toLocaleString(),
      currentValue: (amount + rewardsEarned).toLocaleString(),
      rewards: rewardsEarned.toLocaleString(),
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
    mutationFn: async (positionId: string) => {
      await apiRequest("DELETE", `/api/positions/${positionId}`);
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
        depositedAmount: position.depositedAmount,
        rewards: position.rewards,
      });
      setWithdrawModalOpen(true);
    }
  };

  const handleClaim = (positionId: string) => {
    const position = formattedPositions.find((p) => p.id === positionId);
    if (position) {
      toast({
        title: "Rewards Claimed",
        description: `Successfully claimed ${position.rewards} XRP from ${position.vaultName}`,
      });
    }
  };

  const handleConfirmWithdraw = async (amount: string) => {
    if (!selectedPosition) return;
    
    try {
      await deleteMutation.mutateAsync(selectedPosition.id);
      toast({
        title: "Withdrawal Successful",
        description: `Successfully withdrew ${amount} XRP from ${selectedPosition.vaultName}`,
      });
      setWithdrawModalOpen(false);
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: "Failed to process withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio</h1>
        <p className="text-muted-foreground">
          Track your staking positions and rewards
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
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
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Active Positions</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
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
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <PortfolioTable
            positions={formattedPositions}
            onWithdraw={handleWithdraw}
            onClaim={handleClaim}
          />
        )}
      </div>

      {selectedPosition && (
        <WithdrawModal
          open={withdrawModalOpen}
          onOpenChange={setWithdrawModalOpen}
          vaultName={selectedPosition.vaultName}
          depositedAmount={selectedPosition.depositedAmount}
          rewards={selectedPosition.rewards}
          onConfirm={handleConfirmWithdraw}
        />
      )}
    </div>
  );
}
