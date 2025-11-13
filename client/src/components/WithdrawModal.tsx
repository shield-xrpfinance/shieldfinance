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
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MultiAssetIcon } from "@/components/AssetIcon";

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
  const { toast} = useToast();
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

    onConfirm(amount);
    setAmount("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-withdraw">
        <DialogHeader>
          <DialogTitle>Withdraw {assetSymbol}</DialogTitle>
          <DialogDescription>
            Your withdrawal will be processed automatically. XRP will be sent to your original XRPL wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="p-4 rounded-md bg-muted/50">
            <div className="flex items-center gap-3 mb-3">
              <MultiAssetIcon assets={asset} size={24} />
              <p className="text-sm font-medium">{vaultName}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deposited</span>
                <span className="font-mono">{depositedAmount} sh{assetSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono text-chart-2">+{rewards} sh{assetSymbol}</span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-medium">Total Available</span>
                <span className="font-bold font-mono">{totalWithdrawable} sh{assetSymbol}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
              <div className="flex-1 space-y-2 text-sm">
                <p className="font-medium text-primary">Automated Withdrawal Process</p>
                <p className="text-muted-foreground">
                  Your shXRP tokens will be automatically redeemed for XRP through the FAssets bridge. The XRP will be sent directly to your original XRPL wallet address.
                </p>
                <p className="text-xs text-muted-foreground">
                  Typical processing time: 1-5 minutes
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-amount">Withdrawal Amount</Label>
              <div className="relative mt-2">
                <Input
                  id="withdraw-amount"
                  type="text"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-20 text-lg font-mono"
                  data-testid="input-withdraw-amount"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  {assetSymbol}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Available: {totalWithdrawable} {assetSymbol}
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

            <div className="flex items-start gap-3 p-3 rounded-md bg-chart-4/10 text-chart-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Early Withdrawal Notice</p>
                <p className="text-xs mt-1 opacity-90">
                  Withdrawing before the lock period ends may result in reduced rewards.
                </p>
              </div>
            </div>

            <div className="space-y-2 p-4 rounded-md bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Est. Gas Fee</span>
                <span className="font-mono">{gasEstimate} {assetSymbol}</span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-medium">You'll Receive</span>
                <span className="text-lg font-bold font-mono">
                  {amount ? (parseFloat(amount.replace(/,/g, "")) - parseFloat(gasEstimate)).toFixed(5) : "0.00"} {assetSymbol}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!amount || parseFloat(amount.replace(/,/g, "")) <= 0 || loading}
            data-testid="button-confirm-withdraw"
          >
            {loading ? "Processing..." : "Confirm Withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
