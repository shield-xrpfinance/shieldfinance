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
import ConnectWalletEmptyState from "@/components/ConnectWalletEmptyState";
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
import { useLocation } from "wouter";
import { getAssetAddress, getAssetDecimals, getAssetDisplayName, type Network } from "@shared/assetConfig";

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
  const [progressErrorMessage, setProgressErrorMessage] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { address, evmAddress, provider, walletType, isConnected, walletConnectProvider, requestPayment } = useWallet();
  const { network, isTestnet } = useNetwork();
  const [, setLocation] = useLocation();

  const { data: apiVaults, isLoading } = useQuery<VaultType[]>({
    queryKey: ["/api/vaults"],
  });

  const { data: escrows = [] } = useQuery<Escrow[]>({
    queryKey: ["/api/escrows", address, evmAddress],
    queryFn: async () => {
      const walletAddr = address || evmAddress;
      if (!walletAddr) return [];
      const response = await fetch(`/api/escrows?walletAddress=${encodeURIComponent(walletAddr)}`);
      if (!response.ok) throw new Error('Failed to fetch escrows');
      return response.json();
    },
    enabled: !!address || !!evmAddress,
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

  const allVaults = apiVaults?.map(vault => {
    // Use backend asset field as primary source of truth
    let vaultAsset = vault.asset || "XRP";
    
    // Fallback: if no backend asset, check vault name
    if (!vault.asset && vault.name.toLowerCase().includes("fxrp")) {
      vaultAsset = "FXRP";
    }
    
    const vaultDepositAssets = vaultAsset.split(",").map(a => a.trim());
    if (vaultAsset === "FXRP") {
      console.log(`✅ FXRP Vault detected: ${vault.name} → asset: ${vaultAsset}`);
    }
    
    return {
      id: vault.id,
      name: vault.name,
      asset: vaultAsset,
      apy: vault.apy,
      apyLabel: vault.apyLabel,
      tvl: formatCurrency(vault.tvl),
      liquidity: formatCurrency(vault.liquidity),
      lockPeriod: vault.lockPeriod,
      riskLevel: vault.riskLevel as "low" | "medium" | "high",
      depositors: 0,
      status: vault.status.charAt(0).toUpperCase() + vault.status.slice(1),
      depositAssets: vaultDepositAssets,
      pendingEscrowCount: vaultEscrowStats[vault.id]?.pendingCount || 0,
      finishedEscrowCount: vaultEscrowStats[vault.id]?.finishedCount || 0,
      cancelledEscrowCount: vaultEscrowStats[vault.id]?.cancelledCount || 0,
      failedEscrowCount: vaultEscrowStats[vault.id]?.failedCount || 0,
      totalEscrowAmount: vaultEscrowStats[vault.id]?.totalAmount.toString() || "0",
      depositLimit: (vault as any).depositLimit || null,
      depositLimitRaw: (vault as any).depositLimitRaw || null,
      paused: typeof (vault as any).paused === 'boolean' ? (vault as any).paused : null,
      comingSoon: (vault as any).comingSoon || false,
    };
  }) || [];

  // Filter vaults based on wallet type
  const walletFilteredVaults = useMemo(() => {
    if (!isConnected || !walletType) {
      return []; // No wallet connected, return empty array
    }
    
    if (walletType === "xrpl") {
      // Xaman users see XRP vaults only
      return allVaults.filter(vault => vault.asset === "XRP");
    } else if (walletType === "evm") {
      // WalletConnect/BiFrost users see FXRP vaults only
      return allVaults.filter(vault => vault.asset === "FXRP");
    }
    
    return allVaults;
  }, [allVaults, isConnected, walletType]);

  const filteredVaults = walletFilteredVaults
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
      return;
    }
    
    // Block deposit flow if vault is paused
    if (vault.paused === true) {
      return;
    }
    
    // Use vault.depositAssets which is already computed from vault.asset
    const depositAssets = vault.depositAssets && vault.depositAssets.length > 0 
      ? vault.depositAssets 
      : ["XRP"];
    
    console.log(`🔄 Opening deposit modal for ${vault.name}: depositAssets=${JSON.stringify(depositAssets)}`);
    
    setSelectedVault({ 
      id: vault.id, 
      name: vault.name, 
      apy: vault.apy,
      apyLabel: vault.apyLabel,
      depositAssets: depositAssets,
    });
    setDepositModalOpen(true);
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
    if (!selectedVault) {
      console.error("❌ Missing selectedVault");
      return;
    }

    const totalAmount = Object.values(amounts)
      .filter((amt) => amt && parseFloat(amt.replace(/,/g, "")) > 0)
      .reduce((sum, amt) => sum + parseFloat(amt.replace(/,/g, "")), 0);

    const paymentAsset = selectedVault.depositAssets[0];

    // PRIMARY: Check vault name for FXRP - this is the most reliable method
    // If vault name contains "fxrp" → force EVM deposit flow
    const nameHasFXRP = selectedVault.name.toLowerCase().includes("fxrp");
    const assetsHasFXRP = selectedVault.depositAssets && selectedVault.depositAssets.some((a: string) => a.toUpperCase() === "FXRP");
    const isFXRPDeposit = nameHasFXRP || assetsHasFXRP;
    
    console.log(`
🔄 DEPOSIT FLOW DETECTION:
  Vault: "${selectedVault.name}"
  Name has FXRP: ${nameHasFXRP}
  Assets has FXRP: ${assetsHasFXRP}
  → FXRP Deposit: ${isFXRPDeposit}
  Deposit Assets: ${JSON.stringify(selectedVault.depositAssets)}
    `);

    if (isFXRPDeposit) {
      // Use direct FXRP deposit flow - user deposits FXRP via EVM wallet, gets shXRP immediately
      if (!evmAddress) {
        toast({
          title: "Connection Error",
          description: "Please connect an EVM wallet (like BiFrost) to deposit FXRP.",
          variant: "destructive",
        });
        return;
      }

      try {
        setDepositModalOpen(false);
        setProgressStep('creating');
        setProgressModalOpen(true);
        
        setBridgeInfo({
          bridgeId: '',
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
        });

        // Step 1: Request FXRP transfer from EVM wallet (Flare Network)
        if (!walletConnectProvider) {
          throw new Error("EVM wallet not connected. Please connect with WalletConnect.");
        }

        const { ethers } = await import("ethers");
        
        // Get signer from WalletConnect provider
        const provider = new ethers.BrowserProvider(walletConnectProvider as any);
        const signer = await provider.getSigner();
        
        // Get network-aware FXRP token address (FXRP on mainnet, FTestXRP on testnet)
        const FXRP_ADDRESS = getAssetAddress("FXRP", network as Network);
        if (!FXRP_ADDRESS || FXRP_ADDRESS === "0x0000000000000000000000000000000000000000") {
          throw new Error(`${getAssetDisplayName("FXRP", network as Network)} not deployed on ${network}`);
        }
        
        const VAULT_ADDRESS = "0x0000000000000000000000000000000000000001"; // TODO: Update with actual vault address
        
        // ERC-20 ABI for approval and transfer
        const ERC20_ABI = [
          "function approve(address spender, uint256 amount) public returns (bool)",
          "function transfer(address to, uint256 amount) public returns (bool)",
          "function allowance(address owner, address spender) public view returns (uint256)"
        ];
        
        const fxrpContract = new ethers.Contract(FXRP_ADDRESS, ERC20_ABI, signer);
        const decimals = getAssetDecimals("FXRP", network as Network);
        const amountInWei = ethers.parseUnits(totalAmount.toString(), decimals);

        // Step 2: Request approval from user's wallet
        const tokenName = getAssetDisplayName("FXRP", network as Network);
        console.log(`🔄 Requesting ${tokenName} approval from ${evmAddress}...`);
        const approveTx = await fxrpContract.approve(VAULT_ADDRESS, amountInWei);
        console.log(`⏳ Approval tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`✅ Approval confirmed`);

        // Step 3: Request transfer
        console.log(`🔄 Requesting ${tokenName} transfer...`);
        const transferTx = await fxrpContract.transfer(VAULT_ADDRESS, amountInWei);
        console.log(`⏳ Transfer tx: ${transferTx.hash}`);
        await transferTx.wait();
        console.log(`✅ Transfer confirmed`);

        // Step 4: Notify backend and create position
        const response = await fetch("/api/deposits/fxrp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: evmAddress,
            vaultId: selectedVault.id,
            amount: totalAmount.toString(),
            network: network,
            txHash: transferTx.hash,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to create FXRP deposit");
        }

        // Update with position info
        setBridgeInfo({
          bridgeId: data.position.id,
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
        });

        // Show success and navigate to portfolio
        setTimeout(() => {
          setProgressModalOpen(false);
          toast({
            title: "Deposit Successful",
            description: `${totalAmount} ${tokenName} deposited! You received ${data.shXRPShares} shXRP shares.`,
          });
          setLocation('/portfolio');
        }, 2000);

      } catch (error) {
        const tokenName = getAssetDisplayName("FXRP", network as Network);
        console.error(`${tokenName} deposit error:`, error);
        setProgressModalOpen(false);
        toast({
          title: "Deposit Failed",
          description: error instanceof Error ? error.message : `Failed to deposit ${tokenName}. Make sure you have enough ${tokenName} and are connected to the correct network.`,
          variant: "destructive",
        });
      }
    } else {
      // Use bridge flow for XRP deposits
      if (!address) {
        toast({
          title: "Connection Error",
          description: "Please connect an XRPL wallet (like Xaman) to deposit XRP.",
          variant: "destructive",
        });
        return;
      }

      try {
        setDepositModalOpen(false);
        setProgressStep('creating');
        setProgressModalOpen(true);
        
        setBridgeInfo({
          bridgeId: '',
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

        setBridgeInfo({
          bridgeId: data.bridgeId,
          vaultName: selectedVault.name,
          amount: totalAmount.toString(),
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

  // Show empty state if wallet not connected
  if (!isConnected) {
    return <ConnectWalletEmptyState />;
  }

  // Show loading skeleton only when connected and loading
  if (isLoading && isConnected) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

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

      {/* Empty State - No vaults at all */}
      {filteredVaults.length === 0 && (
        <div className="text-center py-16">
          <p className="text-xl text-muted-foreground mb-2">No vaults found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Active Vaults Section */}
      {filteredVaults.filter((vault) => !vault.comingSoon).length > 0 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Active Vaults</h2>
            <p className="text-muted-foreground">
              Earn yield on your XRP with our liquid staking vaults
            </p>
          </div>
          <div className="space-y-6">
            {filteredVaults
              .filter((vault) => !vault.comingSoon)
              .map((vault) => (
                <VaultListItem key={vault.id} {...vault} onDeposit={handleDeposit} />
              ))}
          </div>
        </div>
      )}

      {/* Coming Soon Vaults Section */}
      {filteredVaults.filter((vault) => vault.comingSoon).length > 0 && (
        <div className="mt-12">
          <CollapsibleSection
            title="Coming Soon"
            count={filteredVaults.filter((vault) => vault.comingSoon).length}
            defaultOpen={false}
          >
            <div className="space-y-4">
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
    </div>
  );
}
