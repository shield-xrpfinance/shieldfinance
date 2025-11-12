import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { BridgeStatus } from "@/components/BridgeStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, CheckCircle2, XCircle, Wallet } from "lucide-react";
import type { SelectXrpToFxrpBridge } from "@shared/schema";

export default function BridgeTracking() {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState("active");

  const { data: bridges, isLoading } = useQuery<SelectXrpToFxrpBridge[]>({
    queryKey: ["/api/bridges", address],
    enabled: !!address,
  });

  const { activeBridges, completedBridges, failedBridges } = useMemo(() => {
    if (!bridges) {
      return { activeBridges: [], completedBridges: [], failedBridges: [] };
    }

    const failed = bridges.filter(
      (b) => b.status === "failed" || b.errorMessage !== null
    );

    const completed = bridges.filter(
      (b) => b.status === "completed" && !b.errorMessage
    );

    const active = bridges.filter(
      (b) =>
        !b.errorMessage &&
        b.status !== "completed" &&
        b.status !== "failed" &&
        (b.status === "awaiting_payment" ||
          b.status === "xrpl_confirmed" ||
          b.status === "proof_generated" ||
          b.status === "minting")
    );

    return {
      activeBridges: active,
      completedBridges: completed,
      failedBridges: failed,
    };
  }, [bridges]);

  const NotConnectedMessage = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-center text-muted-foreground font-medium" data-testid="text-connect-wallet-prompt">
          Connect your wallet to view bridge tracking
        </p>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Your bridge operations will appear here after connecting
        </p>
      </CardContent>
    </Card>
  );

  const LoadingMessage = () => (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading bridge operations...</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Bridge Tracking
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
          Monitor your XRP to FXRP bridge operations in real-time
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-bridge-tracking">
          <TabsTrigger value="active" data-testid="tab-active">
            <Activity className="h-4 w-4 mr-2" />
            Active ({activeBridges.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Completed ({completedBridges.length})
          </TabsTrigger>
          <TabsTrigger value="failed" data-testid="tab-failed">
            <XCircle className="h-4 w-4 mr-2" />
            Failed ({failedBridges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : activeBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-active-bridges">
                  No active bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Start a new deposit to see your bridge operations here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBridges.map((bridge) => (
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
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : completedBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-completed-bridges">
                  No completed bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Successfully completed bridges will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedBridges.map((bridge) => (
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
        </TabsContent>

        <TabsContent value="failed" className="mt-6">
          {!address ? (
            <NotConnectedMessage />
          ) : isLoading ? (
            <LoadingMessage />
          ) : failedBridges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground font-medium" data-testid="text-no-failed-bridges">
                  No failed bridge operations
                </p>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Failed bridge operations will appear here for troubleshooting
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {failedBridges.map((bridge) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
