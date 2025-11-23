import { CheckCircle2, Clock, AlertCircle, Loader2, Copy, RefreshCw, Send, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Note: XRPL wallets (Xaman) automatically hex-encode MEMO fields
// Users should enter the plain UUID, not the hex-encoded version

interface BridgeStatusProps {
  status: string;
  xrpAmount: string;
  fxrpExpected: string;
  xrplTxHash?: string;
  flareTxHash?: string;
  vaultMintTxHash?: string;
  errorMessage?: string;
  bridgeId?: string;
  agentUnderlyingAddress?: string;
  onSendPayment?: () => void;
  onCancelBridge?: () => void;
  isVaultsLoading?: boolean;
  onNavigateToBridgeTracking?: () => void;
  onNavigateToPortfolio?: () => void;
}

export function BridgeStatus({
  status,
  xrpAmount,
  fxrpExpected,
  xrplTxHash,
  flareTxHash,
  vaultMintTxHash,
  errorMessage,
  bridgeId,
  agentUnderlyingAddress,
  onSendPayment,
  onCancelBridge,
  isVaultsLoading = false,
  onNavigateToBridgeTracking,
  onNavigateToPortfolio,
}: BridgeStatusProps) {
  const { toast } = useToast();
  
  // Determine if bridge can be cancelled
  // Can only cancel BEFORE XRPL transaction is confirmed (before minting starts)
  // Safe to cancel: pending, reserving_collateral, bridging, awaiting_payment
  // NOT safe to cancel: xrpl_confirmed onwards (XRP sent, minting in progress)
  const cancellableStatuses = ["pending", "reserving_collateral", "bridging", "awaiting_payment"];
  const canCancel = cancellableStatuses.includes(status) && !errorMessage;

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!bridgeId) throw new Error("Bridge ID is required");
      const response = await apiRequest("POST", `/api/bridges/${bridgeId}/reconcile`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Retry Successful",
        description: data.message || "Bridge reconciliation initiated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bridges/wallet'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry bridge reconciliation",
        variant: "destructive",
      });
    },
  });
  
  const stages = [
    { 
      key: "pending", 
      label: "XRPL Confirmation", 
      completed: ["xrpl_confirmed", "proof_generated", "minting", "vault_minting", "completed", "vault_minted"].includes(status) 
    },
    { 
      key: "proof", 
      label: "XRP → FXRP Bridge", 
      completed: ["proof_generated", "minting", "vault_minting", "completed", "vault_minted"].includes(status) 
    },
    { 
      key: "minting", 
      label: "Minting Vault Shares", 
      completed: ["completed", "vault_minted"].includes(status),
      failed: status === "vault_mint_failed"
    },
    { 
      key: "completed", 
      label: "shXRP Shares Ready", 
      completed: ["completed", "vault_minted"].includes(status) 
    },
  ];
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const currentStageIndex = stages.findIndex((s) => !s.completed);
  const progress = ((currentStageIndex === -1 ? stages.length : currentStageIndex) / stages.length) * 100;

  return (
    <Card data-testid={`card-bridge-${status}`}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Deposit Processing</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {(status === "completed" || status === "vault_minted") && (
              <Badge variant="default" data-testid="badge-status-completed">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            )}
            {(status === "failed" || status === "vault_mint_failed" || errorMessage) && (
              <>
                <Badge variant="destructive" data-testid="badge-status-failed">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Failed
                </Badge>
                {bridgeId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                    data-testid="button-retry-bridge"
                  >
                    {retryMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </>
            )}
            {status === "vault_minting" && (
              <Badge variant="secondary" data-testid="badge-status-processing">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Minting Shares
              </Badge>
            )}
            {!["completed", "vault_minted", "failed", "vault_mint_failed", "vault_minting"].includes(status) && !errorMessage && (
              <Badge variant="secondary" data-testid="badge-status-processing">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Processing
              </Badge>
            )}
            {canCancel && onCancelBridge && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelBridge}
                data-testid="button-cancel-bridge"
                className="text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Depositing {xrpAmount} XRP → {fxrpExpected} shXRP shares
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {bridgeId && (
          <div className="rounded-lg bg-muted p-3 space-y-3" data-testid="bridge-id-section">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bridge ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-2 py-1.5 font-mono text-xs break-all" data-testid="text-bridge-id-display">
                  {bridgeId}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(bridgeId, "Bridge ID")}
                  data-testid="button-copy-bridge-id"
                  className="self-start"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {(status === "completed" || status === "vault_minted") && onNavigateToPortfolio && (
              <Button
                variant="default"
                size="sm"
                onClick={onNavigateToPortfolio}
                data-testid="button-view-portfolio-bridge"
                className="w-full"
              >
                View in Portfolio
              </Button>
            )}
            
            {!["completed", "vault_minted", "failed", "vault_mint_failed"].includes(status) && onNavigateToBridgeTracking && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToBridgeTracking}
                data-testid="button-view-bridge-tracking-status"
                className="w-full"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Track Bridge
              </Button>
            )}
          </div>
        )}

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} data-testid="progress-bridge" />
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className="flex items-start gap-3"
              data-testid={`stage-${stage.key}`}
            >
              {stage.failed ? (
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" data-testid={`icon-${stage.key}-failed`} />
              ) : stage.completed ? (
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" data-testid={`icon-${stage.key}-completed`} />
              ) : currentStageIndex === index ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mt-0.5" data-testid={`icon-${stage.key}-processing`} />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" data-testid={`icon-${stage.key}-pending`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${stage.failed ? "text-destructive" : stage.completed ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {status === "awaiting_payment" && bridgeId && agentUnderlyingAddress && (
          <div className="space-y-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Payment Required</p>
              <p className="text-xs text-muted-foreground">Send {xrpAmount} XRP to complete the bridge</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Destination Address:</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 rounded bg-background px-2 py-1.5 font-mono text-xs break-all" data-testid="text-agent-address">
                    {agentUnderlyingAddress}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(agentUnderlyingAddress, "Address")}
                    data-testid="button-copy-address"
                    className="self-start sm:self-auto"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Destination Tag (for Xaman):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-2 py-1.5 font-mono text-xs" data-testid="text-destination-tag">
                    Leave empty - Use MEMO field instead
                  </code>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-xs font-medium text-muted-foreground">MEMO (Required):</p>
                  <Badge variant="outline" className="text-xs">Copy this value</Badge>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="flex-1 rounded bg-background px-2 py-1.5 font-mono text-xs break-all" data-testid="text-payment-memo">
                    {bridgeId}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(bridgeId || "", "MEMO")}
                    data-testid="button-copy-memo"
                    className="self-start sm:self-auto"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Wallet will hex-encode automatically - do NOT manually encode
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Bridge ID: {bridgeId}
                </p>
              </div>
            </div>
            {onSendPayment && (
              <Button
                variant="default"
                size="sm"
                onClick={onSendPayment}
                disabled={isVaultsLoading}
                className="w-full"
                data-testid="button-send-payment"
              >
                {isVaultsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Payment
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {xrplTxHash && (
          <div className="flex items-center justify-between text-xs">
            <p className="text-muted-foreground">XRPL Transaction:</p>
            <a
              href={`https://testnet.xrpscan.com/tx/${xrplTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
              data-testid="link-xrpl-tx"
            >
              {xrplTxHash.slice(0, 8)}...{xrplTxHash.slice(-8)}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
        
        {flareTxHash && (
          <div className="flex items-center justify-between text-xs">
            <p className="text-muted-foreground">Flare Transaction:</p>
            <a
              href={`https://coston2-explorer.flare.network/tx/${flareTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
              data-testid="link-flare-tx"
            >
              {flareTxHash.slice(0, 8)}...{flareTxHash.slice(-8)}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {vaultMintTxHash && (
          <div className="flex items-center justify-between text-xs">
            <p className="text-muted-foreground">Vault Mint Transaction:</p>
            <a
              href={`https://coston2-explorer.flare.network/tx/${vaultMintTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
              data-testid="link-vault-mint-tx"
            >
              {vaultMintTxHash.slice(0, 8)}...{vaultMintTxHash.slice(-8)}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {errorMessage && (
          <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm" data-testid="text-error">
            <p className="font-medium text-destructive">Error:</p>
            <p className="text-destructive/80">{errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
