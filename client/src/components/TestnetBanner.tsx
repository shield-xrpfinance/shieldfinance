import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Beaker } from "lucide-react";
import { useNetwork } from "@/lib/networkContext";
import { Badge } from "@/components/ui/badge";

export function TestnetBanner() {
  const { isTestnet, network } = useNetwork();

  if (!isTestnet) return null;

  return (
    <Alert className="border-chart-4 bg-chart-4/10 mb-6">
      <div className="flex items-center gap-3">
        <Beaker className="h-5 w-5 text-chart-4" />
        <div className="flex-1">
          <AlertDescription className="text-sm flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-chart-4/20 text-chart-4 border-chart-4">
              {network === "testnet" ? "XRPL Testnet" : "Coston2 Testnet"}
            </Badge>
            <span className="text-muted-foreground">
              This is a demo environment with simulated yields and test tokens. No real assets at risk.
            </span>
          </AlertDescription>
        </div>
        <Info className="h-4 w-4 text-muted-foreground" />
      </div>
    </Alert>
  );
}
