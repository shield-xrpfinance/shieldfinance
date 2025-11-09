import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield, ShieldAlert, ShieldCheck, Clock, Users, Lock, Info, TrendingUp } from "lucide-react";
import { MultiAssetIcon } from "@/components/AssetIcon";
import { useNetwork } from "@/lib/networkContext";
import { getVaultYieldProjection } from "@/lib/demoYield";
import { getTooltipContent } from "@/lib/tooltipCopy";

interface VaultCardProps {
  id: string;
  name: string;
  asset?: string;
  apy: string;
  apyLabel?: string | null;
  tvl: string;
  liquidity: string;
  lockPeriod: number;
  riskLevel: "low" | "medium" | "high";
  depositors: number;
  status: string;
  depositAssets?: string[];
  pendingEscrowCount?: number;
  finishedEscrowCount?: number;
  cancelledEscrowCount?: number;
  failedEscrowCount?: number;
  totalEscrowAmount?: string;
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
  apyLabel,
  tvl,
  liquidity,
  lockPeriod,
  riskLevel,
  depositors,
  status,
  depositAssets = ["XRP"],
  pendingEscrowCount = 0,
  finishedEscrowCount = 0,
  cancelledEscrowCount = 0,
  failedEscrowCount = 0,
  totalEscrowAmount,
  onDeposit,
}: VaultCardProps) {
  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;
  const isXRPVault = depositAssets.includes("XRP");
  const totalEscrowCount = pendingEscrowCount + finishedEscrowCount + cancelledEscrowCount + failedEscrowCount;
  const { isTestnet } = useNetwork();
  const yieldProjection = getVaultYieldProjection(id);

  return (
    <Card className="hover-elevate">
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <MultiAssetIcon assets={asset} size={32} />
            <h3 className="text-lg font-semibold" data-testid={`text-vault-name-${id}`}>
              {name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isTestnet && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4" data-testid={`badge-simulated-yield-${id}`}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Simulated
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("apy", "simulated")}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Badge variant="secondary" className="text-xs" data-testid={`badge-status-${id}`}>
              {status}
            </Badge>
          </div>
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
        {isXRPVault && totalEscrowCount > 0 && (
          <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-muted/50">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs font-medium">
                {totalEscrowCount} Total Escrow{totalEscrowCount > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2 mt-1 text-xs">
                {pendingEscrowCount > 0 && (
                  <span className="text-chart-4">{pendingEscrowCount} Pending</span>
                )}
                {finishedEscrowCount > 0 && (
                  <span className="text-chart-2">{finishedEscrowCount} Finished</span>
                )}
                {cancelledEscrowCount > 0 && (
                  <span className="text-muted-foreground">{cancelledEscrowCount} Cancelled</span>
                )}
                {failedEscrowCount > 0 && (
                  <span className="text-destructive">{failedEscrowCount} Failed</span>
                )}
              </div>
              {totalEscrowAmount && (
                <p className="text-xs text-muted-foreground mt-1">
                  {parseFloat(totalEscrowAmount).toFixed(2)} XRP total
                </p>
              )}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-sm text-muted-foreground">Annual Percentage Yield</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" data-testid={`icon-apy-info-${id}`} />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{getTooltipContent("apy", isTestnet ? "simulated" : "calculation")}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-5xl font-bold text-primary font-mono tabular-nums" data-testid={`text-apy-${id}`}>
            {apyLabel || `${apy}%`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">Total Value Locked</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" data-testid={`icon-tvl-info-${id}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "tvl")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-base font-semibold font-mono tabular-nums" data-testid={`text-tvl-${id}`}>{tvl}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">Available Liquidity</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" data-testid={`icon-liquidity-info-${id}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "liquidity")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-base font-semibold font-mono tabular-nums" data-testid={`text-liquidity-${id}`}>{liquidity}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lock Period</p>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-base font-semibold" data-testid={`text-lock-period-${id}`}>{lockPeriod} days</p>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">Risk Rating</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" data-testid={`icon-risk-info-${id}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "riskLevel")}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className={`flex items-center gap-1 ${risk.color}`}>
              <RiskIcon className="h-3.5 w-3.5" />
              <p className="text-sm font-medium" data-testid={`text-risk-${id}`}>{risk.label.split(" ")[0]}</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {isTestnet && yieldProjection && (
          <div className="w-full p-3 rounded-md bg-muted/50 border border-muted">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium mb-1">Projected Earnings (Per 100 XRP)</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Daily:</span>{" "}
                    <span className="font-mono font-semibold">{yieldProjection.projectedEarnings.daily} XRP</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly:</span>{" "}
                    <span className="font-mono font-semibold">{yieldProjection.projectedEarnings.monthly} XRP</span>
                  </div>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" data-testid={`icon-projection-info-${id}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{yieldProjection.disclaimer}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
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
          <span data-testid={`text-depositors-${id}`}>{depositors.toLocaleString()} depositors</span>
        </div>
      </CardFooter>
    </Card>
  );
}
