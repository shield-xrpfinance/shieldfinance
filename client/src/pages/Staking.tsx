import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useFlrBalance } from "@/hooks/useFlrBalance";
import { useComprehensiveBalance } from "@/hooks/useComprehensiveBalance";
import GlassStatsCard from "@/components/GlassStatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, TrendingUp, Lock, Unlock, Clock, Info, Coins } from "lucide-react";
import shieldLogo from "@assets/shield_logo_1763761188895.png";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { queryClient } from "@/lib/queryClient";

// Type for staking API response
interface StakingApiResponse {
  amount: string;
  stakedAt: string;
  unlockTime: string;
  boostPercentage: number;
  isLocked: boolean;
}

export default function Staking() {
  const { evmAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const { balance: flrBalance } = useFlrBalance();
  const { shield: shieldBalance, isLoading: balancesLoading } = useComprehensiveBalance();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");

  // Fetch user's staking info from real API
  const { data: stakeInfo, isLoading } = useQuery<StakingApiResponse>({
    queryKey: ['/api/staking', evmAddress],
    queryFn: async () => {
      const response = await fetch(`/api/staking/${evmAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch staking info');
      }
      return response.json();
    },
    enabled: !!evmAddress,
  });

  // Calculate derived values from real API response
  const stakedBalance = stakeInfo?.amount ? parseFloat(stakeInfo.amount) / 1e18 : 0;
  const boostPercentage = stakeInfo?.boostPercentage || 0;
  const unlockTime = stakeInfo?.unlockTime ? parseFloat(stakeInfo.unlockTime) : 0;
  const isLocked = stakeInfo?.isLocked ?? false; // Use backend-validated lock status
  const timeUntilUnlock = isLocked ? unlockTime - Math.floor(Date.now() / 1000) : 0;

  // Format countdown timer
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Unlocked";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Live countdown timer
  const [timeRemaining, setTimeRemaining] = useState(formatTimeRemaining(timeUntilUnlock));

  useEffect(() => {
    if (!isLocked) {
      setTimeRemaining("Unlocked");
      return;
    }

    const interval = setInterval(() => {
      const remaining = unlockTime - Math.floor(Date.now() / 1000);
      setTimeRemaining(formatTimeRemaining(remaining));
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [unlockTime, isLocked]);

  const stakeMutation = useMutation({
    mutationFn: async (amount: string) => {
      const res = await fetch("/api/staking/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: evmAddress, amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      // Invalidate staking query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/staking', evmAddress] });
      toast({
        title: "Stake Successful",
        description: "Your SHIELD tokens have been staked for 30 days",
      });
      setStakeAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Stake Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: async (amount: string) => {
      const res = await fetch("/api/staking/unstake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: evmAddress, amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      // Invalidate staking query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/staking', evmAddress] });
      toast({
        title: "Unstake Successful",
        description: "Your SHIELD tokens have been returned",
      });
      setUnstakeAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Unstake Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid stake amount",
        variant: "destructive",
      });
      return;
    }
    stakeMutation.mutate(stakeAmount);
  };

  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid unstake amount",
        variant: "destructive",
      });
      return;
    }
    if (isLocked) {
      toast({
        title: "Tokens Locked",
        description: `Your tokens are locked for ${timeRemaining}`,
        variant: "destructive",
      });
      return;
    }
    unstakeMutation.mutate(unstakeAmount);
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Connect your wallet to stake SHIELD tokens and boost your shXRP APY
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <img 
            src={shieldLogo} 
            alt="Shield Finance" 
            className="h-10 w-10"
            data-testid="logo-staking-header"
          />
          SHIELD Staking
        </h1>
        <p className="text-muted-foreground text-lg">
          Stake SHIELD tokens to boost your shXRP APY rewards
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-8 border-primary/20 bg-primary/5 backdrop-blur-md">
        <Info className="h-5 w-5 text-primary" />
        <AlertDescription className="text-base ml-2">
          <strong>Boost Formula:</strong> Stake 100 SHIELD = +1% APY on all your shXRP deposits. 
          Example: 500 SHIELD staked = +5% APY boost!
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <GlassStatsCard
            label="Your SHIELD Balance"
            value={parseFloat(shieldBalance).toFixed(4)}
            icon={<img src={shieldLogo} alt="Shield" className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Your Staked Balance"
            value={`${stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SHIELD`}
            icon={<img src={shieldLogo} alt="Shield" className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Current APY Boost"
            value={`+${boostPercentage}%`}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Lock Status"
            value={isLocked ? timeRemaining : "Unlocked"}
            icon={isLocked ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
          />
        </div>
      )}

      {/* Staking Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stake Card */}
        <Card className="backdrop-blur-md bg-card/95 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src={shieldLogo} alt="Shield" className="h-5 w-5" />
              Stake SHIELD
            </CardTitle>
            <CardDescription>
              Lock your SHIELD tokens for 30 days to earn APY boosts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stake-amount">Amount to Stake</Label>
              <Input
                id="stake-amount"
                type="number"
                placeholder="100"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0"
                step="1"
                data-testid="input-stake-amount"
              />
              <p className="text-xs text-muted-foreground">
                Minimum: 1 SHIELD
              </p>
            </div>

            <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-accent mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">30-Day Lock Period</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your tokens will be locked for 30 days. You can add more SHIELD anytime, 
                    which will reset the lock period.
                  </p>
                </div>
              </div>
            </div>

            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-md">
                <p className="text-sm font-medium">Estimated Boost</p>
                <p className="text-2xl font-bold text-primary mt-1">
                  +{Math.floor(parseFloat(stakeAmount) / 100)}% APY
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  on all shXRP deposits
                </p>
              </div>
            )}

            <Button
              onClick={handleStake}
              className="w-full"
              size="lg"
              disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || stakeMutation.isPending}
              data-testid="button-stake"
            >
              {stakeMutation.isPending ? "Staking..." : "Lock for 30 Days"}
            </Button>
          </CardContent>
        </Card>

        {/* Unstake Card */}
        <Card className="backdrop-blur-md bg-card/95 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-muted-foreground" />
              Unstake SHIELD
            </CardTitle>
            <CardDescription>
              Withdraw your staked SHIELD tokens after the lock period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unstake-amount">Amount to Unstake</Label>
              <Input
                id="unstake-amount"
                type="number"
                placeholder="100"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                min="0"
                max={stakedBalance.toString()}
                step="1"
                disabled={isLocked}
                data-testid="input-unstake-amount"
              />
              <p className="text-xs text-muted-foreground">
                Available: {stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SHIELD
              </p>
            </div>

            {isLocked && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <Lock className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-destructive">Tokens Locked</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your tokens will unlock in {timeRemaining}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isLocked && stakedBalance > 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-start gap-2">
                  <Unlock className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-green-500">Ready to Unstake</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your lock period has ended. You can unstake anytime.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleUnstake}
              className="w-full"
              size="lg"
              variant="secondary"
              disabled={
                isLocked || 
                !unstakeAmount || 
                parseFloat(unstakeAmount) <= 0 || 
                parseFloat(unstakeAmount) > stakedBalance ||
                unstakeMutation.isPending
              }
              data-testid="button-unstake"
            >
              {unstakeMutation.isPending ? "Unstaking..." : "Unstake SHIELD"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* How It Works Section */}
      <Card className="mt-8 backdrop-blur-md bg-card/95 border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            How SHIELD Staking Boosts Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">🔒 Lock Period</h3>
              <p className="text-sm text-muted-foreground">
                Stake SHIELD for a 30-day lock period. During this time, your tokens cannot be withdrawn 
                but continue earning boost benefits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📈 Boost Formula</h3>
              <p className="text-sm text-muted-foreground">
                For every 100 SHIELD staked, you receive +1% APY boost on ALL your shXRP deposits. 
                Stake 500 SHIELD = +5% APY!
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">➕ Adding More</h3>
              <p className="text-sm text-muted-foreground">
                You can stake additional SHIELD anytime. Each stake extends the lock period by 30 days 
                from the last deposit.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">💰 Economic Flywheel</h3>
              <p className="text-sm text-muted-foreground">
                Higher shXRP APY → More deposits → More SHIELD demand → Buy pressure → 
                Deflationary tokenomics via buyback & burn.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-md">
            <h4 className="font-semibold text-sm mb-2">Example Scenario</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• You have 10,000 FXRP in shXRP vault earning 7% base APY</p>
              <p>• You stake 500 SHIELD tokens</p>
              <p>• Your boost: +5% APY (500 SHIELD / 100 = 5)</p>
              <p>• Your total APY: 7% + 5% = <span className="text-primary font-semibold">12% APY</span></p>
              <p>• Annual earnings increase: ~$500 additional per year!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
