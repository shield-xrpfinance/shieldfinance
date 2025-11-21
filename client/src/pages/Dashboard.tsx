import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Vault as VaultType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import GlassStatsCard from "@/components/GlassStatsCard";
import VaultListItem from "@/components/VaultListItem";
import ApyChart from "@/components/ApyChart";
import DepositModal from "@/components/DepositModal";
import BridgeStatusModal from "@/components/BridgeStatusModal";
import XamanSigningModal from "@/components/XamanSigningModal";
import { ProgressStepsModal, type ProgressStep } from "@/components/ProgressStepsModal";
import { useComprehensiveBalance } from "@/hooks/useComprehensiveBalance";
import { Coins, TrendingUp, Vault, Users, Loader2, CheckCircle2, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { Link, useLocation } from "wouter";

export default function Dashboard() {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [bridgeStatusModalOpen, setBridgeStatusModalOpen] = useState(false);
  const [bridgeInfo, setBridgeInfo] = useState<{ bridgeId: string; vaultName: string; amount: string } | null>(null);
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [walletConnectSigningOpen, setWalletConnectSigningOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ amounts: { [asset: string]: string }; vaultId: string; vaultName: string } | null>(null);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string; apyLabel?: string | null; depositAssets: string[] } | null>(null);
  const [successMessage, setSuccessMessage] = useState<{ title: string; description: string; txHash: string } | null>(null);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>('creating');
  const [progressErrorMessage, setProgressErrorMessage] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { address, provider, walletConnectProvider, requestPayment } = useWallet();
  const { network, isTestnet } = useNetwork();
  const [, setLocation] = useLocation();
  const comprehensiveBalances = useComprehensiveBalance();

  const { data: apiVaults, isLoading } = useQuery<VaultType[]>({
    queryKey: ["/api/vaults"],
  });

  // NOTE: Legacy polling removed - ProgressStepsModal now handles all polling internally

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
    setBridgeInfo(null);
    setProgressErrorMessage(undefined);
  };

  const handleNavigateToBridgeTracking = () => {
    setLocation('/bridge-tracking');
    handleCloseProgressModal();
  };

  const handleNavigateToPortfolio = () => {
    setLocation('/portfolio');
    handleCloseProgressModal();
  };

  // Filter out coming soon vaults and take first 3 active vaults
  const vaults = apiVaults
    ?.filter(vault => !(vault as any).comingSoon)
    .slice(0, 3)
    .map(vault => ({
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
      comingSoon: (vault as any).comingSoon || false,
    })) || [];

  const chartData = [
    { date: "Oct 1", "Stable Yield": 7.2, "High Yield": 12.5, "Maximum Returns": 18.2 },
    { date: "Oct 8", "Stable Yield": 7.3, "High Yield": 12.7, "Maximum Returns": 18.5 },
    { date: "Oct 15", "Stable Yield": 7.4, "High Yield": 12.6, "Maximum Returns": 18.3 },
    { date: "Oct 22", "Stable Yield": 7.5, "High Yield": 12.8, "Maximum Returns": 18.5 },
    { date: "Oct 29", "Stable Yield": 7.5, "High Yield": 12.9, "Maximum Returns": 18.7 },
    { date: "Nov 5", "Stable Yield": 7.5, "High Yield": 12.8, "Maximum Returns": 18.5 },
  ];

  const handleDeposit = (vaultId: string) => {
    const vault = vaults.find((v) => v.id === vaultId);
    if (vault) {
      setSelectedVault({ 
        id: vault.id, 
        name: vault.name, 
        apy: vault.apy,
        apyLabel: vault.apyLabel,
        depositAssets: vault.depositAssets || ["XRP"],
      });
      setDepositModalOpen(true);
    }
  };

  const depositMutation = useMutation({
    mutationFn: async (data: { walletAddress: string; vaultId: string; amount: string; network: string; txHash?: string }) => {
      const res = await apiRequest("POST", "/api/positions", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    },
  });

  const handleConfirmDeposit = async (amounts: { [asset: string]: string }) => {
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

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create deposit");
        }

        // Update bridge info with the returned bridgeId
        setBridgeInfo({
          bridgeId: data.bridgeId,
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
        });

        // ProgressStepsModal will now handle polling using bridgeId

        toast({
          title: "Bridge Initiated",
          description: data.demo 
            ? "Demo bridge created successfully" 
            : "Bridge created. Processing your deposit...",
        });
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
      const depositInfo = {
        amounts,
        vaultId: selectedVault.id,
        vaultName: selectedVault.name,
      };

      setPendingDeposit(depositInfo);
      setDepositModalOpen(false);

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
        await handleWalletConnectDeposit(paymentAmount, paymentAsset, depositInfo);
      } else {
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

  const handleWalletConnectDeposit = async (
    paymentAmount: string, 
    paymentAsset: string,
    depositInfo: { amounts: { [asset: string]: string }; vaultId: string; vaultName: string }
  ) => {
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
      await handleXamanSuccess(txHash, depositInfo);

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

  const handleXamanSuccess = async (
    txHash: string, 
    depositInfo?: { amounts: { [asset: string]: string }; vaultId: string; vaultName: string }
  ) => {
    // Use provided depositInfo or fall back to state (for Xaman flow compatibility)
    const depositData = depositInfo || pendingDeposit;
    
    if (!depositData || !address) {
      return;
    }

    const assetList = Object.entries(depositData.amounts)
      .filter(([_, amt]) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .map(([asset, amt]) => `${amt} ${asset}`)
      .join(", ");

    const totalAmount = Object.values(depositData.amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    const positionData = {
      walletAddress: address,
      vaultId: depositData.vaultId,
      amount: totalAmount.toString(),
      network: network,
      txHash: txHash,
    };

    try {
      await depositMutation.mutateAsync(positionData);

      // Show success dialog with CTA
      setSuccessDialogOpen(true);
      setSuccessMessage({
        title: "Deposit Successful!",
        description: `Successfully deposited ${assetList} to ${depositData.vaultName} on ${network}`,
        txHash: txHash,
      });

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
    <div className="space-y-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-base">
          Overview of your liquid staking protocol performance
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative rounded-2xl border-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8 overflow-hidden hover-elevate transition-all duration-200">
          <div className="absolute top-6 left-6 rounded-xl bg-primary/20 p-4 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl" />
              <div className="relative text-primary">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </div>
          
          <div className="mt-24 space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Total Wallet Holdings
            </p>
            {comprehensiveBalances.isLoading ? (
              <Skeleton className="h-10 w-full" data-testid="skeleton-wallet-balance" />
            ) : (
              <div className="space-y-3">
                <div className="space-y-1 pb-2 border-b border-border/50">
                  <p className="text-xs text-muted-foreground">Total Value (USD)</p>
                  <p className="text-3xl font-bold tabular-nums" data-testid="text-total-usd-value">
                    ${comprehensiveBalances.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-2">
                  {parseFloat(comprehensiveBalances.flr) > 0 && (
                    <div className="flex items-center justify-between" data-testid="balance-flr">
                      <span className="text-sm text-muted-foreground">FLR</span>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" data-testid="text-balance-flr">{parseFloat(comprehensiveBalances.flr).toFixed(4)}</div>
                        <div className="text-xs text-muted-foreground" data-testid="text-balance-flr-usd">${comprehensiveBalances.flrUsd.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {parseFloat(comprehensiveBalances.shield) > 0 && (
                    <div className="flex items-center justify-between" data-testid="balance-shield">
                      <span className="text-sm text-muted-foreground">SHIELD</span>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" data-testid="text-balance-shield">{parseFloat(comprehensiveBalances.shield).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground" data-testid="text-balance-shield-usd">${comprehensiveBalances.shieldUsd.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {parseFloat(comprehensiveBalances.shxrp) > 0 && (
                    <div className="flex items-center justify-between" data-testid="balance-shxrp">
                      <span className="text-sm text-muted-foreground">shXRP</span>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" data-testid="text-balance-shxrp">{parseFloat(comprehensiveBalances.shxrp).toFixed(4)}</div>
                        <div className="text-xs text-muted-foreground" data-testid="text-balance-shxrp-usd">${comprehensiveBalances.shxrpUsd.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {parseFloat(comprehensiveBalances.xrp) > 0 && (
                    <div className="flex items-center justify-between" data-testid="balance-xrp">
                      <span className="text-sm text-muted-foreground">XRP</span>
                      <div className="text-right">
                        <div className="text-lg font-bold tabular-nums" data-testid="text-balance-xrp">{parseFloat(comprehensiveBalances.xrp).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground" data-testid="text-balance-xrp-usd">${comprehensiveBalances.xrpUsd.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {!address ? (
                    <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-balances">Connect your wallet to view balance</p>
                  ) : [parseFloat(comprehensiveBalances.flr), parseFloat(comprehensiveBalances.shield), parseFloat(comprehensiveBalances.shxrp), parseFloat(comprehensiveBalances.xrp)].every(v => v === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-balances">No assets found</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </Card>
        <GlassStatsCard
          label="Average APY"
          value="8.2%"
          change={{ value: 0.8, positive: true }}
          icon={<TrendingUp className="h-6 w-6" />}
        />
        <GlassStatsCard 
          label="Active Vaults" 
          value="12" 
          icon={<Vault className="h-6 w-6" />} 
        />
        <GlassStatsCard
          label="Total Stakers"
          value="3,421"
          change={{ value: 5.2, positive: true }}
          icon={<Users className="h-6 w-6" />}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Featured Vaults</h2>
          <p className="text-muted-foreground">
            High-performing vaults for your XRP liquid staking
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" data-testid={`skeleton-vault-${i}`} />
            ))}
          </div>
        ) : vaults.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed bg-muted/20">
            <p className="text-xl text-muted-foreground mb-2">No active vaults available</p>
            <p className="text-sm text-muted-foreground">
              Check back soon for new staking opportunities
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {vaults.map((vault) => (
              <VaultListItem key={vault.id} {...vault} onDeposit={handleDeposit} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">APY Performance</h2>
          <p className="text-muted-foreground">
            Historical yield trends across all vaults
          </p>
        </div>
        <div className="rounded-2xl border-2 bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <ApyChart
            data={chartData}
            vaultNames={["Stable Yield", "High Yield", "Maximum Returns"]}
          />
        </div>
      </div>

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
        bridgeId={bridgeInfo?.bridgeId}
        errorMessage={progressErrorMessage}
        onNavigateToBridgeTracking={handleNavigateToBridgeTracking}
        onNavigateToPortfolio={handleNavigateToPortfolio}
        onOpenChange={(open) => {
          if (!open && (progressStep === 'error' || progressStep === 'ready' || progressStep === 'awaiting_payment' || progressStep === 'finalizing' || progressStep === 'completed')) {
            handleCloseProgressModal();
          }
        }}
      />

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-deposit-success">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">
              {successMessage?.title || "Success!"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {successMessage?.description}
            </DialogDescription>
          </DialogHeader>
          
          {successMessage?.txHash && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground text-center mb-2">Transaction Hash:</p>
              <code className="block text-xs bg-muted p-3 rounded-md break-all text-center">
                {successMessage.txHash}
              </code>
            </div>
          )}

          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setSuccessDialogOpen(false)}
              data-testid="button-close-success"
            >
              Close
            </Button>
            <Link href="/portfolio">
              <Button 
                onClick={() => setSuccessDialogOpen(false)}
                data-testid="button-view-positions"
              >
                View My Positions
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
