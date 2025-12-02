import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import type { CrossChainBridgeJob } from "@shared/schema";

// Helper to convert status to human-readable format
function formatStatus(status: string): string {
  const statusLabels: Record<string, string> = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'failed': 'Failed',
  };
  
  return statusLabels[status] || status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Map status to badge variant
function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "secondary";
}

export default function BridgeTracking() {
  const { address, evmAddress } = useWallet();
  const walletAddr = address || evmAddress;

  // Query for multi-chain bridge jobs (FSwap widget)
  const { data: crossChainJobs, isLoading } = useQuery<{ jobs: CrossChainBridgeJob[] }>({
    queryKey: [`/api/bridge/jobs/${walletAddr}`],
    enabled: !!walletAddr,
  });

  const jobs = crossChainJobs?.jobs || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Bridge History
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
          View your cross-chain bridge transactions
        </p>
      </div>

      {!walletAddr ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground font-medium" data-testid="text-connect-wallet-prompt">
              Connect your wallet to view bridge history
            </p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Your bridge transactions will appear here after connecting
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading bridge history...</p>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground font-medium" data-testid="text-no-bridges">
              No bridge transactions yet
            </p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Use the Bridge page to swap tokens across chains
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {jobs.length} bridge transaction{jobs.length !== 1 ? 's' : ''}
          </p>
          {jobs.map((job) => (
            <Card key={job.id} data-testid={`card-bridge-${job.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      <ArrowLeftRight className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge 
                          variant="outline"
                          className="border-purple-500 text-purple-600"
                          data-testid={`badge-type-${job.id}`}
                        >
                          Cross-Chain
                        </Badge>
                        <Badge 
                          variant={getStatusVariant(job.status)}
                          data-testid={`badge-status-${job.id}`}
                        >
                          {formatStatus(job.status)}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {job.sourceNetwork} → {job.destNetwork}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {job.createdAt && format(new Date(job.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {job.completedAt && (
                          <span className="block mt-1">
                            Completed: {format(new Date(job.completedAt), "MMM d, h:mm a")}
                          </span>
                        )}
                      </p>
                      {job.errorMessage && (
                        <p className="text-sm text-destructive mt-1">
                          {job.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:items-end">
                    <p className="font-semibold" data-testid={`text-source-amount-${job.id}`}>
                      {parseFloat(job.sourceAmount?.toString() || "0").toFixed(6)} {job.sourceToken}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      → {parseFloat(job.destAmountReceived?.toString() || job.destAmount?.toString() || "0").toFixed(6)} {job.destToken}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
