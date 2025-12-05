import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
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
  Users,
  Coins,
  Crown,
  Star,
  Sparkles,
  Award,
  ArrowLeft,
} from "lucide-react";
import type { UserPoints, UserTier } from "@shared/schema";
import { TIER_CONFIG } from "@shared/schema";

interface LeaderboardEntry {
  walletAddress: string;
  totalPoints: number;
  tier: UserTier;
  isOg: boolean;
  rank: number;
}

interface LeaderboardStats {
  totalParticipants: number;
  totalPointsDistributed: number;
  tierBreakdown: Record<UserTier, number>;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  stats: LeaderboardStats;
}

interface UserPointsWithRank extends UserPoints {
  rank: number;
  nextTierProgress?: {
    currentTier: UserTier;
    nextTier: UserTier | null;
    pointsNeeded: number;
    progressPercent: number;
  };
}

const tierColors: Record<UserTier, string> = {
  bronze: "bg-orange-600 text-white",
  silver: "bg-gray-400 text-gray-900",
  gold: "bg-yellow-500 text-yellow-900",
  diamond: "bg-cyan-400 text-cyan-900",
};

const tierIcons: Record<UserTier, typeof Trophy> = {
  bronze: Medal,
  silver: Star,
  gold: Crown,
  diamond: Sparkles,
};

function getTierBadge(tier: UserTier) {
  const TierIcon = tierIcons[tier];
  return (
    <Badge className={`${tierColors[tier]} gap-1`} data-testid={`badge-tier-${tier}`}>
      <TierIcon className="h-3 w-3" />
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function getRankDisplay(rank: number) {
  if (rank === 1) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-yellow-500/20 p-1">
          <Trophy className="h-4 w-4 text-yellow-500" />
        </div>
        <span className="font-bold text-yellow-500">1st</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-gray-400/20 p-1">
          <Medal className="h-4 w-4 text-gray-400" />
        </div>
        <span className="font-bold text-gray-400">2nd</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-orange-600/20 p-1">
          <Medal className="h-4 w-4 text-orange-600" />
        </div>
        <span className="font-bold text-orange-600">3rd</span>
      </div>
    );
  }
  return <span className="font-mono text-muted-foreground">#{rank}</span>;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Leaderboard() {
  const { address, evmAddress, isConnected } = useWallet();
  const walletAddress = address || evmAddress;

  const { data: leaderboardData, isLoading: isLoadingLeaderboard } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: userPointsData, isLoading: isLoadingUserPoints } = useQuery<UserPointsWithRank>({
    queryKey: ["/api/points", walletAddress],
    enabled: !!walletAddress,
  });

  const stats = leaderboardData?.stats;
  const leaderboard = leaderboardData?.leaderboard || [];

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
          <h1 className="text-xl sm:text-2xl font-bold">Testnet Leaderboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Compete for points and climb the ranks during testnet
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-participants">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-participants">
                {stats?.totalParticipants?.toLocaleString() ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-points">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points Distributed</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-points">
                {stats?.totalPointsDistributed?.toLocaleString() ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-tier-breakdown">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tier Breakdown</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="badges-tier-breakdown">
                {stats?.tierBreakdown && Object.entries(stats.tierBreakdown).map(([tier, count]) => (
                  <Badge key={tier} variant="secondary" className="gap-1">
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isConnected && walletAddress && (
        <Card className="border-primary/50 bg-primary/5" data-testid="card-your-rank">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              Your Rank
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingUserPoints ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : userPointsData ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
                  <div className="grid grid-cols-3 gap-4 flex-1 sm:flex sm:items-center sm:gap-4">
                    <div className="text-center">
                      <p className="text-xs sm:text-sm text-muted-foreground">Rank</p>
                      <p className="text-2xl sm:text-3xl font-bold" data-testid="text-user-rank">
                        #{userPointsData.rank || "—"}
                      </p>
                    </div>
                    <div className="hidden sm:block w-px h-12 bg-border" />
                    <div className="text-center">
                      <p className="text-xs sm:text-sm text-muted-foreground">Points</p>
                      <p className="text-2xl sm:text-3xl font-bold" data-testid="text-user-points">
                        {(userPointsData.totalPoints ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="hidden sm:block w-px h-12 bg-border" />
                    <div className="text-center">
                      <p className="text-xs sm:text-sm text-muted-foreground">Tier</p>
                      <div className="mt-1" data-testid="badge-user-tier">
                        {getTierBadge(userPointsData.tier)}
                      </div>
                    </div>
                  </div>
                  {userPointsData.isOg && (
                    <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500 w-full sm:w-auto justify-center">
                      <Sparkles className="h-3 w-3" />
                      OG Status
                    </Badge>
                  )}
                </div>

                {userPointsData.nextTierProgress && userPointsData.nextTierProgress.nextTier && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Progress to {userPointsData.nextTierProgress.nextTier.charAt(0).toUpperCase() + userPointsData.nextTierProgress.nextTier.slice(1)}
                      </span>
                      <span className="font-medium">
                        {(userPointsData.nextTierProgress.pointsNeeded ?? 0).toLocaleString()} points to go
                      </span>
                    </div>
                    <Progress 
                      value={userPointsData.nextTierProgress.progressPercent} 
                      className="h-2"
                      data-testid="progress-tier"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No points data available yet. Start participating to earn points!</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-leaderboard-table">
        <CardHeader>
          <CardTitle>Top Testers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLeaderboard ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No participants yet. Be the first to earn points!
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 sm:w-24">Rank</TableHead>
                    <TableHead className="min-w-24">Wallet</TableHead>
                    <TableHead className="text-right min-w-20">Points</TableHead>
                    <TableHead className="text-center hidden sm:table-cell min-w-20">Tier</TableHead>
                    <TableHead className="text-center hidden md:table-cell min-w-16">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, index) => {
                    const isCurrentUser = walletAddress && (
                      entry.walletAddress.toLowerCase() === walletAddress.toLowerCase()
                    );
                    return (
                      <TableRow 
                        key={entry.walletAddress}
                        className={isCurrentUser ? "bg-primary/10" : undefined}
                        data-testid={`row-leaderboard-${index}`}
                      >
                        <TableCell className="text-xs sm:text-base">{getRankDisplay(entry.rank)}</TableCell>
                        <TableCell className="text-xs sm:text-base">
                          <span className="font-mono" data-testid={`text-wallet-${index}`}>
                            {truncateAddress(entry.walletAddress)}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">You</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs sm:text-base" data-testid={`text-points-${index}`}>
                          {(entry.totalPoints ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {getTierBadge(entry.tier)}
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          {entry.isOg ? (
                            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500 text-xs">
                              <Sparkles className="h-3 w-3" />
                              OG
                            </Badge>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
