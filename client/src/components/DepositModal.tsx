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
  depositAssets?: string[];
  onConfirm: (amounts: { [asset: string]: string }) => void;
}

export default function DepositModal({
  open,
  onOpenChange,
  vaultName,
  vaultApy,
  depositAssets = ["XRP"],
  onConfirm,
}: DepositModalProps) {
  const [amounts, setAmounts] = useState<{ [key: string]: string }>({});
  const [step, setStep] = useState<1 | 2>(1);
  const gasEstimate = "0.00012";

  const availableBalances: { [key: string]: string } = {
    XRP: "10,000",
    RLUSD: "5,000",
    USDC: "8,000",
  };

  const totalValue = Object.entries(amounts).reduce((sum, [asset, amount]) => {
    if (!amount) return sum;
    const val = parseFloat(amount.replace(/,/g, ""));
    return sum + val;
  }, 0);

  const projectedEarnings = totalValue
    ? (totalValue * parseFloat(vaultApy) / 100).toFixed(2)
    : "0";

  const handleContinue = () => {
    if (step === 1 && Object.keys(amounts).length > 0) {
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
              {depositAssets.map((asset) => (
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
                    <p className="text-xs text-muted-foreground">
                      Available: {availableBalances[asset] || "0"} {asset}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setAssetAmount(asset, availableBalances[asset] || "0")}
                      data-testid={`button-max-${asset}`}
                    >
                      Max
                    </Button>
                  </div>
                </div>
              ))}

              <div className="space-y-2 p-4 rounded-md bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Value</span>
                  <span className="font-semibold font-mono">{totalValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Projected Annual Earnings</span>
                  <span className="font-semibold font-mono">{projectedEarnings}</span>
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
                {Object.entries(amounts).filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0).map(([asset, amount]) => (
                  <div key={asset} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{asset} Amount</span>
                    <span className="font-semibold font-mono">{amount} {asset}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total Value</span>
                  <span className="font-semibold font-mono">{totalValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Annual Earnings</span>
                  <span className="font-medium font-mono text-chart-2">+{projectedEarnings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Gas Fee</span>
                  <span className="font-mono text-sm">{gasEstimate} XRP</span>
                </div>
                <div className="pt-3 border-t flex items-center justify-between">
                  <span className="font-medium">Total Cost</span>
                  <span className="text-lg font-bold font-mono">
                    {(totalValue + parseFloat(gasEstimate)).toFixed(5)}
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
            disabled={!hasValidAmount}
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
