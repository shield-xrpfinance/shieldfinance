import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Vault as VaultType } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import VaultCard from "@/components/VaultCard";
import DepositModal from "@/components/DepositModal";
import XamanSigningModal from "@/components/XamanSigningModal";
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
  const [xamanSigningModalOpen, setXamanSigningModalOpen] = useState(false);
  const [walletConnectSigningOpen, setWalletConnectSigningOpen] = useState(false);
  const [xamanPayload, setXamanPayload] = useState<{ uuid: string; qrUrl: string; deepLink: string } | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ amounts: { [asset: string]: string }; vaultId: string; vaultName: string } | null>(null);
  const [selectedVault, setSelectedVault] = useState<{ id: string; name: string; apy: string; depositAssets: string[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("apy");
  const { toast } = useToast();
  const { address, provider, walletConnectProvider } = useWallet();
  const { network, isTestnet } = useNetwork();

  const { data: apiVaults, isLoading } = useQuery<VaultType[]>({
    queryKey: ["/api/vaults"],
  });

  const formatCurrency = (value: string): string => {
    const num = parseFloat(value);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  const allVaults = apiVaults?.map(vault => ({
    id: vault.id,
    name: vault.name,
    asset: vault.asset || "XRP",
    apy: vault.apy,
    tvl: formatCurrency(vault.tvl),
    liquidity: formatCurrency(vault.liquidity),
    lockPeriod: vault.lockPeriod,
    riskLevel: vault.riskLevel as "low" | "medium" | "high",
    depositors: 0,
    status: vault.status.charAt(0).toUpperCase() + vault.status.slice(1),
    depositAssets: (vault.asset || "XRP").split(",").map(a => a.trim()),
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
    if (vault) {
      setSelectedVault({ 
        id: vault.id, 
        name: vault.name, 
        apy: vault.apy,
        depositAssets: vault.depositAssets || ["XRP"],
      });
      setDepositModalOpen(true);
    }
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
    console.log("=== handleConfirmDeposit CALLED ===", { amounts, provider, address, walletConnectProvider: !!walletConnectProvider });
    
    if (!selectedVault || !address) return;

    const totalAmount = Object.values(amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    // For single-asset vaults, use that asset. For multi-asset, use first asset for payment
    const paymentAsset = selectedVault.depositAssets[0];
    const paymentAmount = amounts[paymentAsset] || totalAmount.toString();

    // Store pending deposit
    setPendingDeposit({
      amounts,
      vaultId: selectedVault.id,
      vaultName: selectedVault.name,
    });
    setDepositModalOpen(false);

    // Debug logging
    console.log("Deposit routing - provider:", provider, "address:", address, "walletConnectProvider:", !!walletConnectProvider);

    // Check if provider is set - if not, wallet may have disconnected
    if (!provider) {
      toast({
        title: "Connection Lost",
        description: "Your wallet connection has expired. Please reconnect your wallet.",
        variant: "destructive",
      });
      setPendingDeposit(null);
      return;
    }

    // Route to correct signing method based on provider
    if (provider === "walletconnect") {
      console.log("Routing to WalletConnect deposit");
      await handleWalletConnectDeposit(paymentAmount, paymentAsset);
    } else {
      console.log("Routing to Xaman deposit");
      // Default to Xaman
      await handleXamanDeposit(paymentAmount, paymentAsset);
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVaults.map((vault) => (
          <VaultCard key={vault.id} {...vault} onDeposit={handleDeposit} />
        ))}
      </div>

      {selectedVault && (
        <DepositModal
          open={depositModalOpen}
          onOpenChange={setDepositModalOpen}
          vaultName={selectedVault.name}
          vaultApy={selectedVault.apy}
          depositAssets={selectedVault.depositAssets}
          onConfirm={handleConfirmDeposit}
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
    </div>
  );
}
