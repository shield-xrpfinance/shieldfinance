import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  Target, 
  Clock,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface StrategyAllocation {
  vaultId: string;
  vaultName: string;
  asset: string;
  percentage: number;
  apy: number;
}

interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  riskLevel: "conservative" | "balanced" | "aggressive";
  expectedApy: number;
  allocations: StrategyAllocation[];
  minInvestment: number;
  lockPeriod: number;
  tags: string[];
}

interface MarketConditions {
  overallSentiment: "bullish" | "neutral" | "bearish";
  volatility: "low" | "medium" | "high";
  recommendedStrategy: string;
  riskScore: number;
}

const riskColors = {
  conservative: "text-green-500",
  balanced: "text-yellow-500",
  aggressive: "text-red-500",
};

const riskBgColors = {
  conservative: "bg-green-500/10",
  balanced: "bg-yellow-500/10",
  aggressive: "bg-red-500/10",
};

const riskIcons = {
  conservative: Shield,
  balanced: Target,
  aggressive: Zap,
};

export default function YieldOptimizer() {
  const [selectedStrategy, setSelectedStrategy] = useState<OptimizationStrategy | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: strategies = [], isLoading: strategiesLoading } = useQuery<OptimizationStrategy[]>({
    queryKey: ["/api/yield/strategies"],
  });

  const { data: marketConditions, isLoading: marketLoading } = useQuery<MarketConditions>({
    queryKey: ["/api/yield/market-conditions"],
  });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return "text-green-500";
      case "bearish": return "text-red-500";
      default: return "text-yellow-500";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return <TrendingUp className="h-4 w-4" />;
      case "bearish": return <AlertTriangle className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const handleApplyStrategy = (strategy: OptimizationStrategy) => {
    setSelectedStrategy(strategy);
    setApplyDialogOpen(true);
  };

  const confirmApplyStrategy = () => {
    setApplyDialogOpen(false);
    setSelectedStrategy(null);
    toast({
      title: "Coming Soon",
      description: "Automated strategy allocation will be available after mainnet launch. Stay tuned!",
    });
  };

  if (strategiesLoading || marketLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Conditions Banner */}
      {marketConditions && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${riskBgColors[marketConditions.volatility === "high" ? "aggressive" : marketConditions.volatility === "low" ? "conservative" : "balanced"]}`}>
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Market Sentiment:</span>
                    <span className={`flex items-center gap-1 font-semibold capitalize ${getSentimentColor(marketConditions.overallSentiment)}`}>
                      {getSentimentIcon(marketConditions.overallSentiment)}
                      {marketConditions.overallSentiment}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Volatility: <span className="capitalize">{marketConditions.volatility}</span> | 
                    Risk Score: {marketConditions.riskScore}/100
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Recommended:</span>
                <Badge variant="outline" className="capitalize">
                  {strategies.find(s => s.id === marketConditions.recommendedStrategy)?.name || marketConditions.recommendedStrategy}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {strategies.map((strategy) => {
          const RiskIcon = riskIcons[strategy.riskLevel];
          const isRecommended = marketConditions?.recommendedStrategy === strategy.id;

          return (
            <Card 
              key={strategy.id} 
              className={`relative overflow-hidden hover-elevate transition-all ${isRecommended ? "ring-2 ring-primary" : ""}`}
              data-testid={`card-strategy-${strategy.id}`}
            >
              {isRecommended && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl-md font-medium">
                  Recommended
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${riskBgColors[strategy.riskLevel]}`}>
                      <RiskIcon className={`h-5 w-5 ${riskColors[strategy.riskLevel]}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <span className={`text-xs capitalize ${riskColors[strategy.riskLevel]}`}>
                        {strategy.riskLevel} Risk
                      </span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-sm mt-2">
                  {strategy.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Expected APY */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expected APY</span>
                  <span className="text-2xl font-bold text-primary">
                    {strategy.expectedApy.toFixed(1)}%
                  </span>
                </div>

                {/* Allocation Breakdown */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Allocation</span>
                  {strategy.allocations.slice(0, 3).map((alloc) => (
                    <div key={alloc.vaultId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <Progress value={alloc.percentage} className="w-12 h-1.5" />
                        <span className="truncate">{alloc.vaultName}</span>
                      </div>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {alloc.percentage}%
                      </span>
                    </div>
                  ))}
                  {strategy.allocations.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{strategy.allocations.length - 3} more vaults
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {strategy.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Details Row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{strategy.lockPeriod} day lock</span>
                  </div>
                  <span>Min: ${strategy.minInvestment}</span>
                </div>

                {/* Apply Button */}
                <Button 
                  className="w-full"
                  onClick={() => handleApplyStrategy(strategy)}
                  data-testid={`button-apply-strategy-${strategy.id}`}
                >
                  Apply Strategy
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Apply Strategy Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Apply {selectedStrategy?.name}
            </DialogTitle>
            <DialogDescription>
              Review your allocation before proceeding
            </DialogDescription>
          </DialogHeader>
          
          {selectedStrategy && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expected APY</span>
                <span className="text-xl font-bold text-primary">
                  {selectedStrategy.expectedApy.toFixed(1)}%
                </span>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm font-medium">Allocation Breakdown</span>
                {selectedStrategy.allocations.map((alloc) => (
                  <div key={alloc.vaultId} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
                    <div className="flex flex-col">
                      <span className="font-medium">{alloc.vaultName}</span>
                      <span className="text-xs text-muted-foreground">{alloc.asset}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{alloc.percentage}%</span>
                      <p className="text-xs text-muted-foreground">{alloc.apy}% APY</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Funds will be distributed across selected vaults automatically
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApplyStrategy} data-testid="button-confirm-apply-strategy">
              Confirm & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
