import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Position, Vault } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PortfolioTable from "@/components/PortfolioTable";
import WithdrawModal from "@/components/WithdrawModal";
import ProgressModal from "@/components/ProgressModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import EmptyState from "@/components/EmptyState";
import { PortfolioStatsSkeleton, PortfolioTableSkeleton } from "@/components/skeletons/PortfolioSkeleton";
import { TrendingUp, Coins, Gift, Package, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useLocation } from "wouter";

// Define withdrawal step progression
interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  estimate?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  isMilestone?: boolean;
}

export default function Portfolio() {
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: "claim"; positionId: string; amount: string; asset: string; vaultName: string } | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{
    id: string;
    vaultName: string;
    asset: string;
    depositedAmount: string;
    rewards: string;
  } | null>(null);
  
  // Withdrawal progress modal state
  const [withdrawProgressModalOpen, setWithdrawProgressModalOpen] = useState(false);
  const [withdrawRedemptionId, setWithdrawRedemptionId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [lastCelebrationStatus, setLastCelebrationStatus] = useState<string | null>(null);
  const [copiedRedemptionId, setCopiedRedemptionId] = useState(false);
  
  const { toast } = useToast();
  const { isConnected, address } = useWallet();
  const { network } = useNetwork();
  const [, navigate] = useLocation();

  // Poll withdrawal status
  const withdrawalStatusUrl = withdrawRedemptionId 
    ? `/api/withdrawals/${withdrawRedemptionId}/status`
    : "";
  
  const { data: withdrawalStatus, error: withdrawalStatusError } = useStatusPolling<any>(
    withdrawalStatusUrl,
    {
      interval: 2000,
      enabled: withdrawProgressModalOpen && !!withdrawRedemptionId,
    }
  );

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/positions?walletAddress=${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
    enabled: !!address,
    refetchInterval: 5000,
  });

  const { data: redemptions = [] } = useQuery<any[]>({
    queryKey: ["/api/withdrawals/wallet", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/withdrawals/wallet/${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch redemptions');
      return response.json();
    },
    enabled: !!address,
    refetchInterval: (query) => {
      const hasActiveRedemptions = query.state.data?.some((r: any) => 
        !["completed", "failed"].includes(r.status)
      );
      return hasActiveRedemptions ? 5000 : false;
    },
  });

  const { data: vaults = [] } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
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

  // Map backend redemption status to withdrawal steps
  const getWithdrawalSteps = (status: string | undefined, xrplTxHash?: string): ProgressStep[] => {
    const steps: ProgressStep[] = [
      {
        id: 'burning_shxrp',
        label: 'Burning shXRP Shares',
        description: 'Redeeming your shares from vault',
        estimate: '~30s',
        status: 'pending',
      },
      {
        id: 'redeeming_fxrp',
        label: 'Redeeming FXRP',
        description: 'Requesting redemption from FAssets',
        estimate: '~30s',
        status: 'pending',
      },
      {
        id: 'awaiting_xrp',
        label: 'Agent Sending XRP',
        description: 'FAssets agent transferring XRP to your wallet',
        estimate: '~1 min',
        status: 'pending',
      },
      {
        id: 'xrp_received',
        label: 'XRP Received to Your Wallet!',
        description: 'Money is in your wallet',
        estimate: undefined,
        status: 'pending',
        isMilestone: true,
      },
      {
        id: 'finalizing_proof',
        label: 'Finalizing Proof (Optional)',
        description: 'Background confirmation running',
        estimate: '~3 min',
        status: 'pending',
      },
    ];

    if (!status) return steps;

    // Map backend status to step progression
    let currentStepIndex = 0;
    
    switch (status) {
      case 'pending':
      case 'redeeming_shares':
        currentStepIndex = 0;
        break;
      case 'redeemed_fxrp':
      case 'redeeming_fxrp':
        currentStepIndex = 1;
        break;
      case 'awaiting_proof':
      case 'xrpl_payout':
        currentStepIndex = 2;
        break;
      case 'xrpl_received':
        currentStepIndex = 3; // Terminal success!
        break;
      case 'completed':
        currentStepIndex = 4;
        break;
      case 'failed':
        // Mark current step as error
        return steps.map((step, idx) => ({
          ...step,
          status: idx < currentStepIndex ? 'complete' : idx === currentStepIndex ? 'error' : 'pending',
        }));
      default:
        currentStepIndex = 0;
    }

    // Mark all steps before current as complete, current as in_progress, rest as pending
    return steps.map((step, idx) => ({
      ...step,
      status: idx < currentStepIndex ? 'complete' : idx === currentStepIndex ? 'in_progress' : 'pending',
    }));
  };

  const handleConfirmWithdraw = async (amount: string) => {
    if (!selectedPosition || !address) return;

    const assetSymbol = selectedPosition.asset?.split(",")[0] || "XRP";
    setWithdrawalLoading(true);
    
    try {
      const response = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: selectedPosition.id,
          shareAmount: amount,
          userAddress: address,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to process withdrawal");
      }

      // Close withdraw modal and show progress modal
      setWithdrawModalOpen(false);
      setWithdrawRedemptionId(data.redemptionId);
      setWithdrawAmount(amount);
      setWithdrawProgressModalOpen(true);
      setLastCelebrationStatus(null);
      
      // Show initiation toast
      toast({
        title: "Withdrawal Initiated ✅",
        description: `Processing ${amount} shXRP withdrawal to your wallet`,
      });
      
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to process withdrawal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const handleXamanSuccess = async (txHash: string) => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "claim") {
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

  // Show milestone toasts when withdrawal status changes
  useEffect(() => {
    if (!withdrawalStatus) return;

    const status = withdrawalStatus.status;
    
    // Show XRP received celebration toast (only once)
    if (status === 'xrpl_received' && lastCelebrationStatus !== 'xrpl_received') {
      setLastCelebrationStatus('xrpl_received');
      toast({
        title: "XRP Received to Your Wallet! 💰",
        description: `${withdrawalStatus.xrpSent || withdrawAmount} XRP has been successfully sent to your wallet!`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/positions", address] });
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/wallet", address] });
    }
    
    // Show final completion toast (only once)
    if (status === 'completed' && lastCelebrationStatus !== 'completed') {
      setLastCelebrationStatus('completed');
      toast({
        title: "Withdrawal Complete ✅",
        description: "Proof confirmation finalized on-chain",
      });
    }
    
    // Show error toast if failed
    if (status === 'failed' && lastCelebrationStatus !== 'failed') {
      setLastCelebrationStatus('failed');
      toast({
        title: "Withdrawal Failed",
        description: withdrawalStatus.errorMessage || "An error occurred during withdrawal",
        variant: "destructive",
      });
    }
  }, [withdrawalStatus, lastCelebrationStatus, toast, address, withdrawAmount]);

  // Handle withdrawal progress modal dismissal
  const handleWithdrawProgressDismiss = () => {
    setWithdrawProgressModalOpen(false);
    setWithdrawRedemptionId(null);
    setWithdrawAmount("");
    setLastCelebrationStatus(null);
    setCopiedRedemptionId(false);
  };

  // Copy redemption ID to clipboard
  const handleCopyRedemptionId = () => {
    if (withdrawRedemptionId) {
      navigator.clipboard.writeText(withdrawRedemptionId);
      setCopiedRedemptionId(true);
      setTimeout(() => setCopiedRedemptionId(false), 2000);
    }
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
            network={network}
            onWithdraw={handleWithdraw}
            onClaim={handleClaim}
          />
        )}

        {/* Pending Withdrawals Section */}
        {redemptions.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Withdrawal History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {redemptions.map((redemption) => {
                  const statusBadgeVariant = 
                    redemption.status === "completed" ? "default" :
                    redemption.status === "failed" ? "destructive" :
                    redemption.status === "awaiting_proof" || redemption.status === "awaiting_liquidity" ? "outline" :
                    "secondary";
                  
                  const statusLabel = 
                    redemption.status === "pending" ? "Initiated" :
                    redemption.status === "redeeming_shares" ? "Redeeming Shares" :
                    redemption.status === "redeemed_fxrp" ? "FXRP Redeemed" :
                    redemption.status === "redeeming_fxrp" ? "Requesting Redemption" :
                    redemption.status === "awaiting_proof" ? "Awaiting Payment" :
                    redemption.status === "xrpl_payout" ? "Confirming Payment" :
                    redemption.status === "completed" ? "Completed" :
                    redemption.status === "awaiting_liquidity" ? "Queued (Low Liquidity)" :
                    redemption.status === "failed" ? "Failed" :
                    `Unknown (${redemption.status})`;
                  
                  const isActive = !["completed", "failed"].includes(redemption.status);

                  return (
                    <div 
                      key={redemption.id}
                      className={`flex items-center justify-between p-4 rounded-md border ${isActive ? 'bg-accent/5' : ''}`}
                      data-testid={`redemption-${redemption.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {isActive && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Badge variant={statusBadgeVariant} data-testid={`status-${redemption.id}`}>
                            {statusLabel}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(redemption.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-medium">
                            Amount: {parseFloat(redemption.shareAmount).toFixed(6)} shXRP
                            {redemption.xrpSent && (
                              <span className="text-muted-foreground"> → {parseFloat(redemption.xrpSent).toFixed(6)} XRP</span>
                            )}
                          </p>
                          {redemption.errorMessage && (
                            <p className="text-sm text-destructive">
                              Error: {redemption.errorMessage}
                            </p>
                          )}
                          {redemption.xrplPayoutTxHash && (
                            <a
                              href={`${network === 'mainnet' ? 'https://livenet.xrpl.org' : 'https://testnet.xrpl.org'}/transactions/${redemption.xrplPayoutTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                              data-testid={`link-xrpl-tx-${redemption.id}`}
                            >
                              View Transaction
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          ID: {redemption.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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
          network={network}
          onConfirm={handleConfirmWithdraw}
          loading={withdrawalLoading}
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

      <ProgressModal
        open={withdrawProgressModalOpen}
        onOpenChange={(open) => {
          // Only allow closing after XRP received or if there's an error
          const canClose = withdrawalStatus?.status === 'xrpl_received' || 
                          withdrawalStatus?.status === 'completed' ||
                          withdrawalStatus?.status === 'failed';
          if (!open && canClose) {
            handleWithdrawProgressDismiss();
          }
        }}
        title="Processing Withdrawal"
        steps={getWithdrawalSteps(withdrawalStatus?.status, withdrawalStatus?.xrplTxHash)}
        currentStepId={withdrawalStatus?.status === 'xrpl_received' ? 'xrp_received' : 
                       withdrawalStatus?.status === 'completed' ? 'finalizing_proof' :
                       withdrawalStatus?.status === 'failed' ? 'burning_shxrp' :
                       'burning_shxrp'}
        actions={
          withdrawalStatus?.status === 'xrpl_received' || withdrawalStatus?.status === 'completed'
            ? [
                {
                  label: "View Transactions",
                  variant: "outline" as const,
                  onClick: () => {
                    handleWithdrawProgressDismiss();
                    navigate("/transactions");
                  },
                },
                {
                  label: "Close",
                  variant: "default" as const,
                  onClick: handleWithdrawProgressDismiss,
                },
              ]
            : withdrawalStatus?.status === 'failed'
            ? [
                {
                  label: "Close",
                  variant: "default" as const,
                  onClick: handleWithdrawProgressDismiss,
                },
              ]
            : []
        }
        errorMessage={withdrawalStatus?.status === 'failed' ? withdrawalStatus.errorMessage : undefined}
        metadata={
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Redemption ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                  {withdrawRedemptionId?.slice(0, 8)}...
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCopyRedemptionId}
                  data-testid="button-copy-redemption-id"
                >
                  {copiedRedemptionId ? (
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-sm font-mono font-medium">
                {withdrawAmount} shXRP
                {withdrawalStatus?.xrpSent && (
                  <span className="text-chart-2"> → {withdrawalStatus.xrpSent} XRP</span>
                )}
              </span>
            </div>
            {withdrawalStatus?.xrplTxHash && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">XRPL Transaction</span>
                <a
                  href={`${network === 'mainnet' ? 'https://livenet.xrpl.org' : 'https://testnet.xrpl.org'}/transactions/${withdrawalStatus.xrplTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono"
                  data-testid="link-xrpl-transaction"
                >
                  {withdrawalStatus.xrplTxHash.slice(0, 8)}...
                </a>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
