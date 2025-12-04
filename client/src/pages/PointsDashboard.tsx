import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  Copy,
  Check,
  Share2,
  ExternalLink,
  ArrowRight,
  Wallet,
  TrendingUp,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
    pointsToNext: number;
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
  const [copied, setCopied] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  
  const walletAddress = address || evmAddress;

  const { data: userPointsData, isLoading: isLoadingPoints } = useQuery<UserPointsWithRank>({
    queryKey: ["/api/points", walletAddress],
    enabled: !!walletAddress,
  });

  const { data: activitiesData, isLoading: isLoadingActivities } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/points", walletAddress, "activities"],
    enabled: !!walletAddress,
  });

  const copyReferralCode = async () => {
    if (!userPointsData?.referralCode) return;
    
    try {
      await navigator.clipboard.writeText(userPointsData.referralCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  const shareReferral = () => {
    const referralLink = `${window.location.origin}/app?ref=${userPointsData?.referralCode}`;
    const text = `Join me on Shield Finance testnet and earn points for the upcoming airdrop! Use my referral code: ${userPointsData?.referralCode}`;
    
    if (navigator.share) {
      navigator.share({
        title: "Shield Finance Referral",
        text,
        url: referralLink,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${referralLink}`);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
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
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary/20 p-3">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Points Dashboard</h1>
          <p className="text-muted-foreground">
            Track your testnet activity and earn points for the airdrop
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Points</p>
                    <p className="text-3xl font-bold" data-testid="text-total-points">
                      {userPointsData.totalPoints.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Current Tier</p>
                    <div className="mt-2" data-testid="badge-current-tier">
                      {getTierBadge(userPointsData.tier, "lg")}
                    </div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Airdrop Multiplier</p>
                    <p className="text-3xl font-bold text-primary" data-testid="text-multiplier">
                      {userPointsData.airdropMultiplier}x
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Leaderboard Rank</p>
                    <p className="text-3xl font-bold" data-testid="text-rank">
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

        <Card data-testid="card-referral">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Referral Program
            </CardTitle>
            <CardDescription>
              Invite friends and earn {POINTS_CONFIG.referral.base} points per referral
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPoints ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : userPointsData?.referralCode ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Your Referral Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-lg" data-testid="text-referral-code">
                      {userPointsData.referralCode}
                    </code>
                    <Button 
                      size="icon" 
                      variant="outline" 
                      onClick={copyReferralCode}
                      data-testid="button-copy-referral"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Referrals</p>
                    <p className="text-2xl font-bold" data-testid="text-referral-count">
                      {userPointsData.referralCount}
                    </p>
                  </div>
                  <Button onClick={shareReferral} className="gap-2" data-testid="button-share-referral">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>

                {userPointsData.referredBy && (
                  <div className="pt-2 text-sm text-muted-foreground">
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
                    className="h-full bg-gradient-to-r from-orange-600 via-gray-400 via-yellow-500 to-cyan-400 transition-all"
                    style={{ 
                      width: `${Math.min(100, (userPointsData.totalPoints / TIER_CONFIG.diamond.minPoints) * 100)}%` 
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
                      {userPointsData.nextTierProgress.pointsToNext.toLocaleString()} points needed
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pointsBreakdown.map((item) => {
                const Icon = item.icon;
                const percentage = userPointsData ? Math.round((item.value / userPointsData.totalPoints) * 100) : 0;
                return (
                  <div key={item.label} className="p-4 rounded-lg bg-muted/50" data-testid={`breakdown-${item.label.toLowerCase()}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="text-xl font-bold">{item.value.toLocaleString()}</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="text-right">Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activitiesData.activities.map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.activityType);
                  return (
                    <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-muted p-2">
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{getActivityLabel(activity.activityType)}</p>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-mono">
                          +{activity.pointsEarned}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(new Date(activity.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
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
