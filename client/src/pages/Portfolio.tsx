import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PortfolioTable from "@/components/PortfolioTable";
import WithdrawModal from "@/components/WithdrawModal";
import { TrendingUp, Coins, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Portfolio() {
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{
    id: string;
    vaultName: string;
    depositedAmount: string;
    rewards: string;
  } | null>(null);
  const { toast } = useToast();

  const positions = [
    {
      id: "pos-1",
      vaultName: "XRP Stable Yield",
      depositedAmount: "5,000",
      currentValue: "5,325.50",
      rewards: "325.50",
      apy: "7.5",
      depositDate: "Jan 15, 2025",
    },
    {
      id: "pos-2",
      vaultName: "XRP High Yield",
      depositedAmount: "3,000",
      currentValue: "3,284.00",
      rewards: "284.00",
      apy: "12.8",
      depositDate: "Feb 1, 2025",
    },
  ];

  const totalValue = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.currentValue.replace(/,/g, "")),
    0
  );
  const totalRewards = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.rewards.replace(/,/g, "")),
    0
  );
  const avgApy = positions.reduce((sum, pos) => sum + parseFloat(pos.apy), 0) / positions.length;

  const handleWithdraw = (positionId: string) => {
    const position = positions.find((p) => p.id === positionId);
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
    const position = positions.find((p) => p.id === positionId);
    if (position) {
      toast({
        title: "Rewards Claimed",
        description: `Successfully claimed ${position.rewards} XRP from ${position.vaultName}`,
      });
    }
  };

  const handleConfirmWithdraw = (amount: string) => {
    toast({
      title: "Withdrawal Initiated",
      description: `Processing withdrawal of ${amount} XRP from ${selectedPosition?.vaultName}`,
    });
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums">
              {totalValue.toLocaleString()} XRP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ ${(totalValue * 2.45).toLocaleString()} USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rewards Earned</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums text-chart-2">
              +{totalRewards.toLocaleString()} XRP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ≈ ${(totalRewards * 2.45).toLocaleString()} USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums">
              {avgApy.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {positions.length} positions
            </p>
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

        <PortfolioTable
          positions={positions}
          onWithdraw={handleWithdraw}
          onClaim={handleClaim}
        />
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
