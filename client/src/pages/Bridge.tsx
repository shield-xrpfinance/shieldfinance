import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Globe } from "lucide-react";
import { FSwapWidget } from "@/components/FSwapWidget";
import { useWallet } from "@/lib/walletContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BridgeProgressTracker, type BridgeJob } from "@/components/BridgeProgressTracker";

export default function Bridge() {
  const { address, evmAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const walletAddr = address || evmAddress;

  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: activeJob, isLoading: isLoadingJob } = useQuery<BridgeJob>({
    queryKey: ["/api/bridge/job", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: 5000,
  });

  // Mutation to log FSwap bridge completions - must be called before any conditional returns
  const logBridgeMutation = useMutation({
    mutationFn: async (data: { 
      walletAddress: string; 
      txHash: string;
      sourceNetwork?: string;
      destNetwork?: string;
      sourceToken?: string;
      destToken?: string;
      amount?: string;
    }) => {
      const response = await apiRequest("POST", "/api/bridge/fswap-complete", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bridge/jobs"] });
    },
    onError: (error) => {
      console.error("Failed to log bridge completion:", error);
    },
  });

  const handleFSwapComplete = (params: { txHash: string }) => {
    toast({
      title: "Bridge Complete",
      description: `Transaction hash: ${params.txHash.substring(0, 10)}...`,
    });
    
    // Log the bridge completion to backend for notifications and tracking
    if (walletAddr) {
      logBridgeMutation.mutate({
        walletAddress: walletAddr,
        txHash: params.txHash,
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
            <p className="text-center text-muted-foreground" data-testid="text-connect-prompt">
              Connect your wallet to use the multi-chain bridge
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeJobId && activeJob) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Bridge</h1>
            <p className="text-muted-foreground mt-1">Track your bridge transaction</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setActiveJobId(null)}
            data-testid="button-new-bridge"
          >
            New Bridge
          </Button>
        </div>

        <BridgeProgressTracker job={activeJob} isLoading={isLoadingJob} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Bridge</h1>
        <p className="text-muted-foreground mt-1">Transfer assets across multiple chains</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Multi-Chain Bridge
          </CardTitle>
          <CardDescription>
            Bridge assets between XRPL, Flare, Ethereum, Base, Arbitrum, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FSwapWidget 
            sourceChainId="xrpl"
            destChainId="flare"
            onSwapComplete={handleFSwapComplete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
