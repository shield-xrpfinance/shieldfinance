import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Gift,
  Wallet,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
  Info,
  Coins,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";
import ConnectWalletModal from "@/components/ConnectWalletModal";

interface AirdropEligibility {
  eligible: boolean;
  amount?: string;
  proof?: string[];
}

interface AirdropRoot {
  root: string;
  totalAmount: string;
  totalEntries: number;
  timestamp: string;
}

export default function Airdrop() {
  const { address, evmAddress, isConnected, isEvmConnected, provider: providerType, walletConnectProvider } = useWallet();
  const { isTestnet } = useNetwork();
  const { toast } = useToast();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Fetch airdrop merkle root data
  const { data: rootData } = useQuery<AirdropRoot>({
    queryKey: ["/api/airdrop/root"],
    enabled: true,
  });

  // Check eligibility when wallet connects (using EVM address for Flare Network)
  const {
    data: eligibility,
    isLoading: checkingEligibility,
    refetch: recheckEligibility,
  } = useQuery<AirdropEligibility>({
    queryKey: ["/api/airdrop/check", evmAddress],
    enabled: !!evmAddress && isEvmConnected,
  });

  // Check if user already claimed (on-chain check)
  useEffect(() => {
    async function checkClaimStatus() {
      if (!evmAddress || !isEvmConnected || !walletConnectProvider || isTestnet) return;

      try {
        // MerkleDistributor contract address (set after deployment)
        const distributorAddress = import.meta.env.VITE_MERKLE_DISTRIBUTOR_ADDRESS;
        if (!distributorAddress || distributorAddress === "0x...") {
          return;
        }

        const distributorAbi = [
          "function hasClaimed(address account) external view returns (bool)",
        ];

        // Create ethers provider from WalletConnect
        const ethersProvider = new ethers.BrowserProvider(walletConnectProvider);
        
        const contract = new ethers.Contract(
          distributorAddress,
          distributorAbi,
          ethersProvider
        );

        const claimed = await contract.hasClaimed(evmAddress);
        setHasClaimed(claimed);
      } catch (error) {
        console.error("Error checking claim status:", error);
      }
    }

    checkClaimStatus();
  }, [evmAddress, isEvmConnected, walletConnectProvider, isTestnet]);

  const handleClaim = async () => {
    if (!evmAddress || !eligibility || !eligibility.proof || !walletConnectProvider) {
      toast({
        title: "Cannot claim",
        description: "Please connect your wallet with Flare Network support (e.g., Bifrost) to claim.",
        variant: "destructive",
      });
      return;
    }

    if (isTestnet) {
      toast({
        title: "Mainnet Only",
        description: "Switch to Flare Mainnet to claim your airdrop.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsClaiming(true);

      // MerkleDistributor contract address (set after deployment)
      const distributorAddress = import.meta.env.VITE_MERKLE_DISTRIBUTOR_ADDRESS;
      if (!distributorAddress || distributorAddress === "0x...") {
        throw new Error("Airdrop contract not deployed. Please contact support.");
      }

      const distributorAbi = [
        "function claim(uint256 amount, bytes32[] calldata merkleProof) external",
        "function hasClaimed(address account) external view returns (bool)",
      ];

      // Create ethers provider and signer from WalletConnect
      const ethersProvider = new ethers.BrowserProvider(walletConnectProvider);
      const signer = await ethersProvider.getSigner();
      
      const contract = new ethers.Contract(
        distributorAddress,
        distributorAbi,
        signer
      );

      // Double-check not already claimed
      const alreadyClaimed = await contract.hasClaimed(evmAddress);
      if (alreadyClaimed) {
        setHasClaimed(true);
        toast({
          title: "Already Claimed",
          description: "You have already claimed your SHIELD airdrop.",
        });
        setIsClaiming(false);
        return;
      }

      // Parse amount (18 decimals for SHIELD token)
      if (!eligibility.amount) {
        throw new Error("Invalid airdrop amount");
      }
      
      const amountWei = ethers.parseEther(eligibility.amount);

      // Submit claim transaction
      const tx = await contract.claim(amountWei, eligibility.proof);

      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation...",
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      setClaimTxHash(receipt.hash);
      setHasClaimed(true);

      toast({
        title: "Claim Successful! 🎉",
        description: `You received ${eligibility.amount} SHIELD tokens!`,
      });
    } catch (error: any) {
      console.error("Claim error:", error);

      let errorMessage = "Transaction failed. Please try again.";
      if (error.code === "ACTION_REJECTED") {
        errorMessage = "Transaction rejected by user.";
      } else if (error.message?.includes("Already claimed")) {
        errorMessage = "You have already claimed your airdrop.";
        setHasClaimed(true);
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const getFlareScanUrl = (txHash: string) => {
    return isTestnet
      ? `https://coston2-explorer.flare.network/tx/${txHash}`
      : `https://flarescan.com/tx/${txHash}`;
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-8">
        <div className="absolute top-4 left-4 rounded-lg bg-primary/20 p-3 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-primary/30 blur-xl" />
            <Gift className="relative h-8 w-8 text-primary" />
          </div>
        </div>

        <div className="ml-16">
          <h1 className="text-3xl font-bold">$SHIELD Airdrop</h1>
          <p className="text-muted-foreground mt-2">
            Claim your share of 2,000,000 SHIELD tokens
          </p>
        </div>

        {rootData && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-4">
              <p className="text-xs text-muted-foreground">Total Allocation</p>
              <p className="text-2xl font-bold font-mono">
                {Number(rootData.totalAmount).toLocaleString()} SHIELD
              </p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-4">
              <p className="text-xs text-muted-foreground">Eligible Addresses</p>
              <p className="text-2xl font-bold font-mono">{rootData.totalEntries.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-4">
              <p className="text-xs text-muted-foreground">Value per Address</p>
              <p className="text-2xl font-bold font-mono">
                {(Number(rootData.totalAmount) / rootData.totalEntries).toLocaleString()} SHIELD
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bifrost Recommendation */}
      {!isConnected && (
        <Alert className="border-chart-3 bg-chart-3/10">
          <Info className="h-4 w-4 text-chart-3" />
          <AlertDescription>
            <span className="font-semibold">XRP Users:</span> We recommend{" "}
            <a
              href="https://bifrostwallet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-chart-3"
            >
              Bifrost Wallet
            </a>{" "}
            for seamless XRPL + Flare Network support in one wallet.
          </AlertDescription>
        </Alert>
      )}

      {/* Testnet Mode - Faucet Link */}
      {isTestnet && (
        <Alert className="border-orange-500 bg-orange-500/10">
          <Coins className="h-4 w-4 text-orange-500" />
          <AlertDescription className="flex flex-col gap-2">
            <span>
              <span className="font-semibold">Testnet Mode:</span> Airdrop claims are only available on Flare Mainnet.
            </span>
            <span>
              Need test tokens to explore the platform? Visit our{" "}
              <a
                href="https://faucet.shyield.finance/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-500"
                data-testid="link-faucet"
              >
                Testnet Faucet
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              to get free test SHIELD and FLR tokens.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* EVM Address Connection Status */}
      {isConnected && !isEvmConnected && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Flare Network address not detected.</strong> To claim the airdrop, please
            connect using a multi-chain wallet like Bifrost that supports both XRPL and Flare
            Network.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Claim Card */}
      <Card className="p-8">
        {!isConnected ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-muted p-6">
                <Wallet className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your Flare Network wallet to check if you're eligible for the
              SHIELD airdrop.
            </p>
            <Button size="lg" onClick={() => setConnectModalOpen(true)} data-testid="button-connect-wallet-airdrop">
              <Wallet className="h-5 w-5 mr-2" />
              Connect Wallet
            </Button>
          </div>
        ) : checkingEligibility ? (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-2xl font-bold">Checking Eligibility...</h2>
            <p className="text-muted-foreground">
              Verifying your Flare address: {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}
            </p>
          </div>
        ) : hasClaimed ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/20 p-6">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Already Claimed!</h2>
            <p className="text-muted-foreground">
              You have successfully claimed your SHIELD airdrop.
            </p>
            {claimTxHash && (
              <Button variant="outline" asChild data-testid="button-view-transaction">
                <a
                  href={getFlareScanUrl(claimTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Transaction
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
        ) : eligibility && eligibility.eligible ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-500/20 p-6">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">You're Eligible! 🎉</h2>
              <p className="text-muted-foreground">
                You can claim{" "}
                <span className="font-bold text-foreground">
                  {Number(eligibility.amount).toLocaleString()} SHIELD
                </span>{" "}
                tokens
              </p>
            </div>

            <Separator />

            {/* Transaction Preview */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Transaction Details
              </h3>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You will receive:</span>
                  <span className="font-bold font-mono">
                    {Number(eligibility.amount).toLocaleString()} SHIELD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="font-medium">
                    {isTestnet ? "Coston2 Testnet" : "Flare Mainnet"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Flare Address:</span>
                  <span className="font-mono text-xs">
                    {evmAddress?.slice(0, 10)}...{evmAddress?.slice(-8)}
                  </span>
                </div>
                {address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your XRPL Address:</span>
                    <span className="font-mono text-xs">
                      {address?.slice(0, 10)}...{address?.slice(-8)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gas Fee:</span>
                  <span className="text-xs">Paid in FLR (≈ $0.01)</span>
                </div>
              </div>
            </div>

            {/* Claim Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleClaim}
              disabled={isClaiming || isTestnet}
              data-testid="button-claim-airdrop"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Coins className="h-5 w-5 mr-2" />
                  Claim {Number(eligibility.amount).toLocaleString()} SHIELD
                </>
              )}
            </Button>

            {isTestnet && (
              <p className="text-xs text-center text-destructive">
                Switch to Flare Mainnet to claim your airdrop
              </p>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/20 p-6">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Not Eligible</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Unfortunately, your Flare address ({evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}) is
              not eligible for the SHIELD airdrop.
            </p>
            <p className="text-xs text-muted-foreground">
              The airdrop snapshot was taken on a specific date. If you believe this is an
              error, please contact support.
            </p>
          </div>
        )}
      </Card>

      {/* Legal Disclaimer */}
      <Alert className="border-muted-foreground/20 bg-muted/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          <strong>Important:</strong> This is a one-time community reward for early
          supporters. $SHIELD has no promised value and is not a security. Participation is
          voluntary and at your own risk. XRPL users: Use Bifrost for easy Flare claims.
        </AlertDescription>
      </Alert>

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onConnect={() => {
          // Connection handled in modal
        }}
      />
    </div>
  );
}
