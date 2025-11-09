import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Clock, AlertCircle, Lock, Unlock, RefreshCw, ExternalLink } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Escrow, Vault } from "@shared/schema";

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
  const [selectedEscrow, setSelectedEscrow] = useState<Escrow | null>(null);
  const [escrowDetailOpen, setEscrowDetailOpen] = useState(false);
  const [escrowStatusFilter, setEscrowStatusFilter] = useState<string>("all");
  const [escrowVaultFilter, setEscrowVaultFilter] = useState<string>("all");
  const [escrowWalletSearch, setEscrowWalletSearch] = useState<string>("");
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

  const { data: escrows = [], isLoading: escrowsLoading } = useQuery<Escrow[]>({
    queryKey: ["/api/escrows"],
    refetchInterval: 30000,
  });

  const { data: vaults = [] } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const finishEscrowMutation = useMutation({
    mutationFn: async (escrowId: string) => {
      const res = await apiRequest("POST", `/api/escrows/${escrowId}/finish`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrows"] });
      toast({
        title: "Escrow Finished",
        description: "The escrow has been completed and XRP released.",
      });
    },
    onError: (error) => {
      toast({
        title: "Finish Failed",
        description: error instanceof Error ? error.message : "Failed to finish escrow",
        variant: "destructive",
      });
    },
  });

  const cancelEscrowMutation = useMutation({
    mutationFn: async (escrowId: string) => {
      const res = await apiRequest("POST", `/api/escrows/${escrowId}/cancel`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrows"] });
      toast({
        title: "Escrow Cancelled",
        description: "The escrow has been cancelled and XRP returned.",
      });
    },
    onError: (error) => {
      toast({
        title: "Cancel Failed",
        description: error instanceof Error ? error.message : "Failed to cancel escrow",
        variant: "destructive",
      });
    },
  });

  const retryEscrowMutation = useMutation({
    mutationFn: async (escrowId: string) => {
      const res = await apiRequest("POST", `/api/escrows/${escrowId}/retry`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrows"] });
      toast({
        title: "Escrow Retry",
        description: "The escrow status has been reset to pending.",
      });
    },
    onError: (error) => {
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Failed to retry escrow",
        variant: "destructive",
      });
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  const filteredEscrows = escrows.filter((e) => {
    const statusMatch = escrowStatusFilter === "all" || e.status === escrowStatusFilter;
    const vaultMatch = escrowVaultFilter === "all" || e.vaultId === escrowVaultFilter;
    const walletMatch = escrowWalletSearch === "" || 
      e.walletAddress.toLowerCase().includes(escrowWalletSearch.toLowerCase());
    return statusMatch && vaultMatch && walletMatch;
  });

  const pendingEscrows = escrows.filter(e => e.status === "pending");
  const finishedEscrows = escrows.filter(e => e.status === "finished");
  const cancelledEscrows = escrows.filter(e => e.status === "cancelled");

  const getVaultName = (vaultId: string) => {
    const vault = vaults.find(v => v.id === vaultId);
    return vault?.name || "Unknown Vault";
  };

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

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>;
      case "finished":
        return <Badge variant="default" className="gap-1"><Unlock className="h-3 w-3" />Released</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Vault Operator Admin</h1>
          <p className="text-muted-foreground">
            Manage withdrawal requests and escrow operations
          </p>
        </div>

        <Tabs defaultValue="withdrawals" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">
              Withdrawal Requests
            </TabsTrigger>
            <TabsTrigger value="escrows" data-testid="tab-escrows">
              Escrows
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdrawals" className="space-y-6 mt-6">
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
          </TabsContent>

          <TabsContent value="escrows" className="space-y-6 mt-6">
            {/* Escrow Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Escrows</CardTitle>
                  <Lock className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingEscrows.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Released</CardTitle>
                  <Unlock className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{finishedEscrows.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Escrows</CardTitle>
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{escrows.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Escrow Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <Select value={escrowStatusFilter} onValueChange={setEscrowStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-escrow-status">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={escrowVaultFilter} onValueChange={setEscrowVaultFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-escrow-vault">
                  <SelectValue placeholder="Filter by vault" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vaults</SelectItem>
                  {vaults.map((vault) => (
                    <SelectItem key={vault.id} value={vault.id}>
                      {vault.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search by wallet address..."
                value={escrowWalletSearch}
                onChange={(e) => setEscrowWalletSearch(e.target.value)}
                className="w-[280px]"
                data-testid="input-escrow-wallet-search"
              />

              {(escrowStatusFilter !== "all" || escrowVaultFilter !== "all" || escrowWalletSearch !== "") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEscrowStatusFilter("all");
                    setEscrowVaultFilter("all");
                    setEscrowWalletSearch("");
                  }}
                  data-testid="button-clear-escrow-filters"
                >
                  Clear Filters
                </Button>
              )}

              <div className="ml-auto text-sm text-muted-foreground">
                Showing {filteredEscrows.length} of {escrows.length} escrows
              </div>
            </div>

            {/* Escrows Table */}
            <Card>
              <CardHeader>
                <CardTitle>Escrow Management</CardTitle>
              </CardHeader>
              <CardContent>
                {escrowsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : filteredEscrows.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No escrows found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Vault</TableHead>
                        <TableHead>Network</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Finish After</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEscrows.map((escrow) => (
                        <TableRow key={escrow.id} data-testid={`row-escrow-${escrow.id}`}>
                          <TableCell>{getEscrowStatusBadge(escrow.status)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {escrow.walletAddress.slice(0, 8)}...{escrow.walletAddress.slice(-6)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs">{escrow.walletAddress}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="font-mono">{parseFloat(escrow.amount).toFixed(6)}</TableCell>
                          <TableCell>{escrow.asset}</TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`text-vault-${escrow.id}`}>
                              {getVaultName(escrow.vaultId)}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{escrow.network}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(escrow.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {escrow.finishAfter ? new Date(escrow.finishAfter).toLocaleString() : "N/A"}
                          </TableCell>
                          <TableCell className="space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedEscrow(escrow);
                                    setEscrowDetailOpen(true);
                                  }}
                                  data-testid={`button-view-escrow-${escrow.id}`}
                                >
                                  View
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View escrow details</TooltipContent>
                            </Tooltip>
                            {escrow.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => finishEscrowMutation.mutate(escrow.id)}
                                  disabled={finishEscrowMutation.isPending}
                                  data-testid={`button-finish-escrow-${escrow.id}`}
                                >
                                  <Unlock className="h-4 w-4 mr-1" />
                                  Finish
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => cancelEscrowMutation.mutate(escrow.id)}
                                  disabled={cancelEscrowMutation.isPending}
                                  data-testid={`button-cancel-escrow-${escrow.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            {escrow.status === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retryEscrowMutation.mutate(escrow.id)}
                                disabled={retryEscrowMutation.isPending}
                                data-testid={`button-retry-escrow-${escrow.id}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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

        {/* Escrow Detail Drawer */}
        <Sheet open={escrowDetailOpen} onOpenChange={setEscrowDetailOpen}>
          <SheetContent className="sm:max-w-lg" data-testid="sheet-escrow-detail">
            <SheetHeader>
              <SheetTitle>Escrow Details</SheetTitle>
              <SheetDescription>
                XRPL escrow metadata and transaction information
              </SheetDescription>
            </SheetHeader>
            {selectedEscrow && (
              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div className="mt-1">{getEscrowStatusBadge(selectedEscrow.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Amount</Label>
                    <div className="mt-1 font-mono text-lg">{parseFloat(selectedEscrow.amount).toFixed(6)} {selectedEscrow.asset}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Wallet Address</Label>
                    <div className="mt-1 font-mono text-sm break-all">{selectedEscrow.walletAddress}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Destination Address</Label>
                    <div className="mt-1 font-mono text-sm break-all">{selectedEscrow.destinationAddress}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Network</Label>
                    <div className="mt-1 capitalize">{selectedEscrow.network}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Escrow Sequence</Label>
                    <div className="mt-1 font-mono">{selectedEscrow.escrowSequence || "N/A"}</div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium">XRPL Transaction Hashes</h4>
                  {selectedEscrow.createTxHash && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Create TX</Label>
                      <a
                        href={`https://${selectedEscrow.network === "testnet" ? "testnet." : ""}xrpl.org/transactions/${selectedEscrow.createTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-primary hover:underline font-mono text-sm"
                      >
                        {selectedEscrow.createTxHash.slice(0, 12)}...{selectedEscrow.createTxHash.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selectedEscrow.finishTxHash && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Finish TX</Label>
                      <a
                        href={`https://${selectedEscrow.network === "testnet" ? "testnet." : ""}xrpl.org/transactions/${selectedEscrow.finishTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-primary hover:underline font-mono text-sm"
                      >
                        {selectedEscrow.finishTxHash.slice(0, 12)}...{selectedEscrow.finishTxHash.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selectedEscrow.cancelTxHash && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Cancel TX</Label>
                      <a
                        href={`https://${selectedEscrow.network === "testnet" ? "testnet." : ""}xrpl.org/transactions/${selectedEscrow.cancelTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 mt-1 text-primary hover:underline font-mono text-sm"
                      >
                        {selectedEscrow.cancelTxHash.slice(0, 12)}...{selectedEscrow.cancelTxHash.slice(-8)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium">Timing</h4>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created At</Label>
                    <div className="mt-1">{new Date(selectedEscrow.createdAt).toLocaleString()}</div>
                  </div>
                  {selectedEscrow.finishAfter && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Can Finish After</Label>
                      <div className="mt-1">{new Date(selectedEscrow.finishAfter).toLocaleString()}</div>
                    </div>
                  )}
                  {selectedEscrow.cancelAfter && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Can Cancel After</Label>
                      <div className="mt-1">{new Date(selectedEscrow.cancelAfter).toLocaleString()}</div>
                    </div>
                  )}
                  {selectedEscrow.finishedAt && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Finished At</Label>
                      <div className="mt-1">{new Date(selectedEscrow.finishedAt).toLocaleString()}</div>
                    </div>
                  )}
                  {selectedEscrow.cancelledAt && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Cancelled At</Label>
                      <div className="mt-1">{new Date(selectedEscrow.cancelledAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
