import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { BridgeStatus } from "@/components/BridgeStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Wallet, RefreshCw, Loader2, History, ArrowDownToLine, ArrowUpFromLine, ExternalLink, Copy, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BridgeStatusModal from "@/components/BridgeStatusModal";
import { format } from "date-fns";
import type { SelectXrpToFxrpBridge, SelectFxrpToXrpRedemption, Vault, BridgeHistoryEntry, CrossChainBridgeJob } from "@shared/schema";
import { useBridgeTracking } from "@/hooks/useBridgeTracking";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper to convert snake_case status to human-readable format
function formatStatus(status: string): string {
  // Provide user-friendly labels for common statuses
  const statusLabels: Record<string, string> = {
    // Deposit statuses
    'pending': 'Creating Bridge',
    'reserving_collateral': 'Reserving Collateral',
    'awaiting_payment': 'Awaiting Payment',
    'xrpl_confirmed': 'Payment Confirmed',
    'generating_proof': 'Generating Proof',
    'proof_generated': 'Proof Generated',
    'minting': 'Minting FXRP',
    'vault_minting': 'Depositing to Vault',
    'vault_minted': 'Completed',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled',
    
    // Withdrawal statuses
    'redeeming_shares': 'Redeeming Shares',
    'redeemed_fxrp': 'FXRP Redeemed',
    'redeeming_fxrp': 'Processing Redemption',
    'awaiting_proof': 'Awaiting Payment',
    'xrpl_payout': 'Sending XRP',
    'awaiting_liquidity': 'Queued (Low Liquidity)',
  };
  
  // Return mapped label or fallback to title case conversion
  return statusLabels[status] || status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Map status to badge variant (explicit mapping, not based on completedAt)
function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  // Success states - green badge
  if (status === "completed" || status === "vault_minted") {
    return "default";
  }
  // Failure state - red badge  
  if (status === "failed") {
    return "destructive";
  }
  // All in-progress states - gray badge
  // (pending, redeeming_shares, redeemed_fxrp, redeeming_fxrp, awaiting_proof, xrpl_payout, etc.)
  return "secondary";
}

// Reusable Bridge Section Component for Active, Completed, Failed tabs
interface BridgeSectionProps {
  type: 'active' | 'completed' | 'failed';
  bridges: SelectXrpToFxrpBridge[];
  withdrawals?: SelectFxrpToXrpRedemption[];
  isLoading: boolean;
  address: string | null;
  onSendPayment: (bridge: SelectXrpToFxrpBridge) => void;
  onCancelBridge?: (bridge: SelectXrpToFxrpBridge) => void;
  isVaultsLoading: boolean;
  retryAllMutation?: any;
}

const BridgeSection = ({ 
  type, 
  bridges, 
  withdrawals = [],
  isLoading, 
  address, 
  onSendPayment, 
  onCancelBridge,
  isVaultsLoading,
  retryAllMutation 
}: BridgeSectionProps) => {
  const icons = {
    active: Activity,
    completed: CheckCircle2,
    failed: XCircle,
  };
  
  const emptyMessages = {
    active: {
      title: "No active operations",
      description: "Your deposits and withdrawals will appear here",
    },
    completed: {
      title: "No completed bridge operations",
      description: "Successfully completed bridges will appear here",
    },
    failed: {
      title: "No failed bridge operations",
      description: "Failed bridge operations will appear here for troubleshooting",
    },
  };
  
  const Icon = icons[type];
  const message = emptyMessages[type];
  
  const NotConnectedMessage = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-center text-muted-foreground font-medium" data-testid="text-connect-wallet-prompt">
          Connect your wallet to view bridge tracking
        </p>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Your bridge operations will appear here after connecting
        </p>
      </CardContent>
    </Card>
  );

  const LoadingMessage = () => (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading bridge operations...</p>
      </CardContent>
    </Card>
  );

  if (!address) {
    return <NotConnectedMessage />;
  }
  
  if (isLoading) {
    return <LoadingMessage />;
  }
  
  if (bridges.length === 0 && withdrawals.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Icon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-center text-muted-foreground font-medium" data-testid={`text-no-${type}-bridges`}>
            {message.title}
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            {message.description}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {type === 'failed' && retryAllMutation && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-sm text-muted-foreground">
            {bridges.length} failed bridge{bridges.length !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            onClick={() => retryAllMutation.mutate()}
            disabled={retryAllMutation.isPending}
            className="w-full sm:w-auto"
            data-testid="button-retry-all"
          >
            {retryAllMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry All
              </>
            )}
          </Button>
        </div>
      )}
      {/* Display Deposits */}
      {bridges.map((bridge) => (
        <BridgeStatus
          key={bridge.id}
          status={bridge.status}
          xrpAmount={bridge.xrpAmount}
          fxrpExpected={bridge.fxrpExpected}
          xrplTxHash={bridge.xrplTxHash || undefined}
          flareTxHash={bridge.flareTxHash || undefined}
          vaultMintTxHash={bridge.vaultMintTxHash || undefined}
          errorMessage={bridge.errorMessage || undefined}
          bridgeId={bridge.id}
          agentUnderlyingAddress={bridge.agentUnderlyingAddress || undefined}
          onSendPayment={() => onSendPayment(bridge)}
          onCancelBridge={onCancelBridge ? () => onCancelBridge(bridge) : undefined}
          isVaultsLoading={isVaultsLoading}
        />
      ))}
      {/* Display Withdrawals */}
      {withdrawals.map((redemption) => (
        <Card key={redemption.id} data-testid={`card-withdrawal-${redemption.id}`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Withdrawal Processing</h3>
                </div>
                <Badge 
                  variant={getStatusVariant(redemption.status || redemption.userStatus)}
                  data-testid={`badge-withdrawal-status-${redemption.id}`}
                >
                  {formatStatus(redemption.status || redemption.userStatus)}
                </Badge>
              </div>
              
              <div className="rounded-lg bg-muted p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Redemption ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-2 py-1.5 font-mono text-xs break-all" data-testid={`text-redemption-id-${redemption.id}`}>
                    {redemption.id}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(redemption.id);
                    }}
                    data-testid="button-copy-redemption-id"
                    className="self-start"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Withdrawing {parseFloat(redemption.shareAmount?.toString() || "0").toFixed(6)} shXRP shares
                </p>
                <div className="flex flex-wrap gap-2">
                  {redemption.vaultRedeemTxHash && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-vault-redeem-tx-${redemption.id}`}
                    >
                      <a
                        href={`https://coston2-explorer.flare.network/tx/${redemption.vaultRedeemTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Redeem TX
                      </a>
                    </Button>
                  )}
                  {redemption.xrplPayoutTxHash && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-xrpl-payout-tx-${redemption.id}`}
                    >
                      <a
                        href={`https://testnet.xrpscan.com/tx/${redemption.xrplPayoutTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Payout TX
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {redemption.errorMessage && (
                <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm" data-testid={`text-withdrawal-error-${redemption.id}`}>
                  <p className="font-medium text-destructive">Error:</p>
                  <p className="text-destructive/80">{redemption.errorMessage}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Reusable History Section Component
interface HistorySectionProps {
  history: BridgeHistoryEntry[] | undefined;
  crossChainJobs: CrossChainBridgeJob[] | undefined;
  isLoadingHistory: boolean;
  address: string | null;
}

const HistorySection = ({ history, crossChainJobs, isLoadingHistory, address }: HistorySectionProps) => {
  const NotConnectedMessage = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-center text-muted-foreground font-medium" data-testid="text-connect-wallet-prompt">
          Connect your wallet to view bridge tracking
        </p>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Your bridge operations will appear here after connecting
        </p>
      </CardContent>
    </Card>
  );

  const LoadingMessage = () => (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading bridge operations...</p>
      </CardContent>
    </Card>
  );

  if (!address) {
    return <NotConnectedMessage />;
  }
  
  if (isLoadingHistory) {
    return <LoadingMessage />;
  }

  const hasHistory = history && history.length > 0;
  const hasCrossChainJobs = crossChainJobs && crossChainJobs.length > 0;
  
  if (!hasHistory && !hasCrossChainJobs) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-center text-muted-foreground font-medium" data-testid="text-no-history">
            No bridge history
          </p>
          <p className="text-center text-sm text-muted-foreground mt-2">
            Your deposits, withdrawals, and cross-chain bridges will appear here
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Multi-Chain Bridge Jobs (FSwap) */}
      {crossChainJobs?.map((job) => (
        <Card key={job.id} data-testid={`card-crosschain-${job.id}`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  <ArrowLeftRight className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge 
                      variant="outline"
                      className="border-purple-500 text-purple-600"
                      data-testid={`badge-type-crosschain-${job.id}`}
                    >
                      Multi-Chain
                    </Badge>
                    <Badge 
                      variant={getStatusVariant(job.status)}
                      data-testid={`badge-status-${job.status}`}
                    >
                      {formatStatus(job.status)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {job.sourceNetwork} → {job.destNetwork}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {job.createdAt && format(new Date(job.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    {job.completedAt && (
                      <span className="block mt-1">
                        Completed: {format(new Date(job.completedAt), "MMM d, h:mm a")}
                      </span>
                    )}
                  </p>
                  {job.errorMessage && (
                    <p className="text-sm text-destructive mt-1">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="font-semibold break-all" data-testid={`text-amount-${job.id}`}>
                  {parseFloat(job.sourceAmount?.toString() || "0").toFixed(6)} {job.sourceToken}
                </p>
                <p className="text-sm text-muted-foreground">
                  → {parseFloat(job.destAmountReceived?.toString() || job.destAmount?.toString() || "0").toFixed(6)} {job.destToken}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* FAssets Bridge History */}
      {history?.map((entry) => (
        <Card key={entry.id} data-testid={`card-history-${entry.id}`}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  {entry.type === "deposit" ? (
                    <ArrowDownToLine className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowUpFromLine className="h-5 w-5 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge 
                      variant={entry.type === "deposit" ? "default" : "secondary"}
                      data-testid={`badge-type-${entry.type}`}
                    >
                      {entry.type === "deposit" ? "Deposit" : "Withdrawal"}
                    </Badge>
                    <Badge 
                      variant={getStatusVariant(entry.status)}
                      data-testid={`badge-status-${entry.status}`}
                    >
                      {formatStatus(entry.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    {entry.completedAt && (
                      <span className="block mt-1">
                        Completed: {format(new Date(entry.completedAt), "MMM d, h:mm a")}
                      </span>
                    )}
                  </p>
                  {entry.errorMessage && (
                    <p className="text-sm text-destructive mt-1">
                      {entry.errorMessage}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="font-semibold break-all" data-testid={`text-amount-${entry.id}`}>
                  {parseFloat(entry.amount).toFixed(6)} XRP
                </p>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
                  {entry.xrplTxHash && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      asChild
                      data-testid={`button-xrpl-explorer-${entry.id}`}
                    >
                      <a
                        href={`https://testnet.xrpl.org/transactions/${entry.xrplTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        XRPL
                      </a>
                    </Button>
                  )}
                  {entry.flareTxHash && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      asChild
                      data-testid={`button-flare-explorer-${entry.id}`}
                    >
                      <a
                        href={`https://coston2-explorer.flare.network/tx/${entry.flareTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Flare
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default function BridgeTracking() {
  const { address, evmAddress } = useWallet();
  const walletAddr = address || evmAddress;
  const [activeTab, setActiveTab] = useState("active");
  const [selectedBridge, setSelectedBridge] = useState<{
    bridgeId: string;
    vaultName: string;
    amount: string;
  } | null>(null);
  const [bridgeToCancel, setBridgeToCancel] = useState<{ id: string; amount: string } | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile(768);

  const { data: bridges, isLoading } = useQuery<SelectXrpToFxrpBridge[]>({
    queryKey: [`/api/bridges/wallet/${walletAddr}`],
    enabled: !!walletAddr,
  });

  const { data: vaults, isLoading: isLoadingVaults } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery<BridgeHistoryEntry[]>({
    queryKey: [`/api/bridge-history/${walletAddr}`],
    enabled: !!walletAddr,
  });

  const { data: redemptions = [] } = useQuery<SelectFxrpToXrpRedemption[]>({
    queryKey: [`/api/withdrawals/wallet/${walletAddr}`],
    enabled: !!walletAddr,
  });

  // Query for multi-chain bridge jobs (FSwap widget)
  const { data: crossChainJobs } = useQuery<{ jobs: CrossChainBridgeJob[] }>({
    queryKey: [`/api/bridge/jobs/${walletAddr}`],
    enabled: !!walletAddr,
  });

  // Memoize vault lookup map for performance
  const vaultMap = useMemo(() => {
    if (!vaults) return new Map<string, Vault>();
    return new Map(vaults.map(v => [v.id, v]));
  }, [vaults]);

  // Callback to open payment modal for a bridge
  const handleSendPayment = useCallback((bridge: SelectXrpToFxrpBridge) => {
    if (!vaultMap.size) {
      toast({
        title: "Loading",
        description: "Please wait while vault data loads...",
      });
      return;
    }
    
    const vault = vaultMap.get(bridge.vaultId);
    if (!vault) {
      toast({
        title: "Error",
        description: "Vault not found",
        variant: "destructive",
      });
      return;
    }

    setSelectedBridge({
      bridgeId: bridge.id,
      vaultName: vault.name,
      amount: bridge.xrpAmount,
    });
  }, [vaultMap, toast]);

  // Callback to initiate bridge cancellation
  const handleCancelBridge = useCallback((bridge: SelectXrpToFxrpBridge) => {
    setBridgeToCancel({
      id: bridge.id,
      amount: bridge.xrpAmount,
    });
  }, []);

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bridges/reconcile-all");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Retry Complete",
        description: `Successfully retried ${data.successful} bridge(s). ${data.failed} failed.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bridges/wallet'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Retry Failed",
        description: error.message || "Failed to retry bridges",
        variant: "destructive",
      });
    },
  });

  const cancelBridgeMutation = useMutation({
    mutationFn: async (bridgeId: string) => {
      const response = await apiRequest("POST", `/api/bridges/${bridgeId}/user-cancel`, {
        walletAddress: walletAddr,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bridge Cancelled",
        description: "Your deposit request has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/bridges/wallet/${walletAddr}`] });
      setBridgeToCancel(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel bridge",
        variant: "destructive",
      });
      setBridgeToCancel(null);
    },
  });

  const { activeBridges, completedBridges, failedBridges, activeWithdrawals } = useMemo(() => {
    if (!bridges) {
      return { activeBridges: [], completedBridges: [], failedBridges: [], activeWithdrawals: [] };
    }

    const failed = bridges.filter(
      (b) => b.status === "failed" || b.status === "vault_mint_failed" || b.errorMessage !== null
    );

    const completed = bridges.filter(
      (b) => (b.status === "completed" || b.status === "vault_minted") && !b.errorMessage
    );

    const active = bridges.filter(
      (b) =>
        !b.errorMessage &&
        b.status !== "completed" &&
        b.status !== "vault_minted" &&
        b.status !== "failed" &&
        b.status !== "vault_mint_failed" &&
        (b.status === "awaiting_payment" ||
          b.status === "xrpl_confirmed" ||
          b.status === "proof_generated" ||
          b.status === "minting" ||
          b.status === "vault_minting")
    );

    // Filter active withdrawals (not completed, failed, or xrpl_received)
    const activeWithdrawals = (redemptions || []).filter(
      (r) => {
        const displayStatus = r.userStatus || r.status;
        return displayStatus && !['completed', 'xrpl_received', 'failed', 'cancelled'].includes(displayStatus);
      }
    );

    return {
      activeBridges: active,
      completedBridges: completed,
      failedBridges: failed,
      activeWithdrawals,
    };
  }, [bridges, redemptions]);

  // Enable real-time polling when there are active bridges or withdrawals
  useBridgeTracking(activeBridges.length > 0 || activeWithdrawals.length > 0, address);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Bridge Tracking
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
          Monitor your XRP to FXRP bridge operations in real-time
        </p>
      </div>

      {isMobile ? (
        <Accordion 
          type="single" 
          collapsible 
          value={activeTab} 
          onValueChange={setActiveTab}
          data-testid="accordion-bridge-tracking"
        >
        <AccordionItem value="active">
          <AccordionTrigger 
            className="hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="accordion-trigger-active"
          >
            <div className="flex items-center gap-2 flex-1">
              <Activity className="h-4 w-4" />
              <span>Active</span>
              <Badge variant="secondary" className="ml-auto mr-2">
                {activeBridges.length + activeWithdrawals.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <BridgeSection
              type="active"
              bridges={activeBridges}
              withdrawals={activeWithdrawals}
              isLoading={isLoading}
              address={address}
              onSendPayment={handleSendPayment}
              onCancelBridge={handleCancelBridge}
              isVaultsLoading={isLoadingVaults}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="completed">
          <AccordionTrigger 
            className="hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="accordion-trigger-completed"
          >
            <div className="flex items-center gap-2 flex-1">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed</span>
              <Badge variant="secondary" className="ml-auto mr-2">
                {completedBridges.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <BridgeSection
              type="completed"
              bridges={completedBridges}
              isLoading={isLoading}
              address={address}
              onSendPayment={handleSendPayment}
              isVaultsLoading={isLoadingVaults}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="failed">
          <AccordionTrigger 
            className="hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="accordion-trigger-failed"
          >
            <div className="flex items-center gap-2 flex-1">
              <XCircle className="h-4 w-4" />
              <span>Failed</span>
              <Badge variant="secondary" className="ml-auto mr-2">
                {failedBridges.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <BridgeSection
              type="failed"
              bridges={failedBridges}
              isLoading={isLoading}
              address={address}
              onSendPayment={handleSendPayment}
              isVaultsLoading={isLoadingVaults}
              retryAllMutation={retryAllMutation}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="history">
          <AccordionTrigger 
            className="hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="accordion-trigger-history"
          >
            <div className="flex items-center gap-2 flex-1">
              <History className="h-4 w-4" />
              <span>History</span>
              <Badge variant="secondary" className="ml-auto mr-2">
                {(history?.length || 0) + (crossChainJobs?.jobs?.length || 0)}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <HistorySection
              history={history}
              crossChainJobs={crossChainJobs?.jobs}
              isLoadingHistory={isLoadingHistory}
              address={address}
            />
          </AccordionContent>
        </AccordionItem>
        </Accordion>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto pb-2" aria-label="Bridge tracking tabs">
          <TabsList className="inline-flex gap-1 w-full min-w-max sm:grid sm:grid-cols-4 sm:gap-0 sm:min-w-0" data-testid="tabs-bridge-tracking">
            <TabsTrigger value="active" data-testid="tab-active" className="flex-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Activity className="h-4 w-4 mr-2" />
              Active ({activeBridges.length + activeWithdrawals.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed" className="flex-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completed ({completedBridges.length})
            </TabsTrigger>
            <TabsTrigger value="failed" data-testid="tab-failed" className="flex-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <XCircle className="h-4 w-4 mr-2" />
              Failed ({failedBridges.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" className="flex-1 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <History className="h-4 w-4 mr-2" />
              History ({(history?.length || 0) + (crossChainJobs?.jobs?.length || 0)})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-6">
          <BridgeSection
            type="active"
            bridges={activeBridges}
            withdrawals={activeWithdrawals}
            isLoading={isLoading}
            address={address}
            onSendPayment={handleSendPayment}
            onCancelBridge={handleCancelBridge}
            isVaultsLoading={isLoadingVaults}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <BridgeSection
            type="completed"
            bridges={completedBridges}
            isLoading={isLoading}
            address={address}
            onSendPayment={handleSendPayment}
            isVaultsLoading={isLoadingVaults}
          />
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          <BridgeSection
            type="failed"
            bridges={failedBridges}
            isLoading={isLoading}
            address={address}
            onSendPayment={handleSendPayment}
            isVaultsLoading={isLoadingVaults}
            retryAllMutation={retryAllMutation}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistorySection
            history={history}
            crossChainJobs={crossChainJobs?.jobs}
            isLoadingHistory={isLoadingHistory}
            address={address}
          />
        </TabsContent>
        </Tabs>
      )}

      {selectedBridge && (
        <BridgeStatusModal
          open={!!selectedBridge}
          onOpenChange={(open) => {
            if (!open) setSelectedBridge(null);
          }}
          bridgeId={selectedBridge.bridgeId}
          vaultName={selectedBridge.vaultName}
          amount={selectedBridge.amount}
        />
      )}

      <AlertDialog open={!!bridgeToCancel} onOpenChange={(open) => !open && setBridgeToCancel(null)}>
        <AlertDialogContent data-testid="dialog-cancel-bridge">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this deposit of {bridgeToCancel?.amount} XRP?
              This action will remove the deposit request from processing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-no">
              Keep Deposit
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bridgeToCancel) {
                  cancelBridgeMutation.mutate(bridgeToCancel.id);
                }
              }}
              disabled={cancelBridgeMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-cancel-yes"
            >
              {cancelBridgeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Deposit"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
