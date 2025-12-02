import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shield, ShieldAlert, ShieldCheck, Clock, Users, Lock, TrendingUp, AlertTriangle, DollarSign, Link2, UserCheck, BadgeCheck, Building2, Landmark, Coins, Vault, Zap, HelpCircle } from "lucide-react";
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
  custodian?: string | null;
  riskDisclosure?: string | null;
  // SHIELD boost props
  boostPercentage?: number;
  hasActiveBoost?: boolean;
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
  custodian,
  riskDisclosure,
  boostPercentage = 0,
  hasActiveBoost = false,
  onDeposit,
}: VaultListItemProps) {
  const risk = riskConfig[riskLevel];
  const RiskIcon = risk.icon;
  const { isTestnet } = useNetwork();

  const isDepositDisabled = comingSoon || paused === true;
  
  // Calculate boosted APY
  const baseApyValue = parseFloat(apy.replace('%', ''));
  const boostedApyValue = hasActiveBoost 
    ? baseApyValue + (baseApyValue * (boostPercentage / 100))
    : baseApyValue;
  const boostedApy = `${boostedApyValue.toFixed(1)}%`;
  
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className={`text-xs ${risk.bg} ${risk.color} border-current cursor-help`} data-testid={`badge-risk-${id}`}>
                      <RiskIcon className="h-3 w-3 mr-1" />
                      {risk.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{getTooltipContent("risk", riskLevel)}</p>
                  </TooltipContent>
                </Tooltip>
                {lockPeriod > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help" data-testid={`badge-lock-period-${id}`}>
                        <Lock className="h-3 w-3 mr-1" />
                        {lockPeriod} days
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{getTooltipContent("lockPeriod", lockPeriod === 7 ? "days7" : lockPeriod === 30 ? "days30" : lockPeriod === 90 ? "days90" : "flexible")}</p>
                    </TooltipContent>
                  </Tooltip>
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
                {custodian && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500" data-testid={`badge-custodian-${id}`}>
                        <Vault className="h-3 w-3 mr-1" />
                        {custodian}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Asset custodian: {custodian}</p>
                      {riskDisclosure && <p className="text-xs mt-1 text-muted-foreground">{riskDisclosure}</p>}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Center: Metrics */}
          <div className="flex flex-wrap gap-8 lg:flex-1 lg:justify-center">
            {/* APY with boost display */}
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 cursor-help" data-testid={`tooltip-vault-apy-${id}`}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">APY</p>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("apy", "calculation")}</p>
                  {hasActiveBoost && (
                    <p className="text-xs mt-1 text-primary">{getTooltipContent("apy", "formula")}</p>
                  )}
                </TooltipContent>
              </Tooltip>
              
              {hasActiveBoost ? (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg font-medium tabular-nums text-muted-foreground line-through" data-testid={`text-apy-${id}`}>
                    {apy}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-3xl font-bold tabular-nums bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent" data-testid={`text-boosted-apy-${id}`}>
                    {boostedApy}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-full cursor-help">
                        <Zap className="h-3 w-3 text-primary fill-primary" />
                        <span className="text-xs font-medium text-primary">+{boostPercentage}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{getTooltipContent("apy", "boosted")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <p className="text-3xl font-bold tabular-nums bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mt-1" data-testid={`text-apy-${id}`}>
                  {apy}
                </p>
              )}
              {apyLabel && (
                <p className="text-xs text-muted-foreground mt-1">{apyLabel}</p>
              )}
            </div>

            {/* TVL with tooltip */}
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 cursor-help" data-testid={`tooltip-vault-tvl-${id}`}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">TVL</p>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "tvl")}</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-2xl font-semibold tabular-nums mt-1" data-testid={`text-tvl-${id}`}>
                {tvl}
              </p>
            </div>

            {/* Liquidity */}
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 cursor-help">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Liquidity</p>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "liquidity")}</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-2xl font-semibold tabular-nums mt-1" data-testid={`text-liquidity-${id}`}>
                {liquidity}
              </p>
            </div>

            {/* Depositors */}
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 cursor-help">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Depositors</p>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{getTooltipContent("vault", "depositors")}</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-2xl font-semibold tabular-nums mt-1" data-testid={`text-depositors-${id}`}>
                {depositors >= 0 ? depositors.toLocaleString() : "—"}
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
