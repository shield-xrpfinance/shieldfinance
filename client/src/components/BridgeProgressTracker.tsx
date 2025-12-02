import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  Copy, 
  ExternalLink,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  NETWORKS, 
  BRIDGE_TOKENS, 
  type NetworkId, 
  type BridgeTokenId 
} from "@shared/bridgeConfig";

type LegStatus = "pending" | "executing" | "awaiting_confirm" | "bridging" | "awaiting_dest" | "completed" | "failed" | "refunded";
type JobStatus = "pending" | "quoted" | "confirmed" | "executing" | "awaiting_source" | "awaiting_dest" | "completed" | "partially_failed" | "failed" | "cancelled" | "refunded";

interface BridgeLeg {
  id: string;
  legIndex: number;
  fromNetwork: NetworkId;
  fromToken: BridgeTokenId;
  fromAmount: string;
  toNetwork: NetworkId;
  toToken: BridgeTokenId;
  toAmountExpected: string | null;
  toAmountReceived: string | null;
  protocol: string;
  routerAddress: string | null;
  sourceTxHash: string | null;
  bridgeTxHash: string | null;
  destTxHash: string | null;
  status: LegStatus;
  errorMessage: string | null;
  gasFeeSourceUsd: string | null;
  gasFeeDestUsd: string | null;
  bridgeFeeUsd: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface BridgeJob {
  id: string;
  walletAddress: string;
  sourceNetwork: NetworkId;
  sourceToken: BridgeTokenId;
  sourceAmount: string;
  destNetwork: NetworkId;
  destToken: BridgeTokenId;
  destAmount: string | null;
  destAmountReceived: string | null;
  recipientAddress: string;
  totalLegs: number;
  currentLeg: number;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  legs: BridgeLeg[];
}

interface BridgeProgressTrackerProps {
  job: BridgeJob;
  isLoading?: boolean;
}

function getStatusIcon(status: LegStatus | JobStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-status-completed" />;
    case "failed":
    case "partially_failed":
    case "cancelled":
      return <AlertCircle className="h-5 w-5 text-destructive" data-testid="icon-status-failed" />;
    case "executing":
    case "bridging":
    case "confirmed":
      return <Loader2 className="h-5 w-5 text-primary animate-spin" data-testid="icon-status-executing" />;
    case "awaiting_confirm":
    case "awaiting_dest":
    case "awaiting_source":
    case "quoted":
      return <Clock className="h-5 w-5 text-yellow-500" data-testid="icon-status-awaiting" />;
    case "refunded":
      return <AlertCircle className="h-5 w-5 text-orange-500" data-testid="icon-status-refunded" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" data-testid="icon-status-pending" />;
  }
}

function getStatusBadge(status: LegStatus | JobStatus) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    quoted: { variant: "secondary", label: "Quoted" },
    confirmed: { variant: "default", label: "Confirmed" },
    executing: { variant: "default", label: "Executing" },
    bridging: { variant: "default", label: "Bridging" },
    awaiting_confirm: { variant: "secondary", label: "Awaiting Confirmation" },
    awaiting_source: { variant: "secondary", label: "Awaiting Source" },
    awaiting_dest: { variant: "secondary", label: "Awaiting Destination" },
    completed: { variant: "default", label: "Completed" },
    partially_failed: { variant: "destructive", label: "Partially Failed" },
    failed: { variant: "destructive", label: "Failed" },
    cancelled: { variant: "destructive", label: "Cancelled" },
    refunded: { variant: "secondary", label: "Refunded" },
  };

  const config = statusConfig[status] || { variant: "secondary" as const, label: String(status).replace(/_/g, ' ') };
  
  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      {config.label}
    </Badge>
  );
}

function getExplorerUrl(networkId: NetworkId, txHash: string): string {
  const network = NETWORKS[networkId];
  if (!network) return "";
  
  const baseUrl = network.explorerUrls.testnet || network.explorerUrls.mainnet;
  
  if (networkId === "xrpl") {
    return `${baseUrl}/transactions/${txHash}`;
  }
  
  return `${baseUrl}/tx/${txHash}`;
}

function NetworkIcon({ networkId }: { networkId: NetworkId }) {
  const network = NETWORKS[networkId];
  if (!network) return null;
  
  return (
    <div 
      className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white"
      style={{ backgroundColor: network.color }}
      data-testid={`icon-network-${networkId}`}
    >
      {network.shortName.charAt(0)}
    </div>
  );
}

function LegCard({ leg, isLast }: { leg: BridgeLeg; isLast: boolean }) {
  const { toast } = useToast();
  const sourceNetwork = NETWORKS[leg.fromNetwork];
  const destNetwork = NETWORKS[leg.toNetwork];
  const sourceToken = BRIDGE_TOKENS[leg.fromToken];
  const destToken = BRIDGE_TOKENS[leg.toToken];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const txHash = leg.destTxHash || leg.bridgeTxHash || leg.sourceTxHash;
  const isActive = leg.status === "executing" || leg.status === "awaiting_confirm" || leg.status === "bridging" || leg.status === "awaiting_dest";
  const outputAmount = leg.toAmountReceived || leg.toAmountExpected || "—";
  
  return (
    <div 
      className={`relative ${!isLast ? "pb-6" : ""}`}
      data-testid={`leg-card-${leg.legIndex}`}
    >
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      )}
      
      <div className={`flex gap-4 ${isActive ? "opacity-100" : leg.status === "completed" ? "opacity-100" : "opacity-60"}`}>
        <div className="flex-shrink-0 mt-1">
          {getStatusIcon(leg.status)}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">Leg {leg.legIndex + 1}</span>
              <Badge variant="outline" className="text-xs">{leg.protocol}</Badge>
              {getStatusBadge(leg.status)}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-2">
              <NetworkIcon networkId={leg.fromNetwork} />
              <span className="text-muted-foreground">{sourceNetwork?.name}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <NetworkIcon networkId={leg.toNetwork} />
              <span className="text-muted-foreground">{destNetwork?.name}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Send: </span>
              <span className="font-mono">{leg.fromAmount} {sourceToken?.symbol}</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Receive: </span>
              <span className="font-mono">{outputAmount} {destToken?.symbol}</span>
            </div>
          </div>
          
          {txHash && (
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
                {txHash}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(txHash, "Transaction hash")}
                data-testid={`button-copy-tx-${leg.legIndex}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
                data-testid={`button-explorer-${leg.legIndex}`}
              >
                <a 
                  href={getExplorerUrl(leg.toNetwork, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          )}
          
          {leg.errorMessage && (
            <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm" data-testid={`error-leg-${leg.legIndex}`}>
              <p className="font-medium text-destructive">Error:</p>
              <p className="text-destructive/80">{leg.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BridgeProgressTracker({ job, isLoading }: BridgeProgressTrackerProps) {
  const { toast } = useToast();
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const completedLegs = job.legs.filter(leg => leg.status === "completed").length;
  const totalLegs = job.legs.length;
  const progressPercent = totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0;

  const sourceNetwork = NETWORKS[job.sourceNetwork];
  const destNetwork = NETWORKS[job.destNetwork];
  const sourceToken = BRIDGE_TOKENS[job.sourceToken];
  const destToken = BRIDGE_TOKENS[job.destToken];

  const copyJobId = () => {
    navigator.clipboard.writeText(job.id);
    toast({
      title: "Copied!",
      description: "Job ID copied to clipboard",
    });
  };

  return (
    <Card data-testid="card-bridge-progress">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Bridge Transaction</CardTitle>
            <CardDescription className="mt-1">
              {sourceToken?.symbol} on {sourceNetwork?.name} → {destToken?.symbol} on {destNetwork?.name}
            </CardDescription>
          </div>
          {getStatusBadge(job.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Job ID</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs" data-testid="text-job-id">
                {job.id.slice(0, 8)}...{job.id.slice(-8)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyJobId}
                data-testid="button-copy-job-id"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Started</span>
            <span data-testid="text-created-at">
              {new Date(job.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium" data-testid="text-progress">
              {completedLegs} of {totalLegs} legs completed
            </span>
          </div>
          <Progress value={progressPercent} data-testid="progress-overall" />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono" data-testid="text-input-amount">
              {job.sourceAmount}
            </div>
            <div className="text-sm text-muted-foreground">
              {sourceToken?.symbol} on {sourceNetwork?.shortName}
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="text-center">
            <div className="text-2xl font-bold font-mono" data-testid="text-output-amount">
              {job.destAmountReceived || job.destAmount || "—"}
            </div>
            <div className="text-sm text-muted-foreground">
              {destToken?.symbol} on {destNetwork?.shortName}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Transaction Legs
          </h4>
          <div className="space-y-0">
            {job.legs.map((leg, index) => (
              <LegCard 
                key={leg.id} 
                leg={leg} 
                isLast={index === job.legs.length - 1}
              />
            ))}
          </div>
        </div>

        {job.status === "completed" && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="font-medium text-green-600 dark:text-green-400" data-testid="text-success">
              Bridge completed successfully!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {job.destAmountReceived || job.destAmount} {destToken?.symbol} has been delivered to your wallet on {destNetwork?.name}
            </p>
          </div>
        )}

        {job.status === "failed" && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="font-medium text-destructive" data-testid="text-failed">
              Bridge transaction failed
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please contact support with your Job ID for assistance
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
