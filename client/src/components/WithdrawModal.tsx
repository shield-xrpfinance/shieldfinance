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

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  depositedAmount: string;
  rewards: string;
  onConfirm: (amount: string) => void;
}

export default function WithdrawModal({
  open,
  onOpenChange,
  vaultName,
  depositedAmount,
  rewards,
  onConfirm,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const gasEstimate = "0.00008";

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
        description: `You can only withdraw up to ${totalWithdrawable} XRP from this position.`,
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
          <DialogTitle>Withdraw XRP</DialogTitle>
          <DialogDescription>
            Withdraw your staked XRP and accrued rewards
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="p-4 rounded-md bg-muted/50">
            <p className="text-sm font-medium mb-3">{vaultName}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Deposited</span>
                <span className="font-mono">{depositedAmount} XRP</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rewards</span>
                <span className="font-mono text-chart-2">+{rewards} XRP</span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-medium">Total Available</span>
                <span className="font-bold font-mono">{totalWithdrawable} XRP</span>
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
                  XRP
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Available: {totalWithdrawable} XRP
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
                <span className="font-mono">{gasEstimate} XRP</span>
              </div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="font-medium">You'll Receive</span>
                <span className="text-lg font-bold font-mono">
                  {amount ? (parseFloat(amount.replace(/,/g, "")) - parseFloat(gasEstimate)).toFixed(5) : "0.00"} XRP
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
