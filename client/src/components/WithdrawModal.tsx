import { useState } from "react";
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
import { AlertCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { MultiAssetIcon } from "@/components/AssetIcon";
import WithdrawalProgressModal from "./WithdrawalProgressModal";
import { apiRequest } from "@/lib/queryClient";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ethers } from "ethers";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  asset?: string;
  depositedAmount: string;
  rewards: string;
  network?: string;
  onConfirm: (amount: string) => void;
  loading?: boolean;
}

export default function WithdrawModal({
  open,
  onOpenChange,
  vaultName,
  asset = "XRP",
  depositedAmount,
  rewards,
  network = "mainnet",
  onConfirm,
  loading = false,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  
  // Progress modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [withdrawalId, setWithdrawalId] = useState<string>("");
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { evmAddress, address, walletConnectProvider } = useWallet();
  const { ecosystem } = useNetwork();
  const gasEstimate = "0.00008";
  const assetSymbol = asset.split(",")[0];

  const totalWithdrawable = (
    parseFloat(depositedAmount.replace(/,/g, "")) +
    parseFloat(rewards.replace(/,/g, ""))
  ).toFixed(2);

  const handleConfirm = () => {
    const withdrawAmount = parseFloat(amount.replace(/,/g, ""));
    const maxWithdrawable = parseFloat(totalWithdrawable);

    if (withdrawAmount > maxWithdrawable) {
      toast({
        title: "Insufficient Balance",
        description: `You can only withdraw up to ${totalWithdrawable} ${assetSymbol} from this position.`,
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    // Process withdrawal based on ecosystem
    if (ecosystem === "flare") {
      handleFlareWithdrawal();
    } else {
      // XRPL ecosystem - use existing flow
      onConfirm(amount);
      setAmount("");
      onOpenChange(false);
    }
  };

  const handleFlareWithdrawal = async () => {
    if (!evmAddress) {
      toast({
        title: "EVM Wallet Required",
        description: "Please connect an EVM wallet for Flare ecosystem withdrawals.",
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

    setProcessingWithdrawal(true);
    
    try {
      // Get vault configuration from backend (read-only)
      const vaultInfoRes = await apiRequest("GET", "/api/vaults/fxrp/info");
      const vaultInfo = await vaultInfoRes.json();
      
      if (!vaultInfo.success || !vaultInfo.vaultAddress) {
        throw new Error("Failed to fetch vault configuration");
      }

      const { vaultAddress, fxrpTokenAddress } = vaultInfo;
      
      // Create ethers provider and signer (works with both WalletConnect and MetaMask)
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      
      // Import ABIs
      const { FIRELIGHT_VAULT_ABI } = await import("@shared/flare-abis");
      
      // Create vault contract instance
      const vault = new ethers.Contract(vaultAddress, FIRELIGHT_VAULT_ABI, signer);
      
      // Amount in wei (shXRP shares have 18 decimals)
      const sharesWei = ethers.parseUnits(amount, 18);
      
      // Check shXRP balance
      const shXRPBalance = await vault.balanceOf(evmAddress);
      if (shXRPBalance < sharesWei) {
        throw new Error(`Insufficient shXRP balance. You have ${ethers.formatUnits(shXRPBalance, 18)} shXRP`);
      }
      
      // Execute withdrawal (redeem shares for FXRP)
      toast({
        title: "Withdrawal Transaction",
        description: "Please sign the withdrawal transaction in your wallet.",
      });
      
      // ERC-4626 redeem: burn shXRP shares to get FXRP back
      const withdrawTx = await vault.redeem(
        sharesWei,
        evmAddress,  // Receive FXRP to user's own address
        evmAddress   // Owner of shares is user's address
      );
      
      toast({
        title: "Withdrawal Submitted",
        description: "Waiting for confirmation...",
      });
      
      // Wait for withdrawal confirmation
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawTxHash = withdrawReceipt.hash;
      
      // Track withdrawal on backend (status only, no execution)
      const trackingRes = await apiRequest("POST", "/api/withdrawals/fxrp/track", {
        userAddress: evmAddress, // Use EVM address as primary identifier for Flare ecosystem
        evmAddress, // EVM wallet that signed the transaction
        amount,
        withdrawHash: withdrawTxHash, // Use 'withdrawHash' for consistency
        vaultAddress, // Include vault address as required
        tokenAddress: fxrpTokenAddress, // Include token address as required
      });
      const trackingResponse = await trackingRes.json();

      if (!trackingResponse.success) {
        console.warn("Failed to track withdrawal on backend:", trackingResponse.error);
        // Don't fail the whole operation - withdrawal succeeded on-chain
      }
      
      // Open progress modal to show completion
      setWithdrawalId(trackingResponse.withdrawalId || withdrawTxHash);
      setProgressModalOpen(true);
      
      // Clear state
      setAmount("");
      onOpenChange(false);
      
      toast({
        title: "Withdrawal Successful",
        description: `Your FXRP has been withdrawn. Transaction: ${withdrawTxHash.slice(0, 10)}...`,
      });
      
    } catch (error) {
      console.error("Flare withdrawal error:", error);
      
      // Handle user rejection
      if (error instanceof Error && error.message.includes("rejected")) {
        toast({
          title: "Transaction Rejected",
          description: "You rejected the transaction in your wallet.",
          variant: "destructive",
        });
      } else {
        setWithdrawalError(error instanceof Error ? error.message : "Failed to process withdrawal");
        toast({
          title: "Withdrawal Failed",
          description: error instanceof Error ? error.message : "Failed to process withdrawal",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="modal-withdraw">
        <DialogHeader>
          <DialogTitle>Withdraw {assetSymbol}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {ecosystem === "flare" 
              ? "Direct withdrawal. FXRP sent to your EVM wallet."
              : "Processed automatically. XRP sent to your XRPL wallet."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 sm:py-6 space-y-4 sm:space-y-6">
          {/* Vault Info - Compact on mobile */}
          <div className="p-3 sm:p-4 rounded-md bg-muted/50">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <MultiAssetIcon assets={asset} size={20} />
              <p className="text-xs sm:text-sm font-medium truncate">{vaultName}</p>
            </div>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Deposited</span>
                <span className="font-mono text-xs sm:text-sm">{depositedAmount} sh{assetSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono text-xs sm:text-sm text-chart-2">+{rewards} sh{assetSymbol}</span>
              </div>
              <div className="pt-1 sm:pt-2 border-t flex items-center justify-between">
                <span className="text-xs sm:text-sm font-medium">Total</span>
                <span className="font-bold font-mono text-xs sm:text-sm">{totalWithdrawable} sh{assetSymbol}</span>
              </div>
            </div>
          </div>

          {/* Withdrawal Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount" className="text-xs sm:text-sm">Withdrawal Amount</Label>
            <div className="relative">
              <Input
                id="withdraw-amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 text-sm sm:text-lg font-mono"
                data-testid="input-withdraw-amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-medium text-muted-foreground">
                {assetSymbol}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Avail: {totalWithdrawable} {assetSymbol}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setAmount(totalWithdrawable)}
                data-testid="button-max-withdraw"
              >
                Max
              </Button>
            </div>
          </div>

          {/* Fee and Total - Compact */}
          <div className="space-y-1 p-3 sm:p-4 rounded-md bg-muted/50">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Gas Fee</span>
              <span className="font-mono text-xs sm:text-sm">{gasEstimate} {assetSymbol}</span>
            </div>
            <div className="pt-1 sm:pt-2 border-t flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium">You'll Receive</span>
              <span className="text-sm sm:text-lg font-bold font-mono">
                {amount ? (parseFloat(amount.replace(/,/g, "")) - parseFloat(gasEstimate)).toFixed(5) : "0.00"} {assetSymbol}
              </span>
            </div>
          </div>

          {/* Collapsible Details Section */}
          <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-0 h-auto py-2 text-xs sm:text-sm"
                data-testid="button-toggle-details"
              >
                <span className="font-medium">Details & Notices</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${detailsExpanded ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 border-t">
              {/* Automated Process Info */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/10">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
                <div className="flex-1 space-y-1 text-xs">
                  <p className="font-medium text-primary">Automated Process</p>
                  <p className="text-muted-foreground">
                    {ecosystem === "flare" 
                      ? "Your shXRP tokens will be redeemed for FXRP and sent to your EVM wallet."
                      : "Your shXRP tokens will be redeemed for XRP through the FAssets bridge and sent to your wallet."}
                  </p>
                  <p className="text-muted-foreground">
                    Typical time: {ecosystem === "flare" ? "30 seconds" : "1-5 minutes"}
                  </p>
                </div>
              </div>

              {/* Early Withdrawal Notice */}
              <div className="flex items-start gap-2 p-3 rounded-md bg-chart-4/10 text-chart-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">Early Withdrawal</p>
                  <p className="mt-1 opacity-90">
                    Withdrawing before lock period ends may reduce rewards.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount.replace(/,/g, "")) <= 0 || loading}
            className="flex-1 sm:flex-none"
            data-testid="button-confirm-withdraw"
          >
            {loading ? "Processing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <WithdrawalProgressModal
        open={progressModalOpen}
        onOpenChange={setProgressModalOpen}
        withdrawalId={withdrawalId}
        amount={amount}
        asset={ecosystem === "flare" ? "FXRP" : assetSymbol}
        vaultName={vaultName}
        ecosystem={ecosystem}
        onComplete={() => {
          setProgressModalOpen(false);
          toast({
            title: "Withdrawal Complete",
            description: ecosystem === "flare" 
              ? "Your FXRP has been sent to your wallet."
              : "Your XRP has been sent to your wallet.",
          });
        }}
        onError={(error) => {
          setProgressModalOpen(false);
          setWithdrawalError(error);
          toast({
            title: "Withdrawal Failed",
            description: error,
            variant: "destructive",
          });
        }}
      />
    </Dialog>
  );
}
