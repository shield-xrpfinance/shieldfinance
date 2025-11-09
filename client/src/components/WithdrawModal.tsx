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
import { AlertCircle, Lock, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MultiAssetIcon } from "@/components/AssetIcon";
import type { Escrow } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  asset?: string;
  depositedAmount: string;
  rewards: string;
  escrow?: Escrow | null;
  network?: string;
  onConfirm: (amount: string) => void;
}

export default function WithdrawModal({
  open,
  onOpenChange,
  vaultName,
  asset = "XRP",
  depositedAmount,
  rewards,
  escrow,
  network = "mainnet",
  onConfirm,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const { toast} = useToast();
  const gasEstimate = "0.00008";
  const assetSymbol = asset.split(",")[0];
  const isXRP = asset.includes("XRP");
  const hasEscrow = isXRP && escrow;

  const totalWithdrawable = (
    parseFloat(depositedAmount.replace(/,/g, "")) +
    parseFloat(rewards.replace(/,/g, ""))
  ).toFixed(2);

  const formatReleaseTime = (finishAfter: Date | string | null): string => {
    if (!finishAfter) return "Unknown";
    try {
      const date = typeof finishAfter === "string" ? new Date(finishAfter) : finishAfter;
      const now = new Date();
      if (date <= now) {
        return "Ready to release";
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const formatCompletionTime = (timestamp: Date | string | null): string => {
    if (!timestamp) return "Unknown";
    try {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  const getEscrowStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bgClass: "bg-chart-4/10 border-chart-4/20",
          iconColor: "text-chart-4",
          title: "Funds Secured in Escrow",
          description: "Your XRP deposit is secured in an escrow. Upon withdrawal approval, the escrow will be released and XRP sent to your wallet."
        };
      case "finished":
        return {
          bgClass: "bg-chart-2/10 border-chart-2/20",
          iconColor: "text-chart-2",
          title: "Escrow Released",
          description: "Your escrow has been successfully released and the funds have been sent to your wallet."
        };
      case "cancelled":
        return {
          bgClass: "bg-muted/50 border-muted",
          iconColor: "text-muted-foreground",
          title: "Escrow Cancelled",
          description: "This escrow was cancelled and the funds were returned."
        };
      case "failed":
        return {
          bgClass: "bg-destructive/10 border-destructive/20",
          iconColor: "text-destructive",
          title: "Escrow Failed",
          description: "The escrow operation failed. Please contact support for assistance."
        };
      default:
        return {
          bgClass: "bg-muted/50 border-muted",
          iconColor: "text-muted-foreground",
          title: "Escrow Status",
          description: "Escrow information"
        };
    }
  };

  const getXrplExplorerUrl = (txHash: string): string => {
    const isTestnet = network === "testnet";
    const baseUrl = isTestnet
      ? "https://testnet.xrpl.org/transactions"
      : "https://livenet.xrpl.org/transactions";
    return `${baseUrl}/${txHash}`;
  };

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
            Withdraw your staked {assetSymbol} and accrued rewards
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
                <span className="font-mono">{depositedAmount} {assetSymbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono text-chart-2">+{rewards} {assetSymbol}</span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-medium">Total Available</span>
                <span className="font-bold font-mono">{totalWithdrawable} {assetSymbol}</span>
              </div>
            </div>
          </div>

          {hasEscrow && escrow && (
            <div className={`p-4 rounded-md border ${getEscrowStatusConfig(escrow.status).bgClass}`}>
              <div className="flex items-start gap-3">
                <Lock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${getEscrowStatusConfig(escrow.status).iconColor}`} />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className={`font-semibold text-sm ${getEscrowStatusConfig(escrow.status).iconColor}`}>
                      {getEscrowStatusConfig(escrow.status).title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getEscrowStatusConfig(escrow.status).description}
                    </p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Escrow Amount:</span>
                      <span className="font-mono font-medium">{parseFloat(escrow.amount).toFixed(6)} XRP</span>
                    </div>
                    {escrow.status === "pending" && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Release Time:</span>
                        <span className="font-medium">{formatReleaseTime(escrow.finishAfter)}</span>
                      </div>
                    )}
                    {escrow.status === "finished" && escrow.finishedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Released On:</span>
                        <span className="font-medium">{formatCompletionTime(escrow.finishedAt)}</span>
                      </div>
                    )}
                    {escrow.status === "cancelled" && escrow.cancelledAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cancelled On:</span>
                        <span className="font-medium">{formatCompletionTime(escrow.cancelledAt)}</span>
                      </div>
                    )}
                    {escrow.createTxHash && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Create Tx:</span>
                        <a 
                          href={getXrplExplorerUrl(escrow.createTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {escrow.createTxHash.substring(0, 10)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {escrow.status === "finished" && escrow.finishTxHash && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Finish Tx:</span>
                        <a 
                          href={getXrplExplorerUrl(escrow.finishTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {escrow.finishTxHash.substring(0, 10)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {escrow.status === "cancelled" && escrow.cancelTxHash && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Cancel Tx:</span>
                        <a 
                          href={getXrplExplorerUrl(escrow.cancelTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {escrow.cancelTxHash.substring(0, 10)}...
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
            disabled={!amount || parseFloat(amount.replace(/,/g, "")) <= 0}
            data-testid="button-confirm-withdraw"
          >
            Confirm Withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
