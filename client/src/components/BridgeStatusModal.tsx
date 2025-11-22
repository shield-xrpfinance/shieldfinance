import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Send,
  Ban,
  ChevronDown,
  ExternalLink
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { QRCodeSVG } from "qrcode.react";
import { differenceInSeconds } from "date-fns";
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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [stageDetailsExpanded, setStageDetailsExpanded] = useState(false);
  const [paymentDetailsExpanded, setPaymentDetailsExpanded] = useState(false);
  const [transactionDetailsExpanded, setTransactionDetailsExpanded] = useState(false);
  const { toast } = useToast();
  const { requestPayment, provider, isConnected, address: walletAddress } = useWallet();

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

        // Stop polling if bridge is completed, failed, timed out, or cancelled
        const terminalStates = ["completed", "vault_minted", "failed", "vault_mint_failed", "fdc_timeout", "cancelled"];
        if (terminalStates.includes(data.status)) {
          shouldContinuePolling = false;
        }
      } catch (error) {
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

  // Countdown timer effect
  useEffect(() => {
    if (!bridge?.expiresAt) {
      setRemainingSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const expiryDate = new Date(bridge.expiresAt!);
      const now = new Date();
      const seconds = differenceInSeconds(expiryDate, now);
      
      if (seconds <= 0) {
        setRemainingSeconds(0);
        return;
      }
      
      setRemainingSeconds(seconds);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [bridge?.expiresAt]);

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
    if (!bridge?.totalAmountUBA) {
      // This should never happen due to button being disabled, but defensive check
      toast({
        title: "Payment Not Ready",
        description: "Waiting for collateral reservation to complete...",
        variant: "default",
      });
      return;
    }

    setIsSendingPayment(true);
    try {
      // Use totalAmountUBA which already includes base amount + FAssets bridge fee
      // This is critical - using xrpAmount would cause payment amount mismatch errors
      const amountInDrops = bridge.totalAmountUBA;

      const result = await requestPayment({
        bridgeId: bridge.id,
        destination: bridge.agentUnderlyingAddress!,
        amountDrops: amountInDrops,
        memo: bridge.paymentReference!,
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

  const handleCancelDeposit = async () => {
    if (!bridge || !walletAddress) {
      toast({
        title: "Error",
        description: "Bridge or wallet not available",
        variant: "destructive",
      });
      return;
    }

    setIsCancelling(true);
    setShowCancelDialog(false);

    try {
      // Request server to create canonical cancel payload (prevents message forgery)
      const payloadResponse = await fetch(`/api/bridges/${bridge.id}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
        }),
      });

      if (!payloadResponse.ok) {
        throw new Error("Failed to create signature request");
      }

      const payloadData = await payloadResponse.json();
      
      // Open Xaman for signing
      if (payloadData.deepLink) {
        window.open(payloadData.deepLink, "_blank");
      }

      // Poll for signature result
      let signedTxBlob: string | null = null;
      const maxAttempts = 60; // 60 seconds timeout
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await fetch(`/api/wallet/xaman/payload/${payloadData.uuid}`);
        const statusData = await statusResponse.json();
        
        if (statusData.signed && statusData.signedTxBlob) {
          signedTxBlob = statusData.signedTxBlob;
          break;
        } else if (statusData.cancelled) {
          throw new Error("Signature request cancelled in Xaman");
        }
      }

      if (!signedTxBlob) {
        throw new Error("Signature request timed out - please try again");
      }

      // Send cancellation request with signed transaction blob
      const response = await apiRequest("POST", `/api/bridges/${bridge.id}/cancel`, {
        walletAddress,
        signedTxBlob,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Deposit Cancelled",
          description: "Your deposit request has been cancelled successfully",
        });

        // Invalidate query cache and refresh bridge status
        queryClient.invalidateQueries({ queryKey: ["/api/bridges", bridge.id] });
        setRetryCount(prev => prev + 1);
      } else {
        throw new Error(result.error || "Failed to cancel deposit");
      }
    } catch (error) {
      console.error("Error cancelling deposit:", error);
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel deposit",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
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

        <div className="space-y-2 sm:space-y-6 py-2 sm:py-4">
          {/* Progress Bar - only show for active stages */}
          {!isTimeout && !isFailed && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">Stage {stage} of 4</span>
              </div>
              <Progress value={progress} className="h-2" data-testid="progress-bridge" />
            </div>
          )}

          {/* Current Stage Indicator - Always Visible */}
          {!isTimeout && !isFailed && typeof stage === "number" && (
            <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md ${
              stage === 4 ? 'bg-green-500/10 border border-green-500/20' : 'bg-primary/10 border border-primary/20'
            }`}>
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                stage === 4 ? 'bg-green-500' : 'bg-primary'
              }`}>
                {stage === 4 ? (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium">
                  {stage === 1 && "Waiting for XRP Payment"}
                  {stage === 2 && "Bridging XRP → FXRP"}
                  {stage === 3 && "Minting Vault Shares"}
                  {stage === 4 && "shXRP Shares Ready"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stage === 1 && "Send XRP to the agent address below"}
                  {stage === 2 && "Generating FDC proof and minting FXRP (5-15 min)"}
                  {stage === 3 && "Depositing FXRP and minting shXRP shares"}
                  {stage === 4 && "Bridge complete! Vault shares in your portfolio"}
                </p>
              </div>
            </div>
          )}

          {/* Vault and Amount Info - ALWAYS VISIBLE */}
          <div className="p-2 sm:p-4 rounded-md bg-muted/50 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Vault</span>
              <span className="text-xs sm:text-sm font-medium">{vaultName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Deposit Amount</span>
              <span className="text-xs sm:text-sm font-medium font-mono">{amount} XRP</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
              <Badge variant={(bridge.status === "completed" || bridge.status === "vault_minted") ? "default" : "secondary"} className="text-xs">
                {bridge.status}
              </Badge>
            </div>
          </div>

          {/* Accordion 1: Stage Details */}
          {!isTimeout && !isFailed && (
            <Collapsible open={stageDetailsExpanded} onOpenChange={setStageDetailsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1" data-testid="button-toggle-stage-details">
                <ChevronDown className={`h-4 w-4 transition-transform ${stageDetailsExpanded ? 'rotate-180' : ''}`} />
                View All Stages
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 sm:space-y-3 pt-2">
                {/* Stage 1: Waiting for XRP Payment */}
                <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md ${
                  stage >= 1 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                }`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    stage > 1 ? 'bg-green-500' : stage === 1 ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {stage > 1 ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : stage === 1 ? (
                      <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <span className="text-xs text-muted-foreground">1</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium">Waiting for XRP Payment</p>
                    <p className="text-xs text-muted-foreground">Send XRP to the agent address below</p>
                  </div>
                </div>

                {/* Stage 2: Bridging XRP → FXRP */}
                <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md ${
                  stage >= 2 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                }`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    stage > 2 ? 'bg-green-500' : stage === 2 ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {stage > 2 ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : stage === 2 ? (
                      <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <span className="text-xs text-muted-foreground">2</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium">Bridging XRP → FXRP</p>
                    <p className="text-xs text-muted-foreground">Generating FDC proof and minting FXRP (5-15 min)</p>
                  </div>
                </div>

                {/* Stage 3: Minting Vault Shares */}
                <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md ${
                  stage >= 3 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                }`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    stage > 3 ? 'bg-green-500' : stage === 3 ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {stage > 3 ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : stage === 3 ? (
                      <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <span className="text-xs text-muted-foreground">3</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium">Minting Vault Shares</p>
                    <p className="text-xs text-muted-foreground">Depositing FXRP and minting shXRP shares</p>
                  </div>
                </div>

                {/* Stage 4: shXRP Shares Ready */}
                <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-md ${
                  stage === 4 ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/30'
                }`}>
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    stage === 4 ? 'bg-green-500' : 'bg-muted'
                  }`}>
                    {stage === 4 ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <span className="text-xs text-muted-foreground">4</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-medium">shXRP Shares Ready</p>
                    <p className="text-xs text-muted-foreground">Bridge complete! Vault shares in your portfolio</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* FDC Timeout State */}
          {isTimeout && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10" data-testid="alert-timeout">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="space-y-2 sm:space-y-4">
                <div>
                  <p className="font-medium text-yellow-900 dark:text-yellow-100">FDC Proof Timeout - Testnet Issue</p>
                  <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 mt-1">
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
                <p className="text-xs sm:text-sm mt-1">{bridge.errorMessage || "An error occurred during the bridge process. Please contact support."}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Countdown Timer - only show for active bridges */}
          {bridge.status !== "completed" && bridge.status !== "vault_minted" && 
           bridge.status !== "failed" && bridge.status !== "vault_mint_failed" && 
           bridge.status !== "cancelled" && remainingSeconds !== null && (
            <Alert 
              variant={remainingSeconds > 300 ? "default" : "destructive"} 
              className={remainingSeconds > 300 ? "border-blue-500/50 bg-blue-500/10" : ""}
              data-testid="alert-countdown"
            >
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-medium">
                    {remainingSeconds > 0 ? "Time Remaining" : "Expired"}
                  </span>
                  <span className="font-mono font-bold text-base sm:text-lg" data-testid="text-countdown">
                    {remainingSeconds > 0 
                      ? `${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')}`
                      : "00:00"
                    }
                  </span>
                </div>
                {remainingSeconds <= 300 && remainingSeconds > 0 && (
                  <p className="text-xs mt-1">
                    This deposit request will expire soon. Please complete payment or cancel.
                  </p>
                )}
                {remainingSeconds === 0 && (
                  <p className="text-xs mt-1">
                    This deposit request has expired and will be automatically cancelled.
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Accordion 2: Transaction Details */}
          <Collapsible open={transactionDetailsExpanded} onOpenChange={setTransactionDetailsExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1" data-testid="button-toggle-transaction-details">
              <ChevronDown className={`h-4 w-4 transition-transform ${transactionDetailsExpanded ? 'rotate-180' : ''}`} />
              Transaction Details
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 sm:space-y-3 pt-2">
              <div className="p-2 sm:p-4 rounded-md bg-muted/50 space-y-2">
                {/* Bridge Fee Breakdown */}
                {bridge && bridge.reservedFeeUBA && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-muted-foreground">Bridge Fee (0.25%)</span>
                      <span className="text-xs sm:text-sm font-medium font-mono">+{(Number(bridge.reservedFeeUBA) / 1_000_000).toFixed(6)} XRP</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/20">
                      <span className="text-xs sm:text-sm font-medium">Total Payment</span>
                      <span className="text-xs sm:text-sm font-bold font-mono">
                        {bridge.totalAmountUBA 
                          ? (Number(bridge.totalAmountUBA) / 1_000_000).toFixed(6)
                          : amount} XRP
                      </span>
                    </div>
                  </>
                )}
                {/* Bridge ID */}
                <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/20">
                  <span className="text-xs text-muted-foreground">Bridge ID (for support)</span>
                  <span className="text-xs font-mono text-muted-foreground">{bridge.id.slice(0, 8)}...{bridge.id.slice(-8)}</span>
                </div>
              </div>

              {/* Transaction Links - show when available */}
              <div className="space-y-2">
                {bridge.xrplTxHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">XRPL Transaction:</span>
                    <a
                      href={`https://testnet.xrpscan.com/tx/${bridge.xrplTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
                      data-testid="link-xrpl-tx"
                    >
                      {bridge.xrplTxHash.slice(0, 8)}...{bridge.xrplTxHash.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {bridge.flareTxHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Flare Transaction:</span>
                    <a
                      href={`https://coston2-explorer.flare.network/tx/${bridge.flareTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
                      data-testid="link-flare-tx"
                    >
                      {bridge.flareTxHash.slice(0, 8)}...{bridge.flareTxHash.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {bridge.vaultMintTxHash && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Vault Mint Tx:</span>
                    <a
                      href={`https://coston2-explorer.flare.network/tx/${bridge.vaultMintTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
                      data-testid="link-vault-mint-tx"
                    >
                      {bridge.vaultMintTxHash.slice(0, 8)}...{bridge.vaultMintTxHash.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Send Payment Button - Always Visible (if applicable) */}
          {isConnected && bridge.paymentReference && bridge.status === "awaiting_payment" && bridge.agentUnderlyingAddress && (
            <div className="space-y-2">
              <Button 
                onClick={handleSendPayment}
                disabled={isSendingPayment || !bridge.totalAmountUBA}
                className="w-full"
                size="lg"
                data-testid="button-send-payment"
              >
                {isSendingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing Payment...
                  </>
                ) : !bridge.totalAmountUBA ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Waiting for Collateral Reservation...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Payment with {provider === "xaman" ? "Xaman" : provider === "walletconnect" ? "WalletConnect" : "Wallet"}
                  </>
                )}
              </Button>
              {!bridge.totalAmountUBA && (
                <p className="text-xs text-muted-foreground text-center">
                  <Info className="inline h-3 w-3 mr-1" />
                  Collateral reservation in progress. Button will enable when ready.
                </p>
              )}
              {bridge.totalAmountUBA && (
                <p className="text-xs text-muted-foreground text-center">
                  Or manually send {(Number(bridge.totalAmountUBA) / 1_000_000).toFixed(6)} XRP using the details below
                </p>
              )}
            </div>
          )}

          {/* Accordion 3: Payment Instructions */}
          {bridge.agentUnderlyingAddress && bridge.status !== "completed" && bridge.status !== "vault_minted" && (
            <Collapsible open={paymentDetailsExpanded} onOpenChange={setPaymentDetailsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1" data-testid="button-toggle-payment-details">
                <ChevronDown className={`h-4 w-4 transition-transform ${paymentDetailsExpanded ? 'rotate-180' : ''}`} />
                Payment Instructions
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 sm:space-y-3 pt-2">
                <Alert data-testid="alert-agent-address">
                  <AlertDescription className="space-y-2 sm:space-y-4">
                    <div className="space-y-2 sm:space-y-3">
                      <div>
                        <p className="text-xs sm:text-sm font-medium mb-2">Destination Address:</p>
                        <div className="flex items-center gap-2 p-2 sm:p-3 rounded-md bg-background border">
                          <code className="flex-1 text-xs sm:text-sm break-all font-mono" data-testid="text-agent-address">
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
                          <p className="text-xs sm:text-sm font-medium">Payment Reference (Memo):</p>
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        </div>
                        <div className="flex items-center gap-2 p-2 sm:p-3 rounded-md bg-background border">
                          <code className="flex-1 text-xs sm:text-sm break-all font-mono" data-testid="text-payment-memo">
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
                        <p className="text-xs sm:text-sm font-medium mb-2">Destination Tag:</p>
                        <p className="text-xs text-muted-foreground p-2 sm:p-3 rounded-md bg-background border">Leave empty - Use MEMO field above</p>
                      </div>
                    </div>

                    {/* QR Code - Desktop Only, centered when visible */}
                    <div className="hidden sm:flex justify-center p-2 sm:p-4 bg-white rounded-md">
                      <QRCodeSVG 
                        value={bridge.agentUnderlyingAddress} 
                        size={180}
                        data-testid="qr-agent-address"
                      />
                    </div>

                    {!isConnected && (
                      <p className="text-xs text-muted-foreground text-center font-medium">
                        Send exactly {bridge.totalAmountUBA 
                          ? (Number(bridge.totalAmountUBA) / 1_000_000).toFixed(6)
                          : amount} XRP with the MEMO above
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Error Message */}
          {(bridge.status === "failed" || bridge.status === "vault_mint_failed") && bridge.errorMessage && (
            <Alert variant="destructive" data-testid="alert-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-medium">{bridge.errorMessage}</p>
                  
                  {/* Amount Mismatch Details */}
                  {(bridge as any).failureCode === 'amount_mismatch' && (bridge as any).receivedAmountDrops && (bridge as any).expectedAmountDrops && (
                    <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-destructive/10 rounded-md text-xs sm:text-sm">
                      <p className="font-semibold mb-2">Payment Amount Mismatch:</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Expected:</span>
                          <span className="font-mono">{(Number((bridge as any).expectedAmountDrops) / 1_000_000).toFixed(6)} XRP</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Received:</span>
                          <span className="font-mono">{(Number((bridge as any).receivedAmountDrops) / 1_000_000).toFixed(6)} XRP</span>
                        </div>
                        <div className="flex justify-between gap-2 pt-2 border-t border-destructive/20">
                          <span className="text-muted-foreground">Difference:</span>
                          <span className="font-mono font-semibold">
                            {(Number((bridge as any).receivedAmountDrops - (bridge as any).expectedAmountDrops) / 1_000_000).toFixed(6)} XRP
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 sm:mt-3 text-xs text-muted-foreground">
                        You must send the exact amount displayed. You can cancel this deposit and create a new one with the correct amount.
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Demo Mode Indicator */}
          {bridge.flareTxHash?.startsWith("DEMO-") && (
            <Alert data-testid="alert-demo-mode">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                This is a demo bridge. In production, this would process a real FAssets bridge.
              </AlertDescription>
            </Alert>
          )}

          {/* Success State */}
          {(bridge.status === "completed" || bridge.status === "vault_minted") && (
            <Alert className="border-green-500/50 bg-green-500/10" data-testid="alert-success">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-xs sm:text-sm text-green-700 dark:text-green-300">
                Your XRP has been successfully bridged to FXRP and deposited into the vault. 
                You can now view your shXRP tokens in your portfolio.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {/* Cancel Deposit Button - allow canceling failed bridges with amount mismatch */}
          {bridge.status !== "completed" && 
           bridge.status !== "vault_minted" && 
           bridge.status !== "cancelled" &&
           bridge.status !== "vault_mint_failed" &&
           bridge.status !== "minting" &&
           bridge.status !== "vault_minting" &&
           (remainingSeconds !== null && remainingSeconds > 0 || bridge.status === "failed") &&
           isConnected && (
            <Button
              onClick={() => setShowCancelDialog(true)}
              variant="destructive"
              className="w-full"
              disabled={isCancelling || remainingSeconds === 0}
              data-testid="button-cancel-deposit"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Cancel Deposit
                </>
              )}
            </Button>
          )}

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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent data-testid="dialog-cancel-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this deposit request? This action cannot be undone.
              {bridge && remainingSeconds !== null && remainingSeconds > 0 && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium text-foreground">Time remaining: {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}</p>
                  <p className="text-xs mt-1">
                    You can still complete the payment within this time, or cancel now to stop this deposit request.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirmation-no">
              Keep Deposit
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelDeposit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-cancel-confirmation-yes"
            >
              Yes, Cancel Deposit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
