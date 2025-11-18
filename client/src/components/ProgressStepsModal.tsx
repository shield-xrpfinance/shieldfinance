import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Circle, ExternalLink, Info, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export type ProgressStep = 'creating' | 'reserving' | 'ready' | 'awaiting_payment' | 'finalizing' | 'completed' | 'error';

interface ProgressStepsModalProps {
  open: boolean;
  currentStep: ProgressStep;
  errorMessage?: string;
  amount?: string;
  vaultName?: string;
  bridgeId?: string;
  onOpenChange?: (open: boolean) => void;
  onNavigateToBridgeTracking?: () => void;
  onNavigateToPortfolio?: () => void;
}

interface StepConfig {
  id: ProgressStep;
  title: string;
  description: string;
}

const steps: StepConfig[] = [
  {
    id: 'creating',
    title: 'Creating Bridge',
    description: 'Setting up your cross-chain deposit...',
  },
  {
    id: 'reserving',
    title: 'Reserving Collateral',
    description: 'Connecting with FAssets agent on Flare Network...',
  },
  {
    id: 'ready',
    title: 'Ready for Payment',
    description: 'Please approve the payment in your wallet',
  },
  {
    id: 'awaiting_payment',
    title: 'Processing Bridge',
    description: 'Payment signed. Waiting for transaction confirmation...',
  },
  {
    id: 'finalizing',
    title: 'Finalizing on Flare',
    description: 'Generating FDC proof and minting vault shares...',
  },
  {
    id: 'completed',
    title: 'Deposit Complete!',
    description: 'Your vault shares are ready in Portfolio',
  },
];

function mapBackendStatusToStep(backendStatus: string): ProgressStep | null {
  const statusMap: Record<string, ProgressStep> = {
    'pending': 'creating',
    'creating': 'creating',
    'reserving_collateral': 'reserving',
    'awaiting_payment': 'awaiting_payment',
    'xrpl_confirmed': 'finalizing',
    'generating_proof': 'finalizing',
    'proof_generated': 'finalizing',
    'minting': 'finalizing',
    'vault_minting': 'finalizing',
    'completed': 'completed',
    'vault_minted': 'completed',
  };
  
  return statusMap[backendStatus] || null;
}

export function ProgressStepsModal({
  open,
  currentStep,
  errorMessage,
  amount,
  vaultName,
  bridgeId,
  onOpenChange,
  onNavigateToBridgeTracking,
  onNavigateToPortfolio,
}: ProgressStepsModalProps) {
  const [internalStep, setInternalStep] = useState<ProgressStep>(currentStep);

  const shouldPoll = !!bridgeId && (internalStep === 'awaiting_payment' || internalStep === 'finalizing');
  
  const { data: depositStatus } = useQuery<{ status: string }>({
    queryKey: ['/api/deposits', bridgeId, 'status'],
    enabled: shouldPoll && open,
    refetchInterval: shouldPoll ? 5000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (depositStatus?.status) {
      const mappedStep = mapBackendStatusToStep(depositStatus.status);
      if (mappedStep && mappedStep !== internalStep) {
        setInternalStep(mappedStep);
      }
    }
  }, [depositStatus, internalStep]);

  useEffect(() => {
    setInternalStep(currentStep);
  }, [currentStep]);

  const displayStep = internalStep;

  const getCurrentStepIndex = () => {
    if (displayStep === 'error') return -1;
    return steps.findIndex(s => s.id === displayStep);
  };

  const currentStepIndex = getCurrentStepIndex();

  const getStepStatus = (stepIndex: number): 'completed' | 'active' | 'pending' => {
    if (displayStep === 'error') return 'pending';
    if (displayStep === 'completed') return 'completed';
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const canDismiss = displayStep === 'error' || displayStep === 'ready' || displayStep === 'awaiting_payment' || displayStep === 'finalizing' || displayStep === 'completed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md" 
        data-testid="dialog-progress-steps"
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
            {displayStep === 'error' ? 'Bridge Creation Failed' : 
             displayStep === 'completed' ? 'Deposit Complete!' : 
             'Preparing Your Deposit'}
          </DialogTitle>
          {amount && vaultName && displayStep !== 'completed' && (
            <DialogDescription className="text-center">
              {amount} XRP → {vaultName}
            </DialogDescription>
          )}
        </DialogHeader>

        {displayStep === 'error' ? (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <Circle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {errorMessage || 'An error occurred while creating the bridge. Please try again.'}
            </p>
          </div>
        ) : displayStep === 'completed' ? (
          <div className="py-6 space-y-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                  <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2" data-testid="text-completion-title">
                Your vault shares are ready!
              </h3>
              <p className="text-sm text-muted-foreground">
                {amount && `${amount} XRP `}successfully deposited{vaultName && ` to ${vaultName}`}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {onNavigateToPortfolio && (
                <Button
                  variant="default"
                  onClick={onNavigateToPortfolio}
                  data-testid="button-view-portfolio"
                  className="w-full"
                >
                  View Portfolio
                </Button>
              )}
              {onNavigateToBridgeTracking && (
                <Button
                  variant="outline"
                  onClick={onNavigateToBridgeTracking}
                  data-testid="button-view-bridge-tracking-completed"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Bridge Tracking
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                data-testid="button-close-completed"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-4" data-testid="progress-steps-container">
            {steps.filter(s => s.id !== 'completed').map((step, index) => {
              const status = getStepStatus(index);
              
              return (
                <div 
                  key={step.id} 
                  className="flex items-start gap-4"
                  data-testid={`progress-step-${step.id}`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                        status === 'completed' && "bg-green-100 dark:bg-green-900/20 border-green-600 dark:border-green-400",
                        status === 'active' && "bg-primary/10 border-primary",
                        status === 'pending' && "bg-muted border-muted-foreground/20"
                      )}
                    >
                      {status === 'completed' && (
                        <CheckCircle2 
                          className="h-6 w-6 text-green-600 dark:text-green-400" 
                          data-testid={`step-icon-${step.id}-completed`}
                        />
                      )}
                      {status === 'active' && (
                        <Loader2 
                          className="h-6 w-6 text-primary animate-spin" 
                          data-testid={`step-icon-${step.id}-active`}
                        />
                      )}
                      {status === 'pending' && (
                        <Circle 
                          className="h-6 w-6 text-muted-foreground/40" 
                          data-testid={`step-icon-${step.id}-pending`}
                        />
                      )}
                    </div>
                    
                    {index < steps.filter(s => s.id !== 'completed').length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-12 mt-2 transition-all",
                          status === 'completed' ? "bg-green-600 dark:bg-green-400" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                  </div>

                  <div className="flex-1 pt-1">
                    <h4
                      className={cn(
                        "font-medium transition-colors",
                        status === 'active' && "text-foreground",
                        status === 'completed' && "text-green-600 dark:text-green-400",
                        status === 'pending' && "text-muted-foreground"
                      )}
                      data-testid={`step-title-${step.id}`}
                    >
                      {step.title}
                    </h4>
                    <p
                      className={cn(
                        "text-sm transition-colors",
                        status === 'active' && "text-muted-foreground",
                        status === 'completed' && "text-muted-foreground/80",
                        status === 'pending' && "text-muted-foreground/60"
                      )}
                      data-testid={`step-description-${step.id}`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {displayStep === 'reserving' && (
          <div className="text-center text-xs text-muted-foreground">
            This may take up to 60 seconds...
          </div>
        )}

        {displayStep === 'finalizing' && (
          <div className="text-center text-xs text-muted-foreground">
            This may take a few minutes...
          </div>
        )}

        {displayStep === 'awaiting_payment' && (
          <div className="space-y-4 pt-2">
            {bridgeId && (
              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Bridge ID
                </p>
                <p className="text-sm font-mono break-all" data-testid="text-bridge-id">
                  {bridgeId}
                </p>
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You can close this and check the bridge status anytime in Bridge Tracking
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2">
              {onNavigateToBridgeTracking && (
                <Button
                  variant="default"
                  onClick={onNavigateToBridgeTracking}
                  data-testid="button-view-bridge-tracking"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Bridge Tracking
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                data-testid="button-dismiss-progress"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
