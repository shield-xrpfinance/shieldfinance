import { useState, useEffect, useRef, useMemo } from "react";
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
import ConnectWalletEmptyState from "@/components/ConnectWalletEmptyState";
import { PortfolioStatsSkeleton, PortfolioTableSkeleton } from "@/components/skeletons/PortfolioSkeleton";
import { PositionHealthCard, type PositionActivity } from "@/components/PositionHealthCard";
import { TrendingUp, Coins, Gift, Package, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useLocation } from "wouter";
import { usePortfolioPolling } from "@/hooks/usePortfolioPolling";
import { useEnrichedPositions, type PendingActivity } from "@/hooks/useEnrichedPositions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";

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
  const { isConnected, address, evmAddress, walletType } = useWallet();
  const { network, ecosystem } = useNetwork();
  const [, navigate] = useLocation();
  
  // On-chain shXRP balance for accurate FXRP vault display - using react-query for proper caching/invalidation
  const { data: onChainShxrpBalance = null } = useQuery<string | null>({
    queryKey: ["/api/onchain/shxrp-balance", evmAddress],
    queryFn: async () => {
      if (!evmAddress) return null;
      
      try {
        const vaultInfoRes = await fetch("/api/vaults/fxrp/info");
        const vaultInfo = await vaultInfoRes.json();
        
        if (!vaultInfo.success || !vaultInfo.vaultAddress) {
          return null;
        }

        const rpcProvider = new ethers.JsonRpcProvider(COSTON2_RPC);
        const { ERC20_ABI } = await import("@shared/flare-abis");
        const vaultContract = new ethers.Contract(vaultInfo.vaultAddress, ERC20_ABI, rpcProvider);
        
        const [balanceWei, decimals] = await Promise.all([
          vaultContract.balanceOf(evmAddress),
          vaultContract.decimals()
        ]);
        
        const formattedBalance = ethers.formatUnits(balanceWei, decimals);
        console.log("Portfolio on-chain shXRP balance:", formattedBalance);
        return formattedBalance;
      } catch (err) {
        console.error("Failed to fetch on-chain shXRP balance:", err);
        return null;
      }
    },
    enabled: !!evmAddress && ecosystem === "flare",
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions", address, evmAddress],
    queryFn: async () => {
      const walletAddr = address || evmAddress;
      if (!walletAddr) return [];
      const response = await fetch(`/api/positions?walletAddress=${encodeURIComponent(walletAddr)}`);
      if (!response.ok) throw new Error('Failed to fetch positions');
      return response.json();
    },
    enabled: !!address || !!evmAddress,
  });

  // Query for active withdrawals to enable polling (not displayed in UI)
  const { data: redemptions = [] } = useQuery<any[]>({
    queryKey: ["/api/withdrawals/wallet", address, evmAddress],
    queryFn: async () => {
      const walletAddr = address || evmAddress;
      if (!walletAddr) return [];
      const response = await fetch(`/api/withdrawals/wallet/${encodeURIComponent(walletAddr)}`);
      if (!response.ok) throw new Error('Failed to fetch redemptions');
      return response.json();
    },
    enabled: !!address || !!evmAddress,
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
  const walletAddr = address || evmAddress;
  usePortfolioPolling(hasActiveWithdrawals, walletAddr);

  // Fetch enriched positions with pending activities (faster polling for pending deposits)
  const { data: enrichedData, isLoading: enrichedLoading } = useEnrichedPositions(walletAddr, {
    refreshInterval: 10000, // 10 second refresh for pending activities
    enabled: !!walletAddr,
  });
  
  // Extract pending activities (in-progress bridges) for display
  const pendingActivities = enrichedData?.pendingActivities || [];
  const hasPendingDeposits = pendingActivities.length > 0;
  
  // Convert pending activities to PositionActivity format for PositionHealthCard
  const pendingDepositsForCard: PositionActivity[] = pendingActivities.map((pa: PendingActivity) => {
    const assetSymbol = pa.vault?.asset || "XRP";
    const amount = parseFloat(pa.amount) || 0;
    return {
      id: pa.id,
      type: "bridge" as const,
      stage: pa.lifecycleStage,
      vaultName: pa.vault?.name || "XRP Liquid Staking",
      asset: assetSymbol,
      amount: `${amount.toFixed(4)} ${assetSymbol}`,
      amountUsd: `$${(pa.usdValue || 0).toFixed(2)}`,
      createdAt: pa.createdAt,
      metrics: pa.metrics || [],
      progress: pa.progress || 0,
      errorMessage: pa.errorMessage,
    };
  });

  const getVaultById = (vaultId: string) => vaults.find((v) => v.id === vaultId);

  // Filter and consolidate positions based on selected ecosystem
  const filteredPositions = useMemo(() => {
    // Don't filter if vaults data is still loading or empty
    // (wait for vault metadata to be available before filtering)
    if (!vaults || vaults.length === 0) return positions;
    
    let filtered = positions.filter(position => {
      const vault = vaults.find(v => v.id === position.vaultId);
      if (!vault) return false; // Still hide if vault not found after loading
      
      const vaultAsset = vault.asset || "XRP";
      
      // For FXRP vaults, hide position if on-chain balance is 0 (fully withdrawn)
      if (vaultAsset === "FXRP" && onChainShxrpBalance !== null) {
        const balance = parseFloat(onChainShxrpBalance);
        if (balance <= 0) return false;
      }
      
      if (ecosystem === "xrpl") {
        return vaultAsset === "XRP";
      } else if (ecosystem === "flare") {
        return vaultAsset === "FXRP";
      }
      return false;
    });
    
    // For FXRP vaults with on-chain balance, consolidate multiple positions into one
    // to prevent double-counting (since we use a single on-chain balance for all)
    if (ecosystem === "flare" && onChainShxrpBalance !== null) {
      const fxrpPositions = filtered.filter(pos => {
        const vault = vaults.find(v => v.id === pos.vaultId);
        return vault?.asset === "FXRP";
      });
      const nonFxrpPositions = filtered.filter(pos => {
        const vault = vaults.find(v => v.id === pos.vaultId);
        return vault?.asset !== "FXRP";
      });
      
      // If there are multiple FXRP positions, use only the first one (oldest)
      // The on-chain balance represents the consolidated total
      if (fxrpPositions.length > 0) {
        filtered = [...nonFxrpPositions, fxrpPositions[0]];
      }
    }
    
    return filtered;
  }, [positions, ecosystem, vaults, onChainShxrpBalance]);

  // For FXRP positions, aggregate rewards from all database records when using on-chain balance
  const aggregatedFxrpRewards = useMemo(() => {
    if (ecosystem !== "flare" || onChainShxrpBalance === null) return 0;
    
    return positions.reduce((sum, pos) => {
      const vault = vaults.find(v => v.id === pos.vaultId);
      if (vault?.asset === "FXRP") {
        return sum + parseFloat(pos.rewards || "0");
      }
      return sum;
    }, 0);
  }, [positions, vaults, ecosystem, onChainShxrpBalance]);

  // Get earliest deposit date for consolidated FXRP position
  const earliestFxrpDepositDate = useMemo(() => {
    if (ecosystem !== "flare" || onChainShxrpBalance === null) return null;
    
    const fxrpPositions = positions.filter(pos => {
      const vault = vaults.find(v => v.id === pos.vaultId);
      return vault?.asset === "FXRP";
    });
    
    if (fxrpPositions.length === 0) return null;
    
    return fxrpPositions.reduce((earliest, pos) => {
      const posDate = new Date(pos.createdAt);
      return posDate < earliest ? posDate : earliest;
    }, new Date(fxrpPositions[0].createdAt));
  }, [positions, vaults, ecosystem, onChainShxrpBalance]);

  const formattedPositions = filteredPositions.map((pos) => {
    const vault = getVaultById(pos.vaultId);
    const isFxrpVault = vault?.asset === "FXRP";
    
    // For FXRP vaults, use on-chain shXRP balance and aggregated rewards
    const amount = isFxrpVault && onChainShxrpBalance !== null 
      ? parseFloat(onChainShxrpBalance)
      : parseFloat(pos.amount);
    const rewards = isFxrpVault && onChainShxrpBalance !== null
      ? aggregatedFxrpRewards
      : parseFloat(pos.rewards);
    const depositDate = isFxrpVault && earliestFxrpDepositDate !== null
      ? earliestFxrpDepositDate
      : new Date(pos.createdAt);
    
    return {
      id: pos.id,
      vaultId: pos.vaultId,
      vaultName: vault?.name || "Unknown Vault",
      asset: vault?.asset || "XRP",
      depositedAmount: amount.toLocaleString(),
      currentValue: (amount + rewards).toLocaleString(),
      rewards: rewards.toLocaleString(),
      apy: vault?.apy || "0",
      depositDate: depositDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
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
      queryClient.invalidateQueries({ queryKey: ["/api/positions", address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ["/api/onchain/shxrp-balance", evmAddress] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/onchain/shxrp-balance', evmAddress] });

      toast({
        title: "Claim Request Submitted",
        description: "A vault operator will review and approve your claim request shortly.",
      });
    } catch (error) {
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to create claim request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmWithdraw = async (amount: string) => {
    if (!selectedPosition) return;

    const assetSymbol = selectedPosition.asset?.split(",")[0] || "XRP";
    const walletAddr = address || evmAddress;
    if (!walletAddr) return;

    setWithdrawalLoading(true);
    
    try {
      // Determine if this is an FXRP withdrawal based on asset
      const isFXRPWithdrawal = assetSymbol === "FXRP";
      const endpoint = isFXRPWithdrawal ? "/api/withdrawals/fxrp" : "/api/withdrawals";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: selectedPosition.id,
          shareAmount: amount,
          walletAddress: walletAddr,
          userAddress: walletAddr, // Include both for compatibility
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to process withdrawal");
      }

      // Invalidate queries to trigger UI refresh
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/onchain/shxrp-balance', evmAddress] });

      // Close withdraw modal
      setWithdrawModalOpen(false);

      if (isFXRPWithdrawal) {
        // FXRP withdrawal - show success message and navigate
        toast({
          title: "Withdrawal Successful",
          description: `${amount} shXRP converted to FXRP and sent to your wallet!`,
        });
        navigate('/portfolio');
      } else {
        // XRP withdrawal - show progress modal for async processing
        setWithdrawRedemptionId(data.redemptionId);
        setWithdrawProgressStep('creating');
        setWithdrawProgressModalOpen(true);
      }
      
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
          queryClient.invalidateQueries({ queryKey: ["/api/positions", address, evmAddress] });
          queryClient.invalidateQueries({ queryKey: ["/api/withdrawals/wallet", address, evmAddress] });
          queryClient.invalidateQueries({ queryKey: ["/api/onchain/shxrp-balance", evmAddress] });
          
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
    if (withdrawProgressStep === 'complete' && (address || evmAddress)) {
      queryClient.invalidateQueries({ queryKey: ['/api/positions', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawals/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/wallet', address, evmAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/onchain/shxrp-balance', evmAddress] });
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

  // Show empty state if wallet not connected
  if (!isConnected) {
    return <ConnectWalletEmptyState />;
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
              onClick={() => navigate("/app/bridge-tracking")}
              className="flex items-center gap-1"
              data-testid="button-view-withdrawals"
            >
              View Details
              <ExternalLink className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Deposits Section */}
      {hasPendingDeposits && (
        <div className="space-y-4" data-testid="section-pending-deposits">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">Pending Deposits</h2>
            <Badge variant="outline" className="text-primary bg-primary/10 border-0" data-testid="badge-pending-count">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              {pendingDepositsForCard.length} in progress
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Your deposits are being processed. Click to expand for real-time status updates.
          </p>
          <div className="space-y-3">
            {pendingDepositsForCard.map((activity) => (
              <PositionHealthCard
                key={activity.id}
                activity={activity}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-2xl font-semibold">Active Positions</h2>
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
            className="sm:w-auto w-full"
            data-testid="button-claim-all"
          >
            Claim All Rewards
          </Button>
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
              onClick: () => navigate("/app/vaults"),
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
