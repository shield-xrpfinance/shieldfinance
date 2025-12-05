import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Coins,
  Trophy,
  Users,
  Repeat,
  Wallet,
  Share2,
  Gift,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Star,
  Crown,
  Zap,
  Target,
  Calendar,
  TrendingUp,
  Shield,
  Droplets,
} from "lucide-react";

const TIER_INFO = [
  { name: "Bronze", points: "0+", multiplier: "1x", color: "text-orange-600", bg: "bg-orange-500/10" },
  { name: "Silver", points: "500+", multiplier: "1.5x", color: "text-gray-400", bg: "bg-gray-400/10" },
  { name: "Gold", points: "2,000+", multiplier: "2x", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { name: "Diamond", points: "5,000+", multiplier: "3x", color: "text-cyan-400", bg: "bg-cyan-400/10" },
];

const EARNING_ACTIVITIES = [
  { activity: "Daily Login", points: "2 pts", description: "Connect your wallet once per day", icon: Calendar, frequency: "Daily" },
  { activity: "Token Swap", points: "15 pts", description: "Complete a swap on SparkDEX", icon: Repeat, frequency: "Per swap" },
  { activity: "Staking Rewards", points: "5 pts", description: "Hold an active staking position", icon: Droplets, frequency: "Daily" },
  { activity: "Referral Bonus", points: "50 pts", description: "When a friend joins using your code", icon: Users, frequency: "Per referral" },
  { activity: "Social Share", points: "10 pts", description: "Share on X and verify your post", icon: Share2, frequency: "Per verified share" },
];

export default function TestersGuide() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Shield className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold">Testnet Testers Guide</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Everything you need to know about earning points during testnet and how your participation will be rewarded on mainnet.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Why Participate in Testnet?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your testnet participation directly impacts your rewards when Shield Finance launches on mainnet. 
            Every action you take earns points that will determine your share of the <span className="font-bold text-primary">$SHIELD token airdrop</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-background border text-center">
              <Coins className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="font-medium">Earn Points</p>
              <p className="text-sm text-muted-foreground">Every action counts</p>
            </div>
            <div className="p-4 rounded-lg bg-background border text-center">
              <Crown className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Climb Tiers</p>
              <p className="text-sm text-muted-foreground">Unlock multipliers</p>
            </div>
            <div className="p-4 rounded-lg bg-background border text-center">
              <Gift className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Claim $SHIELD</p>
              <p className="text-sm text-muted-foreground">On mainnet launch</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            How to Earn Points
          </CardTitle>
          <CardDescription>
            Multiple ways to accumulate points during the testnet phase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {EARNING_ACTIVITIES.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover-elevate">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium">{item.activity}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {item.points}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {item.frequency}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Tier System & Multipliers
          </CardTitle>
          <CardDescription>
            Reach higher tiers for better airdrop multipliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TIER_INFO.map((tier) => (
              <div key={tier.name} className={`p-4 rounded-lg ${tier.bg} border text-center`}>
                <div className={`text-2xl font-bold ${tier.color}`}>{tier.name}</div>
                <p className="text-sm text-muted-foreground mt-1">{tier.points} pts</p>
                <Separator className="my-2" />
                <p className={`text-lg font-bold ${tier.color}`}>{tier.multiplier}</p>
                <p className="text-xs text-muted-foreground">Airdrop Multiplier</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-yellow-500">OG Status Bonus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Early adopters who joined during the initial testnet phase receive OG status, 
              granting automatic Gold tier access and a permanent boost to all point earnings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-500" />
            Mainnet Benefits
          </CardTitle>
          <CardDescription>
            How your testnet participation translates to mainnet rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">$SHIELD Token Airdrop</p>
                <p className="text-sm text-muted-foreground">
                  Your total points (multiplied by your tier) determine your share of the $SHIELD governance token airdrop at mainnet launch.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Governance Rights</p>
                <p className="text-sm text-muted-foreground">
                  $SHIELD holders can vote on protocol decisions, fee structures, and new vault strategies.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Staking Boost</p>
                <p className="text-sm text-muted-foreground">
                  Stake your $SHIELD tokens on mainnet to boost your vault yields by up to 2.5x.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Revenue Sharing</p>
                <p className="text-sm text-muted-foreground">
                  Protocol fees are distributed to $SHIELD stakers, creating a sustainable reward mechanism.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-background border">
            <p className="text-sm font-medium mb-2">Airdrop Calculation Example:</p>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge variant="outline">1,000 Points</Badge>
              <Zap className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">Gold Tier (2x)</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge className="bg-green-500">2,000 Weighted Points</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Your weighted points determine your proportional share of the total $SHIELD airdrop allocation.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                1
              </div>
              <div>
                <p className="font-medium">Connect Your Wallet</p>
                <p className="text-sm text-muted-foreground">Link your XRPL (Xaman) or EVM (MetaMask) wallet to start earning daily login points.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                2
              </div>
              <div>
                <p className="font-medium">Get Testnet Tokens</p>
                <p className="text-sm text-muted-foreground">Visit the Faucet page to claim free testnet FXRP and SHIELD tokens for testing.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                3
              </div>
              <div>
                <p className="font-medium">Deposit to Vaults</p>
                <p className="text-sm text-muted-foreground">Stake your testnet FXRP in liquid staking vaults to earn yield and daily staking points.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                4
              </div>
              <div>
                <p className="font-medium">Swap Tokens</p>
                <p className="text-sm text-muted-foreground">Use the Swap feature to exchange tokens and earn 15 points per successful swap.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                5
              </div>
              <div>
                <p className="font-medium">Share & Refer Friends</p>
                <p className="text-sm text-muted-foreground">Share your referral link on social media to earn bonus points for each new user.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/30 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-cyan-400" />
            Pro Tips for Maximum Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
              <span className="text-sm">Log in daily to collect your 2 bonus points consistently.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
              <span className="text-sm">Maintain an active staking position for passive daily points.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
              <span className="text-sm">Share your personalized card on X and verify to earn social points.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
              <span className="text-sm">Invite friends early — referral bonuses are substantial at 50 points each.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 mt-1 flex-shrink-0" />
              <span className="text-sm">Reach Gold tier (2,000 pts) to double your airdrop allocation.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground py-4">
        <p>Points earned during testnet will be snapshotted before mainnet launch.</p>
        <p className="mt-1">Stay tuned for announcements on the exact airdrop date and token distribution details.</p>
      </div>
    </div>
  );
}
