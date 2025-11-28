import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/lib/walletContext";
import { useComprehensiveBalance } from "@/hooks/useComprehensiveBalance";
import { useStakingContract, OnChainStakeInfo } from "@/hooks/useStakingContract";
import GlassStatsCard from "@/components/GlassStatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, TrendingUp, Lock, Unlock, Clock, Info, ExternalLink, Loader2, Coins } from "lucide-react";
import { useShieldLogo } from "@/components/ShieldLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";

const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";
const BASE_SHXRP_APY = 6.2;

export default function Staking() {
  const shieldLogo = useShieldLogo();
  const { evmAddress, isConnected, isEvmConnected, walletConnectProvider } = useWallet();
  const { toast } = useToast();
  const { shield: shieldBalance, isLoading: balancesLoading } = useComprehensiveBalance();
  const stakingContract = useStakingContract();
  
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const { data: onChainStakeInfo, isLoading, refetch: refetchStakeInfo } = useQuery<OnChainStakeInfo | null>({
    queryKey: ['staking-contract', evmAddress],
    queryFn: () => stakingContract.getStakeInfo(),
    enabled: !!evmAddress && isEvmConnected,
    refetchInterval: 30000,
  });

  const stakedBalance = onChainStakeInfo?.amount 
    ? parseFloat(ethers.formatEther(onChainStakeInfo.amount)) 
    : 0;
  const boostPercentage = onChainStakeInfo?.boostBps 
    ? Number(onChainStakeInfo.boostBps) / 100 
    : 0;
  const unlockTime = onChainStakeInfo?.unlockTime 
    ? Number(onChainStakeInfo.unlockTime) 
    : 0;
  const isLocked = onChainStakeInfo?.isLocked ?? false;
  const timeUntilUnlock = isLocked ? unlockTime - Math.floor(Date.now() / 1000) : 0;

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Unlocked";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

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
        refetchStakeInfo();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [unlockTime, isLocked, refetchStakeInfo]);

  const handleStake = useCallback(async () => {
    console.log("handleStake called", { stakeAmount, isEvmConnected, hasProvider: !!walletConnectProvider, evmAddress });
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid stake amount",
        variant: "destructive",
      });
      return;
    }

    if (!isEvmConnected || !walletConnectProvider) {
      console.log("Wallet check failed:", { isEvmConnected, hasProvider: !!walletConnectProvider });
      toast({
        title: "EVM Wallet Required",
        description: "Please connect an EVM wallet (MetaMask, Trust Wallet, etc.) via WalletConnect. SHIELD staking is on the Flare EVM chain.",
        variant: "destructive",
      });
      return;
    }

    const availableBalance = parseFloat(shieldBalance);
    if (parseFloat(stakeAmount) > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${availableBalance.toFixed(4)} SHIELD available`,
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    setLastTxHash(null);

    try {
      console.log("About to call approveAndStake...", { 
        stakeAmount, 
        stakingContractType: typeof stakingContract,
        hasApproveAndStake: typeof stakingContract.approveAndStake
      });
      
      toast({
        title: "Staking in Progress",
        description: "Please approve the transaction in your wallet...",
      });

      console.log("Calling approveAndStake now...");
      const result = await stakingContract.approveAndStake(stakeAmount);
      console.log("approveAndStake returned:", result);

      if (result.success && result.txHash) {
        setLastTxHash(result.txHash);
        toast({
          title: "Stake Successful!",
          description: (
            <div className="flex flex-col gap-2">
              <span>Your SHIELD tokens have been staked for 30 days</span>
              <a 
                href={`${COSTON2_EXPLORER}/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary underline"
              >
                View transaction <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ),
        });
        setStakeAmount("");
        refetchStakeInfo();
      } else {
        toast({
          title: "Stake Failed",
          description: result.error || "Transaction failed",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Stake Failed",
        description: err.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  }, [stakeAmount, isEvmConnected, walletConnectProvider, shieldBalance, stakingContract, toast, refetchStakeInfo]);

  const handleUnstake = useCallback(async () => {
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

    if (!isEvmConnected || !walletConnectProvider) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect an EVM wallet via WalletConnect to unstake",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(unstakeAmount) > stakedBalance) {
      toast({
        title: "Insufficient Staked Balance",
        description: `You only have ${stakedBalance.toFixed(4)} SHIELD staked`,
        variant: "destructive",
      });
      return;
    }

    setIsUnstaking(true);
    setLastTxHash(null);

    try {
      toast({
        title: "Unstaking in Progress",
        description: "Please approve the transaction in your wallet...",
      });

      const result = await stakingContract.withdraw(unstakeAmount);

      if (result.success && result.txHash) {
        setLastTxHash(result.txHash);
        toast({
          title: "Unstake Successful!",
          description: (
            <div className="flex flex-col gap-2">
              <span>Your SHIELD tokens have been returned</span>
              <a 
                href={`${COSTON2_EXPLORER}/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary underline"
              >
                View transaction <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ),
        });
        setUnstakeAmount("");
        refetchStakeInfo();
      } else {
        toast({
          title: "Unstake Failed",
          description: result.error || "Transaction failed",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Unstake Failed",
        description: err.message || "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUnstaking(false);
    }
  }, [unstakeAmount, isLocked, timeRemaining, isEvmConnected, walletConnectProvider, stakedBalance, stakingContract, toast, refetchStakeInfo]);

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

  if (!isEvmConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">EVM Wallet Required</h2>
          <p className="text-muted-foreground text-center max-w-md">
            SHIELD staking requires an EVM-compatible wallet connected via WalletConnect. 
            Please disconnect and reconnect using WalletConnect with an EVM wallet (like MetaMask).
          </p>
          <Alert className="max-w-md border-primary/20 bg-primary/5">
            <Info className="h-5 w-5 text-primary" />
            <AlertDescription className="ml-2">
              The StakingBoost contract is deployed on Flare Coston2 testnet. 
              Make sure your wallet is connected to Coston2 (Chain ID: 114).
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
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

      <Alert className="mb-4 border-green-500/20 bg-green-500/5 backdrop-blur-md">
        <Info className="h-5 w-5 text-green-500" />
        <AlertDescription className="text-base ml-2">
          <strong>On-Chain Staking Active</strong> - Your stakes are secured by the StakingBoost smart contract 
          on Flare Coston2 testnet. All transactions require wallet signature.
        </AlertDescription>
      </Alert>

      <Alert className="mb-8 border-primary/20 bg-primary/5 backdrop-blur-md">
        <Info className="h-5 w-5 text-primary" />
        <AlertDescription className="text-base ml-2">
          <strong>Boost Formula:</strong> Stake 100 SHIELD = +1% APY on all your shXRP deposits. 
          Example: 500 SHIELD staked = +5% APY boost!
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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
            label="Effective shXRP APY"
            value={`${(BASE_SHXRP_APY + boostPercentage).toFixed(1)}%`}
            icon={<Coins className="h-6 w-6 text-green-500" />}
          />
          <GlassStatsCard
            label="Lock Status"
            value={isLocked ? timeRemaining : "Unlocked"}
            icon={isLocked ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
          />
        </div>
      )}

      {stakedBalance > 0 && (
        <Card className="mb-8 backdrop-blur-md bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/20">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Your Rewards Are Active</h3>
                <p className="text-sm text-muted-foreground">
                  Your {stakedBalance.toLocaleString()} SHIELD stake gives you +{boostPercentage}% APY boost. 
                  Combined with the base {BASE_SHXRP_APY}% APY, your shXRP deposits earn <strong className="text-green-500">{(BASE_SHXRP_APY + boostPercentage).toFixed(1)}% APY</strong>.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">Rewards Accrue In</p>
                <p className="text-lg font-bold text-green-500">shXRP Vault</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                disabled={isStaking}
                data-testid="input-stake-amount"
              />
              <p className="text-xs text-muted-foreground">
                Available: {parseFloat(shieldBalance).toFixed(4)} SHIELD
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
              disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isStaking || parseFloat(stakeAmount) > parseFloat(shieldBalance)}
              data-testid="button-stake"
            >
              {isStaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Awaiting Wallet Approval...
                </>
              ) : (
                "Lock for 30 Days"
              )}
            </Button>
          </CardContent>
        </Card>

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
                disabled={isLocked || isUnstaking}
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
                isUnstaking
              }
              data-testid="button-unstake"
            >
              {isUnstaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Awaiting Wallet Approval...
                </>
              ) : (
                "Unstake SHIELD"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {lastTxHash && (
        <Alert className="mt-8 border-green-500/20 bg-green-500/5">
          <Info className="h-5 w-5 text-green-500" />
          <AlertDescription className="ml-2">
            <div className="flex items-center gap-2">
              <span>Last transaction:</span>
              <a 
                href={`${COSTON2_EXPLORER}/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary underline font-mono text-sm"
              >
                {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

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
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4" /> Lock Period
              </h3>
              <p className="text-sm text-muted-foreground">
                Stake SHIELD for a 30-day lock period. During this time, your tokens cannot be withdrawn 
                but continue earning boost benefits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Boost Formula
              </h3>
              <p className="text-sm text-muted-foreground">
                For every 100 SHIELD staked, you receive +1% APY boost on ALL your shXRP deposits. 
                Stake 500 SHIELD = +5% APY!
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" /> On-Chain Security
              </h3>
              <p className="text-sm text-muted-foreground">
                Your staked tokens are secured by the StakingBoost smart contract on Flare Coston2. 
                All transactions are verifiable on the blockchain.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> Contract Address
              </h3>
              <p className="text-sm text-muted-foreground">
                <a 
                  href={`${COSTON2_EXPLORER}/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline font-mono text-xs break-all"
                >
                  0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
                </a>
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-md">
            <h4 className="font-semibold text-sm mb-2">Example Scenario</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>You have 10,000 FXRP in shXRP vault earning 7% base APY</p>
              <p>You stake 500 SHIELD tokens</p>
              <p>Your boost: +5% APY (500 SHIELD / 100 = 5)</p>
              <p>Your total APY: 7% + 5% = <span className="text-primary font-semibold">12% APY</span></p>
              <p>Annual earnings increase: ~$500 additional per year!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
