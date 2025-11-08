import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, ShieldCheck, Clock, Users } from "lucide-react";
import { MultiAssetIcon } from "@/components/AssetIcon";

interface VaultCardProps {
  id: string;
  name: string;
  asset?: string;
  apy: string;
  tvl: string;
  liquidity: string;
  lockPeriod: number;
  riskLevel: "low" | "medium" | "high";
  depositors: number;
  status: string;
  depositAssets?: string[];
  onDeposit: (id: string) => void;
}

const riskConfig = {
  low: { icon: ShieldCheck, color: "text-chart-2", bg: "bg-chart-2/10", label: "Low Risk" },
  medium: { icon: Shield, color: "text-chart-4", bg: "bg-chart-4/10", label: "Medium Risk" },
  high: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", label: "High Risk" },
};

export default function VaultCard({
  id,
  name,
  asset = "XRP",
  apy,
  tvl,
  liquidity,
  lockPeriod,
  riskLevel,
  depositors,
  status,
  depositAssets = ["XRP"],
  onDeposit,
}: VaultCardProps) {
  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;

  return (
    <Card className="hover-elevate">
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <MultiAssetIcon assets={asset} size={32} />
            <h3 className="text-lg font-semibold">{name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {status}
          </Badge>
        </div>
        {depositAssets.length > 1 && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-muted-foreground">Accepts:</span>
            <div className="flex gap-1">
              {depositAssets.map((asset) => (
                <Badge key={asset} variant="outline" className="text-xs">
                  {asset}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-1">Annual Percentage Yield</p>
          <p className="text-5xl font-bold text-primary font-mono tabular-nums">{apy}%</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Value Locked</p>
            <p className="text-base font-semibold font-mono tabular-nums">{tvl}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Available Liquidity</p>
            <p className="text-base font-semibold font-mono tabular-nums">{liquidity}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lock Period</p>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-base font-semibold">{lockPeriod} days</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk Rating</p>
            <div className={`flex items-center gap-1 ${risk.color}`}>
              <RiskIcon className="h-3.5 w-3.5" />
              <p className="text-sm font-medium">{risk.label.split(" ")[0]}</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full"
          onClick={() => onDeposit(id)}
          data-testid={`button-deposit-${id}`}
        >
          {depositAssets.length > 1 
            ? `Deposit ${depositAssets.join(" + ")}` 
            : `Deposit ${depositAssets[0]}`}
        </Button>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{depositors.toLocaleString()} depositors</span>
        </div>
      </CardFooter>
    </Card>
  );
}
