import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, TrendingUp, TrendingDown, Clock, ArrowRightLeft } from "lucide-react";
import { AssetIcon } from "@/components/AssetIcon";
import { format } from "date-fns";
import type { AssetKey } from "@shared/assetConfig";

interface PositionHistoryProps {
  walletAddress: string | null | undefined;
}

interface PositionHistoryItem {
  id: string;
  vaultId: string;
  vaultName: string;
  vaultAsset: string;
  currentAmount: number;
  rewards: number;
  status: string;
  createdAt: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netChange: number;
  transactionCount: number;
  lastActivity: string;
}

interface PositionHistoryResponse {
  walletAddress: string;
  activePositions: PositionHistoryItem[];
  closedPositions: PositionHistoryItem[];
  totalPositions: number;
  summary: {
    totalActiveValue: number;
    totalHistoricalDeposits: number;
    totalHistoricalWithdrawals: number;
  };
}

function PositionHistorySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      data-testid="empty-state-position-history"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <History className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No Position History</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your closed and historical positions will appear here once you have vault activity.
      </p>
    </div>
  );
}

function PositionCard({ position }: { position: PositionHistoryItem }) {
  const isProfit = position.netChange >= 0;
  const isClosed = position.status !== 'active' || position.currentAmount === 0;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-card/50 hover-elevate transition-all"
      data-testid={`position-history-item-${position.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <AssetIcon asset={position.vaultAsset as AssetKey} size={40} />
          {isClosed && (
            <div className="absolute -bottom-1 -right-1 bg-muted rounded-full p-0.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium" data-testid={`text-vault-name-${position.id}`}>
              {position.vaultName}
            </p>
            <Badge
              variant={isClosed ? "secondary" : "default"}
              className="text-xs"
              data-testid={`badge-status-${position.id}`}
            >
              {isClosed ? "Closed" : "Active"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{position.transactionCount} transactions</span>
            <span>·</span>
            <span>Last: {format(new Date(position.lastActivity), "MMM d, yyyy")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total In/Out</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-chart-2 font-mono">
              +{position.totalDeposited.toFixed(2)}
            </span>
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
            <span className="text-destructive font-mono">
              -{position.totalWithdrawn.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="text-right min-w-[80px]">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Change</p>
          <div className="flex items-center justify-end gap-1">
            {isProfit ? (
              <TrendingUp className="h-4 w-4 text-chart-2" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span
              className={`font-medium font-mono ${isProfit ? "text-chart-2" : "text-destructive"}`}
              data-testid={`text-net-change-${position.id}`}
            >
              {isProfit ? "+" : ""}{position.netChange.toFixed(2)} {position.vaultAsset}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PositionHistory({ walletAddress }: PositionHistoryProps) {
  const { data, isLoading, isError } = useQuery<PositionHistoryResponse>({
    queryKey: ["/api/positions/history", walletAddress],
    enabled: !!walletAddress,
  });

  const hasClosedPositions = data && data.closedPositions.length > 0;
  const hasActivePositions = data && data.activePositions.length > 0;
  const hasAnyData = hasClosedPositions || hasActivePositions;

  return (
    <Card data-testid="card-position-history">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Position History</CardTitle>
        </div>
        {data && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Total Deposited:{" "}
              <span className="font-mono text-foreground">
                {data.summary.totalHistoricalDeposits.toFixed(2)}
              </span>
            </span>
            <span>
              Total Withdrawn:{" "}
              <span className="font-mono text-foreground">
                {data.summary.totalHistoricalWithdrawals.toFixed(2)}
              </span>
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PositionHistorySkeleton />
        ) : isError || !hasAnyData ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {hasClosedPositions && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Closed Positions ({data.closedPositions.length})
                </h4>
                <div className="space-y-3">
                  {data.closedPositions.map((position) => (
                    <PositionCard key={position.id} position={position} />
                  ))}
                </div>
              </div>
            )}

            {hasActivePositions && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Active Positions ({data.activePositions.length})
                </h4>
                <div className="space-y-3">
                  {data.activePositions.map((position) => (
                    <PositionCard key={position.id} position={position} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PositionHistory;
