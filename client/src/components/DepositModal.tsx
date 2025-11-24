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
import { Coins, Wallet as WalletIcon, Loader2, AlertCircle, Info, ChevronDown } from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { useWalletBalances } from "@/hooks/use-wallet-balance";
import { useComprehensiveBalance } from "@/hooks/useComprehensiveBalance";
import { useNetwork } from "@/lib/networkContext";
import { useToast } from "@/hooks/use-toast";
import ConnectWalletModal from "./ConnectWalletModal";
import XamanSigningModal from "./XamanSigningModal";
import DepositProgressModal from "./DepositProgressModal";
import { MultiAssetIcon } from "@/components/AssetIcon";
import type { PaymentRequest } from "@shared/schema";
import { calculateLotRounding, type LotRoundingResult, LOT_SIZE } from "@shared/lotRounding";
import { apiRequest } from "@/lib/queryClient";
import { ethers } from "ethers";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  vaultApy: string;
  vaultApyLabel?: string | null;
  depositAssets?: string[];
  onConfirm: (amounts: { [asset: string]: string }) => void;
}

export default function DepositModal({
  open,
  onOpenChange,
  vaultName,
  vaultApy,
  vaultApyLabel,
  depositAssets = ["XRP"],
  onConfirm,
}: DepositModalProps) {
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [connectWalletModalOpen, setConnectWalletModalOpen] = useState(false);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [xrpLotRounding, setXrpLotRounding] = useState<LotRoundingResult | null>(null);
  const [xrpValidationError, setXrpValidationError] = useState<string | null>(null);
  
  // Store validated amounts from Step 1 for Step 2 confirmation
  const [validatedAmounts, setValidatedAmounts] = useState<{ [key: string]: string }>({});
  
  // Progressive disclosure state
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  
  // Progress modal state for tracking deposit
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [depositId, setDepositId] = useState<string>("");
  const [depositError, setDepositError] = useState<string | null>(null);
  
  // Helper to sanitize numeric inputs (removes commas and whitespace)
  const sanitizeNumericInput = (value: string) => value.replace(/[\s,]+/g, "");

  // Reset state when modal opens to prevent stale data
  useEffect(() => {
    if (open) {
      setAmounts({});
      setStep(1);
      setXrpLotRounding(null);
      setXrpValidationError(null);
    }
  }, [open]);

  const { address, isConnected, provider, requestPayment, evmAddress, walletType, walletConnectProvider } = useWallet();
  const { balances, isLoading: balancesLoading, error: balancesError, getBalance, getBalanceFormatted } = useWalletBalances();
  const comprehensiveBalances = useComprehensiveBalance();
  const { network, ecosystem } = useNetwork();
  const { toast } = useToast();
  const gasEstimate = "0.00012";

  // Determine primary deposit asset
  const depositAsset = depositAssets && depositAssets.length > 0 ? depositAssets[0] : "XRP";

  // For EVM wallets, use comprehensive balance (which includes network-aware FXRP)
  // For XRPL wallets, use XRPL balances (XRP, RLUSD, USDC)
  const availableBalances: { [key: string]: number } = walletType === "evm" && evmAddress
    ? {
        FXRP: parseFloat(comprehensiveBalances.fxrp) || 0,
      }
    : {
        XRP: balances?.balances.XRP || 0,
        RLUSD: balances?.balances.RLUSD || 0,
        USDC: balances?.balances.USDC || 0,
      };

  const totalValue = Object.entries(amounts).reduce((sum, [asset, amount]) => {
    if (!amount) return sum;
    // For XRP, use rounded amount if available
    if (asset === "XRP" && xrpLotRounding) {
      return sum + parseFloat(xrpLotRounding.roundedAmount);
    }
    const val = parseFloat(sanitizeNumericInput(amount));
    return sum + val;
  }, 0);

  // Calculate FAssets minting fee (0.25% for XRP bridges, but only in XRPL ecosystem)
  const isXRPDeposit = depositAssets.includes("XRP") && ecosystem === "xrpl";
  const mintingFeePercentage = 0.25; // 0.25% = 25 BIPS
  const mintingFee = isXRPDeposit ? (totalValue * (mintingFeePercentage / 100)) : 0;
  const totalWithFee = totalValue + mintingFee;

  const projectedEarnings = totalValue
    ? (totalValue * parseFloat(vaultApy) / 100).toFixed(2)
    : "0";

  const handleContinue = () => {
    if (step === 1 && Object.keys(amounts).length > 0) {
      // Filter out empty amounts and validate against available balances (defensive sanitization)
      const validAmounts = Object.entries(amounts)
        .map(([asset, amt]) => [asset, sanitizeNumericInput(amt)] as [string, string])
        .filter(([_, amt]) => amt && !isNaN(parseFloat(amt)) && parseFloat(amt) > 0);
      
      // Guard: Require at least one valid positive amount
      if (validAmounts.length === 0) {
        toast({
          title: "No Amount Entered",
          description: "Please enter at least one deposit amount greater than 0.",
          variant: "destructive",
        });
        return;
      }
      
      // Recompute XRP lot rounding for validation (ensures fresh calculation)
      let currentXrpRounding: LotRoundingResult | null = null;
      const xrpEntry = validAmounts.find(([asset]) => asset === "XRP");
      if (xrpEntry && depositAssets.includes("XRP")) {
        try {
          currentXrpRounding = calculateLotRounding(xrpEntry[1]);
          // Synchronize state with fresh calculation
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
      
      // Build validated amounts map for confirmation
      const validatedMap: { [key: string]: string } = {};
      for (const [asset, amount] of validAmounts) {
        // For XRP, use rounded amount; for others, use sanitized amount
        const validAmount = asset === "XRP" && currentXrpRounding
          ? currentXrpRounding.roundedAmount
          : amount;
        const availableBalance = availableBalances[asset] || 0;
        
        // Validate balance against validated amount
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
      
      // Store validated amounts for Step 2 confirmation
      setValidatedAmounts(validatedMap);
      setStep(2);
    } else if (step === 2) {
      // Revalidate balances using stored validated amounts
      for (const [asset, validAmount] of Object.entries(validatedAmounts)) {
        const availableBalance = availableBalances[asset] || 0;
        if (parseFloat(validAmount) > availableBalance) {
          toast({
            title: "Insufficient Balance",
            description: `Balance changed. You only have ${availableBalance.toFixed(2)} ${asset} available. Cannot deposit ${parseFloat(validAmount).toFixed(2)} ${asset}.`,
            variant: "destructive",
          });
          return;
        }
      }
      
      // Process deposit based on ecosystem
      if (ecosystem === "flare") {
        handleFlareDeposit(validatedAmounts);
      } else {
        // XRPL ecosystem - use existing flow
        onConfirm(validatedAmounts);
        setAmounts({});
        setValidatedAmounts({});
        setStep(1);
        onOpenChange(false);
      }
    }
  };

  const handleFlareDeposit = async (amounts: { [key: string]: string }) => {
    if (!evmAddress) {
      toast({
        title: "EVM Wallet Required",
        description: "Please connect an EVM wallet for Flare ecosystem deposits.",
        variant: "destructive",
      });
      return;
    }

    // Support both WalletConnect and injected providers (MetaMask)
    const provider = walletConnectProvider || (window as any).ethereum;
    if (!provider) {
      toast({
        title: "Web3 Provider Required",
        description: "Please connect via WalletConnect or MetaMask to sign transactions.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);
    
    try {
      // For Flare ecosystem, process FXRP deposit directly
      const amount = amounts.FXRP;
      if (!amount) {
        throw new Error("No FXRP amount specified");
      }

      // Get vault configuration from backend (read-only)
      const vaultInfoRes = await apiRequest("GET", "/api/vaults/fxrp/info");
      const vaultInfo = await vaultInfoRes.json();
      
      if (!vaultInfo.success || !vaultInfo.vaultAddress || !vaultInfo.fxrpTokenAddress) {
        throw new Error("Failed to fetch vault configuration");
      }

      const { vaultAddress, fxrpTokenAddress } = vaultInfo;
      
      // Create ethers provider and signer (works with both WalletConnect and MetaMask)
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      
      // Import ABIs
      const { ERC20_ABI, FIRELIGHT_VAULT_ABI } = await import("@shared/flare-abis");
      
      // Create contract instances
      const fxrpToken = new ethers.Contract(fxrpTokenAddress, ERC20_ABI, signer);
      const vault = new ethers.Contract(vaultAddress, FIRELIGHT_VAULT_ABI, signer);
      
      // Amount in wei (FXRP has 6 decimals)
      const amountWei = ethers.parseUnits(amount, 6);
      
      // Step 1: Check and approve FXRP spending
      const currentAllowance = await fxrpToken.allowance(evmAddress, vaultAddress);
      
      let approveTxHash = null;
      if (currentAllowance < amountWei) {
        toast({
          title: "Approval Required",
          description: "Please approve FXRP spending in your wallet.",
        });
        
        // Prepare and send approve transaction
        const approveTx = await fxrpToken.approve(vaultAddress, amountWei);
        toast({
          title: "Approval Submitted",
          description: "Waiting for confirmation...",
        });
        
        // Wait for approval confirmation
        const approveReceipt = await approveTx.wait();
        approveTxHash = approveReceipt.hash;
        
        toast({
          title: "Approval Confirmed",
          description: "FXRP spending approved successfully.",
        });
      }
      
      // Step 2: Deposit FXRP to vault
      toast({
        title: "Deposit Transaction",
        description: "Please sign the deposit transaction in your wallet.",
      });
      
      const depositTx = await vault.deposit(amountWei, evmAddress); // Mint shares to user's own address
      
      toast({
        title: "Deposit Submitted",
        description: "Waiting for confirmation...",
      });
      
      // Wait for deposit confirmation
      const depositReceipt = await depositTx.wait();
      const depositTxHash = depositReceipt.hash;
      
      // Step 3: Track deposit on backend (status only, no execution)
      const trackingRes = await apiRequest("POST", "/api/deposits/fxrp/track", {
        userAddress: evmAddress, // Use EVM address as primary identifier for Flare ecosystem
        evmAddress, // EVM wallet that signed the transaction
        amount,
        approveHash: approveTxHash, // Use 'approveHash' as per requirement spec
        depositHash: depositTxHash, // Use 'depositHash' as per requirement spec
        vaultAddress, // Include vault address as required
        tokenAddress: fxrpTokenAddress, // Include token address as required
      });
      const trackingResponse = await trackingRes.json();

      if (!trackingResponse.success) {
        console.warn("Failed to track deposit on backend:", trackingResponse.error);
        // Don't fail the whole operation - deposit succeeded on-chain
      }
      
      // Open progress modal to show completion
      setDepositId(trackingResponse.depositId || depositTxHash);
      setProgressModalOpen(true);
      
      // Clear state
      setAmounts({});
      setValidatedAmounts({});
      setStep(1);
      onOpenChange(false);
      
      toast({
        title: "Deposit Successful",
        description: `Your FXRP has been deposited. Transaction: ${depositTxHash.slice(0, 10)}...`,
      });
      
    } catch (error) {
      console.error("Flare deposit error:", error);
      
      // Handle user rejection
      if (error instanceof Error && error.message.includes("rejected")) {
        toast({
          title: "Transaction Rejected",
          description: "You rejected the transaction in your wallet.",
          variant: "destructive",
        });
      } else {
        setDepositError(error instanceof Error ? error.message : "Failed to process deposit");
        toast({
          title: "Deposit Failed",
          description: error instanceof Error ? error.message : "Failed to process deposit",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const setAssetAmount = (asset: string, value: string) => {
    // Sanitize input before storing in state (removes commas and whitespace)
    const sanitizedValue = sanitizeNumericInput(value);
    
    // If empty, delete the key instead of storing empty string
    if (!sanitizedValue || sanitizedValue.trim() === "") {
      setAmounts((prev) => {
        const { [asset]: _, ...rest } = prev;
        return rest;
      });
      
      // Clear XRP lot rounding if applicable
      if (asset === "XRP" && depositAssets.includes("XRP")) {
        setXrpLotRounding(null);
        setXrpValidationError(null);
      }
      return;
    }
    
    // Store sanitized non-empty value
    setAmounts((prev) => ({ ...prev, [asset]: sanitizedValue }));
    
    // Calculate lot rounding for XRP deposits
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-deposit">
        <DialogHeader>
          <DialogTitle>
            Deposit {depositAssets.length > 1 ? depositAssets.join(" + ") : depositAssets[0]}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? ecosystem === "flare"
                ? "Deposit FXRP directly to receive shXRP shares. No bridging required."
                : depositAssets.includes("XRP")
                  ? "Deposit XRP to receive shXRP shares. Your deposit will be automatically bridged to FXRP and deposited into the vault."
                  : `Enter the amount${depositAssets.length > 1 ? 's' : ''} you want to deposit`
              : "Review and confirm your deposit"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2 sm:py-6 sm:space-y-5">
          {/* Vault Info Card */}
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 sm:gap-3 sm:p-4">
            <MultiAssetIcon assets={depositAssets.join(",")} size={20} className="sm:w-7 sm:h-7 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">{vaultName}</p>
              <p className="text-xs text-muted-foreground hidden sm:block">APY: {vaultApyLabel || `${vaultApy}%`}</p>
            </div>
            <Badge className="text-xs whitespace-nowrap">{vaultApyLabel || `${vaultApy}% APY`}</Badge>
          </div>

          {!isConnected && (
            <div className="space-y-3 text-center py-4 sm:py-6">
              <div className="flex justify-center mb-2 sm:mb-4">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-muted flex items-center justify-center">
                  <WalletIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
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

          {isConnected && address && step === 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Connected:</span>
              <Badge variant="secondary" className="text-xs font-mono">{address.slice(0, 6)}...{address.slice(-4)}</Badge>
            </div>
          )}

          {isConnected && step === 1 && (
            <div className="space-y-2">
              {(balancesLoading || comprehensiveBalances.isLoading) && (
                <div className="flex items-center justify-center py-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Loading balances...</span>
                </div>
              )}

              {(balancesError || comprehensiveBalances.error) && (
                <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Failed to load balances</p>
                      <p className="text-xs text-destructive/80 mt-0.5">Please try again.</p>
                    </div>
                  </div>
                </div>
              )}

              {!balancesLoading && !comprehensiveBalances.isLoading && depositAssets.map((asset) => (
                <div key={asset}>
                  <Label htmlFor={`amount-${asset}`} className="text-xs sm:text-sm">{asset} Amount</Label>
                  <div className="relative mt-1">
                    <Input
                      id={`amount-${asset}`}
                      type="text"
                      placeholder="0.00"
                      value={amounts[asset] || ""}
                      onChange={(e) => setAssetAmount(asset, e.target.value)}
                      className="pr-16 text-sm font-mono"
                      data-testid={`input-deposit-amount-${asset}`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      {asset}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
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
                    <p className="text-xs text-destructive mt-1" data-testid="error-xrp-validation">
                      {xrpValidationError}
                    </p>
                  )}
                </div>
              ))}

              {!balancesLoading && (
                <>
                  {/* Total Payment - Always Visible */}
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Payment</span>
                      <span className="text-base sm:text-lg font-bold font-mono">{totalWithFee.toFixed(6)} {depositAsset}</span>
                    </div>
                  </div>

                  {/* Show Details Accordion */}
                  <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full" data-testid="button-toggle-details">
                        <ChevronDown className={`h-4 w-4 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`} />
                        Show Details
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {/* How XRP Deposits Work */}
                      {depositAssets.includes("XRP") && (
                        <Collapsible open={infoExpanded} onOpenChange={setInfoExpanded}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-2 text-xs font-medium w-full text-left text-muted-foreground hover:text-foreground transition-colors" data-testid="button-toggle-how-it-works">
                              <Info className="h-3 w-3 flex-shrink-0" />
                              <span>How XRP Deposits Work</span>
                              <ChevronDown className={`h-3 w-3 transition-transform ml-auto ${infoExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-xs space-y-1 mt-2 ml-5 text-muted-foreground">
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>System reserves collateral</li>
                              <li>You send XRP to agent</li>
                              <li>System mints FXRP</li>
                              <li>Deposit into vault</li>
                            </ol>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Fee Breakdown */}
                      <div className="space-y-1.5 text-xs">
                        {isXRPDeposit && xrpLotRounding && xrpLotRounding.needsRounding && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Requested Amount</span>
                              <span className="font-mono">{xrpLotRounding.requestedAmount} {depositAsset}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Rounded Amount</span>
                              <span className="font-mono">{xrpLotRounding.roundedAmount} {depositAsset}</span>
                            </div>
                          </>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Deposit Amount</span>
                          <span className="font-mono font-medium">{totalValue.toFixed(2)} {depositAsset}</span>
                        </div>
                        {isXRPDeposit && mintingFee > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Bridge Fee ({mintingFeePercentage}%)</span>
                            <span className="font-mono">+{mintingFee.toFixed(6)} {depositAsset}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t">
                          <span className="text-muted-foreground">Annual Earnings</span>
                          <span className="font-mono font-medium">+{projectedEarnings} {depositAsset}</span>
                        </div>
                      </div>

                      {/* Lot Rounding Warning */}
                      {isXRPDeposit && xrpLotRounding && xrpLotRounding.needsRounding && (
                        <div className="p-1.5 rounded-sm bg-muted/50 border border-muted text-xs text-muted-foreground">
                          <p>FAssets requires deposits in {LOT_SIZE} XRP lots. Your deposit will be rounded up by {xrpLotRounding.shortfall.toFixed(6)} XRP.</p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2 p-3 rounded-md border sm:space-y-3 sm:p-4">
                {Object.entries(amounts).filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0).map(([asset, amount]) => {
                  // For XRP, always use rounded value if available
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
                    <span className="font-mono text-xs sm:text-sm">+{mintingFee.toFixed(6)} {depositAsset}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t sm:pt-2">
                  <span className="font-medium text-xs sm:text-sm">Total Payment Required</span>
                  <span className="text-base sm:text-lg font-bold font-mono">{totalWithFee.toFixed(6)} {depositAsset}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t sm:pt-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Annual Earnings</span>
                  <span className="font-medium font-mono text-chart-2 text-sm sm:text-base">+{projectedEarnings} {depositAsset}</span>
                </div>
              </div>
              
              {isXRPDeposit && (
                <Alert className="p-3 sm:p-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    You'll be prompted to send {totalWithFee.toFixed(6)} {depositAsset} ({totalValue.toFixed(2)} {depositAsset} + {mintingFee.toFixed(6)} {depositAsset} bridge fee) to complete your deposit.
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
          {isConnected && (
            <Button
              onClick={handleContinue}
              disabled={!hasValidAmount}
              className="flex-1"
              data-testid="button-continue"
            >
              {step === 1 ? "Continue" : "Confirm Deposit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      <ConnectWalletModal
        open={connectWalletModalOpen}
        onOpenChange={setConnectWalletModalOpen}
      />
      <XamanSigningModal
        open={xamanSigningModalOpen}
        onOpenChange={setXamanSigningModalOpen}
        payload={xamanPayload}
        onSuccess={() => {
          setXamanSigningModalOpen(false);
          onOpenChange(false);
        }}
        onError={(error) => {
          setXamanSigningModalOpen(false);
          toast({
            title: "Payment Failed",
            description: error,
            variant: "destructive",
          });
        }}
      />
      <DepositProgressModal
        open={progressModalOpen}
        onOpenChange={setProgressModalOpen}
        depositId={depositId}
        amount={Object.values(validatedAmounts).join(", ")}
        asset={ecosystem === "flare" ? "FXRP" : depositAsset}
        vaultName={vaultName}
        ecosystem={ecosystem}
        onComplete={() => {
          setProgressModalOpen(false);
          toast({
            title: "Deposit Complete",
            description: "Your deposit has been successfully processed.",
          });
        }}
        onError={(error) => {
          setProgressModalOpen(false);
          setDepositError(error);
          toast({
            title: "Deposit Failed",
            description: error,
            variant: "destructive",
          });
        }}
      />
    </Dialog>
  );
}
