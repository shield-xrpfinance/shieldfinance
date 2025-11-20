import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Position, Vault } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PortfolioTable from "@/components/PortfolioTable";
import WithdrawModal from "@/components/WithdrawModal";
import { WithdrawProgressModal, type WithdrawProgressStep } from "@/components/WithdrawProgressModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import EmptyState from "@/components/EmptyState";
import { PortfolioStatsSkeleton, PortfolioTableSkeleton } from "@/components/skeletons/PortfolioSkeleton";
import { TrendingUp, Coins, Gift, Package, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useLocation } from "wouter";
import { usePortfolioPolling } from "@/hooks/usePortfolioPolling";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [withdrawProgressStep, setWithdrawProgressStep] = useState<WithdrawProgressStep>('creating');
  const [withdrawRedemptionId, setWithdrawRedemptionId] = useState<string | null>(null);
  const [withdrawXrplTxHash, setWithdrawXrplTxHash] = useState<string | null>(null);
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState<string | undefined>(undefined);
  const withdrawPollingAbortControllerRef = useRef<AbortController | null>(null);
  
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

  // Query for active withdrawals to enable polling (not displayed in UI)
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
      // Check for active redemptions using displayStatus fallback
      const hasActiveRedemptions = query.state.data?.some((r: any) => {
        const displayStatus = r.userStatus || r.status;
        return displayStatus && !['completed', 'xrpl_received', 'failed', 'cancelled'].includes(displayStatus);
      });
      return hasActiveRedemptions ? 5000 : false;
    },
  });

  const { data: vaults = [] } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  // Check if there are any active withdrawals
  const hasActiveWithdrawals = redemptions?.some(w => {
    const displayStatus = w.userStatus || w.status;
    return displayStatus && !['completed', 'xrpl_received', 'failed', 'cancelled'].includes(displayStatus);
  }) || false;

  // Enable polling when there are active withdrawals
  usePortfolioPolling(hasActiveWithdrawals, address);

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
      depositDate: new Date(pos.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
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
      queryClient.invalidateQueries({ queryKey: ["/api/positions", address] });
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

      // Invalidate queries to trigger UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address] });

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

      // Invalidate queries to trigger UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address] });

      // Close withdraw modal and show progress modal
      setWithdrawModalOpen(false);
      setWithdrawRedemptionId(data.redemptionId);
      setWithdrawProgressStep('creating');
      setWithdrawProgressModalOpen(true);
      
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

  // Withdrawal status polling
  useEffect(() => {
    if (!withdrawRedemptionId || !withdrawProgressModalOpen) {
      return;
    }

    const abortController = new AbortController();
    withdrawPollingAbortControllerRef.current = abortController;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Track polling attempts and timeout (5 minutes = 300 seconds, polling every 2s = 150 attempts)
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLL_TIME_MS = 5 * 60 * 1000; // 5 minutes
    const MAX_POLL_ATTEMPTS = MAX_POLL_TIME_MS / POLL_INTERVAL_MS;
    let pollAttempts = 0;
    const pollingStartTime = Date.now();

    const pollStatus = async () => {
      try {
        pollAttempts++;
        const elapsedMs = Date.now() - pollingStartTime;
        
        // Check if timeout exceeded
        if (pollAttempts > MAX_POLL_ATTEMPTS || elapsedMs > MAX_POLL_TIME_MS) {
          console.warn(`Withdrawal polling timeout after ${pollAttempts} attempts (${Math.round(elapsedMs / 1000)}s)`);
          
          setWithdrawProgressStep('error');
          setWithdrawErrorMessage(
            `Withdrawal is taking longer than expected. Your withdrawal request (ID: ${withdrawRedemptionId}) is still processing in the background. ` +
            `You can check the status on the Bridge Tracking page or verify the XRPL transaction in your wallet.`
          );
          
          toast({
            title: "Withdrawal Status Timeout",
            description: "The withdrawal is taking longer than expected but may still complete. Check Bridge Tracking for updates.",
            variant: "destructive",
          });
          
          return; // Stop polling
        }
        
        const response = await fetch(`/api/withdrawals/${withdrawRedemptionId}/status`, {
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error('Failed to fetch withdrawal status');

        const data = await response.json();

        // Update progress step from API response
        setWithdrawProgressStep(data.currentStep);

        // Store XRPL transaction hash if available
        if (data.xrplTxHash) {
          setWithdrawXrplTxHash(data.xrplTxHash);
        }

        // Store error message if failed
        if (data.status === 'failed') {
          setWithdrawErrorMessage(data.error || 'Withdrawal failed');
          
          // Show error toast
          toast({
            title: "Withdrawal Failed",
            description: data.error || "An error occurred during withdrawal. Please try again.",
            variant: "destructive",
          });
        }

        // Stop polling if complete or failed
        if (data.status === 'completed' || data.status === 'failed') {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/positions", address] });
          queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/wallet", address] });
          
          // Show success toast for completion
          if (data.status === 'completed') {
            toast({
              title: "Withdrawal Complete",
              description: `Successfully sent ${data.xrpSent || data.amount} XRP to your wallet!`,
            });
          }
          
          return;
        }

        // Continue polling every 2 seconds
        timeoutId = setTimeout(pollStatus, POLL_INTERVAL_MS);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Polling was aborted, this is expected
          return;
        }
        console.error('Withdrawal polling error:', error);
        
        // Show error toast
        toast({
          title: "Status Update Failed",
          description: "Unable to fetch withdrawal status. The withdrawal is still processing.",
          variant: "destructive",
        });
      }
    };

    // Start polling
    pollStatus();

    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      abortController.abort();
    };
  }, [withdrawRedemptionId, withdrawProgressModalOpen, address, toast]);

  // Handle withdrawal progress modal dismissal
  const handleWithdrawProgressDismiss = () => {
    // If withdrawal completed successfully, invalidate positions to refresh UI
    if (withdrawProgressStep === 'complete' && address) {
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address] });
    }
    
    setWithdrawProgressModalOpen(false);
    setWithdrawRedemptionId(null);
    setWithdrawXrplTxHash(null);
    setWithdrawErrorMessage(undefined);
    setWithdrawProgressStep('creating');
    
    // Abort any ongoing polling
    if (withdrawPollingAbortControllerRef.current) {
      withdrawPollingAbortControllerRef.current.abort();
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

      {/* In-flight withdrawals alert */}
      {hasActiveWithdrawals && (
        <Alert className="bg-accent/5 border-accent" data-testid="alert-active-withdrawals">
          <AlertCircle className="h-4 w-4 text-accent" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span className="text-sm">
              You have {redemptions.filter(r => {
                const displayStatus = r.userStatus || r.status;
                return displayStatus && !['completed', 'xrpl_received', 'failed', 'cancelled'].includes(displayStatus);
              }).length} withdrawal(s) in progress.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/bridge-tracking")}
              className="flex items-center gap-1"
              data-testid="button-view-withdrawals"
            >
              View Details
              <ExternalLink className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

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

      <WithdrawProgressModal
        open={withdrawProgressModalOpen}
        currentStep={withdrawProgressStep}
        errorMessage={withdrawErrorMessage}
        amount={selectedPosition?.depositedAmount}
        vaultName={selectedPosition?.vaultName}
        xrplTxHash={withdrawXrplTxHash || undefined}
        network={network}
        onOpenChange={setWithdrawProgressModalOpen}
        onDismiss={handleWithdrawProgressDismiss}
      />
    </div>
  );
}
