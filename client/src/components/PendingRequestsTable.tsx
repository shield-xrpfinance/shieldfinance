import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MultiAssetIcon } from "@/components/AssetIcon";

interface WithdrawalRequest {
  id: string;
  walletAddress: string;
  vaultId: string;
  positionId: string | null;
  type: string;
  amount: string;
  asset: string;
  status: string;
  network: string;
  requestedAt: string;
  processedAt: string | null;
  txHash: string | null;
  rejectionReason: string | null;
}

interface PendingRequestsTableProps {
  requests: WithdrawalRequest[];
  vaultNames: Record<string, string>;
  network: string;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4" />;
    case "approved":
      return <CheckCircle className="h-4 w-4" />;
    case "rejected":
      return <XCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "pending":
      return "outline";
    case "approved":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
};

const getXrplExplorerUrl = (txHash: string, network: string): string => {
  const isTestnet = network === "testnet";
  const baseUrl = isTestnet
    ? "https://testnet.xrpl.org/transactions"
    : "https://livenet.xrpl.org/transactions";
  return `${baseUrl}/${txHash}`;
};

export default function PendingRequestsTable({
  requests,
  vaultNames,
  network,
}: PendingRequestsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vault</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Requested</TableHead>
            <TableHead className="text-right">Transaction</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No pending requests
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <MultiAssetIcon assets={request.asset} size={28} />
                    <div>
                      <p className="font-medium">{vaultNames[request.vaultId] || "Unknown Vault"}</p>
                      <p className="text-xs text-muted-foreground">{request.asset}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize" data-testid={`badge-type-${request.id}`}>
                    {request.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {parseFloat(request.amount).toLocaleString()} {request.asset}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Badge 
                      variant={getStatusVariant(request.status)}
                      className="capitalize flex items-center gap-1"
                      data-testid={`badge-status-${request.id}`}
                    >
                      {getStatusIcon(request.status)}
                      {request.status}
                    </Badge>
                    {request.status === "rejected" && request.rejectionReason && (
                      <span className="text-xs text-destructive" data-testid={`text-rejection-reason-${request.id}`}>
                        {request.rejectionReason}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  <div className="flex flex-col items-end">
                    <span>{formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}</span>
                    {request.processedAt && (
                      <span className="text-xs">
                        Processed {formatDistanceToNow(new Date(request.processedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {request.txHash ? (
                    <a
                      href={getXrplExplorerUrl(request.txHash, network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      data-testid={`link-tx-${request.id}`}
                    >
                      {request.txHash.substring(0, 8)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
