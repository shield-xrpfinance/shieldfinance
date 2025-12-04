import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  Clock, 
  Loader2, 
  XCircle, 
  ExternalLink,
  AlertCircle,
  PartyPopper
} from "lucide-react";
import { useNetwork } from "@/lib/networkContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawalStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  txHash?: string;
}

interface WithdrawalProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withdrawalId: string;
  amount: string;
  asset: string;
  vaultName: string;
  ecosystem: "xrpl" | "flare";
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export default function WithdrawalProgressModal({
  open,
  onOpenChange,
  withdrawalId,
  amount,
  asset,
  vaultName,
  ecosystem,
  onComplete,
  onError,
}: WithdrawalProgressModalProps) {
  const { network } = useNetwork();
  const isTestnet = network === "testnet";

  // Define steps based on ecosystem
  const getInitialSteps = (): WithdrawalStep[] => {
    if (ecosystem === "flare") {
      // Direct FXRP withdrawal - simpler flow
      return [
        {
          id: "initiate",
          title: "Initiate Withdrawal",
          description: "Requesting withdrawal from vault",
          status: "pending"
        },
        {
          id: "burn-shares",
          title: "Burn Vault Shares",
          description: "Burning shXRP tokens for FXRP",
          status: "pending"
        },
        {
          id: "transfer",
          title: "Transfer FXRP",
          description: "Sending FXRP to your wallet",
          status: "pending"
        },
        {
          id: "confirmation",
          title: "Confirm Transaction",
          description: "Waiting for blockchain confirmation",
          status: "pending"
        }
      ];
    } else {
      // XRPL ecosystem - full redemption flow
      return [
        {
          id: "initiate",
          title: "Initiate Withdrawal",
          description: "Starting vault withdrawal process",
          status: "pending"
        },
        {
          id: "burn-shares",
          title: "Burn shXRP",
          description: "Redeeming vault shares for FXRP",
          status: "pending"
        },
        {
          id: "redemption-request",
          title: "FAssets Redemption",
          description: "Requesting FXRP to XRP redemption",
          status: "pending"
        },
        {
          id: "bridge-processing",
          title: "Bridge Processing",
          description: "FAssets bridge processing redemption",
          status: "pending"
        },
        {
          id: "xrpl-payment",
          title: "XRP Payment",
          description: "Receiving XRP on XRPL",
          status: "pending"
        }
      ];
    }
  };

  const [steps, setSteps] = useState<WithdrawalStep[]>(getInitialSteps());
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate progress percentage
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  // Poll for status updates
  useEffect(() => {
    if (!open || !withdrawalId) return;

    const pollStatus = async () => {
      try {
        const endpoint = ecosystem === "flare" 
          ? `/api/withdrawals/fxrp/status/${withdrawalId}`
          : `/api/withdrawals/status/${withdrawalId}`;
          
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error("Failed to fetch status");
        
        const data = await response.json();
        
        // Update steps based on status
        const updatedSteps = [...steps];
        data.steps?.forEach((stepData: any) => {
          const stepIndex = updatedSteps.findIndex(s => s.id === stepData.id);
          if (stepIndex !== -1) {
            updatedSteps[stepIndex] = {
              ...updatedSteps[stepIndex],
              status: stepData.status,
              txHash: stepData.txHash
            };
          }
        });
        
        setSteps(updatedSteps);
        
        // Update current step index
        const inProgressIndex = updatedSteps.findIndex(s => s.status === "in-progress");
        const lastCompletedIndex = updatedSteps.findLastIndex(s => s.status === "completed");
        
        if (inProgressIndex !== -1) {
          setCurrentStepIndex(inProgressIndex);
        } else if (lastCompletedIndex !== -1) {
          setCurrentStepIndex(Math.min(lastCompletedIndex + 1, updatedSteps.length - 1));
        }
        
        // Check for completion
        if (updatedSteps.every(s => s.status === "completed")) {
          onComplete?.();
        }
        
        // Check for errors
        const failedStep = updatedSteps.find(s => s.status === "failed");
        if (failedStep) {
          setError(`Failed at step: ${failedStep.title}`);
          onError?.(failedStep.title);
        }
        
      } catch (err) {
        console.error("Error polling withdrawal status:", err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [open, withdrawalId, ecosystem]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in-progress":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getExplorerUrl = (txHash: string) => {
    if (ecosystem === "flare") {
      return isTestnet
        ? `https://coston2-explorer.flare.network/tx/${txHash}`
        : `https://flare-explorer.flare.network/tx/${txHash}`;
    } else {
      return isTestnet
        ? `https://testnet.xrpl.org/transactions/${txHash}`
        : `https://livenet.xrpl.org/transactions/${txHash}`;
    }
  };

  const isComplete = steps.every(s => s.status === "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isComplete 
              ? "Withdrawal Complete!" 
              : `${ecosystem === "flare" ? "Direct Withdrawal" : "Bridged Withdrawal"} in Progress`}
          </DialogTitle>
          <DialogDescription>
            {isComplete 
              ? `Successfully withdrew ${amount} ${asset} from ${vaultName}`
              : `Withdrawing ${amount} ${asset} from ${vaultName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Success Banner when complete */}
          {isComplete && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex-shrink-0 p-2 rounded-full bg-green-500/20">
                <PartyPopper className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-600 dark:text-green-400">
                  Funds received!
                </p>
                <p className="text-sm text-muted-foreground">
                  {ecosystem === "flare" 
                    ? "FXRP has been sent to your Flare wallet" 
                    : "XRP has been sent to your XRPL wallet"}
                </p>
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-mono">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step) => (
              <Card 
                key={step.id}
                className={`p-4 transition-all ${
                  step.status === "in-progress" ? "border-primary" : ""
                } ${step.status === "failed" ? "border-destructive" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {getStepIcon(step.status)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{step.title}</h4>
                      {step.status === "in-progress" && (
                        <Badge variant="secondary" className="text-xs">
                          Processing
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                    {step.txHash && (
                      <a
                        href={getExplorerUrl(step.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        View transaction
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info based on ecosystem */}
          {ecosystem === "xrpl" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Redemption through FAssets bridge typically takes 3-7 minutes. Your XRP will be sent to your XRPL wallet.
              </AlertDescription>
            </Alert>
          )}
          
          {ecosystem === "flare" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Direct withdrawal typically completes within 30 seconds. FXRP will be sent to your Flare wallet.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Close button only shown when complete or failed */}
        {(isComplete || error) && (
          <div className="flex justify-end">
            <Button
              onClick={() => onOpenChange(false)}
              variant={error ? "destructive" : "default"}
              data-testid="button-withdrawal-close"
            >
              {error ? "Close" : "Close"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}