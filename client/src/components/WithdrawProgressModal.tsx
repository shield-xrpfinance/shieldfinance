import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type WithdrawProgressStep = 'creating' | 'processing' | 'sending' | 'complete' | 'error';

interface WithdrawProgressModalProps {
  open: boolean;
  currentStep: WithdrawProgressStep;
  errorMessage?: string;
  amount?: string;
  vaultName?: string;
  xrplTxHash?: string;
  network?: 'mainnet' | 'testnet';
  onOpenChange?: (open: boolean) => void;
  onDismiss?: () => void;
}

interface StepConfig {
  id: WithdrawProgressStep;
  title: string;
  description: string;
}

const steps: StepConfig[] = [
  {
    id: 'creating',
    title: 'Creating Withdrawal',
    description: 'Initiating withdrawal request and setting up redemption...',
  },
  {
    id: 'processing',
    title: 'Processing Redemption',
    description: 'Redeeming shXRP shares for FXRP, then requesting XRP redemption from FAssets agent. This typically takes 30-60 seconds.',
  },
  {
    id: 'sending',
    title: 'Sending XRP',
    description: 'FAssets agent is sending XRP to your wallet. Awaiting payment confirmation...',
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'XRP successfully sent to your wallet!',
  },
];

export function WithdrawProgressModal({
  open,
  currentStep,
  errorMessage,
  amount,
  vaultName,
  xrplTxHash,
  network = 'testnet',
  onOpenChange,
  onDismiss,
}: WithdrawProgressModalProps) {
  const getCurrentStepIndex = () => {
    if (currentStep === 'error') return -1;
    return steps.findIndex(s => s.id === currentStep);
  };

  const currentStepIndex = getCurrentStepIndex();

  const getStepStatus = (stepIndex: number): 'completed' | 'active' | 'pending' => {
    if (currentStep === 'error') return 'pending';
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const canDismiss = currentStep === 'error' || currentStep === 'complete';

  const handleDismiss = () => {
    if (canDismiss && onDismiss) {
      onDismiss();
    }
  };

  const getXrplExplorerUrl = (txHash: string) => {
    const baseUrl = network === 'mainnet' 
      ? 'https://livenet.xrpl.org' 
      : 'https://testnet.xrpl.org';
    return `${baseUrl}/transactions/${txHash}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md" 
        data-testid="dialog-withdraw-progress"
        onPointerDownOutside={(e) => {
          if (!canDismiss) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!canDismiss) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {currentStep === 'error' ? 'Withdrawal Failed' : 
             currentStep === 'complete' ? 'Withdrawal Complete!' : 
             'Processing Your Withdrawal'}
          </DialogTitle>
          {amount && vaultName && (
            <DialogDescription className="text-center">
              {amount} shXRP → XRP
            </DialogDescription>
          )}
        </DialogHeader>

        {currentStep === 'error' ? (
          <div className="py-3 sm:py-6 text-center space-y-3 sm:space-y-4">
            <div className="flex justify-center mb-2 sm:mb-4">
              <div className="rounded-full bg-destructive/10 p-2 sm:p-3">
                <Circle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {errorMessage || 'An error occurred while processing the withdrawal. Please try again.'}
            </p>
            <Button 
              onClick={handleDismiss}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              data-testid="button-dismiss-error"
            >
              Close
            </Button>
          </div>
        ) : currentStep === 'complete' ? (
          <div className="py-3 sm:py-6 text-center space-y-3 sm:space-y-4">
            <div className="flex justify-center mb-2 sm:mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-2 sm:p-3">
                <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <p className="text-xs sm:text-sm font-medium">
                {amount} XRP sent to your wallet
              </p>
              <p className="text-xs text-muted-foreground">
                Completed successfully!
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:pt-2">
              {xrplTxHash && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full text-xs"
                  data-testid="button-view-transaction"
                >
                  <a 
                    href={getXrplExplorerUrl(xrplTxHash)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    View on Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
              <Button 
                onClick={handleDismiss}
                size="sm"
                className="w-full"
                data-testid="button-dismiss-complete"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-3 sm:py-6 space-y-2 sm:space-y-4" data-testid="withdraw-progress-steps-container">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              
              return (
                <div 
                  key={step.id} 
                  className="flex items-start gap-2 sm:gap-4"
                  data-testid={`withdraw-step-${step.id}`}
                >
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all",
                        status === 'completed' && "bg-green-100 dark:bg-green-900/20 border-green-600 dark:border-green-400",
                        status === 'active' && "bg-primary/10 border-primary",
                        status === 'pending' && "bg-muted border-muted-foreground/20"
                      )}
                    >
                      {status === 'completed' && (
                        <CheckCircle2 
                          className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" 
                          data-testid={`withdraw-step-icon-${step.id}-completed`}
                        />
                      )}
                      {status === 'active' && (
                        <Loader2 
                          className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin" 
                          data-testid={`withdraw-step-icon-${step.id}-active`}
                        />
                      )}
                      {status === 'pending' && (
                        <Circle 
                          className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/40" 
                          data-testid={`withdraw-step-icon-${step.id}-pending`}
                        />
                      )}
                    </div>
                    
                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-8 sm:h-12 mt-1 sm:mt-2 transition-all",
                          status === 'completed' ? "bg-green-600 dark:bg-green-400" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                  </div>

                  <div className="flex-1 pt-0.5 min-w-0">
                    <h4
                      className={cn(
                        "text-xs sm:text-sm font-medium transition-colors leading-tight",
                        status === 'active' && "text-foreground",
                        status === 'completed' && "text-green-600 dark:text-green-400",
                        status === 'pending' && "text-muted-foreground"
                      )}
                      data-testid={`withdraw-step-title-${step.id}`}
                    >
                      {step.title}
                    </h4>
                    <p
                      className={cn(
                        "text-xs transition-colors leading-snug",
                        status === 'active' && "text-muted-foreground mt-0.5",
                        status === 'completed' && "text-muted-foreground/80 mt-0.5",
                        status === 'pending' && "text-muted-foreground/60 mt-0.5"
                      )}
                      data-testid={`withdraw-step-description-${step.id}`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentStep === 'processing' && (
          <div className="text-center text-xs text-muted-foreground">
            This may take up to 90 seconds...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
