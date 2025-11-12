import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { BridgeStatus } from "@/components/BridgeStatus";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import type { SelectXrpToFxrpBridge } from "@shared/schema";

export default function BridgeTracking() {
  const { address } = useWallet();

  const { data: bridges, isLoading } = useQuery<SelectXrpToFxrpBridge[]>({
    queryKey: ["/api/bridges", address],
    enabled: !!address,
  });

  if (!address) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground">
              Connect your wallet to view bridge history
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading bridge history...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Bridge History</h1>
        <p className="text-muted-foreground mt-1">
          Track your XRP to FXRP bridge operations
        </p>
      </div>

      {!bridges || bridges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-center text-muted-foreground" data-testid="text-no-bridges">
              No bridge operations found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bridges.map((bridge) => (
            <BridgeStatus
              key={bridge.id}
              status={bridge.status}
              xrpAmount={bridge.xrpAmount}
              fxrpExpected={bridge.fxrpExpected}
              xrplTxHash={bridge.xrplTxHash || undefined}
              flareTxHash={bridge.flareTxHash || undefined}
              vaultMintTxHash={bridge.vaultMintTxHash || undefined}
              errorMessage={bridge.errorMessage || undefined}
              bridgeId={bridge.id}
              agentUnderlyingAddress={bridge.agentUnderlyingAddress || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
