import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface XamanSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payloadUuid: string | null;
  qrUrl: string | null;
  deepLink: string | null;
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
  title?: string;
  description?: string;
}

export default function XamanSigningModal({
  open,
  onOpenChange,
  payloadUuid,
  qrUrl,
  deepLink,
  onSuccess,
  onError,
  title = "Sign Transaction with Xaman",
  description = "Scan the QR code with your Xaman wallet to sign the transaction",
}: XamanSigningModalProps) {
  const [status, setStatus] = useState<"waiting" | "success" | "error">("waiting");
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    if (!open || !payloadUuid) {
      setStatus("waiting");
      setStatusMessage("");
      return;
    }

    let pollInterval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes with 1 second intervals

    const pollPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/wallet/xaman/payment/${payloadUuid}`);
        const data = await response.json();

        if (data.signed) {
          clearInterval(pollInterval);
          setStatus("success");
          setStatusMessage("Transaction signed successfully!");
          
          setTimeout(() => {
            onSuccess(data.txHash || `tx-${Date.now()}`);
            onOpenChange(false);
          }, 1500);
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setStatus("error");
          setStatusMessage("Signing timeout - please try again");
          onError("Timeout waiting for signature");
        }
      } catch (error) {
        console.error("Error polling payment status:", error);
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setStatus("error");
          setStatusMessage("Error checking transaction status");
          onError("Failed to check transaction status");
        }
      }
    };

    // Start polling immediately
    pollPaymentStatus();
    pollInterval = setInterval(pollPaymentStatus, 1000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [open, payloadUuid, onSuccess, onError, onOpenChange]);

  const handleOpenXaman = () => {
    if (deepLink) {
      window.open(deepLink, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-xaman-signing">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          {status === "waiting" && qrUrl && qrUrl !== "demo" && (
            <>
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={qrUrl} size={200} />
              </div>
              
              {deepLink && (
                <div className="flex flex-col items-center gap-3 w-full">
                  <Button
                    onClick={handleOpenXaman}
                    className="w-full"
                    data-testid="button-open-xaman"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Xaman
                  </Button>
                  <a
                    href="https://xumm.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Don't have Xaman? Download here
                  </a>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for signature...</span>
              </div>
            </>
          )}

          {status === "waiting" && qrUrl === "demo" && (
            <>
              <div className="p-8 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">Demo Mode</p>
                <p className="text-xs text-muted-foreground">
                  Xaman credentials not configured. Transaction will be simulated.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing demo transaction...</span>
              </div>
            </>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-chart-2/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-chart-2" />
              </div>
              <p className="text-sm font-medium text-chart-2">{statusMessage}</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive">{statusMessage}</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
