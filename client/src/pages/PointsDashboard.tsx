import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Medal,
  Coins,
  Crown,
  Star,
  Sparkles,
  Gift,
  Users,
  Share2,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Wallet,
  TrendingUp,
  Zap,
  ArrowUpRight,
  Droplets,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import EmptyState from "@/components/EmptyState";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import type { UserPoints, TestnetActivity, UserTier } from "@shared/schema";
import { TIER_CONFIG, POINTS_CONFIG } from "@shared/schema";
import { format } from "date-fns";

interface UserPointsWithRank extends UserPoints {
  rank: number;
  nextTierProgress?: {
    currentTier: UserTier;
    nextTier: UserTier | null;
    pointsNeeded: number;
    progressPercent: number;
  };
}

interface ActivitiesResponse {
  activities: TestnetActivity[];
}

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

function getActivityIcon(activityType: string) {
  const iconMap: Record<string, typeof Coins> = {
    deposit: Coins,
    first_deposit: Gift,
    withdrawal: ArrowUpRight,
    stake_shield: Zap,
    bridge_xrpl_flare: ArrowRight,
    bridge_flare_xrpl: ArrowRight,
    referral: Users,
    bug_report: Star,
    social_share: Share2,
    daily_login: TrendingUp,
    swap: ArrowRight,
    boost_activated: Zap,
    faucet_claim: Droplets,
  };
  return iconMap[activityType] || Coins;
}

function getActivityLabel(activityType: string) {
  return POINTS_CONFIG[activityType as keyof typeof POINTS_CONFIG]?.description || activityType;
}

export default function PointsDashboard() {
  const { address, evmAddress, isConnected } = useWallet();
  const { isTestnet } = useNetwork();
  const { toast } = useToast();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [pendingShareId, setPendingShareId] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sharePosted, setSharePosted] = useState(false);
  
  const walletAddress = address || evmAddress;

  const { data: userPointsData, isLoading: isLoadingPoints } = useQuery<UserPointsWithRank>({
    queryKey: ["/api/points", walletAddress],
    enabled: !!walletAddress,
  });

  const { data: activitiesData, isLoading: isLoadingActivities } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/points", walletAddress, "activities"],
    enabled: !!walletAddress,
  });

  useEffect(() => {
    const fetchPendingShares = async () => {
      if (!walletAddress) return;
      
      try {
        const response = await fetch(`/api/twitter/pending-shares/${walletAddress}`);
        const data = await response.json();
        
        if (data.success && data.pendingShares && data.pendingShares.length > 0) {
          const latestPending = data.pendingShares[0];
          setPendingShareId(latestPending.id);
          setSharePosted(true);
        }
      } catch (error) {
        console.error('Failed to fetch pending shares:', error);
      }
    };

    fetchPendingShares();
  }, [walletAddress]);

  const handleShareOnX = async () => {
    if (!userPointsData || !userPointsData.referralCode) {
      toast({
        title: "Error",
        description: "Unable to share. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/twitter/share-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          type: 'referral',
          referralCode: userPointsData.referralCode,
        }),
      });

      const data = await response.json();

      if (data.success && data.shareUrl) {
        window.open(data.shareUrl, '_blank', 'noopener,noreferrer');
        
        if (data.pendingShareId) {
          setPendingShareId(data.pendingShareId);
          setSharePosted(true);
          toast({
            title: "Share Posted!",
            description: "Click 'Verify Post' after sharing to earn points.",
          });
        } else {
          toast({
            title: "Share on X",
            description: "Complete your post on X to earn points.",
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
        setPendingShareId(null);
        setSharePosted(false);
        toast({
          title: "Verified!",
          description: `You earned ${verifyData.pointsAwarded || 10} points for sharing!`,
        });
      } else {
        toast({
          title: "Verification Failed",
          description: verifyData.error || "Could not verify your share. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verify error:', error);
      toast({
        title: "Error",
        description: "Failed to verify share. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getExplorerUrl = (txHash: string) => {
    return isTestnet
      ? `https://coston2-explorer.flare.network/tx/${txHash}`
      : `https://flarescan.com/tx/${txHash}`;
  };

  if (!isConnected) {
    return (
      <>
        <EmptyState
          icon={Wallet}
          title="Points Dashboard"
          description="Connect your wallet to view your testnet points and activity"
          actionButton={{
            label: "Connect Wallet",
            onClick: () => setConnectModalOpen(true),
            testId: "button-connect-wallet-points"
          }}
          testId="connect-wallet-points-empty"
        />
        <ConnectWalletModal
          open={connectModalOpen}
          onOpenChange={setConnectModalOpen}
        />
      </>
    );
  }

  const pointsBreakdown = userPointsData ? [
    { label: "Deposits", value: userPointsData.depositPoints, icon: Coins },
    { label: "Staking", value: userPointsData.stakingPoints, icon: Zap },
    { label: "Bridge", value: userPointsData.bridgePoints, icon: ArrowRight },
    { label: "Referrals", value: userPointsData.referralPoints, icon: Users },
    { label: "Bug Reports", value: userPointsData.bugReportPoints, icon: Star },
    { label: "Social", value: userPointsData.socialPoints, icon: Share2 },
    { label: "Other", value: userPointsData.otherPoints, icon: Gift },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="space-y-6">
      <Link href="/app/airdrop">
        <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-to-airdrop">
          <ArrowLeft className="h-4 w-4" />
          Back to Airdrop
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="rounded-lg bg-primary/20 p-3">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Points Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track your testnet activity and earn points for the airdrop
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className={`lg:col-span-2 ${userPointsData ? tierBorderColors[userPointsData.tier] : ""} border-2`} data-testid="card-points-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Points Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPoints ? (
              <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : userPointsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                  <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Points</p>
                    <p className="text-xl sm:text-3xl font-bold" data-testid="text-total-points">
                      {(userPointsData.totalPoints ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">Current Tier</p>
                    <div className="mt-1 sm:mt-2" data-testid="badge-current-tier">
                      {getTierBadge(userPointsData.tier, "lg")}
                    </div>
                  </div>
                  <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">Airdrop Multiplier</p>
                    <p className="text-xl sm:text-3xl font-bold text-primary" data-testid="text-multiplier">
                      {userPointsData.airdropMultiplier}x
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground">Leaderboard Rank</p>
                    <p className="text-xl sm:text-3xl font-bold" data-testid="text-rank">
                      #{userPointsData.rank || "—"}
                    </p>
                  </div>
                </div>

                {userPointsData.isOg && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium text-yellow-500">OG Status Active</span>
                    <span className="text-sm text-muted-foreground">— Early adopter bonus applied!</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Start participating to earn points!
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-sky-500/30 bg-sky-500/5" data-testid="card-referral">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-sky-500" />
              Share & Earn
            </CardTitle>
            <CardDescription>
              Share your personalized card on X to earn 10 points
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPoints ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : userPointsData?.referralCode ? (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-sky-500/30 shadow-lg">
                  <img 
                    src={`/api/share-card/${userPointsData.referralCode}?points=${userPointsData.totalPoints || 0}&tier=${userPointsData.tier || 'bronze'}`}
                    alt="Your personalized share card"
                    className="w-full h-auto"
                    data-testid="img-share-card-preview"
                  />
                </div>

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Your Referral Link</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm truncate flex-1" data-testid="text-referral-code">
                      {`${window.location.origin}/app?ref=${userPointsData.referralCode}`}
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        if (userPointsData.referralCode) {
                          const referralUrl = `${window.location.origin}/app?ref=${userPointsData.referralCode}`;
                          navigator.clipboard.writeText(referralUrl);
                          toast({
                            title: "Copied!",
                            description: "Referral link copied to clipboard",
                          });
                        }
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
                    Invite friends and earn <span className="font-bold text-primary">{POINTS_CONFIG.referral.base} points</span> per referral!
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                    onClick={handleShareOnX}
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

                {userPointsData.referredBy && (
                  <div className="pt-2 text-sm text-muted-foreground text-center">
                    Referred by: <span className="font-mono">{userPointsData.referredBy.slice(0, 10)}...</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Referral code will be generated after your first activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-tier-progress">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Tier Progress
          </CardTitle>
          <CardDescription>
            Reach higher tiers for better airdrop multipliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPoints ? (
            <Skeleton className="h-32 w-full" />
          ) : userPointsData ? (
            <div className="space-y-6">
              <div className="relative">
                <div className="flex justify-between mb-2">
                  {tierOrder.map((tier) => {
                    const isCurrentTier = tier === userPointsData.tier;
                    const isAchieved = tierOrder.indexOf(tier) <= tierOrder.indexOf(userPointsData.tier);
                    return (
                      <div 
                        key={tier} 
                        className={`text-center flex-1 ${isCurrentTier ? "font-bold" : ""}`}
                      >
                        <div className={`flex justify-center mb-1 ${isAchieved ? "" : "opacity-40"}`}>
                          {getTierBadge(tier)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {TIER_CONFIG[tier].minPoints.toLocaleString()} pts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {TIER_CONFIG[tier].multiplier}x
                        </p>
                      </div>
                    );
                  })}
                </div>
                
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all"
                    style={{ 
                      width: `${Math.min(100, (userPointsData.totalPoints / TIER_CONFIG.diamond.minPoints) * 100)}%`,
                      background: 'linear-gradient(to right, #ea580c 0%, #ea580c 10%, #9ca3af 10%, #9ca3af 40%, #eab308 40%, #eab308 80%, #22d3ee 80%, #22d3ee 100%)'
                    }}
                    data-testid="progress-tier-visual"
                  />
                </div>
              </div>

              {userPointsData.nextTierProgress && userPointsData.nextTierProgress.nextTier && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      Progress to {userPointsData.nextTierProgress.nextTier.charAt(0).toUpperCase() + userPointsData.nextTierProgress.nextTier.slice(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {(userPointsData.nextTierProgress.pointsNeeded ?? 0).toLocaleString()} points needed
                    </span>
                  </div>
                  <Progress 
                    value={userPointsData.nextTierProgress.progressPercent} 
                    className="h-2"
                    data-testid="progress-next-tier"
                  />
                </div>
              )}

              {!userPointsData.nextTierProgress?.nextTier && (
                <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
                  <Sparkles className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                  <p className="font-medium text-cyan-400">Maximum Tier Achieved!</p>
                  <p className="text-sm text-muted-foreground">You've reached Diamond tier with the highest multiplier.</p>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pointsBreakdown.length > 0 && (
        <Card data-testid="card-points-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Points Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {pointsBreakdown.map((item) => {
                const Icon = item.icon;
                const percentage = userPointsData ? Math.round((item.value / userPointsData.totalPoints) * 100) : 0;
                return (
                  <div key={item.label} className="p-2 sm:p-4 rounded-lg bg-muted/50" data-testid={`breakdown-${item.label.toLowerCase()}`}>
                    <div className="flex items-center gap-2 mb-1 sm:mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold">{(item.value ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{percentage}% of total</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-activity-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Activity History
          </CardTitle>
          <CardDescription>
            Your recent testnet activities and points earned
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activitiesData?.activities && activitiesData.activities.length > 0 ? (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitiesData.activities.map((activity) => {
                    const ActivityIcon = getActivityIcon(activity.activityType);
                    return (
                      <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="rounded-full bg-muted p-1.5 sm:p-2">
                              <ActivityIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs sm:text-base">{getActivityLabel(activity.activityType)}</p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge variant="secondary" className="font-mono text-xs sm:text-base">
                            +{activity.pointsEarned}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground hidden sm:table-cell text-xs sm:text-base">
                          {format(new Date(activity.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {activity.relatedTxHash ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              asChild
                              data-testid={`button-tx-${activity.id}`}
                            >
                              <a 
                                href={getExplorerUrl(activity.relatedTxHash)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No activities yet. Start using the platform to earn points!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
