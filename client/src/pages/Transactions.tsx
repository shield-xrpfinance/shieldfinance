import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownCircle, ArrowUpCircle, Gift, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Transaction {
  id: string;
  type: "deposit" | "withdraw" | "claim";
  amount: string;
  vault: string;
  timestamp: Date;
  status: "completed" | "pending";
  txHash?: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "deposit",
    amount: "1,000",
    vault: "Stable Yield Pool",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    status: "completed",
    txHash: "ABC123...XYZ789"
  },
  {
    id: "2",
    type: "claim",
    amount: "45.50",
    vault: "High Yield Vault",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: "completed",
    txHash: "DEF456...UVW012"
  },
  {
    id: "3",
    type: "deposit",
    amount: "2,500",
    vault: "Maximum Returns",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    status: "completed",
    txHash: "GHI789...RST345"
  },
  {
    id: "4",
    type: "withdraw",
    amount: "500",
    vault: "Stable Yield Pool",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    status: "completed",
    txHash: "JKL012...OPQ678"
  },
  {
    id: "5",
    type: "claim",
    amount: "12.25",
    vault: "Stable Yield Pool",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    status: "completed",
    txHash: "MNO345...LMN901"
  },
];

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
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Transaction History</h1>
        <p className="text-muted-foreground mt-2">
          View all your staking activity and transaction history
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tabular-nums" data-testid="text-total-deposits">
              3,500 XRP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 2 transactions
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
              500 XRP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 1 transaction
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
              +57.75 XRP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across 2 transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTransactions.map((tx) => (
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
                        {tx.vault}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold tabular-nums" data-testid={`text-amount-${tx.id}`}>
                    {tx.type === "withdraw" ? "-" : "+"}{tx.amount} XRP
                  </div>
                  {tx.txHash && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {tx.txHash}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
