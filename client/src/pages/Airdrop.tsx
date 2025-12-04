import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
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
  Trophy,
  Medal,
  Crown,
  Star,
  Sparkles,
  ArrowRight,
  Users,
  TrendingUp,
  Clock,
  Lock,
  ArrowLeftRight,
  Bug,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import type { UserTier } from "@shared/schema";
import { TIER_CONFIG } from "@shared/schema";

interface AirdropEligibility {
  eligible: boolean;
  claimed?: boolean;
  amount?: string;
  proof?: string[];
  message?: string;
}

interface AirdropRoot {
  root: string;
  totalAmount: string;
  totalEntries: number;
  timestamp: string;
  totalClaimed: string;
  remainingAmount: string;
  claimedCount: number;
  eligibleCount: number;
}

interface UserPointsData {
  walletAddress: string;
  totalPoints: number;
  depositPoints: number;
  stakingPoints: number;
  bridgePoints: number;
  referralPoints: number;
  bugReportPoints: number;
  socialPoints: number;
  otherPoints: number;
  tier: 'none' | 'bronze' | 'silver' | 'gold' | 'diamond';
  tierMultiplier: string;
  airdropMultiplier: number;
  referralCode: string;
  referralCount: number;
  rank: number;
  nextTierProgress?: {
    currentTier: string;
    nextTier: string | null;
    pointsNeeded: number;
    progressPercent: number;
  };
}

interface LeaderboardStats {
  totalParticipants: number;
  totalPointsDistributed: number;
  tierBreakdown: Record<UserTier, number>;
}

interface LeaderboardResponse {
  leaderboard: any[];
  stats: LeaderboardStats;
}

const TOTAL_AIRDROP_POOL = 2000000;

const tierColors: Record<UserTier, string> = {
  bronze: "bg-orange-600 text-white",
  silver: "bg-gray-400 text-gray-900",
  gold: "bg-yellow-500 text-yellow-900",
  diamond: "bg-cyan-400 text-cyan-900",
};

const tierBorderColors: Record<UserTier, string> = {
  bronze: "border-orange-600",
  silver: "border-gray-400",
  gold: "border-yellow-500",
  diamond: "border-cyan-400",
};

const tierIcons: Record<UserTier, typeof Trophy> = {
  bronze: Medal,
  silver: Star,
  gold: Crown,
  diamond: Sparkles,
};

const tierOrder: UserTier[] = ["bronze", "silver", "gold", "diamond"];

function getTierBadge(tier: UserTier, size: "sm" | "lg" = "sm") {
  const TierIcon = tierIcons[tier];
  const sizeClasses = size === "lg" ? "text-base px-4 py-1.5" : "";
  return (
    <Badge className={`${tierColors[tier]} gap-1 ${sizeClasses}`} data-testid={`badge-tier-${tier}`}>
      <TierIcon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function calculateProjectedAllocation(
  userPoints: number, 
  userMultiplier: number,
  totalPointsDistributed: number,
  totalParticipants: number
): number {
  if (totalPointsDistributed === 0 || totalParticipants === 0) {
    return 0;
  }
  
  const weightedUserPoints = userPoints * userMultiplier;
  const avgMultiplier = 1.5;
  const estimatedTotalWeightedPoints = totalPointsDistributed * avgMultiplier;
  
  if (estimatedTotalWeightedPoints === 0) {
    return 0;
  }
  
  const share = weightedUserPoints / estimatedTotalWeightedPoints;
  return Math.round(share * TOTAL_AIRDROP_POOL);
}

export default function Airdrop() {
  const { address, evmAddress, isConnected, isEvmConnected, provider: providerType, walletConnectProvider } = useWallet();
  const { isTestnet } = useNetwork();
  const { toast } = useToast();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sharePosted, setSharePosted] = useState(false);

  const walletAddress = address || evmAddress;

  const { data: rootData } = useQuery<AirdropRoot>({
    queryKey: ["/api/airdrop/root"],
    enabled: !isTestnet,
  });

  const {
    data: eligibility,
    isLoading: checkingEligibility,
  } = useQuery<AirdropEligibility>({
    queryKey: ["/api/airdrop/check", evmAddress],
    enabled: !!evmAddress && isEvmConnected && !isTestnet,
  });

  const { 
    data: userPointsData, 
    isLoading: isLoadingPoints 
  } = useQuery<UserPointsData>({
    queryKey: ["/api/points", walletAddress],
    enabled: !!walletAddress && isTestnet,
  });

  const { 
    data: leaderboardData, 
    isLoading: isLoadingLeaderboard 
  } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
    enabled: isTestnet,
  });

  useEffect(() => {
    setHasClaimed(Boolean(eligibility?.claimed));
  }, [eligibility]);

  useEffect(() => {
    if (!isEvmConnected) {
      setHasClaimed(false);
      setClaimTxHash(null);
    }
  }, [isEvmConnected, evmAddress]);

  const handleClaim = async () => {
    if (!evmAddress || !eligibility || !eligibility.proof || !walletConnectProvider) {
      toast({
        title: "Cannot claim",
        description: "Please connect your wallet with Flare Network support (e.g., Bifrost) to claim.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsClaiming(true);

      const distributorAddress = import.meta.env.VITE_MERKLE_DISTRIBUTOR_ADDRESS;
      if (!distributorAddress || distributorAddress === "0x...") {
        throw new Error("Airdrop contract not deployed. Please contact support.");
      }

      const distributorAbi = [
        "function claim(uint256 amount, bytes32[] calldata merkleProof) external",
        "function hasClaimed(address account) external view returns (bool)",
      ];

      const ethersProvider = new ethers.BrowserProvider(walletConnectProvider);
      const signer = await ethersProvider.getSigner();
      
      const contract = new ethers.Contract(
        distributorAddress,
        distributorAbi,
        signer
      );

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

      if (!eligibility.amount) {
        throw new Error("Invalid airdrop amount");
      }
      
      const amountWei = ethers.parseEther(eligibility.amount);

      const tx = await contract.claim(amountWei, eligibility.proof);

      toast({
        title: "Transaction Submitted",
        description: "Waiting for confirmation...",
      });

      const receipt = await tx.wait();

      setClaimTxHash(receipt.hash);
      setHasClaimed(true);

      toast({
        title: "Claim Successful!",
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

  const handleShareOnX = async (type: 'referral' | 'airdrop_claim') => {
    if (!userPointsData || !userPointsData.referralCode) {
      toast({
        title: "Error",
        description: "Unable to share. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/twitter/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletAddress,
          referralCode: userPointsData.referralCode,
          totalPoints: userPointsData.totalPoints,
          tier: userPointsData.tier,
          type,
        }),
      });

      const data = await response.json();

      if (data.success && data.intentUrl) {
        window.open(data.intentUrl, '_blank', 'width=600,height=400');
        
        // Store the pending share ID for verification later
        if (data.pendingShareId) {
          setPendingShareId(data.pendingShareId);
          setSharePosted(true);
          toast({
            title: "Share Posted!",
            description: "After posting on X, click 'Verify Post' to earn 10 points!",
          });
        } else {
          toast({
            title: "Share on X",
            description: "Complete your post on X!",
          });
        }
      } else {
        throw new Error(data.error || 'Failed to generate share URL');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Error",
        description: "Failed to open share dialog. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyShare = async () => {
    if (!walletAddress || !pendingShareId) {
      toast({
        title: "Error",
        description: "No pending share to verify.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // First check if user is connected to X
      const statusResponse = await fetch(`/api/twitter/status/${walletAddress}`);
      const statusData = await statusResponse.json();
      
      if (!statusData.connected) {
        // Need to connect to X first
        toast({
          title: "Connect to X",
          description: "Please connect your X account first to verify your post.",
        });
        
        // Open auth flow
        const authResponse = await fetch(`/api/twitter/auth/${walletAddress}`);
        const authData = await authResponse.json();
        
        if (authData.authUrl) {
          window.open(authData.authUrl, '_blank', 'width=600,height=700');
          toast({
            title: "Authorize on X",
            description: "Complete the authorization on X, then try verifying again.",
          });
        }
        setIsVerifying(false);
        return;
      }

      // User is connected, verify the tweet
      const verifyResponse = await fetch('/api/twitter/verify-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          pendingShareId,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        toast({
          title: "Verified!",
          description: `Tweet verified! You earned ${verifyData.pointsAwarded} social points.`,
        });
        
        // Clear pending share state
        setPendingShareId(null);
        setSharePosted(false);
        
        // Refresh points display
        queryClient.invalidateQueries({ queryKey: ['/api/points', walletAddress] });
        queryClient.invalidateQueries({ queryKey: ['/api/leaderboard'] });
      } else {
        toast({
          title: "Verification Failed",
          description: verifyData.error || "Could not verify your tweet. Please ensure you posted it.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Error",
        description: "Failed to verify tweet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const projectedAllocation = userPointsData && leaderboardData?.stats
    ? calculateProjectedAllocation(
        userPointsData.totalPoints,
        userPointsData.airdropMultiplier || 1,
        leaderboardData.stats.totalPointsDistributed,
        leaderboardData.stats.totalParticipants
      )
    : 0;

  if (!isTestnet) {
    return (
      <div className="space-y-6">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-blue-500/20 p-6">
                <AlertCircle className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Switch to Testnet</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                The airdrop program runs on Flare Testnet (Coston2). Toggle your network to testnet to earn points.
              </p>
            </div>
            <Alert className="border-blue-500 bg-blue-500/10 text-left">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription>
                <strong>How to switch:</strong> Open your wallet settings and select "Flare Testnet (Coston2)" or use your network selector. Once switched, you can earn points through deposits, staking, bridges, referrals, faucet claims, and bug reports.
              </AlertDescription>
            </Alert>
            <div className="pt-4">
              <Button size="lg" onClick={() => setConnectModalOpen(true)} data-testid="button-connect-testnet">
                <Wallet className="h-5 w-5 mr-2" />
                Connect & Switch to Testnet
              </Button>
            </div>
          </div>
        </Card>

        <ConnectWalletModal
          open={connectModalOpen}
          onOpenChange={setConnectModalOpen}
          onConnect={() => {}}
        />
      </div>
    );
  }

  if (isTestnet) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-orange-500/10 via-yellow-500/5 to-background p-8">
          <div className="absolute top-4 left-4 rounded-lg bg-orange-500/20 p-3 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-orange-500/30 blur-xl" />
              <Trophy className="relative h-8 w-8 text-orange-500" />
            </div>
          </div>

          <div className="ml-16">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold" data-testid="text-testnet-airdrop-title">Testnet Points Airdrop</h1>
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                Testnet
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              Earn points during testnet to claim your share of {TOTAL_AIRDROP_POOL.toLocaleString()} SHIELD tokens
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Total Pool</p>
              <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-total-pool">
                {TOTAL_AIRDROP_POOL.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">SHIELD</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Participants</p>
              {isLoadingLeaderboard ? (
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-20" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold font-mono text-green-500" data-testid="text-participants">
                  {leaderboardData?.stats?.totalParticipants?.toLocaleString() || 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">testers</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Total Points</p>
              {isLoadingLeaderboard ? (
                <Skeleton className="h-6 sm:h-8 w-20 sm:w-24" />
              ) : (
                <p className="text-lg sm:text-2xl font-bold font-mono text-primary" data-testid="text-total-points-distributed">
                  {leaderboardData?.stats?.totalPointsDistributed?.toLocaleString() || 0}
                </p>
              )}
              <p className="text-xs text-muted-foreground">distributed</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm sm:text-base font-semibold text-green-500" data-testid="text-testnet-status">Active</span>
              </div>
              <p className="text-xs text-muted-foreground">earning points</p>
            </div>
          </div>
        </div>

        <Alert className="border-orange-500 bg-orange-500/10">
          <Coins className="h-4 w-4 text-orange-500" />
          <AlertDescription className="flex flex-col gap-2">
            <span>
              <span className="font-semibold">Testnet Mode:</span> Earn points now to secure your airdrop allocation. 
              Claims will be available on Flare Mainnet after testnet concludes.
            </span>
            <span>
              Need test tokens to get started? Visit our{" "}
              <a
                href="https://faucet.shyield.finance/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-500"
                data-testid="link-faucet-testnet"
              >
                Testnet Faucet
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </AlertDescription>
        </Alert>

        {!isConnected ? (
          <Card className="p-8" data-testid="card-connect-wallet-testnet">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-6">
                  <Wallet className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Connect your wallet to view your testnet points and projected airdrop allocation.
              </p>
              <Button size="lg" onClick={() => setConnectModalOpen(true)} data-testid="button-connect-wallet-testnet">
                <Wallet className="h-5 w-5 mr-2" />
                Connect Wallet
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card 
              className={`lg:col-span-2 ${userPointsData && userPointsData.tier !== 'none' ? tierBorderColors[userPointsData.tier as UserTier] : ""} border-2`} 
              data-testid="card-points-summary-airdrop"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Your Airdrop Status
                </CardTitle>
                <CardDescription>
                  Your current points and projected SHIELD allocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPoints ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 sm:h-24" />
                      ))}
                    </div>
                  </div>
                ) : userPointsData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                      <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Points</p>
                        <p className="text-2xl sm:text-3xl font-bold" data-testid="text-user-points">
                          {userPointsData.totalPoints.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                        <p className="text-xs sm:text-sm text-muted-foreground">Your Tier</p>
                        <div className="mt-1 sm:mt-2" data-testid="badge-user-tier">
                          {userPointsData.tier !== 'none' ? (
                            getTierBadge(userPointsData.tier as UserTier, "lg")
                          ) : (
                            <Badge variant="outline">No Tier</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                        <p className="text-xs sm:text-sm text-muted-foreground">Multiplier</p>
                        <p className="text-2xl sm:text-3xl font-bold text-primary" data-testid="text-user-multiplier">
                          {userPointsData.airdropMultiplier || 1}x
                        </p>
                      </div>
                      <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                        <p className="text-xs sm:text-sm text-muted-foreground">Rank</p>
                        <p className="text-2xl sm:text-3xl font-bold" data-testid="text-user-rank">
                          #{userPointsData.rank || "—"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Projected SHIELD Allocation</p>
                          <p className="text-2xl sm:text-4xl font-bold text-primary" data-testid="text-projected-allocation">
                            {projectedAllocation.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on current points and tier multiplier
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xs sm:text-sm text-muted-foreground">Pool Share</p>
                          <p className="text-xl sm:text-2xl font-bold" data-testid="text-pool-share">
                            {((projectedAllocation / TOTAL_AIRDROP_POOL) * 100).toFixed(3)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">Points Breakdown</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3" data-testid="section-points-breakdown">
                        {([
                          { label: "Deposits", value: userPointsData.depositPoints, Icon: Coins },
                          { label: "Staking", value: userPointsData.stakingPoints, Icon: Lock },
                          { label: "Bridges", value: userPointsData.bridgePoints, Icon: ArrowLeftRight },
                          { label: "Referrals", value: userPointsData.referralPoints, Icon: Users },
                          { label: "Bug Reports", value: userPointsData.bugReportPoints, Icon: Bug },
                          { label: "Social", value: userPointsData.socialPoints, Icon: Share2 },
                          { label: "Faucet & Other", value: userPointsData.otherPoints, Icon: Gift },
                        ] as { label: string; value: number; Icon: LucideIcon }[]).filter(item => item.value > 0).map((item) => (
                          <div 
                            key={item.label} 
                            className="p-2 sm:p-3 rounded-lg bg-muted/30 border"
                            data-testid={`breakdown-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <div className="flex items-center gap-2">
                              <item.Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{item.label}</span>
                            </div>
                            <p className="text-base sm:text-lg font-semibold mt-1">{item.value.toLocaleString()}</p>
                          </div>
                        ))}
                        {userPointsData.depositPoints === 0 && 
                         userPointsData.stakingPoints === 0 && 
                         userPointsData.bridgePoints === 0 && 
                         userPointsData.referralPoints === 0 && 
                         userPointsData.bugReportPoints === 0 && 
                         userPointsData.socialPoints === 0 && 
                         userPointsData.otherPoints === 0 && (
                          <div className="col-span-full text-center py-4 text-muted-foreground">
                            <p className="text-sm">No activity yet. Start earning points!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      No points yet. Start using the platform to earn points!
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 mt-4">
                      <Button asChild data-testid="button-start-earning">
                        <Link to="/app">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Start Earning
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card data-testid="card-tier-progress-airdrop">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Tier Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingPoints ? (
                    <Skeleton className="h-24" />
                  ) : userPointsData && userPointsData.tier !== 'none' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        {tierOrder.map((tier) => {
                          const isAchieved = tierOrder.indexOf(tier) <= tierOrder.indexOf(userPointsData.tier as UserTier);
                          return (
                            <div key={tier} className={`text-center ${isAchieved ? "" : "opacity-40"}`}>
                              {getTierBadge(tier)}
                              <p className="text-xs text-muted-foreground mt-1">
                                {TIER_CONFIG[tier].multiplier}x
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-600 via-gray-400 via-yellow-500 to-cyan-400 transition-all"
                          style={{ 
                            width: `${Math.min(100, (userPointsData.totalPoints / TIER_CONFIG.diamond.minPoints) * 100)}%` 
                          }}
                          data-testid="progress-tier-bar"
                        />
                      </div>

                      {userPointsData.nextTierProgress && userPointsData.nextTierProgress.nextTier && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-2 text-sm">
                            <span>
                              Next: {userPointsData.nextTierProgress.nextTier.charAt(0).toUpperCase() + userPointsData.nextTierProgress.nextTier.slice(1)}
                            </span>
                            <span className="text-muted-foreground">
                              {userPointsData.nextTierProgress.pointsNeeded.toLocaleString()} pts
                            </span>
                          </div>
                          <Progress 
                            value={userPointsData.nextTierProgress.progressPercent} 
                            className="h-2"
                            data-testid="progress-next-tier-airdrop"
                          />
                        </div>
                      )}

                      {!userPointsData.nextTierProgress?.nextTier && (
                        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
                          <Sparkles className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
                          <p className="text-sm font-medium text-cyan-400">Max Tier!</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Earn points to unlock tiers
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-quick-links">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Earn More Points
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button asChild className="w-full justify-start" variant="outline" data-testid="link-points-dashboard">
                    <Link to="/app/points">
                      <Coins className="h-4 w-4 mr-2" />
                      Points Dashboard
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button asChild className="w-full justify-start" variant="outline" data-testid="link-leaderboard">
                    <Link to="/app/leaderboard">
                      <Trophy className="h-4 w-4 mr-2" />
                      Leaderboard
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                  <Button 
                    asChild 
                    className="w-full justify-start" 
                    variant="outline"
                    data-testid="link-faucet-card"
                  >
                    <a href="https://faucet.shyield.finance/" target="_blank" rel="noopener noreferrer">
                      <Gift className="h-4 w-4 mr-2" />
                      Get Test Tokens
                      <ExternalLink className="h-4 w-4 ml-auto" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {userPointsData && userPointsData.referralCode && (
                <Card className="border-sky-500/30 bg-sky-500/5" data-testid="card-share-on-x">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-sky-500" />
                      Share & Earn
                    </CardTitle>
                    <CardDescription>
                      Share your personalized card on X to earn 10 points
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl overflow-hidden border border-sky-500/30 shadow-lg">
                      <img 
                        src={`/api/share-card/${userPointsData.referralCode}?points=${userPointsData.totalPoints || 0}&tier=${userPointsData.tier || 'bronze'}`}
                        alt="Your personalized share card"
                        className="w-full h-auto"
                        data-testid="img-share-card-preview"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
                      <div className="flex items-center justify-between">
                        <p className="font-mono font-bold text-lg" data-testid="text-referral-code">
                          {userPointsData.referralCode}
                        </p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(userPointsData.referralCode);
                            toast({
                              title: "Copied!",
                              description: "Referral code copied to clipboard",
                            });
                          }}
                          data-testid="button-copy-referral"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        <Users className="h-4 w-4 inline mr-1" />
                        Invite friends and earn <span className="font-bold text-primary">50 points</span> per referral!
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button 
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={() => handleShareOnX('referral')}
                        data-testid="button-share-on-x"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share on X
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>

                      {sharePosted && pendingShareId && (
                        <Button 
                          className="w-full"
                          variant="outline"
                          onClick={handleVerifyShare}
                          disabled={isVerifying}
                          data-testid="button-verify-share"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Verifying...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Verify Post to Earn 10 Points
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {sharePosted && pendingShareId && (
                      <Alert className="border-sky-500/50 bg-sky-500/10">
                        <Info className="h-4 w-4 text-sky-500" />
                        <AlertDescription className="text-xs">
                          Posted on X? Connect your X account and click "Verify Post" to earn your social share points.
                        </AlertDescription>
                      </Alert>
                    )}

                    <p className="text-xs text-center text-muted-foreground">
                      {userPointsData.referralCount || 0} friends joined using your code
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <Card className="border-primary/30 bg-primary/5" data-testid="card-mainnet-info">
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="rounded-lg bg-primary/20 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Mainnet Claims Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                After the testnet period ends, your points will be converted to a SHIELD token allocation.
                Claims will be available on Flare Mainnet using the MerkleDistributor contract.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="outline" className="text-muted-foreground">
                  <Users className="h-3 w-3 mr-1" />
                  Points Snapshot
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Merkle Proof
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  <Coins className="h-3 w-3 mr-1" />
                  Mainnet Claim
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert className="border-muted-foreground/20 bg-muted/50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            <strong>Important:</strong> Points earned during testnet determine your share of the {TOTAL_AIRDROP_POOL.toLocaleString()} SHIELD airdrop pool. 
            Higher tiers earn multiplied allocations. Keep testing to maximize your rewards!
          </AlertDescription>
        </Alert>

        <ConnectWalletModal
          open={connectModalOpen}
          onOpenChange={setConnectModalOpen}
          onConnect={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Total Allocation</p>
              <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-total-allocation">
                {Number(rootData.totalAmount).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">SHIELD</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-lg sm:text-2xl font-bold font-mono text-green-500" data-testid="text-remaining-amount">
                {Number(rootData.remainingAmount || rootData.totalAmount).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">SHIELD</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Claimed</p>
              <p className="text-lg sm:text-2xl font-bold font-mono text-orange-500" data-testid="text-total-claimed">
                {Number(rootData.totalClaimed || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">SHIELD</p>
            </div>
            <div className="rounded-lg border bg-card/50 backdrop-blur-sm p-2 sm:p-4">
              <p className="text-xs text-muted-foreground">Claimants</p>
              <p className="text-lg sm:text-2xl font-bold font-mono" data-testid="text-claimed-count">
                {rootData.claimedCount || 0} / {rootData.totalEntries}
              </p>
              <p className="text-xs text-muted-foreground">addresses</p>
            </div>
          </div>
        )}
      </div>

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
              <h2 className="text-2xl font-bold">You're Eligible!</h2>
              <p className="text-muted-foreground">
                You can claim{" "}
                <span className="font-bold text-foreground">
                  {Number(eligibility?.amount || 0).toLocaleString()} SHIELD
                </span>{" "}
                tokens
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                Transaction Details
              </h3>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You will receive:</span>
                  <span className="font-bold font-mono">
                    {Number(eligibility?.amount || 0).toLocaleString()} SHIELD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="font-medium">
                    Flare Mainnet
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
                  <span className="text-xs">Paid in FLR (approx $0.01)</span>
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleClaim}
              disabled={isClaiming}
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
                  Claim {Number(eligibility?.amount || 0).toLocaleString()} SHIELD
                </>
              )}
            </Button>
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

      <Alert className="border-muted-foreground/20 bg-muted/50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          <strong>Important:</strong> This is a one-time community reward for early
          supporters. $SHIELD has no promised value and is not a security. Participation is
          voluntary and at your own risk. XRPL users: Use Bifrost for easy Flare claims.
        </AlertDescription>
      </Alert>

      <ConnectWalletModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onConnect={() => {}}
      />
    </div>
  );
}
