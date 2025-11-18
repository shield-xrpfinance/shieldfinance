import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { BridgeStatus } from "@/components/BridgeStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Wallet, RefreshCw, Loader2, History, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BridgeStatusModal from "@/components/BridgeStatusModal";
import { format } from "date-fns";
import type { SelectXrpToFxrpBridge, Vault, BridgeHistoryEntry } from "@shared/schema";
import { useBridgeTracking } from "@/hooks/useBridgeTracking";
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

export default function BridgeTracking() {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState("active");
  const [selectedBridge, setSelectedBridge] = useState<{
    bridgeId: string;
    vaultName: string;
    amount: string;
  } | null>(null);
  const [bridgeToCancel, setBridgeToCancel] = useState<{ id: string; amount: string } | null>(null);
  const { toast } = useToast();

  const { data: bridges, isLoading } = useQuery<SelectXrpToFxrpBridge[]>({
    queryKey: [`/api/bridges/wallet/${address}`],
    enabled: !!address,
  });

  const { data: vaults, isLoading: isLoadingVaults } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery<BridgeHistoryEntry[]>({
    queryKey: [`/api/bridge-history/${address}`],
    enabled: !!address,
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
        walletAddress: address,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bridge Cancelled",
        description: "Your deposit request has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/bridges/wallet/${address}`] });
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

  const { activeBridges, completedBridges, failedBridges } = useMemo(() => {
    if (!bridges) {
      return { activeBridges: [], completedBridges: [], failedBridges: [] };
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

    return {
      activeBridges: active,
      completedBridges: completed,
      failedBridges: failed,
    };
  }, [bridges]);

  // Enable real-time polling when there are active bridges
  useBridgeTracking(activeBridges.length > 0, address);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Bridge Tracking
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
          Monitor your XRP to FXRP bridge operations in real-time
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-bridge-tracking">
          <TabsTrigger value="active" data-testid="tab-active">
            <Activity className="h-4 w-4 mr-2" />
            Active ({activeBridges.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed ({completedBridges.length})
          </TabsTrigger>
          <TabsTrigger value="failed" data-testid="tab-failed">
            <XCircle className="h-4 w-4 mr-2" />
            Failed ({failedBridges.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            History ({history?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : activeBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-active-bridges">
                  No active bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Start a new deposit to see your bridge operations here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBridges.map((bridge) => (
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  onCancelBridge={() => handleCancelBridge(bridge)}
                  isVaultsLoading={isLoadingVaults}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : completedBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-completed-bridges">
                  No completed bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Successfully completed bridges will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedBridges.map((bridge) => (
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  isVaultsLoading={isLoadingVaults}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : failedBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-failed-bridges">
                  No failed bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Failed bridge operations will appear here for troubleshooting
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {failedBridges.length} failed bridge{failedBridges.length !== 1 ? 's' : ''}
                </p>
                <Button
                  variant="outline"
                  onClick={() => retryAllMutation.mutate()}
                  disabled={retryAllMutation.isPending}
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
              {failedBridges.map((bridge) => (
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  isVaultsLoading={isLoadingVaults}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoadingHistory ? (
            <LoadingMessage />
          ) : !history || history.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-history">
                  No bridge history
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Your deposits and withdrawals will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <Card key={entry.id} data-testid={`card-history-${entry.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {entry.type === "deposit" ? (
                            <ArrowDownToLine className="h-5 w-5 text-green-500" />
                          ) : (
                            <ArrowUpFromLine className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                      <div className="text-right">
                        <p className="font-semibold" data-testid={`text-amount-${entry.id}`}>
                          {parseFloat(entry.amount).toFixed(6)} XRP
                        </p>
                        <div className="flex gap-2 mt-2">
                          {entry.xrplTxHash && (
                            <Button
                              variant="outline"
                              size="sm"
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
          )}
        </TabsContent>
      </Tabs>

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
