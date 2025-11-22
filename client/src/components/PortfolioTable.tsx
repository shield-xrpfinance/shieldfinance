import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, Lock, ExternalLink } from "lucide-react";
import { MultiAssetIcon } from "@/components/AssetIcon";
import type { Escrow } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface Position {
  id: string;
  vaultName: string;
  asset?: string;
  depositedAmount: string;
  currentValue: string;
  rewards: string;
  apy: string;
  depositDate: string;
}

interface PortfolioTableProps {
  positions: Position[];
  escrows?: Escrow[];
  network?: string;
  onWithdraw: (id: string) => void;
  onClaim: (id: string) => void;
}

const getEscrowStatusVariant = (status: string): "default" | "secondary" | "outline" => {
  switch (status) {
    case "pending":
      return "outline";
    case "finished":
      return "secondary";
    case "cancelled":
      return "outline";
    default:
      return "outline";
  }
};

const getEscrowStatusColor = (status: string): string => {
  switch (status) {
    case "pending":
      return "text-chart-4";
    case "finished":
      return "text-chart-2";
    case "cancelled":
      return "text-muted-foreground";
    case "failed":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
};

const getXrplExplorerUrl = (txHash: string, network: string): string => {
  const isTestnet = network === "testnet";
  const baseUrl = isTestnet
    ? "https://testnet.xrpl.org/transactions"
    : "https://livenet.xrpl.org/transactions";
  return `${baseUrl}/${txHash}`;
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-md border p-4 space-y-3 ${className || ""}`}>{children}</div>
);

export default function PortfolioTable({
  positions,
  escrows = [],
  network = "mainnet",
  onWithdraw,
  onClaim,
}: PortfolioTableProps) {
  const getPositionEscrow = (positionId: string): Escrow | undefined => {
    return escrows.find((escrow) => escrow.positionId === positionId);
  };

  const formatReleaseTime = (finishAfter: Date | string | null): string => {
    if (!finishAfter) return "Unknown";
    try {
      const date = typeof finishAfter === "string" ? new Date(finishAfter) : finishAfter;
      const now = new Date();
      if (date <= now) {
        return "Ready to release";
      }
      return `in ${formatDistanceToNow(date)}`;
    } catch {
      return "Unknown";
    }
  };

  const formatCompletionTime = (timestamp: Date | string | null): string => {
    if (!timestamp) return "Unknown";
    try {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  const getEscrowTooltipTitle = (status: string): string => {
    switch (status) {
      case "pending":
        return "Funds Secured in Escrow";
      case "finished":
        return "Escrow Released";
      case "cancelled":
        return "Escrow Cancelled";
      case "failed":
        return "Escrow Failed";
      default:
        return "Escrow Status";
    }
  };

  const getEscrowTooltipDescription = (escrow: Escrow): string => {
    switch (escrow.status) {
      case "pending":
        return "Your XRP deposit is secured in an escrow. Upon withdrawal approval, the escrow will be released.";
      case "finished":
        return `Your escrow was successfully released on ${formatCompletionTime(escrow.finishedAt)}.`;
      case "cancelled":
        return `This escrow was cancelled on ${formatCompletionTime(escrow.cancelledAt)}.`;
      case "failed":
        return "The escrow operation failed. Please contact support for assistance.";
      default:
        return "Escrow status information";
    }
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vault</TableHead>
            <TableHead className="text-right">Deposited</TableHead>
            <TableHead className="text-right">Current Value</TableHead>
            <TableHead className="text-right">Rewards</TableHead>
            <TableHead className="text-center">Escrow</TableHead>
            <TableHead className="text-right">APY</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No active positions
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => {
              const escrow = getPositionEscrow(position.id);
              const isXRP = position.asset?.includes("XRP");
              
              return (
                <TableRow key={position.id} data-testid={`row-position-${position.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <MultiAssetIcon assets={position.asset || "XRP"} size={28} />
                      <div>
                        <p className="font-medium">{position.vaultName}</p>
                        <p className="text-xs text-muted-foreground">{position.depositDate}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {position.depositedAmount} {position.asset?.split(",")[0] || "XRP"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono tabular-nums">{position.currentValue} {position.asset?.split(",")[0] || "XRP"}</span>
                      <span className="text-xs text-chart-2 flex items-center gap-0.5">
                        <ArrowUpRight className="h-3 w-3" />
                        {(
                          ((parseFloat(position.currentValue.replace(/,/g, "")) -
                            parseFloat(position.depositedAmount.replace(/,/g, ""))) /
                            parseFloat(position.depositedAmount.replace(/,/g, ""))) *
                          100
                        ).toFixed(2)}
                        %
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-chart-2">
                    +{position.rewards} {position.asset?.split(",")[0] || "XRP"}
                  </TableCell>
                  <TableCell className="text-center">
                    {isXRP && escrow ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex flex-col items-center gap-1">
                            <Badge 
                              variant={getEscrowStatusVariant(escrow.status)}
                              className={getEscrowStatusColor(escrow.status)}
                              data-testid={`badge-escrow-status-${position.id}`}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              {escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1)}
                            </Badge>
                            <span className="text-xs text-muted-foreground" data-testid={`text-escrow-amount-${position.id}`}>
                              {parseFloat(escrow.amount).toFixed(2)} XRP
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              <Lock className="h-4 w-4" />
                              {getEscrowTooltipTitle(escrow.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {getEscrowTooltipDescription(escrow)}
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-mono">{parseFloat(escrow.amount).toFixed(6)} XRP</span>
                              </div>
                              {escrow.status === "pending" && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Release:</span>
                                  <span>{formatReleaseTime(escrow.finishAfter)}</span>
                                </div>
                              )}
                              {escrow.status === "finished" && escrow.finishedAt && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Released:</span>
                                  <span>{formatCompletionTime(escrow.finishedAt)}</span>
                                </div>
                              )}
                              {escrow.status === "cancelled" && escrow.cancelledAt && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Cancelled:</span>
                                  <span>{formatCompletionTime(escrow.cancelledAt)}</span>
                                </div>
                              )}
                              {escrow.createTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Create Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.createTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.createTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {escrow.status === "finished" && escrow.finishTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Finish Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.finishTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.finishTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {escrow.status === "cancelled" && escrow.cancelTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Cancel Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.cancelTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.cancelTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{position.apy}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onClaim(position.id)}
                        data-testid={`button-claim-${position.id}`}
                      >
                        Claim
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onWithdraw(position.id)}
                        data-testid={`button-withdraw-${position.id}`}
                      >
                        Withdraw
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {positions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No active positions</div>
        ) : (
          positions.map((position) => {
            const escrow = getPositionEscrow(position.id);
            const isXRP = position.asset?.includes("XRP");
            const gain = parseFloat(position.currentValue.replace(/,/g, "")) - parseFloat(position.depositedAmount.replace(/,/g, ""));
            const gainPercent = (gain / parseFloat(position.depositedAmount.replace(/,/g, ""))) * 100;

            return (
              <Card key={position.id} className="bg-card" data-testid={`row-position-${position.id}`}>
                {/* Header with vault and APY */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <MultiAssetIcon assets={position.asset || "XRP"} size={24} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{position.vaultName}</p>
                      <p className="text-xs text-muted-foreground">{position.depositDate}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{position.apy}%</Badge>
                </div>

                {/* Amount info */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Deposited</span>
                    <span className="font-mono text-sm font-medium">{position.depositedAmount} {position.asset?.split(",")[0] || "XRP"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Value</span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-medium">{position.currentValue} {position.asset?.split(",")[0] || "XRP"}</span>
                      <span className="text-xs text-chart-2 ml-2 flex items-center gap-0.5 justify-end">
                        <ArrowUpRight className="h-3 w-3" />
                        {gainPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Rewards</span>
                    <span className="font-mono text-sm font-medium text-chart-2">+{position.rewards} {position.asset?.split(",")[0] || "XRP"}</span>
                  </div>
                  
                  {/* Escrow status */}
                  {isXRP && escrow ? (
                    <div className="flex justify-between items-end gap-2">
                      <span className="text-sm text-muted-foreground">Escrow</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex flex-col items-end gap-1">
                            <Badge 
                              variant={getEscrowStatusVariant(escrow.status)}
                              className={getEscrowStatusColor(escrow.status)}
                              data-testid={`badge-escrow-status-${position.id}`}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              {escrow.status.charAt(0).toUpperCase() + escrow.status.slice(1)}
                            </Badge>
                            <span className="text-xs text-muted-foreground" data-testid={`text-escrow-amount-${position.id}`}>
                              {parseFloat(escrow.amount).toFixed(2)} XRP
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              <Lock className="h-4 w-4" />
                              {getEscrowTooltipTitle(escrow.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {getEscrowTooltipDescription(escrow)}
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-mono">{parseFloat(escrow.amount).toFixed(6)} XRP</span>
                              </div>
                              {escrow.status === "pending" && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Release:</span>
                                  <span>{formatReleaseTime(escrow.finishAfter)}</span>
                                </div>
                              )}
                              {escrow.status === "finished" && escrow.finishedAt && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Released:</span>
                                  <span>{formatCompletionTime(escrow.finishedAt)}</span>
                                </div>
                              )}
                              {escrow.status === "cancelled" && escrow.cancelledAt && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Cancelled:</span>
                                  <span>{formatCompletionTime(escrow.cancelledAt)}</span>
                                </div>
                              )}
                              {escrow.createTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Create Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.createTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.createTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {escrow.status === "finished" && escrow.finishTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Finish Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.finishTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.finishTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {escrow.status === "cancelled" && escrow.cancelTxHash && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Cancel Tx:</span>
                                  <a 
                                    href={getXrplExplorerUrl(escrow.cancelTxHash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    {escrow.cancelTxHash.substring(0, 8)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onClaim(position.id)}
                    className="flex-1"
                    data-testid={`button-claim-${position.id}`}
                  >
                    Claim
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onWithdraw(position.id)}
                    className="flex-1"
                    data-testid={`button-withdraw-${position.id}`}
                  >
                    Withdraw
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
