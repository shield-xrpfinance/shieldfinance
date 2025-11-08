import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function Admin() {
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<WithdrawalRequest[]>({
    queryKey: ["/api/withdrawal-requests"],
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, txHash }: { requestId: string; txHash: string }) => {
      const res = await apiRequest("PATCH", `/api/withdrawal-requests/${requestId}/approve`, { txHash });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-requests"] });
      toast({
        title: "Request Approved",
        description: "The withdrawal/claim request has been approved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/withdrawal-requests/${requestId}/reject`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-requests"] });
      setRejectDialogOpen(false);
      setRejectionReason("");
      toast({
        title: "Request Rejected",
        description: "The withdrawal/claim request has been rejected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (request: WithdrawalRequest) => {
    const txHash = prompt(
      `Enter the XRPL transaction hash for the ${request.type} of ${request.amount} ${request.asset}:`
    );
    if (txHash && txHash.trim()) {
      approveMutation.mutate({ requestId: request.id, txHash: txHash.trim() });
    }
  };

  const handleReject = (request: WithdrawalRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequest && rejectionReason.trim()) {
      rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason.trim() });
    } else {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this request.",
        variant: "destructive",
      });
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Vault Operator Admin</h1>
        <p className="text-muted-foreground">
          Review and approve withdrawal and claim requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending requests
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium capitalize">{request.type}</TableCell>
                    <TableCell className="font-mono text-sm">{request.walletAddress.slice(0, 8)}...{request.walletAddress.slice(-6)}</TableCell>
                    <TableCell>{request.amount} {request.asset}</TableCell>
                    <TableCell>{request.asset}</TableCell>
                    <TableCell className="capitalize">{request.network}</TableCell>
                    <TableCell>{new Date(request.requestedAt).toLocaleString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={approveMutation.isPending}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(request)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${request.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : processedRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No processed requests yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>TX Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.slice(0, 20).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium capitalize">{request.type}</TableCell>
                    <TableCell className="font-mono text-sm">{request.walletAddress.slice(0, 8)}...{request.walletAddress.slice(-6)}</TableCell>
                    <TableCell>{request.amount} {request.asset}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.processedAt ? new Date(request.processedAt).toLocaleString() : "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {request.txHash ? (
                        <a
                          href={`https://${request.network === "testnet" ? "testnet." : ""}xrpl.org/transactions/${request.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {request.txHash.slice(0, 8)}...
                        </a>
                      ) : request.rejectionReason ? (
                        <span className="text-destructive text-xs">{request.rejectionReason}</span>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject-request">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this {selectedRequest?.type} request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Input
                id="rejection-reason"
                data-testid="input-rejection-reason"
                placeholder="e.g., Insufficient liquidity, suspicious activity..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
