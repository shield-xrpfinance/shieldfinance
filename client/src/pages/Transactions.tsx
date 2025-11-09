import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/EmptyState";
import { TransactionStatsSkeleton, TransactionListSkeleton } from "@/components/skeletons/TransactionSkeleton";
import { ArrowDownCircle, ArrowUpCircle, Gift, Clock, Receipt } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@shared/schema";
import { useLocation } from "wouter";

interface TransactionSummary {
  totalDeposits: string;
  totalWithdrawals: string;
  totalRewards: string;
  depositCount: number;
  withdrawalCount: number;
  claimCount: number;
}

function getTransactionIcon(type: string) {
  switch (type) {
    case "deposit":
      return <ArrowDownCircle className="h-5 w-5 text-chart-2" />;
    case "withdraw":
      return <ArrowUpCircle className="h-5 w-5 text-destructive" />;
    case "claim":
      return <Gift className="h-5 w-5 text-chart-1" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getTransactionBadge(type: string) {
  const variants: Record<string, "default" | "destructive" | "secondary"> = {
    deposit: "default",
    withdraw: "destructive",
    claim: "secondary",
  };

  return (
    <Badge variant={variants[type]} className="capitalize" data-testid={`badge-${type}`}>
      {type}
    </Badge>
  );
}

export default function Transactions() {
  const [, navigate] = useLocation();
  
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<TransactionSummary>({
    queryKey: ["/api/transactions/summary"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Transaction History</h1>
        <p className="text-muted-foreground mt-2">
          View all your staking activity and transaction history
        </p>
      </div>

      {summaryLoading ? (
        <TransactionStatsSkeleton />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-total-deposits">
                {parseFloat(summary?.totalDeposits || "0").toLocaleString()} XRP
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {summary?.depositCount || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-total-withdrawals">
                {parseFloat(summary?.totalWithdrawals || "0").toLocaleString()} XRP
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {summary?.withdrawalCount || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rewards Claimed</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono tabular-nums text-chart-2" data-testid="text-total-claimed">
                +{parseFloat(summary?.totalRewards || "0").toLocaleString()} XRP
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {summary?.claimCount || 0} transactions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {transactionsLoading ? (
        <TransactionListSkeleton />
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Receipt}
              title="No Transactions Yet"
              description="Your transaction history will appear here once you start depositing into vaults, claiming rewards, or making withdrawals."
              actionButton={{
                label: "Browse Vaults",
                onClick: () => navigate("/vaults"),
                testId: "button-browse-vaults-transactions"
              }}
              testId="empty-state-transactions"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-md border hover-elevate"
                  data-testid={`transaction-${tx.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 rounded-md bg-muted">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTransactionBadge(tx.type)}
                        <span className="text-sm text-muted-foreground">
                          Vault ID: {tx.vaultId.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold tabular-nums" data-testid={`text-amount-${tx.id}`}>
                      {tx.type === "withdraw" ? "-" : "+"}{parseFloat(tx.type === "claim" ? tx.rewards || "0" : tx.amount).toLocaleString()} XRP
                    </div>
                    {tx.txHash && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {tx.txHash.substring(0, 20)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
