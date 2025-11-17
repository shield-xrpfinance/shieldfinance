import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Vault as VaultType, Escrow } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import VaultListItem from "@/components/VaultListItem";
import CollapsibleSection from "@/components/CollapsibleSection";
import DepositModal from "@/components/DepositModal";
import BridgeStatusModal from "@/components/BridgeStatusModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import { ProgressStepsModal, type ProgressStep } from "@/components/ProgressStepsModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import UniversalProvider from "@walletconnect/universal-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Vaults() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [bridgeStatusModalOpen, setBridgeStatusModalOpen] = useState(false);
  const [bridgeInfo, setBridgeInfo] = useState<{ bridgeId: string; vaultName: string; amount: string } | null>(null);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [walletConnectSigningOpen, setWalletConnectSigningOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ amounts: { [asset: string]: string }; vaultId: string; vaultName: string } | null>(null);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string; apyLabel?: string | null; depositAssets: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("apy");
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>('creating');
  const [pollingBridgeId, setPollingBridgeId] = useState<string | null>(null);
  const [progressErrorMessage, setProgressErrorMessage] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { address, provider, walletConnectProvider, requestPayment } = useWallet();
  const { network, isTestnet } = useNetwork();

  const { data: apiVaults, isLoading } = useQuery<VaultType[]>({
    queryKey: ["/api/vaults"],
  });

  const { data: escrows = [] } = useQuery<Escrow[]>({
    queryKey: ["/api/escrows", address],
    queryFn: async () => {
      if (!address) return [];
      const response = await fetch(`/api/escrows?walletAddress=${encodeURIComponent(address)}`);
      if (!response.ok) throw new Error('Failed to fetch escrows');
      return response.json();
    },
    enabled: !!address,
  });

  // Poll bridge status when pollingBridgeId is set
  useEffect(() => {
    if (!pollingBridgeId) return;

    console.log("🔄 Starting status polling for bridgeId:", pollingBridgeId);
    
    let intervalId: NodeJS.Timeout | null = null;
    let isPolling = true;
    const abortController = new AbortController();

    const pollStatus = async () => {
      if (!isPolling) return;

      try {
        const response = await fetch(`/api/deposits/${pollingBridgeId}/status`, {
          signal: abortController.signal
        });
        const data = await response.json();

        console.log("📊 Poll response:", data);

        if (!data.success) {
          console.error("❌ Poll failed:", data.error);
          return;
        }

        const status = data.status;

        // Map backend status to progress step
        if (status === "pending") {
          setProgressStep('creating');
        } else if (status === "reserving_collateral") {
          setProgressStep('reserving');
        } else if (status === "awaiting_payment") {
          setProgressStep('ready');
          
          // Stop polling
          isPolling = false;
          if (intervalId !== null) {
            clearInterval(intervalId);
          }
          setPollingBridgeId(null);

          console.log("✅ Bridge ready for payment, auto-triggering payment...");

          // Auto-trigger payment
          if (data.paymentRequest && provider && (provider === "xaman" || walletConnectProvider)) {
            try {
              const paymentResult = await requestPayment(data.paymentRequest);
              
              console.log("=== PAYMENT REQUEST RESULT ===", paymentResult);
              
              if (paymentResult.success) {
                if (provider === "xaman" && paymentResult.payloadUuid) {
                  // Close progress modal, show Xaman signing modal
                  setProgressModalOpen(false);
                  setXamanPayload({
                    uuid: paymentResult.payloadUuid,
                    qrUrl: paymentResult.qrUrl || "",
                    deepLink: paymentResult.deepLink || "",
                  });
                  setXamanSigningModalOpen(true);
                } else if (provider === "walletconnect" && paymentResult.txHash) {
                  setProgressModalOpen(false);
                  toast({
                    title: "Payment Submitted",
                    description: `Transaction submitted: ${paymentResult.txHash}`,
                  });
                }
              } else {
                console.warn("⚠️ Payment request failed:", paymentResult.error);
                setProgressModalOpen(false);
                toast({
                  title: "Payment Request Info",
                  description: "Please manually send the payment to complete the bridge.",
                });
              }
            } catch (paymentError) {
              console.error("❌ Payment request exception:", paymentError);
              setProgressModalOpen(false);
              toast({
                title: "Payment Request Failed",
                description: "Please manually send the payment to complete the bridge.",
              });
            }
          } else {
            setProgressModalOpen(false);
            toast({
              title: "Bridge Ready",
              description: "Bridge is ready for payment. Please complete the transaction.",
            });
          }
        } else if (status === "failed") {
          setProgressStep('error');
          setProgressErrorMessage(data.error || "Failed to reserve collateral. Please try again.");
          setProgressModalOpen(true);
          
          // Stop polling
          isPolling = false;
          if (intervalId !== null) {
            clearInterval(intervalId);
          }
          setPollingBridgeId(null);

          toast({
            title: "Bridge Creation Failed",
            description: data.error || "Failed to reserve collateral. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log("🛑 Polling aborted");
        } else {
          console.error("❌ Polling error:", error);
        }
      }
    };

    // Start polling immediately, then every 2 seconds
    pollStatus();
    intervalId = setInterval(pollStatus, 2000);

    // Cleanup on unmount or when pollingBridgeId changes
    return () => {
      isPolling = false;
      abortController.abort();
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [pollingBridgeId, provider, walletConnectProvider, requestPayment, toast]);

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  const handleCloseProgressModal = () => {
    setProgressModalOpen(false);
    setProgressStep('creating');
    setPollingBridgeId(null);
    setBridgeInfo(null);
    setProgressErrorMessage(undefined);
  };

  const vaultEscrowStats = useMemo(() => {
    const stats: Record<string, { 
      pendingCount: number; 
      finishedCount: number; 
      cancelledCount: number; 
      failedCount: number; 
      totalAmount: number 
    }> = {};
    
    escrows.forEach((escrow) => {
      if (escrow.vaultId) {
        if (!stats[escrow.vaultId]) {
          stats[escrow.vaultId] = { 
            pendingCount: 0, 
            finishedCount: 0, 
            cancelledCount: 0, 
            failedCount: 0, 
            totalAmount: 0 
          };
        }
        
        if (escrow.status === "pending") {
          stats[escrow.vaultId].pendingCount += 1;
        } else if (escrow.status === "finished") {
          stats[escrow.vaultId].finishedCount += 1;
        } else if (escrow.status === "cancelled") {
          stats[escrow.vaultId].cancelledCount += 1;
        } else if (escrow.status === "failed") {
          stats[escrow.vaultId].failedCount += 1;
        }
        
        stats[escrow.vaultId].totalAmount += parseFloat(escrow.amount);
      }
    });
    
    return stats;
  }, [escrows]);

  const allVaults = apiVaults?.map(vault => ({
    id: vault.id,
    name: vault.name,
    asset: vault.asset || "XRP",
    apy: vault.apy,
    apyLabel: vault.apyLabel,
    tvl: formatCurrency(vault.tvl),
    liquidity: formatCurrency(vault.liquidity),
    lockPeriod: vault.lockPeriod,
    riskLevel: vault.riskLevel as "low" | "medium" | "high",
    depositors: 0,
    status: vault.status.charAt(0).toUpperCase() + vault.status.slice(1),
    depositAssets: (vault.asset || "XRP").split(",").map(a => a.trim()),
    pendingEscrowCount: vaultEscrowStats[vault.id]?.pendingCount || 0,
    finishedEscrowCount: vaultEscrowStats[vault.id]?.finishedCount || 0,
    cancelledEscrowCount: vaultEscrowStats[vault.id]?.cancelledCount || 0,
    failedEscrowCount: vaultEscrowStats[vault.id]?.failedCount || 0,
    totalEscrowAmount: vaultEscrowStats[vault.id]?.totalAmount.toString() || "0",
    depositLimit: (vault as any).depositLimit || null,
    depositLimitRaw: (vault as any).depositLimitRaw || null,
    paused: typeof (vault as any).paused === 'boolean' ? (vault as any).paused : null,
    comingSoon: (vault as any).comingSoon || false,
  })) || [];


  const filteredVaults = allVaults
    .filter((vault) =>
      vault.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "apy") return parseFloat(b.apy) - parseFloat(a.apy);
      if (sortBy === "tvl")
        return (
          parseFloat(b.tvl.replace(/[$MK,]/g, "")) -
          parseFloat(a.tvl.replace(/[$MK,]/g, ""))
        );
      if (sortBy === "depositors") return b.depositors - a.depositors;
      return 0;
    });

  const handleDeposit = (vaultId: string) => {
    const vault = allVaults.find((v) => v.id === vaultId);
    if (!vault) return;
    
    // Block deposit flow if vault is coming soon
    if (vault.comingSoon) {
      console.warn(`[DEPOSIT_BLOCKED] Vault ${vault.name} is coming soon`);
      return;
    }
    
    // Block deposit flow if vault is paused
    if (vault.paused === true) {
      console.warn(`[DEPOSIT_BLOCKED] Vault ${vault.name} is currently paused`);
      return;
    }
    
    setSelectedVault({ 
      id: vault.id, 
      name: vault.name, 
      apy: vault.apy,
      apyLabel: vault.apyLabel,
      depositAssets: vault.depositAssets || ["XRP"],
    });
    setDepositModalOpen(true);
  };

  const depositMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; vaultId: string; amount: string; network: string; txHash?: string }) => {
      console.log("depositMutation.mutationFn called with data:", data);
      const res = await apiRequest("POST", "/api/positions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });

  const handleConfirmDeposit = async (amounts: { [asset: string]: string }) => {
    console.log("=== handleConfirmDeposit CALLED ===", { 
      amounts, 
      provider, 
      address, 
      walletConnectProvider: !!walletConnectProvider,
      walletConnectProviderSession: walletConnectProvider?.session ? "exists" : "missing",
    });
    
    if (!selectedVault || !address) {
      console.error("❌ Missing selectedVault or address:", { selectedVault: !!selectedVault, address });
      return;
    }

    const totalAmount = Object.values(amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    const paymentAsset = selectedVault.depositAssets[0];

    // Check if this is an XRP deposit
    const isXRPDeposit = selectedVault.depositAssets.includes("XRP");

    if (isXRPDeposit) {
      console.log("📍 XRP Deposit Flow - Starting bridge creation...");
      // Use bridge flow for XRP deposits
      try {
        // Close deposit modal and show progress modal immediately
        setDepositModalOpen(false);
        setProgressStep('creating');
        setProgressModalOpen(true);
        
        // Store bridge info for the progress modal
        setBridgeInfo({
          bridgeId: '', // Will be set when response comes back
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
        });
        
        console.log("📡 Calling POST /api/deposits with:", { 
          walletAddress: address,
          vaultId: selectedVault.id,
          amount: totalAmount.toString(),
          network,
        });
        
        const response = await fetch("/api/deposits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            vaultId: selectedVault.id,
            amount: totalAmount.toString(),
            network: network,
          }),
        });

        const data = await response.json();

        console.log("=== POST /api/deposits RESPONSE ===", {
          success: data.success,
          bridgeId: data.bridgeId,
          demo: data.demo,
        });

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create deposit");
        }

        // Update bridge info with the actual bridgeId
        setBridgeInfo({
          bridgeId: data.bridgeId,
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
        });

        // Start polling for status updates
        setPollingBridgeId(data.bridgeId);

      } catch (error) {
        console.error("Bridge creation error:", error);
        setProgressModalOpen(false);
        toast({
          title: "Deposit Failed",
          description: error instanceof Error ? error.message : "Failed to create bridge",
          variant: "destructive",
        });
      }
    } else {
      // Use existing flow for non-XRP deposits
      const paymentAmount = amounts[paymentAsset] || totalAmount.toString();

      setPendingDeposit({
        amounts,
        vaultId: selectedVault.id,
        vaultName: selectedVault.name,
      });
      setDepositModalOpen(false);

      console.log("Deposit routing - provider:", provider, "address:", address, "walletConnectProvider:", !!walletConnectProvider);

      if (!provider) {
        toast({
          title: "Connection Lost",
          description: "Your wallet connection has expired. Please reconnect your wallet.",
          variant: "destructive",
        });
        setPendingDeposit(null);
        return;
      }

      if (provider === "walletconnect") {
        console.log("Routing to WalletConnect deposit");
        await handleWalletConnectDeposit(paymentAmount, paymentAsset);
      } else {
        console.log("Routing to Xaman deposit");
        await handleXamanDeposit(paymentAmount, paymentAsset);
      }
    }
  };

  const handleXamanDeposit = async (paymentAmount: string, paymentAsset: string) => {
    if (!selectedVault) return;

    try {
      // Create Xaman payment payload
      const payloadResponse = await fetch("/api/wallet/xaman/payment/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          asset: paymentAsset,
          vaultId: selectedVault.id,
          network: network,
        }),
      });

      const payloadData = await payloadResponse.json();

      if (!payloadData.uuid) {
        throw new Error("Failed to create payment payload");
      }

      // Show Xaman signing modal
      setXamanPayload({
        uuid: payloadData.uuid,
        qrUrl: payloadData.qrUrl,
        deepLink: payloadData.deepLink,
      });
      setXamanSigningModalOpen(true);
    } catch (error) {
      console.error("Error creating Xaman payment payload:", error);
      toast({
        title: "Payment Failed",
        description: "Failed to create payment request. Please try again.",
        variant: "destructive",
      });
      setPendingDeposit(null);
    }
  };

  const handleWalletConnectDeposit = async (paymentAmount: string, paymentAsset: string) => {
    if (!address || !selectedVault) {
      toast({
        title: "Connection Error",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!walletConnectProvider) {
      toast({
        title: "Connection Error",
        description: "WalletConnect session not found. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }

    // Validate that the session is still active
    if (!walletConnectProvider.session) {
      toast({
        title: "Session Expired",
        description: "Your WalletConnect session has expired. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }

    setWalletConnectSigningOpen(true);

    try {
      // Use the stored WalletConnect provider from the wallet context
      const wcProvider = walletConnectProvider;

      // Get the destination address (vault's deposit address)
      const vaultDepositAddress = "rpC7sRSUcK6F1nPb9E5U8z8bz5ee5mFEjC";
      
      // Convert amount to drops (1 XRP = 1,000,000 drops)
      const amountInDrops = Math.floor(parseFloat(paymentAmount) * 1000000).toString();

      // Convert memo to hex (browser-compatible)
      const memoString = JSON.stringify({
        vaultId: selectedVault.id,
        asset: paymentAsset,
      });
      const memoHex = Array.from(new TextEncoder().encode(memoString))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // Build XRPL Payment transaction
      const txJson = {
        TransactionType: "Payment",
        Account: address,
        Destination: vaultDepositAddress,
        Amount: amountInDrops,
        Fee: "12", // Standard fee in drops
        Memos: [
          {
            Memo: {
              MemoData: memoHex,
            },
          },
        ],
      };

      // XRPL WalletConnect chain IDs: mainnet = xrpl:0, testnet = xrpl:1
      const chainId = isTestnet ? "xrpl:1" : "xrpl:0";

      // Sign transaction with WalletConnect
      const signResult = await wcProvider.request({
        method: "xrpl_signTransaction",
        params: {
          tx_json: txJson,
        },
      }, chainId) as any;

      // Extract signed transaction - try multiple possible response structures
      const signedTxJson = signResult?.result?.tx_json || signResult?.tx_json || signResult;

      if (!signedTxJson) {
        throw new Error("No transaction data received from WalletConnect");
      }

      // WalletConnect returns tx_json, we need to encode it to tx_blob
      const { encode } = await import("xrpl");
      const tx_blob = encode(signedTxJson);

      // Submit signed transaction via backend
      const submitResponse = await fetch("/api/xrpl/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_blob: tx_blob,
          network: network,
        }),
      });

      const submitResult = await submitResponse.json();

      if (!submitResponse.ok || !submitResult.success) {
        throw new Error(submitResult.error || "Transaction submission failed");
      }

      const txHash = submitResult.txHash;

      if (!txHash) {
        throw new Error("No transaction hash returned");
      }

      // Close WalletConnect modal and call success handler
      setWalletConnectSigningOpen(false);
      await handleXamanSuccess(txHash);

    } catch (error) {
      console.error("WalletConnect signing error:", error);
      setWalletConnectSigningOpen(false);
      
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to sign transaction with WalletConnect",
        variant: "destructive",
      });
      
      setPendingDeposit(null);
    }
  };

  const handleXamanSuccess = async (txHash: string) => {
    if (!pendingDeposit || !address) return;

    const assetList = Object.entries(pendingDeposit.amounts)
      .filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .map(([asset, amt]) => `${amt} ${asset}`)
      .join(", ");

    const totalAmount = Object.values(pendingDeposit.amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    const depositData = {
      walletAddress: address,
      vaultId: pendingDeposit.vaultId,
      amount: totalAmount.toString(),
      network: network,
      txHash: txHash, // Include real transaction hash
    };

    try {
      await depositMutation.mutateAsync(depositData);

      toast({
        title: "Deposit Successful",
        description: `Successfully deposited ${assetList} to ${pendingDeposit.vaultName} on ${network}`,
      });

      // Clear pending deposit
      setPendingDeposit(null);
      setXamanPayload(null);
    } catch (error) {
      console.error("Deposit mutation error:", error);
      toast({
        title: "Deposit Failed",
        description: "Transaction signed but failed to create position. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleXamanError = (error: string) => {
    toast({
      title: "Signing Failed",
      description: error,
      variant: "destructive",
    });
    setPendingDeposit(null);
    setXamanPayload(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Vaults</h1>
        <p className="text-muted-foreground">
          Browse and deposit into high-yield XRP vaults
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vaults..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-vaults"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apy">Highest APY</SelectItem>
            <SelectItem value="tvl">Highest TVL</SelectItem>
            <SelectItem value="depositors">Most Depositors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Vaults Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Active Vaults</h2>
        <div className="space-y-4">
          {filteredVaults
            .filter((vault) => !vault.comingSoon)
            .map((vault) => (
              <VaultListItem key={vault.id} {...vault} onDeposit={handleDeposit} />
            ))}
          {filteredVaults.filter((vault) => !vault.comingSoon).length === 0 && (
            <p className="text-muted-foreground text-center py-12">
              No active vaults found matching your search.
            </p>
          )}
        </div>
      </div>

      {/* Coming Soon Vaults Section */}
      {filteredVaults.filter((vault) => vault.comingSoon).length > 0 && (
        <div className="mt-12">
          <CollapsibleSection
            title="Coming Soon Vaults"
            count={filteredVaults.filter((vault) => vault.comingSoon).length}
            defaultOpen={false}
          >
            <div className="space-y-3">
              {filteredVaults
                .filter((vault) => vault.comingSoon)
                .map((vault) => (
                  <VaultListItem key={vault.id} {...vault} onDeposit={handleDeposit} />
                ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {selectedVault && (
        <DepositModal
          open={depositModalOpen}
          onOpenChange={setDepositModalOpen}
          vaultName={selectedVault.name}
          vaultApy={selectedVault.apy}
          vaultApyLabel={selectedVault.apyLabel}
          depositAssets={selectedVault.depositAssets}
          onConfirm={handleConfirmDeposit}
        />
      )}

      {bridgeInfo && (
        <BridgeStatusModal
          open={bridgeStatusModalOpen}
          onOpenChange={setBridgeStatusModalOpen}
          bridgeId={bridgeInfo.bridgeId}
          vaultName={bridgeInfo.vaultName}
          amount={bridgeInfo.amount}
        />
      )}

      <XamanSigningModal
        open={xamanSigningModalOpen}
        onOpenChange={setXamanSigningModalOpen}
        payloadUuid={xamanPayload?.uuid || null}
        qrUrl={xamanPayload?.qrUrl || null}
        deepLink={xamanPayload?.deepLink || null}
        onSuccess={handleXamanSuccess}
        onError={handleXamanError}
        title="Sign Deposit Transaction"
        description="Scan the QR code with your Xaman wallet to complete the deposit"
      />

      <Dialog open={walletConnectSigningOpen} onOpenChange={setWalletConnectSigningOpen}>
        <DialogContent data-testid="dialog-walletconnect-signing">
          <DialogHeader>
            <DialogTitle>Sign Transaction with WalletConnect</DialogTitle>
            <DialogDescription>
              Please approve the transaction in your connected wallet
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">
              Waiting for wallet confirmation...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <ProgressStepsModal
        open={progressModalOpen}
        currentStep={progressStep}
        amount={bridgeInfo?.amount}
        vaultName={bridgeInfo?.vaultName}
        errorMessage={progressErrorMessage}
        onOpenChange={(open) => {
          if (!open && (progressStep === 'error' || progressStep === 'ready')) {
            handleCloseProgressModal();
          }
        }}
      />
    </div>
  );
}
