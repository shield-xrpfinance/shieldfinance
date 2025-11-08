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
import { Coins } from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  vaultApy: string;
  onConfirm: (amount: string) => void;
}

export default function DepositModal({
  open,
  onOpenChange,
  vaultName,
  vaultApy,
  onConfirm,
}: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const availableBalance = "10,000";
  const gasEstimate = "0.00012";

  const projectedEarnings = amount
    ? (parseFloat(amount.replace(/,/g, "")) * parseFloat(vaultApy) / 100).toFixed(2)
    : "0";

  const handleContinue = () => {
    if (step === 1 && amount) {
      setStep(2);
    } else if (step === 2) {
      onConfirm(amount);
      setAmount("");
      setStep(1);
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-deposit">
        <DialogHeader>
          <DialogTitle>Deposit XRP</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Enter the amount of XRP you want to deposit"
              : "Review and confirm your deposit"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="flex items-center gap-2 p-4 rounded-md bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{vaultName}</p>
              <p className="text-xs text-muted-foreground">APY: {vaultApy}%</p>
            </div>
            <Badge>{vaultApy}% APY</Badge>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <div className="relative mt-2">
                  <Input
                    id="amount"
                    type="text"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-20 text-lg font-mono"
                    data-testid="input-deposit-amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    XRP
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    Available: {availableBalance} XRP
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setAmount(availableBalance)}
                    data-testid="button-max"
                  >
                    Max
                  </Button>
                </div>
              </div>

              <div className="space-y-2 p-4 rounded-md bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Projected Annual Earnings</span>
                  <span className="font-semibold font-mono">{projectedEarnings} XRP</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Est. Gas Fee</span>
                  <span className="font-mono">{gasEstimate} XRP</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-3 p-4 rounded-md border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Deposit Amount</span>
                  <span className="text-lg font-semibold font-mono">{amount} XRP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Annual Earnings</span>
                  <span className="font-medium font-mono text-chart-2">+{projectedEarnings} XRP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gas Fee</span>
                  <span className="font-mono text-sm">{gasEstimate} XRP</span>
                </div>
                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-lg font-bold font-mono">
                    {(parseFloat(amount.replace(/,/g, "")) + parseFloat(gasEstimate)).toFixed(5)} XRP
                  </span>
                </div>
              </div>
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
            disabled={!amount || parseFloat(amount.replace(/,/g, "")) <= 0}
            className="flex-1"
            data-testid="button-continue"
          >
            {step === 1 ? "Continue" : "Confirm Deposit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
