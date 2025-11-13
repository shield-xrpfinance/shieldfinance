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
import { useToast } from "@/hooks/use-toast";
import ConnectWalletModal from "./ConnectWalletModal";
import XamanSigningModal from "./XamanSigningModal";
import { MultiAssetIcon } from "@/components/AssetIcon";
import type { PaymentRequest } from "@shared/schema";

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
  
  // Initialize info expanded state based on screen size (desktop: expanded, mobile: collapsed)
  const [infoExpanded, setInfoExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640; // sm breakpoint
    }
    return false;
  });

  // Update info expanded state when screen size changes
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 640;
      setInfoExpanded(isDesktop);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { address, isConnected, provider, requestPayment } = useWallet();
  const { balances, isLoading: balancesLoading, error: balancesError, getBalance, getBalanceFormatted } = useWalletBalances();
  const { toast } = useToast();
  const gasEstimate = "0.00012";

  // Debug: Log provider state when modal opens
  console.log("DepositModal - address:", address, "provider:", provider, "isConnected:", isConnected);

  const availableBalances: { [key: string]: number } = {
    XRP: balances?.balances.XRP || 0,
    RLUSD: balances?.balances.RLUSD || 0,
    USDC: balances?.balances.USDC || 0,
  };

  const totalValue = Object.entries(amounts).reduce((sum, [asset, amount]) => {
    if (!amount) return sum;
    const val = parseFloat(amount.replace(/,/g, ""));
    return sum + val;
  }, 0);

  // Calculate FAssets minting fee (0.25% for XRP bridges)
  const isXRPDeposit = depositAssets.includes("XRP");
  const mintingFeePercentage = 0.25; // 0.25% = 25 BIPS
  const mintingFee = isXRPDeposit ? (totalValue * (mintingFeePercentage / 100)) : 0;
  const totalWithFee = totalValue + mintingFee;

  const projectedEarnings = totalValue
    ? (totalValue * parseFloat(vaultApy) / 100).toFixed(2)
    : "0";

  const handleContinue = () => {
    if (step === 1 && Object.keys(amounts).length > 0) {
      // Validate amounts against available balances
      for (const [asset, amount] of Object.entries(amounts)) {
        const numAmount = parseFloat(amount.replace(/,/g, ""));
        const availableBalance = availableBalances[asset] || 0;
        
        if (numAmount > availableBalance) {
          toast({
            title: "Insufficient Balance",
            description: `You only have ${availableBalance.toFixed(2)} ${asset} available. Cannot deposit ${numAmount.toFixed(2)} ${asset}.`,
            variant: "destructive",
          });
          return;
        }
      }
      setStep(2);
    } else if (step === 2) {
      onConfirm(amounts);
      setAmounts({});
      setStep(1);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const setAssetAmount = (asset: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [asset]: value }));
  };

  const hasValidAmount = Object.values(amounts).some(
    (amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-deposit">
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
                      onClick={() => setAssetAmount(asset, availableBalances[asset]?.toString() || "0")}
                      data-testid={`button-max-${asset}`}
                      disabled={balancesLoading || !availableBalances[asset]}
                    >
                      Max
                    </Button>
                  </div>
                </div>
              ))}

              {!balancesLoading && (
                <div className="space-y-1.5 p-3 rounded-md bg-muted/50 sm:space-y-2 sm:p-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Deposit Amount</span>
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
                {Object.entries(amounts).filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0).map(([asset, amount]) => (
                  <div key={asset} className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">{asset} Deposit</span>
                    <span className="font-semibold font-mono text-sm sm:text-base">{amount} {asset}</span>
                  </div>
                ))}
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
    </Dialog>
  );
}
