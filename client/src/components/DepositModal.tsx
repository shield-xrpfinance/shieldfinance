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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Coins, Wallet as WalletIcon, Loader2, AlertCircle, Info, ChevronDown, Copy, Check } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { useWalletBalances } from "@/hooks/use-wallet-balance";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/lib/networkContext";
import { useLocation } from "wouter";
import ConnectWalletModal from "./ConnectWalletModal";
import XamanSigningModal from "./XamanSigningModal";
import ProgressModal from "./ProgressModal";
import { useStatusPolling } from "@/hooks/useStatusPolling";
import { MultiAssetIcon } from "@/components/AssetIcon";
import type { PaymentRequest, SelectXrpToFxrpBridge } from "@shared/schema";
import { calculateLotRounding, type LotRoundingResult, LOT_SIZE } from "@shared/lotRounding";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  vaultName: string;
  vaultApy: string;
  vaultApyLabel?: string | null;
  depositAssets?: string[];
  onConfirm: (amounts: { [asset: string]: string }) => void;
}

interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  estimate?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  isMilestone?: boolean;
}

// Initial deposit progress steps
const initialDepositSteps: ProgressStep[] = [
  { 
    id: 'payment_signed', 
    label: 'Payment Signed', 
    isMilestone: true, 
    status: 'pending' 
  },
  { 
    id: 'reserving_collateral', 
    label: 'Reserving Collateral', 
    description: 'Securing FXRP from FAssets agent', 
    estimate: '~30s', 
    status: 'pending' 
  },
  { 
    id: 'generating_proof', 
    label: 'Generating FDC Proof', 
    description: 'Flare blockchain verifying your transaction', 
    estimate: '~3 min', 
    status: 'pending' 
  },
  { 
    id: 'minting_shxrp', 
    label: 'Minting shXRP', 
    description: 'Depositing FXRP and receiving shXRP shares', 
    estimate: '~30s', 
    status: 'pending' 
  },
  { 
    id: 'completed', 
    label: 'Deposit Complete', 
    isMilestone: true, 
    status: 'pending' 
  }
];

export default function DepositModal({
  open,
  onOpenChange,
  vaultId,
  vaultName,
  vaultApy,
  vaultApyLabel,
  depositAssets = ["XRP"],
  onConfirm,
}: DepositModalProps) {
  // Form state
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [validatedAmounts, setValidatedAmounts] = useState<{ [key: string]: string }>({});
  const [xrpLotRounding, setXrpLotRounding] = useState<LotRoundingResult | null>(null);
  const [xrpValidationError, setXrpValidationError] = useState<string | null>(null);
  
  // Phase state: form → xaman → progress
  const [depositPhase, setDepositPhase] = useState<'form' | 'xaman' | 'progress'>('form');
  const [isCreatingBridge, setIsCreatingBridge] = useState(false);
  
  // Bridge tracking
  const [bridgeId, setBridgeId] = useState<string | null>(null);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  
  // Progress tracking
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([...initialDepositSteps]);
  const [currentStepId, setCurrentStepId] = useState('payment_signed');
  const [lastMilestone, setLastMilestone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [copiedBridgeId, setCopiedBridgeId] = useState(false);
  
  // UI state
  const [connectWalletModalOpen, setConnectWalletModalOpen] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640;
    }
    return false;
  });

  const { address, isConnected, provider, requestPayment } = useWallet();
  const { balances, isLoading: balancesLoading, error: balancesError, getBalanceFormatted } = useWalletBalances();
  const { toast } = useToast();
  const { network } = useNetwork();
  const [, setLocation] = useLocation();

  // Status polling - poll bridge status when in progress phase
  const { data: bridgeStatus } = useStatusPolling<SelectXrpToFxrpBridge>(
    bridgeId ? `/api/bridges/${bridgeId}` : '',
    { enabled: depositPhase === 'progress' && !!bridgeId, interval: 2000 }
  );

  // Helper to sanitize numeric inputs
  const sanitizeNumericInput = (value: string) => value.replace(/[\s,]+/g, "");

  const availableBalances: { [key: string]: number } = {
    XRP: balances?.balances.XRP || 0,
    RLUSD: balances?.balances.RLUSD || 0,
    USDC: balances?.balances.USDC || 0,
  };

  const totalValue = Object.entries(amounts).reduce((sum, [asset, amount]) => {
    if (!amount) return sum;
    if (asset === "XRP" && xrpLotRounding) {
      return sum + parseFloat(xrpLotRounding.roundedAmount);
    }
    const val = parseFloat(sanitizeNumericInput(amount));
    return sum + val;
  }, 0);

  const isXRPDeposit = depositAssets.includes("XRP");
  const mintingFeePercentage = 0.25;
  const mintingFee = isXRPDeposit ? (totalValue * (mintingFeePercentage / 100)) : 0;
  const totalWithFee = totalValue + mintingFee;
  const projectedEarnings = totalValue ? (totalValue * parseFloat(vaultApy) / 100).toFixed(2) : "0";

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmounts({});
      setStep(1);
      setDepositPhase('form');
      setIsCreatingBridge(false);
      setBridgeId(null);
      setXamanPayload(null);
      setProgressSteps([...initialDepositSteps]);
      setCurrentStepId('payment_signed');
      setLastMilestone(null);
      setErrorMessage(undefined);
      setXrpLotRounding(null);
      setXrpValidationError(null);
    }
  }, [open]);

  // Update info expanded state when screen size changes
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 640;
      setInfoExpanded(isDesktop);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update progress steps based on bridge status
  useEffect(() => {
    // Guard: ensure bridgeStatus exists and has status field before proceeding
    if (!bridgeStatus || !bridgeStatus.status || depositPhase !== 'progress') return;

    const status = bridgeStatus.status;
    console.log("📊 Bridge status update:", status);

    // Map backend status to progress steps
    updateProgressFromStatus(status);

    // Check for milestone completions and show toasts
    const currentStep = progressSteps.find(s => s.status === 'complete' && s.isMilestone && s.id !== lastMilestone);
    if (currentStep) {
      setLastMilestone(currentStep.id);
      
      if (currentStep.id === 'payment_signed') {
        toast({ title: "Payment Signed ✅", description: "Your XRP payment has been confirmed on the ledger" });
      } else if (currentStep.id === 'completed') {
        toast({ title: "Deposit Complete ✅", description: "Your shXRP shares have been minted successfully" });
      }
    }
  }, [bridgeStatus, depositPhase, progressSteps, lastMilestone, toast]);

  // Update progress steps based on backend status
  const updateProgressFromStatus = (status: string) => {
    const updatedSteps = [...progressSteps];
    
    // Reset all to pending first
    updatedSteps.forEach(s => {
      if (s.status !== 'complete') s.status = 'pending';
    });

    if (status === 'xrpl_confirmed') {
      // Payment detected, now reserving collateral
      updatedSteps[0].status = 'complete'; // payment_signed
      updatedSteps[1].status = 'in_progress'; // reserving_collateral
      setCurrentStepId('reserving_collateral');
    } else if (status === 'collateral_reserved' || status === 'awaiting_payment') {
      // Collateral reserved, generating proof
      updatedSteps[0].status = 'complete';
      updatedSteps[1].status = 'complete';
      updatedSteps[2].status = 'in_progress'; // generating_proof
      setCurrentStepId('generating_proof');
    } else if (status === 'proof_generated' || status === 'fdc_proof_generated') {
      // Proof generated, minting shXRP
      updatedSteps[0].status = 'complete';
      updatedSteps[1].status = 'complete';
      updatedSteps[2].status = 'complete';
      updatedSteps[3].status = 'in_progress'; // minting_shxrp
      setCurrentStepId('minting_shxrp');
    } else if (status === 'completed' || status === 'vault_minted') {
      // All steps complete
      updatedSteps.forEach(s => s.status = 'complete');
      setCurrentStepId('completed');
    } else if (status === 'failed' || status === 'fdc_timeout' || status === 'vault_mint_failed') {
      // Error state
      const currentIndex = updatedSteps.findIndex(s => s.status === 'in_progress');
      if (currentIndex >= 0) {
        updatedSteps[currentIndex].status = 'error';
      }
      setErrorMessage(bridgeStatus.errorMessage || "Deposit failed. Please try again.");
    }

    setProgressSteps(updatedSteps);
  };

  const handleContinue = async () => {
    if (step === 1 && Object.keys(amounts).length > 0) {
      // Validate amounts
      const validAmounts = Object.entries(amounts)
        .map(([asset, amt]) => [asset, sanitizeNumericInput(amt)] as [string, string])
        .filter(([_, amt]) => amt && !isNaN(parseFloat(amt)) && parseFloat(amt) > 0);
      
      if (validAmounts.length === 0) {
        toast({
          title: "No Amount Entered",
          description: "Please enter at least one deposit amount greater than 0.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate XRP lot rounding
      let currentXrpRounding: LotRoundingResult | null = null;
      const xrpEntry = validAmounts.find(([asset]) => asset === "XRP");
      if (xrpEntry && depositAssets.includes("XRP")) {
        try {
          currentXrpRounding = calculateLotRounding(xrpEntry[1]);
          setXrpLotRounding(currentXrpRounding);
          setXrpValidationError(null);
        } catch (error) {
          setXrpLotRounding(null);
          setXrpValidationError(error instanceof Error ? error.message : "Invalid amount");
          toast({
            title: "Invalid XRP Amount",
            description: error instanceof Error ? error.message : "Invalid amount",
            variant: "destructive",
          });
          return;
        }
      }
      
      // Build validated amounts
      const validatedMap: { [key: string]: string } = {};
      for (const [asset, amount] of validAmounts) {
        const validAmount = asset === "XRP" && currentXrpRounding
          ? currentXrpRounding.roundedAmount
          : amount;
        const availableBalance = availableBalances[asset] || 0;
        
        if (parseFloat(validAmount) > availableBalance) {
          toast({
            title: "Insufficient Balance",
            description: `You only have ${availableBalance.toFixed(2)} ${asset} available. Cannot deposit ${parseFloat(validAmount).toFixed(2)} ${asset}.`,
            variant: "destructive",
          });
          return;
        }
        
        validatedMap[asset] = validAmount;
      }
      
      setValidatedAmounts(validatedMap);
      setStep(2);
    } else if (step === 2) {
      // Revalidate balances
      for (const [asset, validAmount] of Object.entries(validatedAmounts)) {
        const availableBalance = availableBalances[asset] || 0;
        if (parseFloat(validAmount) > availableBalance) {
          toast({
            title: "Insufficient Balance",
            description: `Balance changed. You only have ${availableBalance.toFixed(2)} ${asset} available.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      // For XRP deposits, initiate bridge flow
      if (isXRPDeposit) {
        await handleXRPDeposit();
      } else {
        // For non-XRP deposits, use existing flow
        onConfirm(validatedAmounts);
        setAmounts({});
        setValidatedAmounts({});
        setStep(1);
        onOpenChange(false);
      }
    }
  };

  const handleXRPDeposit = async () => {
    // Prevent duplicate submissions
    if (isCreatingBridge) {
      console.log("⚠️ Bridge creation already in progress, ignoring click");
      return;
    }

    // Validate all required fields before proceeding
    if (!address) {
      console.error("❌ No wallet address available");
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet before making a deposit.",
        variant: "destructive",
      });
      return;
    }

    if (!vaultId) {
      console.error("❌ No vaultId provided");
      toast({
        title: "Configuration Error",
        description: "Vault information is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!totalValue || totalValue <= 0) {
      console.error("❌ Invalid amount:", totalValue);
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingBridge(true);

    try {
      // Create bridge
      console.log("📡 Creating bridge with address:", address);
      const requestBody = {
        walletAddress: address,
        vaultId: vaultId,
        amount: totalValue.toString(),
        network: network,
      };
      console.log("Request payload:", requestBody);
      
      const response = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("❌ Bridge creation failed:", data);
        throw new Error(data.error || data.message || "Failed to create deposit");
      }

      console.log("✅ Bridge created:", data.bridgeId);
      setBridgeId(data.bridgeId);

      // Wait for bridge to reach awaiting_payment status, then trigger payment
      await pollForPaymentRequest(data.bridgeId);
    } catch (error) {
      console.error("Bridge creation error details:", error);
      toast({
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Failed to create bridge",
        variant: "destructive",
      });
      setIsCreatingBridge(false);
    }
  };

  const pollForPaymentRequest = async (bridgeId: string) => {
    // Poll for payment request (awaiting_payment status)
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/deposits/${bridgeId}/status`);
        const data = await response.json();

        if (data.success && data.status === 'awaiting_payment' && data.paymentRequest) {
          console.log("✅ Payment request ready");
          
          // Show Xaman payment modal
          const paymentResult = await requestPayment(data.paymentRequest);
          
          if (paymentResult.success && paymentResult.payloadUuid) {
            setXamanPayload({
              uuid: paymentResult.payloadUuid,
              qrUrl: paymentResult.qrUrl || "",
              deepLink: paymentResult.deepLink || "",
            });
            setDepositPhase('xaman');
            setIsCreatingBridge(false); // Reset flag when Xaman modal opens
          } else {
            throw new Error("Failed to create payment request");
          }
          return;
        }

        if (data.status === 'failed') {
          throw new Error(data.error || "Bridge creation failed");
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        console.error("Poll error:", error);
        throw error;
      }
    }

    throw new Error("Timeout waiting for payment request");
  };

  const handleXamanSuccess = async (txHash: string) => {
    console.log("✅ Xaman payment signed:", txHash);
    
    // Mark payment_signed step as complete
    const updatedSteps = [...progressSteps];
    updatedSteps[0].status = 'complete';
    setProgressSteps(updatedSteps);
    
    // Show toast
    toast({ title: "Payment Signed ✅", description: "Your XRP payment has been confirmed" });
    
    // Switch to progress phase
    setDepositPhase('progress');
    setCurrentStepId('reserving_collateral');
    updatedSteps[1].status = 'in_progress';
    setProgressSteps(updatedSteps);
  };

  const handleXamanCancel = () => {
    // User cancelled Xaman payment, go back to form
    setDepositPhase('form');
    setXamanPayload(null);
    toast({
      title: "Payment Cancelled",
      description: "You can try depositing again when you're ready.",
    });
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const setAssetAmount = (asset: string, value: string) => {
    const sanitizedValue = sanitizeNumericInput(value);
    
    if (!sanitizedValue || sanitizedValue.trim() === "") {
      setAmounts((prev) => {
        const { [asset]: _, ...rest } = prev;
        return rest;
      });
      
      if (asset === "XRP" && depositAssets.includes("XRP")) {
        setXrpLotRounding(null);
        setXrpValidationError(null);
      }
      return;
    }
    
    setAmounts((prev) => ({ ...prev, [asset]: sanitizedValue }));
    
    if (asset === "XRP" && depositAssets.includes("XRP")) {
      try {
        const roundingResult = calculateLotRounding(sanitizedValue);
        setXrpLotRounding(roundingResult);
        setXrpValidationError(null);
      } catch (error) {
        setXrpLotRounding(null);
        setXrpValidationError(error instanceof Error ? error.message : "Invalid amount");
      }
    }
  };

  const hasValidAmount = Object.values(amounts).some(
    (amt) => amt && parseFloat(sanitizeNumericInput(amt)) > 0
  ) && !xrpValidationError;

  const handleCopyBridgeId = () => {
    if (bridgeId) {
      navigator.clipboard.writeText(bridgeId);
      setCopiedBridgeId(true);
      setTimeout(() => setCopiedBridgeId(false), 2000);
      toast({ title: "Copied", description: "Bridge ID copied to clipboard" });
    }
  };

  const handleNavigateToBridgeTracking = () => {
    setLocation("/bridge-tracking");
    onOpenChange(false);
  };

  const handleContinueStaking = () => {
    onOpenChange(false);
  };

  // Determine if deposit is complete
  const isDepositComplete = currentStepId === 'completed' && progressSteps.every(s => s.status === 'complete');

  return (
    <>
      <Dialog open={open && depositPhase !== 'xaman'} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="modal-deposit">
          {depositPhase === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Deposit {depositAssets.length > 1 ? depositAssets.join(" + ") : depositAssets[0]}
                </DialogTitle>
                <DialogDescription>
                  {step === 1
                    ? depositAssets.includes("XRP")
                      ? "Deposit XRP to receive shXRP shares. Your deposit will be automatically bridged to FXRP and deposited into the vault."
                      : `Enter the amount${depositAssets.length > 1 ? 's' : ''} you want to deposit`
                    : "Review and confirm your deposit"}
                </DialogDescription>
              </DialogHeader>

              <div className="py-3 space-y-3 sm:py-6 sm:space-y-6">
                {depositAssets.includes("XRP") && step === 1 && (
                  <Collapsible open={infoExpanded} onOpenChange={setInfoExpanded}>
                    <Alert data-testid="alert-fassets-info" className="p-3 sm:p-4">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center justify-between w-full text-left group" data-testid="button-toggle-info">
                              <AlertTitle className="text-sm">How XRP Deposits Work</AlertTitle>
                              <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${infoExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <AlertDescription className="text-xs space-y-1.5 mt-2">
                              <p>Your XRP is converted to shXRP through a secure bridging process:</p>
                              <ol className="list-decimal list-inside space-y-0.5 ml-2 text-xs">
                                <li>System reserves collateral with a FAssets agent</li>
                                <li>You send XRP to the agent's address</li>
                                <li>System generates proof and mints FXRP on Flare</li>
                                <li>FXRP is deposited to vault for shXRP tokens</li>
                              </ol>
                            </AlertDescription>
                          </CollapsibleContent>
                        </div>
                      </div>
                    </Alert>
                  </Collapsible>
                )}
                
                <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 sm:gap-3 sm:p-4">
                  <MultiAssetIcon assets={depositAssets.join(",")} size={24} className="sm:w-7 sm:h-7 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{vaultName}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">APY: {vaultApyLabel || `${vaultApy}%`}</p>
                  </div>
                  <Badge className="text-xs whitespace-nowrap">{vaultApyLabel || `${vaultApy}% APY`}</Badge>
                </div>

                {!isConnected && (
                  <div className="space-y-4 text-center py-8">
                    <div className="flex justify-center mb-4">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <WalletIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Connect your wallet to deposit into this vault
                    </p>
                    <Button onClick={() => {
                      onOpenChange(false);
                      setConnectWalletModalOpen(true);
                    }} data-testid="button-connect-wallet-deposit">
                      <WalletIcon className="h-4 w-4 mr-2" />
                      Connect Wallet
                    </Button>
                  </div>
                )}

                {isConnected && address && (
                  <div className="p-3 rounded-md bg-muted/50 flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Connected Wallet</span>
                    <span className="text-sm font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  </div>
                )}

                {isConnected && step === 1 && (
                  <div className="space-y-4">
                    {balancesLoading && (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm">Loading balances...</span>
                      </div>
                    )}

                    {balancesError && (
                      <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-destructive">Failed to load wallet balances</p>
                            <p className="text-xs text-destructive/80 mt-1">Please try again or continue with caution.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!balancesLoading && depositAssets.map((asset) => (
                      <div key={asset}>
                        <Label htmlFor={`amount-${asset}`}>{asset} Amount</Label>
                        <div className="relative mt-2">
                          <Input
                            id={`amount-${asset}`}
                            type="text"
                            placeholder="0.00"
                            value={amounts[asset] || ""}
                            onChange={(e) => setAssetAmount(asset, e.target.value)}
                            className="pr-20 text-lg font-mono"
                            data-testid={`input-deposit-amount-${asset}`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                            {asset}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground" data-testid={`text-available-${asset}`}>
                            Available: {getBalanceFormatted(asset as "XRP" | "RLUSD" | "USDC")} {asset}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => {
                              const balance = availableBalances[asset] || 0;
                              if (asset === "XRP" && depositAssets.includes("XRP")) {
                                const lots = Math.floor(balance / LOT_SIZE);
                                const roundedMax = lots * LOT_SIZE;
                                setAssetAmount(asset, roundedMax.toString());
                              } else {
                                setAssetAmount(asset, balance.toString());
                              }
                            }}
                            data-testid={`button-max-${asset}`}
                            disabled={balancesLoading || !availableBalances[asset]}
                          >
                            Max
                          </Button>
                        </div>
                        
                        {asset === "XRP" && xrpValidationError && (
                          <p className="text-xs text-destructive mt-2" data-testid="error-xrp-validation">
                            {xrpValidationError}
                          </p>
                        )}
                        
                        {asset === "XRP" && xrpLotRounding && xrpLotRounding.needsRounding && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50 border border-muted" data-testid="warning-lot-rounding">
                            <p className="text-xs text-muted-foreground">
                              <Info className="h-3 w-3 inline mr-1" />
                              <span className="font-medium">Lot Rounding:</span> {xrpLotRounding.requestedAmount} XRP → {xrpLotRounding.roundedAmount} XRP ({xrpLotRounding.lots} lot{xrpLotRounding.lots !== 1 ? 's' : ''})
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              FAssets requires deposits in {LOT_SIZE} XRP lots. Your deposit will be rounded up by {xrpLotRounding.shortfall.toFixed(6)} XRP.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {!balancesLoading && (
                      <div className="space-y-1.5 p-3 rounded-md bg-muted/50 sm:space-y-2 sm:p-4">
                        {isXRPDeposit && xrpLotRounding && xrpLotRounding.needsRounding && (
                          <div className="flex items-center justify-between text-xs sm:text-sm pb-1">
                            <span className="text-muted-foreground">Requested Amount</span>
                            <span className="font-mono">{xrpLotRounding.requestedAmount} XRP</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">Deposit Amount{isXRPDeposit && xrpLotRounding && xrpLotRounding.needsRounding ? ' (Rounded)' : ''}</span>
                          <span className="font-semibold font-mono">{totalValue.toFixed(2)} XRP</span>
                        </div>
                        {isXRPDeposit && mintingFee > 0 && (
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">Bridge Fee ({mintingFeePercentage}%)</span>
                            <span className="font-mono">+{mintingFee.toFixed(6)} XRP</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs sm:text-sm pt-1.5 border-t sm:pt-2">
                          <span className="font-medium">Total Payment</span>
                          <span className="font-bold font-mono">{totalWithFee.toFixed(6)} XRP</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">Projected Annual Earnings</span>
                          <span className="font-semibold font-mono">+{projectedEarnings} XRP</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-2 p-3 rounded-md border sm:space-y-3 sm:p-4">
                      {Object.entries(amounts).filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0).map(([asset, amount]) => {
                        const displayAmount = asset === "XRP" && xrpLotRounding 
                          ? xrpLotRounding.roundedAmount 
                          : amount;
                        const showRoundingInfo = asset === "XRP" && xrpLotRounding && xrpLotRounding.needsRounding;
                        
                        return (
                          <div key={asset}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm text-muted-foreground">{asset} Deposit</span>
                              {showRoundingInfo ? (
                                <span className="font-semibold font-mono text-sm sm:text-base">
                                  {xrpLotRounding.requestedAmount} → {displayAmount} {asset}
                                </span>
                              ) : (
                                <span className="font-semibold font-mono text-sm sm:text-base">{displayAmount} {asset}</span>
                              )}
                            </div>
                            {showRoundingInfo && (
                              <p className="text-xs text-muted-foreground mt-1">
                                ({xrpLotRounding.lots} lot{xrpLotRounding.lots !== 1 ? 's' : ''} of {LOT_SIZE} XRP each)
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {isXRPDeposit && mintingFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            Bridge Fee ({mintingFeePercentage}%)
                          </span>
                          <span className="font-mono text-xs sm:text-sm">+{mintingFee.toFixed(6)} XRP</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1.5 border-t sm:pt-2">
                        <span className="font-medium text-xs sm:text-sm">Total Payment Required</span>
                        <span className="text-base sm:text-lg font-bold font-mono">{totalWithFee.toFixed(6)} XRP</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t sm:pt-2">
                        <span className="text-xs sm:text-sm text-muted-foreground">Annual Earnings</span>
                        <span className="font-medium font-mono text-chart-2 text-sm sm:text-base">+{projectedEarnings} XRP</span>
                      </div>
                    </div>
                    
                    {isXRPDeposit && (
                      <Alert className="p-3 sm:p-4">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          You'll be prompted to send {totalWithFee.toFixed(6)} XRP ({totalValue.toFixed(2)} XRP + {mintingFee.toFixed(6)} XRP bridge fee) to complete your deposit.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {step === 2 && (
                  <Button variant="outline" onClick={handleBack} data-testid="button-back">
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleContinue}
                  disabled={
                    (step === 1 && (!hasValidAmount || balancesLoading)) || 
                    (step === 2 && isCreatingBridge)
                  }
                  data-testid={step === 1 ? "button-continue" : "button-confirm-deposit"}
                >
                  {step === 1 ? "Continue" : isCreatingBridge ? "Creating Bridge..." : "Confirm Deposit"}
                </Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      {depositPhase === 'progress' && (
        <ProgressModal
          open={true}
          onOpenChange={onOpenChange}
          title="Processing Deposit"
          steps={progressSteps}
          currentStepId={currentStepId}
          errorMessage={errorMessage}
          metadata={bridgeId && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Bridge ID</p>
                <p className="text-sm font-mono font-medium truncate" data-testid="text-bridge-id">{bridgeId}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyBridgeId}
                data-testid="button-copy-bridge-id"
              >
                {copiedBridgeId ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
          actions={isDepositComplete ? [
            {
              label: "View in Bridge Tracking",
              variant: 'default',
              onClick: handleNavigateToBridgeTracking
            },
            {
              label: "Continue Staking",
              variant: 'outline',
              onClick: handleContinueStaking
            }
          ] : []}
        />
      )}

      {/* Xaman Signing Modal */}
      {xamanPayload && (
        <XamanSigningModal
          open={depositPhase === 'xaman'}
          onOpenChange={(open) => !open && handleXamanCancel()}
          payloadUuid={xamanPayload.uuid}
          qrUrl={xamanPayload.qrUrl}
          deepLink={xamanPayload.deepLink}
          onSuccess={handleXamanSuccess}
          onError={(error) => {
            console.error("Xaman signing error:", error);
            toast({
              title: "Signature Failed",
              description: error || "Failed to sign transaction. Please try again.",
              variant: "destructive"
            });
            handleXamanCancel();
          }}
        />
      )}

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        open={connectWalletModalOpen}
        onOpenChange={setConnectWalletModalOpen}
      />
    </>
  );
}
