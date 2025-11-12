import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { BridgeStatus } from "@/components/BridgeStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Wallet, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BridgeStatusModal from "@/components/BridgeStatusModal";
import type { SelectXrpToFxrpBridge, Vault } from "@shared/schema";

export default function BridgeTracking() {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState("active");
  const [selectedBridge, setSelectedBridge] = useState<{
    bridgeId: string;
    vaultName: string;
    amount: string;
  } | null>(null);
  const { toast } = useToast();

  const { data: bridges, isLoading } = useQuery<SelectXrpToFxrpBridge[]>({
    queryKey: [`/api/bridges/wallet/${address}`],
    enabled: !!address,
  });

  const { data: vaults, isLoading: isLoadingVaults } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  // Memoize vault lookup map for performance
  const vaultMap = useMemo(() => {
    if (!vaults) return new Map<string, Vault>();
    return new Map(vaults.map(v => [v.id, v]));
  }, [vaults]);

  // Callback to open payment modal for a bridge
  const handleSendPayment = useCallback((bridge: SelectXrpToFxrpBridge) => {
    if (!vaultMap.size) {
      toast({
        title: "Loading",
        description: "Please wait while vault data loads...",
      });
      return;
    }
    
    const vault = vaultMap.get(bridge.vaultId);
    if (!vault) {
      toast({
        title: "Error",
        description: "Vault not found",
        variant: "destructive",
      });
      return;
    }

    setSelectedBridge({
      bridgeId: bridge.id,
      vaultName: vault.name,
      amount: bridge.xrpAmount,
    });
  }, [vaultMap, toast]);

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bridges/reconcile-all");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Retry Complete",
        description: `Successfully retried ${data.successful} bridge(s). ${data.failed} failed.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/bridges/wallet'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Retry Failed",
        description: error.message || "Failed to retry bridges",
        variant: "destructive",
      });
    },
  });

  const { activeBridges, completedBridges, failedBridges } = useMemo(() => {
    if (!bridges) {
      return { activeBridges: [], completedBridges: [], failedBridges: [] };
    }

    const failed = bridges.filter(
      (b) => b.status === "failed" || b.status === "vault_mint_failed" || b.errorMessage !== null
    );

    const completed = bridges.filter(
      (b) => (b.status === "completed" || b.status === "vault_minted") && !b.errorMessage
    );

    const active = bridges.filter(
      (b) =>
        !b.errorMessage &&
        b.status !== "completed" &&
        b.status !== "vault_minted" &&
        b.status !== "failed" &&
        b.status !== "vault_mint_failed" &&
        (b.status === "awaiting_payment" ||
          b.status === "xrpl_confirmed" ||
          b.status === "proof_generated" ||
          b.status === "minting" ||
          b.status === "vault_minting")
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  isVaultsLoading={isLoadingVaults}
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  isVaultsLoading={isLoadingVaults}
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
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {failedBridges.length} failed bridge{failedBridges.length !== 1 ? 's' : ''}
                </p>
                <Button
                  variant="outline"
                  onClick={() => retryAllMutation.mutate()}
                  disabled={retryAllMutation.isPending}
                  data-testid="button-retry-all"
                >
                  {retryAllMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry All
                    </>
                  )}
                </Button>
              </div>
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
                  onSendPayment={() => handleSendPayment(bridge)}
                  isVaultsLoading={isLoadingVaults}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedBridge && (
        <BridgeStatusModal
          open={!!selectedBridge}
          onOpenChange={(open) => {
            if (!open) setSelectedBridge(null);
          }}
          bridgeId={selectedBridge.bridgeId}
          vaultName={selectedBridge.vaultName}
          amount={selectedBridge.amount}
        />
      )}
    </div>
  );
}
