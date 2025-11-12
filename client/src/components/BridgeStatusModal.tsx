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
  Info
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import type { SelectXrpToFxrpBridge } from "@shared/schema";

interface BridgeStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bridgeId: string;
  vaultName: string;
  amount: string;
}

const statusConfig = {
  pending: {
    icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
    title: "Reserving Collateral",
    description: "Reserving collateral with FAssets agent...",
    step: 1,
    color: "bg-blue-500",
  },
  bridging: {
    icon: <Clock className="h-5 w-5 text-yellow-500" />,
    title: "Awaiting Payment",
    description: "Collateral reserved! Please send XRP to agent address below",
    step: 2,
    color: "bg-yellow-500",
  },
  awaiting_payment: {
    icon: <Clock className="h-5 w-5 text-yellow-500" />,
    title: "Awaiting Payment",
    description: "Waiting for your XRP payment to agent",
    step: 2,
    color: "bg-yellow-500",
  },
  xrpl_confirmed: {
    icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
    title: "Processing Proof",
    description: "Payment confirmed! Generating cryptographic proof... This typically takes 3-5 minutes. Please wait.",
    step: 3,
    color: "bg-blue-500",
  },
  fdc_proof_generated: {
    icon: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
    title: "Executing Minting",
    description: "Proof generated! Executing minting...",
    step: 4,
    color: "bg-blue-500",
  },
  completed: {
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    title: "Bridge Completed",
    description: "✅ Bridge completed! You received shXRP",
    step: 4,
    color: "bg-green-500",
  },
  failed: {
    icon: <XCircle className="h-5 w-5 text-red-500" />,
    title: "Bridge Failed",
    description: "❌ Bridge failed. Please contact support.",
    step: 0,
    color: "bg-red-500",
  },
};

export default function BridgeStatusModal({
  open,
  onOpenChange,
  bridgeId,
  vaultName,
  amount,
}: BridgeStatusModalProps) {
  const [bridge, setBridge] = useState<SelectXrpToFxrpBridge | null>(null);
  const { toast } = useToast();

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

        // Stop polling if bridge is completed or failed
        if (data.status === "completed" || data.status === "failed") {
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
  }, [open, bridgeId, toast]);

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
    if (bridge?.id) {
      // Copy plain UUID - Xaman wallet will hex-encode it automatically
      navigator.clipboard.writeText(bridge.id);
      toast({
        title: "Copied!",
        description: "MEMO copied to clipboard",
      });
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

  const status = statusConfig[bridge.status as keyof typeof statusConfig] || statusConfig.pending;
  const progress = (status.step / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-bridge-status">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {status.icon}
            <div>
              <DialogTitle data-testid="text-bridge-status-title">{status.title}</DialogTitle>
              <DialogDescription>{status.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step-by-Step Progress Indicator */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bridge Progress</span>
              <span className="font-medium">{status.step} of 4 steps</span>
            </div>
            <Progress value={progress} className="h-2" data-testid="progress-bridge" />
            
            {/* Visual Stepper */}
            <div className="space-y-3">
              {/* Step 1: Reserve Collateral */}
              <div className={`flex items-start gap-3 p-3 rounded-md transition-colors ${
                status.step >= 1 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  status.step > 1 ? 'bg-green-500' : status.step === 1 ? 'bg-blue-500' : 'bg-muted'
                }`}>
                  {status.step > 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : status.step === 1 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground">1</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Reserve Collateral</p>
                  <p className="text-xs text-muted-foreground">FAssets agent reserves collateral</p>
                </div>
              </div>

              {/* Step 2: Send Payment */}
              <div className={`flex items-start gap-3 p-3 rounded-md transition-colors ${
                status.step >= 2 ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  status.step > 2 ? 'bg-green-500' : status.step === 2 ? 'bg-yellow-500' : 'bg-muted'
                }`}>
                  {status.step > 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : status.step === 2 ? (
                    <Clock className="h-4 w-4 text-white" />
                  ) : (
                    <span className="text-xs text-muted-foreground">2</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Send XRP Payment</p>
                  <p className="text-xs text-muted-foreground">You send XRP to agent address</p>
                </div>
              </div>

              {/* Step 3: Generate Proof */}
              <div className={`flex items-start gap-3 p-3 rounded-md transition-colors ${
                status.step >= 3 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  status.step > 3 ? 'bg-green-500' : status.step === 3 ? 'bg-blue-500' : 'bg-muted'
                }`}>
                  {status.step > 3 ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : status.step === 3 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground">3</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Generate FDC Proof</p>
                  <p className="text-xs text-muted-foreground">Flare Data Connector verifies payment</p>
                </div>
              </div>

              {/* Step 4: Mint FXRP & shXRP */}
              <div className={`flex items-start gap-3 p-3 rounded-md transition-colors ${
                status.step >= 4 ? bridge.status === 'completed' ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/30'
              }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  bridge.status === 'completed' ? 'bg-green-500' : status.step === 4 ? 'bg-blue-500' : 'bg-muted'
                }`}>
                  {bridge.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : status.step === 4 ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <span className="text-xs text-muted-foreground">4</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Mint FXRP & shXRP</p>
                  <p className="text-xs text-muted-foreground">Receive FXRP, deposit to vault for shXRP</p>
                </div>
              </div>
            </div>
          </div>

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
              <Badge variant={bridge.status === "completed" ? "default" : "secondary"}>
                {bridge.status}
              </Badge>
            </div>
          </div>

          {/* Agent Address - only show if available and not completed */}
          {bridge.agentUnderlyingAddress && bridge.status !== "completed" && (
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
                        <p className="font-medium">MEMO (Required):</p>
                        <Badge variant="outline" className="text-xs">Must include</Badge>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-md bg-background border">
                        <code className="flex-1 text-sm break-all font-mono" data-testid="text-payment-memo">
                          {bridge.id}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCopyMemo}
                          data-testid="button-copy-memo"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wallet will hex-encode automatically - do NOT manually encode
                      </p>
                    </div>

                    <div>
                      <p className="font-medium mb-2">Destination Tag:</p>
                      <p className="text-xs text-muted-foreground p-3 rounded-md bg-background border">Leave empty - Use MEMO field above</p>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center p-4 bg-white rounded-md">
                    <QRCodeSVG 
                      value={bridge.agentUnderlyingAddress} 
                      size={180}
                      data-testid="qr-agent-address"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground text-center font-medium">
                    Send exactly {amount} XRP with the MEMO above
                  </p>
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
          {bridge.status === "failed" && bridge.errorMessage && (
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
          {bridge.status === "completed" && (
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
            variant={bridge.status === "completed" ? "default" : "outline"}
            className="w-full"
            data-testid="button-close-bridge-status"
          >
            {bridge.status === "completed" ? "View Portfolio" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
