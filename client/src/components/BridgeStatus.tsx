import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BridgeStatusProps {
  status: string;
  xrpAmount: string;
  fxrpExpected: string;
  xrplTxHash?: string;
  flareTxHash?: string;
  vaultMintTxHash?: string;
  errorMessage?: string;
}

export function BridgeStatus({
  status,
  xrpAmount,
  fxrpExpected,
  xrplTxHash,
  flareTxHash,
  vaultMintTxHash,
  errorMessage,
}: BridgeStatusProps) {
  const stages = [
    { key: "pending", label: "XRPL Confirmation", completed: ["xrpl_confirmed", "bridging", "completed"].includes(status) },
    { key: "bridging", label: "XRP → FXRP Bridge", completed: ["bridging", "completed"].includes(status) },
    { key: "completed", label: "Vault Shares Minted", completed: status === "completed" },
  ];

  const currentStageIndex = stages.findIndex((s) => !s.completed);
  const progress = ((currentStageIndex === -1 ? stages.length : currentStageIndex) / stages.length) * 100;

  return (
    <Card data-testid={`card-bridge-${status}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Deposit Processing</CardTitle>
          {status === "completed" && (
            <Badge variant="default" data-testid="badge-status-completed">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Completed
            </Badge>
          )}
          {status === "failed" && (
            <Badge variant="destructive" data-testid="badge-status-failed">
              <AlertCircle className="mr-1 h-3 w-3" />
              Failed
            </Badge>
          )}
          {!["completed", "failed"].includes(status) && (
            <Badge variant="secondary" data-testid="badge-status-processing">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Processing
            </Badge>
          )}
        </div>
        <CardDescription>
          Depositing {xrpAmount} XRP → {fxrpExpected} shXRP shares
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} data-testid="progress-bridge" />
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className="flex items-start gap-3"
              data-testid={`stage-${stage.key}`}
            >
              {stage.completed ? (
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" data-testid={`icon-${stage.key}-completed`} />
              ) : currentStageIndex === index ? (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mt-0.5" data-testid={`icon-${stage.key}-processing`} />
              ) : (
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" data-testid={`icon-${stage.key}-pending`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${stage.completed ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {xrplTxHash && (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">XRPL Transaction:</p>
            <code className="block rounded bg-muted px-2 py-1 font-mono" data-testid="text-xrpl-hash">
              {xrplTxHash}
            </code>
          </div>
        )}
        
        {flareTxHash && (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">Flare Transaction:</p>
            <code className="block rounded bg-muted px-2 py-1 font-mono" data-testid="text-flare-hash">
              {flareTxHash}
            </code>
          </div>
        )}

        {vaultMintTxHash && (
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">Vault Mint Transaction:</p>
            <code className="block rounded bg-muted px-2 py-1 font-mono" data-testid="text-vault-hash">
              {vaultMintTxHash}
            </code>
          </div>
        )}

        {errorMessage && (
          <div className="rounded border border-destructive bg-destructive/10 p-3 text-sm" data-testid="text-error">
            <p className="font-medium text-destructive">Error:</p>
            <p className="text-destructive/80">{errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
