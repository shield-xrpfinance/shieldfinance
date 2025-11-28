import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle, Loader2, ArrowRight, Coins, Shield, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

export type PositionLifecycleStage = 
  | "signing"
  | "awaiting_payment"
  | "bridging"
  | "minting"
  | "earning"
  | "failed"
  | "cancelled";

export interface PositionHealthMetric {
  label: string;
  value: string;
  status: "success" | "pending" | "error" | "neutral";
  txHash?: string;
}

export interface PositionActivity {
  id: string;
  type: "bridge" | "position";
  stage: PositionLifecycleStage;
  vaultName: string;
  asset: string;
  amount: string;
  amountUsd?: string;
  rewards?: string;
  rewardsUsd?: string;
  apy?: string;
  createdAt: string;
  metrics: PositionHealthMetric[];
  progress: number; // 0-100
  errorMessage?: string;
}

interface PositionHealthCardProps {
  activity: PositionActivity;
  onWithdraw?: (id: string) => void;
  onClaim?: (id: string) => void;
  onRetry?: (id: string) => void;
}

function getStageInfo(stage: PositionLifecycleStage): { 
  label: string; 
  icon: typeof CheckCircle2; 
  color: string;
  bgColor: string;
} {
  switch (stage) {
    case "signing":
      return { 
        label: "Awaiting Signature", 
        icon: Clock, 
        color: "text-chart-4",
        bgColor: "bg-chart-4/10"
      };
    case "awaiting_payment":
      return { 
        label: "Awaiting Payment", 
        icon: Clock, 
        color: "text-chart-4",
        bgColor: "bg-chart-4/10"
      };
    case "bridging":
      return { 
        label: "Bridging XRP", 
        icon: Loader2, 
        color: "text-primary",
        bgColor: "bg-primary/10"
      };
    case "minting":
      return { 
        label: "Minting Shares", 
        icon: Loader2, 
        color: "text-primary",
        bgColor: "bg-primary/10"
      };
    case "earning":
      return { 
        label: "Active & Earning", 
        icon: CheckCircle2, 
        color: "text-chart-2",
        bgColor: "bg-chart-2/10"
      };
    case "failed":
      return { 
        label: "Failed", 
        icon: AlertTriangle, 
        color: "text-destructive",
        bgColor: "bg-destructive/10"
      };
    case "cancelled":
      return { 
        label: "Cancelled", 
        icon: AlertTriangle, 
        color: "text-muted-foreground",
        bgColor: "bg-muted"
      };
    default:
      return { 
        label: "Unknown", 
        icon: Clock, 
        color: "text-muted-foreground",
        bgColor: "bg-muted"
      };
  }
}

function MetricRow({ metric }: { metric: PositionHealthMetric }) {
  const statusColors = {
    success: "text-chart-2",
    pending: "text-chart-4",
    error: "text-destructive",
    neutral: "text-muted-foreground",
  };

  const statusIcons = {
    success: CheckCircle2,
    pending: Clock,
    error: AlertTriangle,
    neutral: ArrowRight,
  };

  const Icon = statusIcons[metric.status];

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${statusColors[metric.status]}`} />
        <span className="text-sm text-muted-foreground">{metric.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{metric.value}</span>
        {metric.txHash && (
          <a 
            href={`https://coston2-explorer.flare.network/tx/${metric.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function PositionHealthCard({ activity, onWithdraw, onClaim, onRetry }: PositionHealthCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const stageInfo = getStageInfo(activity.stage);
  const StageIcon = stageInfo.icon;
  const isActive = activity.stage === "earning";
  const isPending = ["signing", "awaiting_payment", "bridging", "minting"].includes(activity.stage);
  const isFailed = activity.stage === "failed";

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover-elevate transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                {/* Left: Vault info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg ${stageInfo.bgColor}`}>
                    <Shield className={`h-5 w-5 ${stageInfo.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{activity.vaultName}</span>
                      <Badge variant="outline" className="text-xs">{activity.asset}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span>{activity.amount} {activity.asset}</span>
                      {activity.amountUsd && (
                        <span className="text-muted-foreground/70">({activity.amountUsd})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Status indicator */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Badge 
                    variant="outline" 
                    className={`${stageInfo.bgColor} ${stageInfo.color} border-0 gap-1`}
                    data-testid={`position-status-${activity.id}`}
                  >
                    <StageIcon className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
                    <span className="text-xs font-medium">{stageInfo.label}</span>
                  </Badge>
                  {isPending && activity.progress > 0 && (
                    <Progress value={activity.progress} className="h-1 w-20" />
                  )}
                </div>

                {/* Right: Rewards and expand */}
                <div className="flex items-center gap-3 shrink-0">
                  {isActive && activity.rewards && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-chart-2">
                        <Coins className="h-3.5 w-3.5" />
                        <span className="font-semibold">+{activity.rewards}</span>
                      </div>
                      {activity.apy && (
                        <span className="text-xs text-muted-foreground">{activity.apy}% APY</span>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/30">
            <CardContent className="p-4 pt-3">
              {/* Error message if failed */}
              {isFailed && activity.errorMessage && (
                <div className="mb-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{activity.errorMessage}</p>
                </div>
              )}

              {/* Health metrics */}
              <div className="space-y-0">
                {activity.metrics.map((metric, idx) => (
                  <MetricRow key={idx} metric={metric} />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                {isActive && (
                  <>
                    {onClaim && parseFloat(activity.rewards || "0") > 0 && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onClaim(activity.id)}
                        data-testid={`button-claim-${activity.id}`}
                      >
                        Claim Rewards
                      </Button>
                    )}
                    {onWithdraw && (
                      <Button 
                        size="sm"
                        onClick={() => onWithdraw(activity.id)}
                        data-testid={`button-withdraw-${activity.id}`}
                      >
                        Withdraw
                      </Button>
                    )}
                  </>
                )}
                {isFailed && onRetry && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onRetry(activity.id)}
                    data-testid={`button-retry-${activity.id}`}
                  >
                    Retry
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Started {new Date(activity.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default PositionHealthCard;
