import { useState, useEffect, useCallback, useMemo } from "react";
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
import { Shield, TrendingUp, Lock, Unlock, Clock, Info, ExternalLink, Loader2, Coins, HelpCircle, ArrowRight, Zap } from "lucide-react";
import { useShieldLogo } from "@/components/ShieldLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ethers } from "ethers";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getTooltipContent, TOOLTIP_CONTENT } from "@/lib/tooltipCopy";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Vault } from "@shared/schema";

const COSTON2_EXPLORER = "https://coston2-explorer.flare.network";

export default function Staking() {
  const shieldLogo = useShieldLogo();
  const { evmAddress, isConnected, isEvmConnected, walletConnectProvider, provider } = useWallet();
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

  const { data: vaults = [], isLoading: vaultsLoading } = useQuery<Vault[]>({
    queryKey: ["/api/vaults"],
  });

  const activeVaults = vaults.filter(v => !v.comingSoon && v.status === "active");
  
  const baseShxrpApy = useMemo(() => {
    const xrpVault = activeVaults.find(v => {
      const assetName = (v.asset ?? "").toLowerCase();
      const vaultName = (v.name ?? "").toLowerCase();
      return assetName.includes('xrp') || assetName.includes('fxrp') || vaultName.includes('xrp');
    });
    if (xrpVault?.apy) {
      const apyNum = parseFloat(xrpVault.apy);
      return isNaN(apyNum) ? 6.2 : apyNum;
    }
    return 6.2;
  }, [activeVaults]);

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
    const isReown = provider === "reown";
    const hasValidProvider = isReown || !!walletConnectProvider;
    console.log("handleStake called", { stakeAmount, isEvmConnected, hasProvider: hasValidProvider, evmAddress, provider });
    
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid stake amount",
        variant: "destructive",
      });
      return;
    }

    if (!isEvmConnected || !hasValidProvider) {
      console.log("Wallet check failed:", { isEvmConnected, hasProvider: hasValidProvider, provider });
      toast({
        title: "EVM Wallet Required",
        description: "Please connect an EVM wallet (MetaMask, Trust Wallet, etc.). SHIELD staking is on the Flare EVM chain.",
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
  }, [stakeAmount, isEvmConnected, walletConnectProvider, provider, shieldBalance, stakingContract, toast, refetchStakeInfo]);

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

    const isReown = provider === "reown";
    const hasValidProvider = isReown || !!walletConnectProvider;
    if (!isEvmConnected || !hasValidProvider) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect an EVM wallet to unstake",
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
  }, [unstakeAmount, isLocked, timeRemaining, isEvmConnected, walletConnectProvider, provider, stakedBalance, stakingContract, toast, refetchStakeInfo]);

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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
          <img 
            src={shieldLogo} 
            alt="Shield Finance" 
            className="h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10"
            data-testid="logo-staking-header"
          />
          SHIELD Staking
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Learn about SHIELD token"
              >
                <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{TOOLTIP_CONTENT.shield.token}</p>
            </TooltipContent>
          </Tooltip>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
          Stake SHIELD to boost your shXRP APY rewards
        </p>
      </div>

      <Alert className="mb-4 sm:mb-6 border-primary/20 bg-gradient-to-r from-green-500/5 to-primary/5 backdrop-blur-md">
        <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
        <AlertDescription className="text-xs sm:text-sm ml-2">
          <span className="hidden sm:inline"><strong>On-Chain Staking</strong> on Flare Coston2. </span>
          <strong className="sm:font-normal">Boost Formula:</strong> 100 SHIELD = +1% APY on shXRP deposits
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
          <Skeleton className="h-[88px] sm:h-[100px] lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl" />
          <Skeleton className="h-[88px] sm:h-[100px] lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl" />
          <Skeleton className="h-[88px] sm:h-[100px] lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl" />
          <Skeleton className="h-[88px] sm:h-[100px] lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl" />
          <Skeleton className="h-[88px] sm:h-[100px] lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl col-span-2 sm:col-span-1" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
          <GlassStatsCard
            label="SHIELD Balance"
            value={parseFloat(shieldBalance).toFixed(2)}
            icon={<img src={shieldLogo} alt="Shield" className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
            compact
          />
          <GlassStatsCard
            label="Staked"
            value={`${stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<img src={shieldLogo} alt="Shield" className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
            compact
          />
          <GlassStatsCard
            label="APY Boost"
            value={`+${boostPercentage}%`}
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
            compact
          />
          <GlassStatsCard
            label="Effective APY"
            value={`${(baseShxrpApy + boostPercentage).toFixed(1)}%`}
            icon={<Coins className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-green-500" />}
            compact
          />
          <GlassStatsCard
            label="Lock Status"
            value={isLocked ? timeRemaining : "Unlocked"}
            icon={isLocked ? <Lock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" /> : <Unlock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
            compact
          />
        </div>
      )}

      {stakedBalance > 0 && (
        <Card className="mb-4 sm:mb-6 backdrop-blur-md bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/30">
          <CardContent className="p-3 sm:p-4 lg:pt-6">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-full bg-green-500/20 flex-shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-semibold text-sm sm:text-base lg:text-lg">Rewards Active</h3>
                  <Badge variant="outline" className="text-green-500 border-green-500/50 text-[10px] sm:text-xs">
                    +{boostPercentage}% Boost
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  <span className="hidden sm:inline">{stakedBalance.toLocaleString()} SHIELD staked. </span>
                  Total shXRP APY: <strong className="text-green-500">{(baseShxrpApy + boostPercentage).toFixed(1)}%</strong>
                </p>
              </div>
              <div className="text-right hidden md:block flex-shrink-0">
                <p className="text-xs text-muted-foreground">Rewards In</p>
                <p className="text-sm lg:text-lg font-bold text-green-500">shXRP Vault</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 sm:mb-6 lg:mb-8 backdrop-blur-md bg-card/95 border-2" data-testid="card-boost-impact">
        <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">Boost Impact</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Learn about boost effect"
                  data-testid="tooltip-shield-boost"
                >
                  <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{TOOLTIP_CONTENT.shield.boostEffect}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            How SHIELD staking boosts your vault APY
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="p-2 sm:p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">Boost</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex"
                      aria-label="Learn about boost formula"
                      data-testid="tooltip-boost-formula"
                    >
                      <HelpCircle className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{TOOLTIP_CONTENT.shield.boostFormula}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary font-mono tabular-nums">
                +{boostPercentage.toFixed(1)}%
              </p>
            </div>
            <div className="p-2 sm:p-4 rounded-lg bg-muted/50 border">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Example</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2" data-testid="text-boost-example">
                <span className="text-sm sm:text-lg font-semibold font-mono tabular-nums">8%</span>
                <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground hidden sm:block" />
                <span className="text-sm sm:text-lg font-semibold font-mono tabular-nums text-chart-2">
                  {(8 * (1 + boostPercentage / 100)).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-2 sm:p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-1 sm:gap-2 mb-1">
                <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground">Max</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex"
                      aria-label="Learn about maximum boost"
                    >
                      <HelpCircle className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{TOOLTIP_CONTENT.shield.maxBoost}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-muted-foreground font-mono tabular-nums">
                25%
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <h4 className="font-semibold text-xs sm:text-sm">Vault Yield Preview</h4>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Learn about SHIELD staking"
                  >
                    <HelpCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{TOOLTIP_CONTENT.shield.staking}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {vaultsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 sm:h-10 w-full" />
                <Skeleton className="h-8 sm:h-10 w-full" />
              </div>
            ) : activeVaults.length > 0 ? (
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%] sm:w-[40%] px-2 sm:px-4">Vault</TableHead>
                      <TableHead className="text-right px-2 sm:px-4">Base</TableHead>
                      <TableHead className="text-right px-2 sm:px-4">
                        <span className="hidden sm:inline">Boosted</span>
                        <span className="sm:hidden">Boost</span>
                      </TableHead>
                      <TableHead className="text-right hidden sm:table-cell px-2 sm:px-4">Extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeVaults.map((vault) => {
                      const baseApy = parseFloat(vault.apy);
                      const boostedApy = baseApy * (1 + boostPercentage / 100);
                      const extraYield = boostedApy - baseApy;
                      return (
                        <TableRow key={vault.id} data-testid={`row-vault-${vault.id}`}>
                          <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-4">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{vault.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums px-2 sm:px-4 py-2 sm:py-4">
                            {baseApy.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums px-2 sm:px-4 py-2 sm:py-4">
                            <span className={boostPercentage > 0 ? "text-chart-2 font-semibold" : ""}>
                              {boostedApy.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-4">
                            {boostPercentage > 0 ? (
                              <span className="text-chart-2">+{extraYield.toFixed(2)}%</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-4 sm:py-6 text-muted-foreground text-xs sm:text-sm">
                <p>No active vaults available</p>
              </div>
            )}

            {boostPercentage > 0 && activeVaults.length > 0 && (
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg bg-chart-2/10 border border-chart-2/20">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-chart-2 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">
                    +{boostPercentage.toFixed(1)}% boost on all {activeVaults.length} vaults
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <Card className="backdrop-blur-md bg-card/95 border-2">
          <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <img src={shieldLogo} alt="Shield" className="h-4 w-4 sm:h-5 sm:w-5" />
              Stake SHIELD
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Lock tokens for 30 days to earn APY boosts
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="stake-amount" className="text-xs sm:text-sm">Amount to Stake</Label>
              <Input
                id="stake-amount"
                type="number"
                placeholder="100"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="0"
                step="1"
                disabled={isStaking}
                className="h-9 sm:h-10"
                data-testid="input-stake-amount"
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Available: {parseFloat(shieldBalance).toFixed(2)} SHIELD
              </p>
            </div>

            <div className="p-2.5 sm:p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-accent mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs sm:text-sm">30-Day Lock</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    Tokens locked for 30 days. Adding more resets the lock.
                  </p>
                </div>
              </div>
            </div>

            {stakeAmount && parseFloat(stakeAmount) > 0 && (
              <div className="p-2.5 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-md">
                <p className="text-xs sm:text-sm font-medium">Estimated Boost</p>
                <p className="text-xl sm:text-2xl font-bold text-primary mt-0.5 sm:mt-1">
                  +{Math.floor(parseFloat(stakeAmount) / 100)}% APY
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                  on all shXRP deposits
                </p>
              </div>
            )}

            <Button
              onClick={handleStake}
              className="w-full"
              disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || isStaking || parseFloat(stakeAmount) > parseFloat(shieldBalance)}
              data-testid="button-stake"
            >
              {isStaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Awaiting Wallet...</span>
                  <span className="sm:hidden">Processing...</span>
                </>
              ) : (
                "Lock for 30 Days"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-card/95 border-2">
          <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Unlock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              Withdraw SHIELD
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Withdraw staked tokens after the lock period
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="withdraw-amount" className="text-xs sm:text-sm">Amount to Withdraw</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="100"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                min="0"
                max={stakedBalance.toString()}
                step="1"
                disabled={isLocked || isUnstaking}
                className="h-9 sm:h-10"
                data-testid="input-withdraw-amount"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Available: {stakedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} SHIELD
                </p>
                {stakedBalance > 0 && !isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] sm:text-xs text-primary"
                    onClick={() => setUnstakeAmount(stakedBalance.toString())}
                    data-testid="button-max-withdraw"
                  >
                    Max
                  </Button>
                )}
              </div>
            </div>

            {(() => {
              if (stakedBalance === 0) {
                return (
                  <div className="p-2.5 sm:p-4 rounded-lg bg-muted/50 border">
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">
                      Stake SHIELD first to have tokens available to withdraw
                    </p>
                  </div>
                );
              }
              if (isLocked) {
                return (
                  <div className="p-2.5 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm text-destructive">Tokens Locked</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                          Available to withdraw in {timeRemaining}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-2.5 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-2">
                    <Unlock className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm text-green-500">Ready to Withdraw</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        Lock period ended. Withdraw your SHIELD anytime.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Button
              onClick={handleUnstake}
              className="w-full"
              variant={!isLocked && stakedBalance > 0 ? "default" : "secondary"}
              disabled={
                isLocked || 
                stakedBalance === 0 ||
                !unstakeAmount || 
                parseFloat(unstakeAmount) <= 0 || 
                parseFloat(unstakeAmount) > stakedBalance ||
                isUnstaking
              }
              data-testid="button-withdraw"
            >
              {isUnstaking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Processing Withdrawal...</span>
                  <span className="sm:hidden">Processing...</span>
                </>
              ) : (
                "Withdraw SHIELD"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {lastTxHash && (
        <Alert className="mt-4 sm:mt-6 lg:mt-8 border-green-500/20 bg-green-500/5">
          <Info className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
          <AlertDescription className="ml-2 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <span>Transaction:</span>
              <a 
                href={`${COSTON2_EXPLORER}/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary underline font-mono text-[10px] sm:text-sm"
              >
                {lastTxHash.slice(0, 8)}...{lastTxHash.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mt-4 sm:mt-6 lg:mt-8 backdrop-blur-md bg-card/95 border-2">
        <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Info className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            How Staking Boosts Work
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <div className="p-2.5 sm:p-4 rounded-lg bg-muted/30 border">
              <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <Lock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> Lock Period
              </h3>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                30-day lock. Tokens earn boost benefits during lock.
              </p>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-muted/30 border">
              <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> Formula
              </h3>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                100 SHIELD = +1% APY on all shXRP deposits.
              </p>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-muted/30 border">
              <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> Security
              </h3>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
                On-chain StakingBoost contract on Flare Coston2.
              </p>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-muted/30 border">
              <h3 className="font-semibold text-xs sm:text-sm mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" /> Contract
              </h3>
              <a 
                href={`${COSTON2_EXPLORER}/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline font-mono text-[8px] sm:text-[10px] lg:text-xs break-all"
              >
                0xC7C50...2B4
              </a>
            </div>
          </div>

          <div className="p-2.5 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur-md">
            <h4 className="font-semibold text-xs sm:text-sm mb-1.5 sm:mb-2">Example</h4>
            <div className="space-y-0.5 sm:space-y-1 text-[10px] sm:text-xs lg:text-sm text-muted-foreground">
              <p>10,000 FXRP in shXRP vault @ 7% base APY</p>
              <p>+ 500 SHIELD staked = +5% boost</p>
              <p className="font-medium text-foreground">Total: <span className="text-primary">12% APY</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
