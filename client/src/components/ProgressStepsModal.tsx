import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Circle, ExternalLink, Info, PartyPopper, AlertCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/lib/walletContext";
import XamanSigningModal from "./XamanSigningModal";

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
    'failed': 'error',
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
  const { requestPayment, provider } = useWallet();
  
  // Track if we've already triggered payment to prevent duplicate calls
  const paymentTriggeredRef = useRef(false);
  
  // State for Xaman payment modal
  const [xamanPaymentModalOpen, setXamanPaymentModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);

  // State for WalletConnect waiting modal
  const [wcWaitingOpen, setWcWaitingOpen] = useState(false);
  const [wcError, setWcError] = useState<string | null>(null);

  // State for minimized modal during finalizing
  const [isMinimized, setIsMinimized] = useState(false);

  // Start polling as soon as we have a bridgeId to detect all status transitions
  const shouldPoll = !!bridgeId && open;
  
  const { data: depositStatus } = useQuery<{ 
    status: string; 
    paymentRequest?: { destination: string; amountDrops: string; memo: string; network: string };
  }>({
    queryKey: ['/api/deposits', bridgeId, 'status'],
    enabled: shouldPoll,
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

  // Reset payment trigger flag when bridgeId changes or modal opens
  useEffect(() => {
    paymentTriggeredRef.current = false;
    setIsMinimized(false); // Reset minimized state when new deposit starts
  }, [bridgeId, open]);

  // Minimize modal when entering finalizing step
  useEffect(() => {
    if (internalStep === 'finalizing' && !isMinimized) {
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, 800); // Wait 800ms before sliding away
      return () => clearTimeout(timer);
    }
  }, [internalStep, isMinimized]);

  // Trigger Xaman/WalletConnect payment when bridge reaches awaiting_payment
  useEffect(() => {
    if (
      depositStatus?.status === 'awaiting_payment' && 
      depositStatus?.paymentRequest && 
      !paymentTriggeredRef.current
    ) {
      paymentTriggeredRef.current = true;
      
      // For WalletConnect, open the modal FIRST to show the waiting state
      // Then send the payment request inside
      if (provider === 'walletconnect') {
        console.log("🔗 Opening WalletConnect payment modal...");
        setWcWaitingOpen(true);
        setWcError(null); // Clear any previous errors
        
        // Send payment request in the background
        requestPayment({
          bridgeId: bridgeId || '',
          destination: depositStatus.paymentRequest.destination,
          amountDrops: depositStatus.paymentRequest.amountDrops,
          memo: depositStatus.paymentRequest.memo,
          network: (depositStatus.paymentRequest.network || 'testnet') as 'mainnet' | 'testnet',
        }).then((result) => {
          if (!result.success) {
            console.error("❌ WalletConnect payment request failed:", result.error);
            // Show error in the modal
            setWcError(result.error || 'Failed to send payment to wallet');
            paymentTriggeredRef.current = false; // Allow retry
          } else {
            console.log("✅ WalletConnect payment sent. Transaction hash:", result.txHash);
            // Modal stays open while waiting for user to approve in wallet
          }
        }).catch((error) => {
          console.error("❌ WalletConnect error:", error);
          setWcError(error instanceof Error ? error.message : 'An error occurred');
          paymentTriggeredRef.current = false; // Allow retry
        });
      } else {
        // For Xaman, use the existing flow
        requestPayment({
          bridgeId: bridgeId || '',
          destination: depositStatus.paymentRequest.destination,
          amountDrops: depositStatus.paymentRequest.amountDrops,
          memo: depositStatus.paymentRequest.memo,
          network: (depositStatus.paymentRequest.network || 'testnet') as 'mainnet' | 'testnet',
        }).then((result) => {
          if (!result.success) {
            console.error("Payment request failed:", result.error);
            paymentTriggeredRef.current = false; // Reset on error to allow retry
            return;
          }

          if (provider === 'xaman') {
            // For Xaman, open the QR code modal
            setXamanPayload({
              uuid: result.payloadUuid || '',
              qrUrl: result.qrUrl || '',
              deepLink: result.deepLink || '',
            });
            setXamanPaymentModalOpen(true);
          }
        }).catch((error) => {
          console.error("Failed to trigger payment modal:", error);
          paymentTriggeredRef.current = false; // Reset on error to allow retry
        });
      }
    }
  }, [depositStatus, bridgeId, requestPayment, provider]);

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
    <>
    {/* Main Progress Modal */}
    <Dialog open={open && !isMinimized} onOpenChange={onOpenChange}>
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
          <div className="py-4 sm:py-6 text-center">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="rounded-full bg-destructive/10 p-2.5 sm:p-3">
                <Circle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {errorMessage || 'An error occurred while creating the bridge. Please try again.'}
            </p>
          </div>
        ) : displayStep === 'completed' ? (
          <div className="py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="text-center">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-2.5 sm:p-3">
                  <PartyPopper className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2" data-testid="text-completion-title">
                Your vault shares are ready!
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
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
          <div className="py-4 sm:py-6 space-y-2 sm:space-y-4" data-testid="progress-steps-container">
            {steps.filter(s => s.id !== 'completed').map((step, index) => {
              const status = getStepStatus(index);
              
              return (
                <div 
                  key={step.id} 
                  className="flex items-start gap-2 sm:gap-4"
                  data-testid={`progress-step-${step.id}`}
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
                          className="h-4 w-4 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" 
                          data-testid={`step-icon-${step.id}-completed`}
                        />
                      )}
                      {status === 'active' && (
                        <Loader2 
                          className="h-4 w-4 sm:h-6 sm:w-6 text-primary animate-spin" 
                          data-testid={`step-icon-${step.id}-active`}
                        />
                      )}
                      {status === 'pending' && (
                        <Circle 
                          className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground/40" 
                          data-testid={`step-icon-${step.id}-pending`}
                        />
                      )}
                    </div>
                    
                    {index < steps.filter(s => s.id !== 'completed').length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 h-6 sm:h-12 mt-1 sm:mt-2 transition-all",
                          status === 'completed' ? "bg-green-600 dark:bg-green-400" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                  </div>

                  <div className="flex-1 pt-0.5 sm:pt-1 min-w-0">
                    <h4
                      className={cn(
                        "text-xs sm:text-sm font-medium transition-colors leading-tight",
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
                        "text-xs transition-colors leading-tight",
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
          <div className="text-center text-xs text-muted-foreground py-2">
            This may take up to 60 seconds...
          </div>
        )}

        {displayStep === 'finalizing' && (
          <div className="text-center text-xs text-muted-foreground py-2">
            This may take a few minutes...
          </div>
        )}

        {displayStep === 'awaiting_payment' && (
          <div className="space-y-2 sm:space-y-4 pt-1 sm:pt-2">
            {bridgeId && (
              <div className="rounded-md bg-muted p-2.5 sm:p-4 space-y-1.5 sm:space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Bridge ID
                </p>
                <p className="text-xs sm:text-sm font-mono break-all" data-testid="text-bridge-id">
                  {bridgeId}
                </p>
              </div>
            )}

            <Alert className="p-2.5 sm:p-4">
              <Info className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm">
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

    {/* Floating Status Badge when minimized */}
    {open && isMinimized && (
      <div className="fixed bottom-4 right-4 animate-slide-up" data-testid="minimized-status-badge">
        <div className="bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs font-medium">Finalizing on Flare...</span>
        </div>
      </div>
    )}
    
    {/* Xaman Payment Modal for QR code scanning */}
    <XamanSigningModal
      open={xamanPaymentModalOpen}
      onOpenChange={setXamanPaymentModalOpen}
      payloadUuid={xamanPayload?.uuid || null}
      qrUrl={xamanPayload?.qrUrl || null}
      deepLink={xamanPayload?.deepLink || null}
      onSuccess={(txHash) => {
        setXamanPaymentModalOpen(false);
      }}
      onError={(error) => {
        console.error("Xaman payment error:", error);
        setXamanPaymentModalOpen(false);
        paymentTriggeredRef.current = false; // Allow retry
      }}
      title="Complete XRP Payment"
      description="Scan the QR code with Xaman to send your XRP to the FAssets bridge agent"
    />

    {/* WalletConnect Payment Modal */}
    <Dialog open={wcWaitingOpen} onOpenChange={setWcWaitingOpen}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-walletconnect-signing">
        <DialogHeader>
          <DialogTitle className="text-center">
            {wcError ? 'Complete Payment Manually' : 'Complete XRP Payment'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {wcError ? 'Send payment through your wallet app' : 'Check your wallet to approve the payment'}
          </DialogDescription>
        </DialogHeader>

        {!wcError ? (
          <div className="py-6 space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Smartphone className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Check your wallet app</p>
              <p className="text-xs text-muted-foreground">
                A transaction signature request is waiting for you. Open your wallet app and approve the XRP payment.
              </p>
            </div>
            <Alert className="p-3">
              <Info className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs">
                Send exactly {(parseFloat(depositStatus?.paymentRequest?.amountDrops || "0") / 1000000).toFixed(6)} XRP to {depositStatus?.paymentRequest?.destination}
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setWcWaitingOpen(false);
                }}
                className="w-full"
                data-testid="button-ready-walletconnect"
              >
                I've approved the payment
              </Button>
              <Button
                variant="outline"
                onClick={() => setWcWaitingOpen(false)}
                className="w-full"
                data-testid="button-close-walletconnect"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <Alert variant="destructive" className="p-3">
              <AlertDescription className="text-xs">
                {wcError}
              </AlertDescription>
            </Alert>
            
            {/* Manual payment instructions */}
            <div className="space-y-3 rounded-md bg-muted p-3">
              <p className="text-xs font-semibold">Send manually through your wallet:</p>
              <div className="space-y-2 text-left text-xs">
                <div>
                  <p className="text-muted-foreground">To:</p>
                  <p className="font-mono break-all" data-testid="manual-payment-address">{depositStatus?.paymentRequest?.destination}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount:</p>
                  <p className="font-mono">{(parseFloat(depositStatus?.paymentRequest?.amountDrops || "0") / 1000000).toFixed(6)} XRP</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Memo:</p>
                  <p className="font-mono break-all text-xs" data-testid="manual-payment-memo">{depositStatus?.paymentRequest?.memo}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setWcError(null);
                  setWcWaitingOpen(false);
                  paymentTriggeredRef.current = false; // Allow retry
                }}
                className="w-full"
                data-testid="button-retry-walletconnect"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setWcError(null);
                  setWcWaitingOpen(false);
                  paymentTriggeredRef.current = false;
                }}
                className="w-full"
                data-testid="button-close-walletconnect-error"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
