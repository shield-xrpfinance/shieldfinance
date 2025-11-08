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
import { ArrowUpRight } from "lucide-react";

interface Position {
  id: string;
  vaultName: string;
  depositedAmount: string;
  currentValue: string;
  rewards: string;
  apy: string;
  depositDate: string;
}

interface PortfolioTableProps {
  positions: Position[];
  onWithdraw: (id: string) => void;
  onClaim: (id: string) => void;
}

export default function PortfolioTable({
  positions,
  onWithdraw,
  onClaim,
}: PortfolioTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vault</TableHead>
            <TableHead className="text-right">Deposited</TableHead>
            <TableHead className="text-right">Current Value</TableHead>
            <TableHead className="text-right">Rewards</TableHead>
            <TableHead className="text-right">APY</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No active positions
              </TableCell>
            </TableRow>
          ) : (
            positions.map((position) => (
              <TableRow key={position.id} data-testid={`row-position-${position.id}`}>
                <TableCell>
                  <div>
                    <p className="font-medium">{position.vaultName}</p>
                    <p className="text-xs text-muted-foreground">{position.depositDate}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {position.depositedAmount} XRP
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="font-mono tabular-nums">{position.currentValue} XRP</span>
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
                  +{position.rewards} XRP
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
