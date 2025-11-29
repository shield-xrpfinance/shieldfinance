import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield, ShieldAlert, ShieldCheck, Clock, Users, Lock, TrendingUp, AlertTriangle, DollarSign, Link2, UserCheck, BadgeCheck, Building2, Landmark, Coins } from "lucide-react";
import { MultiAssetIcon } from "@/components/AssetIcon";
import { useNetwork } from "@/lib/networkContext";
import { getTooltipContent } from "@/lib/tooltipCopy";

interface VaultListItemProps {
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
  depositLimit?: string | null;
  depositLimitRaw?: string | null;
  paused?: boolean | null;
  comingSoon?: boolean;
  // RWA and compliance fields
  assetType?: 'crypto' | 'rwa' | 'tokenized_security';
  kycRequired?: boolean;
  accreditationRequired?: boolean;
  jurisdiction?: string | null;
  underlyingInstrument?: string | null;
  currencyDenomination?: string | null;
  minInvestmentUsd?: string | null;
  onDeposit: (id: string) => void;
}

const riskConfig = {
  low: { icon: ShieldCheck, color: "text-chart-2", bg: "bg-chart-2/10", label: "Low Risk" },
  medium: { icon: Shield, color: "text-chart-4", bg: "bg-chart-4/10", label: "Medium Risk" },
  high: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10", label: "High Risk" },
};

export default function VaultListItem({
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
  depositLimit,
  depositLimitRaw,
  paused,
  comingSoon = false,
  assetType = 'crypto',
  kycRequired = false,
  accreditationRequired = false,
  jurisdiction,
  underlyingInstrument,
  currencyDenomination,
  minInvestmentUsd,
  onDeposit,
}: VaultListItemProps) {
  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;
  const { isTestnet } = useNetwork();

  const isDepositDisabled = comingSoon || paused === true;
  
  // Asset type config for badges
  const assetTypeConfig = {
    crypto: { icon: Coins, label: "Crypto", color: "text-primary", bg: "bg-primary/10" },
    rwa: { icon: Building2, label: "RWA", color: "text-chart-3", bg: "bg-chart-3/10" },
    tokenized_security: { icon: Landmark, label: "Security", color: "text-chart-5", bg: "bg-chart-5/10" },
  };
  const assetTypeInfo = assetTypeConfig[assetType];

  return (
    <Card className={`hover-elevate transition-all duration-200 border-2 ${comingSoon ? 'opacity-75' : ''}`}>
      <div className="p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Vault Info */}
          <div className="flex items-center gap-4 min-w-0">
            <MultiAssetIcon assets={asset} size={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-2xl font-semibold" data-testid={`text-vault-name-${id}`}>
                  {name}
                </h3>
                {comingSoon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs bg-chart-4/10 text-chart-4 border-chart-4" data-testid={`badge-coming-soon-${id}`}>
                        <Clock className="h-3 w-3 mr-1" />
                        Coming Soon
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>This vault is currently under development. Check back soon for launch updates!</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {paused === true && !comingSoon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive" data-testid={`badge-paused-${id}`}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Paused
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>This vault is currently paused by administrators. Deposits and withdrawals are temporarily disabled.</p>
                    </TooltipContent>
                  </Tooltip>
                )}
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
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {/* Asset Type Badge (for RWA and tokenized securities) */}
                {assetType !== 'crypto' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-xs ${assetTypeInfo.bg} ${assetTypeInfo.color} border-current`} data-testid={`badge-asset-type-${id}`}>
                        <assetTypeInfo.icon className="h-3 w-3 mr-1" />
                        {assetTypeInfo.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{assetType === 'rwa' ? 'Real World Asset backed vault' : 'Tokenized security vault'}</p>
                      {underlyingInstrument && <p className="text-xs mt-1">Underlying: {underlyingInstrument}</p>}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Chain Badge */}
                <Badge variant="outline" className="text-xs" data-testid={`badge-chain-${id}`}>
                  <Link2 className="h-3 w-3 mr-1" />
                  {asset === "FXRP" ? "Flare" : "XRPL"}
                </Badge>
                <Badge variant="outline" className={`text-xs ${risk.bg} ${risk.color} border-current`} data-testid={`badge-risk-${id}`}>
                  <RiskIcon className="h-3 w-3 mr-1" />
                  {risk.label}
                </Badge>
                {lockPeriod > 0 && (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-lock-period-${id}`}>
                    <Lock className="h-3 w-3 mr-1" />
                    {lockPeriod} days
                  </Badge>
                )}
                {/* Compliance Badges */}
                {kycRequired && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500" data-testid={`badge-kyc-${id}`}>
                        <UserCheck className="h-3 w-3 mr-1" />
                        KYC
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>KYC verification required before depositing</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {accreditationRequired && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500" data-testid={`badge-accredited-${id}`}>
                        <BadgeCheck className="h-3 w-3 mr-1" />
                        Accredited
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Accredited investor status required</p>
                      {jurisdiction && <p className="text-xs mt-1">Jurisdiction: {jurisdiction}</p>}
                    </TooltipContent>
                  </Tooltip>
                )}
                {minInvestmentUsd && parseFloat(minInvestmentUsd) > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs" data-testid={`badge-min-investment-${id}`}>
                        <DollarSign className="h-3 w-3 mr-1" />
                        Min ${parseFloat(minInvestmentUsd).toLocaleString()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Minimum investment: ${parseFloat(minInvestmentUsd).toLocaleString()} USD equivalent</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Center: Metrics */}
          <div className="flex flex-wrap gap-8 lg:flex-1 lg:justify-center">
            {/* APY */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">APY</p>
              <p className="text-3xl font-bold tabular-nums bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent" data-testid={`text-apy-${id}`}>
                {apy}
              </p>
              {apyLabel && (
                <p className="text-xs text-muted-foreground mt-1">{apyLabel}</p>
              )}
            </div>

            {/* TVL */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">TVL</p>
              <p className="text-2xl font-semibold tabular-nums" data-testid={`text-tvl-${id}`}>
                {tvl}
              </p>
            </div>

            {/* Liquidity */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Liquidity</p>
              <p className="text-2xl font-semibold tabular-nums" data-testid={`text-liquidity-${id}`}>
                {liquidity}
              </p>
            </div>

            {/* Depositors */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Depositors</p>
              <p className="text-2xl font-semibold tabular-nums" data-testid={`text-depositors-${id}`}>
                {depositors.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Right: Action Button */}
          <div className="flex items-center lg:justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    size="lg"
                    onClick={() => onDeposit(id)}
                    disabled={isDepositDisabled}
                    className="min-w-[140px]"
                    data-testid={`button-deposit-${id}`}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Deposit
                  </Button>
                </div>
              </TooltipTrigger>
              {isDepositDisabled && (
                <TooltipContent>
                  <p>
                    {comingSoon 
                      ? "This vault is not yet available for deposits" 
                      : "This vault is currently paused"}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {/* Deposit Limit Warning */}
        {depositLimit && !comingSoon && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Deposit limit: <span className="font-semibold">{depositLimit}</span> FXRP
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
