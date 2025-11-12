import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Loader2,
  ArrowRight,
  XCircle,
  Info,
  RefreshCw,
  Send
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWallet } from "@/lib/walletContext";
import XamanSigningModal from "@/components/XamanSigningModal";
import type { SelectXrpToFxrpBridge } from "@shared/schema";

interface BridgeStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bridgeId: string;
  vaultName: string;
  amount: string;
}

// Simplified 4-stage mapping
type BridgeStage = 1 | 2 | 3 | 4 | "timeout" | "failed";

function getBridgeStage(status: string): BridgeStage {
  // Stage 1: Waiting for XRP Payment
  if (["pending", "bridging", "awaiting_payment"].includes(status)) {
    return 1;
  }
  // Stage 2: Bridging XRP → FXRP (proof generation and minting)
  if (["xrpl_confirmed", "generating_proof", "proof_generated", "fdc_proof_generated", "minting"].includes(status)) {
    return 2;
  }
  // Stage 3: Minting Vault Shares
  if (["vault_minting"].includes(status)) {
    return 3;
  }
  // Stage 4: shXRP Shares Ready
  if (["completed", "vault_minted"].includes(status)) {
    return 4;
  }
  // Timeout state
  if (status === "fdc_timeout") {
    return "timeout";
  }
  // Failed states
  if (["failed", "vault_mint_failed"].includes(status)) {
    return "failed";
  }
  return 1; // Default to stage 1
}

export default function BridgeStatusModal({
  open,
  onOpenChange,
  bridgeId,
  vaultName,
  amount,
}: BridgeStatusModalProps) {
  const [bridge, setBridge] = useState<SelectXrpToFxrpBridge | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isSendingPayment, setIsSendingPayment] = useState(false);
  const [xamanPayloadUuid, setXamanPayloadUuid] = useState<string | null>(null);
  const [xamanQrUrl, setXamanQrUrl] = useState<string | null>(null);
  const [xamanDeepLink, setXamanDeepLink] = useState<string | null>(null);
  const [showXamanModal, setShowXamanModal] = useState(false);
  const { toast } = useToast();
  const { requestPayment, provider, isConnected } = useWallet();

  useEffect(() => {
    if (!open || !bridgeId) {
      return;
    }

    let shouldContinuePolling = true;
    
    const pollBridge = async () => {
      try {
        const response = await fetch(`/api/bridges/${bridgeId}`);
        if (!response.ok) throw new Error("Failed to fetch bridge status");
        const data = await response.json();
        setBridge(data);

        // Stop polling if bridge is completed, failed, or timed out
        const terminalStates = ["completed", "vault_minted", "failed", "vault_mint_failed", "fdc_timeout"];
        if (terminalStates.includes(data.status)) {
          shouldContinuePolling = false;
        }
      } catch (error) {
        console.error("Error polling bridge status:", error);
        toast({
          title: "Error",
          description: "Failed to fetch bridge status",
          variant: "destructive",
        });
      }
    };

    // Initial fetch
    pollBridge();

    // Poll every 2 seconds while bridge is not in terminal state
    const interval = setInterval(() => {
      if (shouldContinuePolling) {
        pollBridge();
      } else {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      shouldContinuePolling = false;
      clearInterval(interval);
    };
  }, [open, bridgeId, toast, retryCount]);

  const handleCopyAddress = () => {
    if (bridge?.agentUnderlyingAddress) {
      navigator.clipboard.writeText(bridge.agentUnderlyingAddress);
      toast({
        title: "Copied",
        description: "Agent address copied to clipboard",
      });
    }
  };

  const handleCopyMemo = () => {
    if (bridge?.paymentReference) {
      // Copy FAssets payment reference (64-char hex from CollateralReserved event)
      navigator.clipboard.writeText(bridge.paymentReference);
      toast({
        title: "Copied!",
        description: "Payment reference copied to clipboard",
      });
    }
  };

  const handleRetryProof = async () => {
    if (!bridge) return;
    
    setIsRetrying(true);
    try {
      const response = await apiRequest("POST", `/api/bridges/${bridge.id}/retry-proof`);
      const result = await response.json();

      if (result.success) {
        toast({
          title: "Retry Initiated",
          description: "FDC proof generation retry has been started. This may take 5-15 minutes.",
        });
        
        // Increment retry count to restart polling
        setRetryCount(prev => prev + 1);
        
        // Refresh bridge status
        const updatedResponse = await fetch(`/api/bridges/${bridge.id}`);
        if (updatedResponse.ok) {
          const updatedBridge = await updatedResponse.json();
          setBridge(updatedBridge);
        }
      }
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry proof generation",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSendPayment = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!bridge?.agentUnderlyingAddress || !bridge?.paymentReference) {
      toast({
        title: "Payment Details Missing",
        description: "Bridge is not ready for payment yet",
        variant: "destructive",
      });
      return;
    }

    setIsSendingPayment(true);
    try {
      // Convert XRP amount to drops (1 XRP = 1,000,000 drops)
      const xrpAmount = parseFloat(bridge.xrpAmount);
      const amountInDrops = (xrpAmount * 1_000_000).toString();

      const result = await requestPayment({
        destination: bridge.agentUnderlyingAddress,
        amountDrops: amountInDrops,
        memo: bridge.paymentReference,
        network: "testnet", // Coston2 testnet
      });

      if (result.success) {
        if (provider === "xaman" && result.payloadUuid) {
          // Show Xaman QR code modal
          setXamanPayloadUuid(result.payloadUuid);
          setXamanQrUrl(result.qrUrl || null);
          setXamanDeepLink(result.deepLink || null);
          setShowXamanModal(true);
        } else if (provider === "walletconnect") {
          // WalletConnect auto-triggers signing, just show success
          toast({
            title: "Payment Sent!",
            description: "Transaction submitted. Waiting for confirmation...",
          });
        }
      } else {
        toast({
          title: "Payment Failed",
          description: result.error || "Failed to create payment request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending payment:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to send payment",
        variant: "destructive",
      });
    } finally {
      setIsSendingPayment(false);
    }
  };

  const handleXamanSuccess = (txHash: string) => {
    toast({
      title: "Payment Sent!",
      description: "Your XRP payment has been sent. Bridge processing will continue automatically.",
    });
    setShowXamanModal(false);
    // Refresh bridge status to pick up the payment
    setRetryCount(prev => prev + 1);
  };

  const handleXamanError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
    setShowXamanModal(false);
  };

  if (!bridge) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-bridge-status-loading">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading bridge status...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const stage = getBridgeStage(bridge.status);
  const isCompleted = stage === 4;
  const isFailed = stage === "failed";
  const isTimeout = stage === "timeout";
  
  // Calculate progress (0-100%)
  const progress = typeof stage === "number" ? (stage / 4) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-bridge-status">
        <DialogHeader>
          <DialogTitle data-testid="text-bridge-status-title">
            {isCompleted && "Bridge Complete!"}
            {isFailed && "Bridge Failed"}
            {isTimeout && "FDC Proof Timeout"}
            {!isCompleted && !isFailed && !isTimeout && "Bridge in Progress"}
          </DialogTitle>
          <DialogDescription>
            {isCompleted && "Your XRP has been successfully bridged to shXRP"}
            {isFailed && "The bridge operation encountered an error"}
            {isTimeout && "FDC proof generation timed out - this is a known testnet issue"}
            {!isCompleted && !isFailed && !isTimeout && `Processing your ${amount} XRP bridge to ${vaultName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar - only show for active stages */}
          {!isTimeout && !isFailed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">Stage {stage} of 4</span>
              </div>
              <Progress value={progress} className="h-2" data-testid="progress-bridge" />
            </div>
          )}

          {/* Simplified 4-Stage Indicator */}
          {!isTimeout && !isFailed && (
            <div className="space-y-3">
              {/* Stage 1: Waiting for XRP Payment */}
              <div className={`flex items-start gap-3 p-3 rounded-md ${
                stage >= 1 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  stage > 1 ? 'bg-green-500' : stage === 1 ? 'bg-primary' : 'bg-muted'
                }`}>
                  {stage > 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : stage === 1 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-white">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Waiting for XRP Payment</p>
                  <p className="text-xs text-muted-foreground">Send XRP to the agent address below</p>
                </div>
              </div>

              {/* Stage 2: Bridging XRP → FXRP */}
              <div className={`flex items-start gap-3 p-3 rounded-md ${
                stage >= 2 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  stage > 2 ? 'bg-green-500' : stage === 2 ? 'bg-primary' : 'bg-muted'
                }`}>
                  {stage > 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : stage === 2 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-white">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Bridging XRP → FXRP</p>
                  <p className="text-xs text-muted-foreground">Generating FDC proof and minting FXRP (5-15 min)</p>
                </div>
              </div>

              {/* Stage 3: Minting Vault Shares */}
              <div className={`flex items-start gap-3 p-3 rounded-md ${
                stage >= 3 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  stage > 3 ? 'bg-green-500' : stage === 3 ? 'bg-primary' : 'bg-muted'
                }`}>
                  {stage > 3 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : stage === 3 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-white">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Minting Vault Shares</p>
                  <p className="text-xs text-muted-foreground">Depositing FXRP and minting shXRP shares</p>
                </div>
              </div>

              {/* Stage 4: shXRP Shares Ready */}
              <div className={`flex items-start gap-3 p-3 rounded-md ${
                stage === 4 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  stage === 4 ? 'bg-green-500' : 'bg-muted'
                }`}>
                  {stage === 4 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <span className="text-xs text-white">4</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">shXRP Shares Ready</p>
                  <p className="text-xs text-muted-foreground">Bridge complete! Vault shares in your portfolio</p>
                </div>
              </div>
            </div>
          )}

          {/* FDC Timeout State */}
          {isTimeout && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10" data-testid="alert-timeout">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="space-y-4">
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">FDC Proof Timeout - Testnet Issue</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    The FDC verifier proof generation timed out after 15 minutes. This is a known issue on Flare testnet.
                    You can retry proof generation below.
                  </p>
                </div>
                <Button 
                  onClick={handleRetryProof} 
                  disabled={isRetrying}
                  className="w-full"
                  data-testid="button-retry-proof"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry Proof Generation
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Failed State */}
          {isFailed && (
            <Alert variant="destructive" data-testid="alert-failed">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Bridge Operation Failed</p>
                <p className="text-sm mt-1">{bridge.errorMessage || "An error occurred during the bridge process. Please contact support."}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Vault and Amount Info */}
          <div className="p-4 rounded-md bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vault</span>
              <span className="font-medium">{vaultName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-medium font-mono">{amount} XRP</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={(bridge.status === "completed" || bridge.status === "vault_minted") ? "default" : "secondary"}>
                {bridge.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/20">
              <span className="text-xs text-muted-foreground">Bridge ID (for support)</span>
              <span className="text-xs font-mono text-muted-foreground">{bridge.id.slice(0, 8)}...{bridge.id.slice(-8)}</span>
            </div>
          </div>

          {/* Agent Address - only show if available and not completed */}
          {bridge.agentUnderlyingAddress && bridge.status !== "completed" && bridge.status !== "vault_minted" && (
            <div className="space-y-3">
              <Alert data-testid="alert-agent-address">
                <AlertDescription className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium mb-2">Destination Address:</p>
                      <div className="flex items-center gap-2 p-3 rounded-md bg-background border">
                        <code className="flex-1 text-sm break-all font-mono" data-testid="text-agent-address">
                          {bridge.agentUnderlyingAddress}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopyAddress}
                          data-testid="button-copy-address"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">Payment Reference (Memo):</p>
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-md bg-background border">
                        <code className="flex-1 text-sm break-all font-mono" data-testid="text-payment-memo">
                          {bridge.paymentReference || "Generating..."}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopyMemo}
                          data-testid="button-copy-memo"
                          disabled={!bridge.paymentReference}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This unique FAssets reference must be included in your XRP payment memo
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Destination Tag:</p>
                      <p className="text-xs text-muted-foreground p-3 rounded-md bg-background border">Leave empty - Use MEMO field above</p>
                    </div>
                  </div>

                  {/* Send Payment Button - Wallet Integration */}
                  {isConnected && bridge.paymentReference && bridge.status === "awaiting_payment" && (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleSendPayment}
                        disabled={isSendingPayment}
                        className="w-full"
                        size="lg"
                        data-testid="button-send-payment"
                      >
                        {isSendingPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Preparing Payment...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Payment with {provider === "xaman" ? "Xaman" : provider === "walletconnect" ? "WalletConnect" : "Wallet"}
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Or manually send {amount} XRP using the details above
                      </p>
                    </div>
                  )}

                  {/* QR Code - for manual sending */}
                  <div className="flex justify-center p-4 bg-white rounded-md">
                    <QRCodeSVG 
                      value={bridge.agentUnderlyingAddress} 
                      size={180}
                      data-testid="qr-agent-address"
                    />
                  </div>

                  {!isConnected && (
                    <p className="text-xs text-muted-foreground text-center font-medium">
                      Send exactly {amount} XRP with the MEMO above
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Transaction Hash - show when available */}
          {bridge.flareTxHash && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Transaction Hash:</p>
              <code className="block text-xs bg-muted p-3 rounded-md break-all" data-testid="text-tx-hash">
                {bridge.flareTxHash}
              </code>
            </div>
          )}

          {/* Error Message */}
          {(bridge.status === "failed" || bridge.status === "vault_mint_failed") && bridge.errorMessage && (
            <Alert variant="destructive" data-testid="alert-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{bridge.errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Demo Mode Indicator */}
          {bridge.flareTxHash?.startsWith("DEMO-") && (
            <Alert data-testid="alert-demo-mode">
              <Info className="h-4 w-4" />
              <AlertDescription>
                This is a demo bridge. In production, this would process a real FAssets bridge.
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {(bridge.status === "completed" || bridge.status === "vault_minted") && (
            <Alert className="border-green-500/50 bg-green-500/10" data-testid="alert-success">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Your XRP has been successfully bridged to FXRP and deposited into the vault. 
                You can now view your shXRP tokens in your portfolio.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant={(bridge.status === "completed" || bridge.status === "vault_minted") ? "default" : "outline"}
            className="w-full"
            data-testid="button-close-bridge-status"
          >
            {(bridge.status === "completed" || bridge.status === "vault_minted") ? "View Portfolio" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Xaman Signing Modal */}
      <XamanSigningModal
        open={showXamanModal}
        onOpenChange={setShowXamanModal}
        payloadUuid={xamanPayloadUuid}
        qrUrl={xamanQrUrl}
        deepLink={xamanDeepLink}
        onSuccess={handleXamanSuccess}
        onError={handleXamanError}
        title="Send XRP Payment"
        description="Scan the QR code with your Xaman wallet to send the XRP payment"
      />
    </Dialog>
  );
}
