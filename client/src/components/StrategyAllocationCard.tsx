import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  PieChart, 
  Flame, 
  Zap, 
  Droplets,
  TrendingUp,
  Info,
  ExternalLink
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface StrategyAllocation {
  name: string;
  slug: string;
  deployed: string;
  percentage: number;
  apy: number;
  enabled: boolean;
}

interface StrategyAllocationResponse {
  success: boolean;
  network: string;
  firelightEnabled: boolean;
  vaultTotalAssets: string;
  allocations: StrategyAllocation[];
  lastUpdated: number;
}

const strategyIcons: Record<string, typeof Flame> = {
  buffer: Droplets,
  firelight: Flame,
  kinetic: Zap,
};

const strategyColors: Record<string, string> = {
  buffer: "hsl(var(--muted-foreground))",
  firelight: "hsl(24 95% 53%)",
  kinetic: "hsl(280 91% 62%)",
};

const strategyBgColors: Record<string, string> = {
  buffer: "bg-muted/50",
  firelight: "bg-orange-500/10",
  kinetic: "bg-purple-500/10",
};

interface StrategyAllocationCardProps {
  className?: string;
}

export default function StrategyAllocationCard({ className }: StrategyAllocationCardProps) {
  const { data, isLoading, isError } = useQuery<StrategyAllocationResponse>({
    queryKey: ["/api/strategies/allocation"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className={className} data-testid="card-strategy-allocation-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Strategy Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data?.success) {
    return (
      <Card className={className} data-testid="card-strategy-allocation-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Strategy Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load strategy data
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalValue = parseFloat(data.vaultTotalAssets) || 0;
  const allocations = data.allocations || [];

  return (
    <Card className={className} data-testid="card-strategy-allocation">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-primary" />
              Strategy Allocation
            </CardTitle>
            <CardDescription>
              How your vault generates yield
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1">
                  <span className="capitalize">{data.network}</span>
                  <Info className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {data.firelightEnabled 
                    ? "Firelight stXRP enabled on mainnet"
                    : "Firelight only available on mainnet"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {allocations.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <p>No active yield strategies</p>
            {totalValue > 0 && (
              <p className="mt-1">All assets are currently in the liquidity buffer</p>
            )}
          </div>
        ) : (
          allocations.map((allocation) => {
            const Icon = strategyIcons[allocation.slug] || PieChart;
            const bgColor = strategyBgColors[allocation.slug] || "bg-muted/50";
            const deployed = parseFloat(allocation.deployed) || 0;
            const isFirelight = allocation.slug === "firelight";
            
            return (
              <div 
                key={allocation.slug}
                className={`p-3 rounded-lg ${bgColor} space-y-2`}
                data-testid={`strategy-allocation-${allocation.slug}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <Icon 
                      className="h-4 w-4" 
                      style={{ color: strategyColors[allocation.slug] || undefined }}
                    />
                    <span className="font-medium text-sm">{allocation.name}</span>
                    {isFirelight && allocation.enabled && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href="https://firelight.finance" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View on Firelight.finance</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {allocation.enabled && allocation.apy > 0 && deployed > 0 && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {allocation.apy.toFixed(1)}% APY
                      </span>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={allocation.percentage} 
                  className="h-2"
                  data-testid={`progress-${allocation.slug}`}
                />
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{allocation.percentage.toFixed(1)}% of vault</span>
                  <span>{deployed > 0 ? `${deployed.toFixed(2)} FXRP` : "—"}</span>
                </div>
              </div>
            );
          })
        )}
        
        {totalValue > 0 && (
          <div className="pt-2 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Vault Assets</span>
            <span className="font-medium">{totalValue.toFixed(2)} FXRP</span>
          </div>
        )}
        
        {data.firelightEnabled && (
          <p className="text-xs text-muted-foreground pt-2">
            Yield powered by{" "}
            <a 
              href="https://firelight.finance" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-orange-500 hover:underline"
            >
              Firelight.finance
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
