import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useFlrBalance } from "@/hooks/useFlrBalance";
import { useComprehensiveBalance } from "@/hooks/useComprehensiveBalance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownUp, TrendingUp, Info, Sparkles, Shield, AlertTriangle, ExternalLink, Loader2, Coins } from "lucide-react";
import shieldLogo from "@assets/shield_logo_1763761188895.png";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GlassStatsCard from "@/components/GlassStatsCard";
import confetti from "canvas-confetti";
import { ethers } from "ethers";
import {
  getContracts,
  validateContracts,
  ROUTER_ABI,
  ERC20_ABI,
  getSwapQuote,
  applySlippage,
  getDeadline,
  formatTokenAmount,
  parseTokenAmount,
  estimatePriceImpact,
} from "@/lib/sparkdex";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { AssetSelector, type SwapAsset } from "@/components/AssetSelector";

// USDT (Stargate) addresses on Flare Network
const USDT_ADDRESSES = {
  mainnet: "0x9C3046C0DaA60b6F061f123CccfC29B7920d0d4f",
  testnet: "0x3E8B8d9B9ee8C1E0D6d10Ea03e1F6eB8e3d1e8a0",
};

export default function Swap() {
  const { evmAddress, isEvmConnected, walletConnectProvider } = useWallet();
  const { isTestnet, network } = useNetwork();
  const { toast } = useToast();
  const { balance: flrBalance } = useFlrBalance();
  const balances = useComprehensiveBalance();

  const contracts = getContracts(isTestnet);
  const isConfigured = validateContracts(contracts);

  // Swap direction: true = buy SHIELD, false = sell SHIELD
  const [isBuyingShield, setIsBuyingShield] = useState(true);

  // Define all tradeable assets
  const allAssets: SwapAsset[] = useMemo(() => [
    {
      symbol: "FLR",
      name: "Flare",
      address: "0x0000000000000000000000000000000000000000", // Native token
      decimals: 18,
      isNative: true,
    },
    {
      symbol: "WFLR",
      name: "Wrapped Flare",
      address: contracts.WFLR,
      decimals: 18,
      isNative: false,
    },
    {
      symbol: "USDT",
      name: "Bridged USDT",
      address: network === "testnet" ? USDT_ADDRESSES.testnet : USDT_ADDRESSES.mainnet,
      decimals: 6,
      isNative: false,
    },
    {
      symbol: "SHIELD",
      name: "Shield Finance",
      address: contracts.SHIELD_TOKEN,
      decimals: 18,
      isNative: false,
    },
  ], [contracts.WFLR, contracts.SHIELD_TOKEN, network]);

  // Get available assets based on swap direction
  const availableInputAssets = useMemo(() => {
    if (isBuyingShield) {
      return allAssets.filter(a => a.symbol !== "SHIELD");
    } else {
      return allAssets.filter(a => a.symbol === "SHIELD");
    }
  }, [isBuyingShield, allAssets]);

  const availableOutputAssets = useMemo(() => {
    if (isBuyingShield) {
      return allAssets.filter(a => a.symbol === "SHIELD");
    } else {
      return allAssets.filter(a => a.symbol !== "SHIELD");
    }
  }, [isBuyingShield, allAssets]);

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [currentAllowance, setCurrentAllowance] = useState<bigint>(BigInt(0));
  const [selectedInputAsset, setSelectedInputAsset] = useState<SwapAsset>(availableInputAssets[0]);
  const [selectedOutputAsset, setSelectedOutputAsset] = useState<SwapAsset>(availableOutputAssets[0]);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [swappedAmount, setSwappedAmount] = useState("");
  const [pathValidationError, setPathValidationError] = useState<string>("");

  const slippageTolerance = 0.5; // 0.5% slippage
  
  // Conservative price impact estimation based on trade size
  const priceImpact = estimatePriceImpact(inputAmount);

  // Prepare balances for AssetSelector
  const assetBalances = {
    flr: balances.flr || "0",
    wflr: balances.wflr || "0",
    usdt: balances.usdt || "0",
    shield: balances.shield || "0",
  };

  // Format balance safely
  const formatBalance = (symbol: string): string => {
    const balance = assetBalances[symbol.toLowerCase() as keyof typeof assetBalances];
    if (!balance) return "0.0000";
    const parsed = parseFloat(balance);
    if (isNaN(parsed)) return "0.0000";
    return parsed.toFixed(4);
  };

  // Build swap path based on selected assets
  const buildSwapPath = (): string[] => {
    if (isBuyingShield) {
      // Buying SHIELD
      if (selectedInputAsset.symbol === "FLR") {
        return [contracts.WFLR, contracts.SHIELD_TOKEN];
      } else if (selectedInputAsset.symbol === "WFLR") {
        return [contracts.WFLR, contracts.SHIELD_TOKEN];
      } else if (selectedInputAsset.symbol === "USDT") {
        return [selectedInputAsset.address, contracts.WFLR, contracts.SHIELD_TOKEN];
      }
    } else {
      // Selling SHIELD
      if (selectedOutputAsset.symbol === "FLR" || selectedOutputAsset.symbol === "WFLR") {
        return [contracts.SHIELD_TOKEN, contracts.WFLR];
      } else if (selectedOutputAsset.symbol === "USDT") {
        return [contracts.SHIELD_TOKEN, contracts.WFLR, selectedOutputAsset.address];
      }
    }
    throw new Error(`Unsupported swap path: ${selectedInputAsset.symbol} → ${selectedOutputAsset.symbol}`);
  };

  // Validate swap path
  const validateSwapPath = (path: string[]): string | null => {
    // Check for USDT direct pairs (may not have liquidity)
    if (path.includes(USDT_ADDRESSES[network === "testnet" ? "testnet" : "mainnet"])) {
      if (path.length === 2 && !path.includes(contracts.WFLR)) {
        return "Direct USDT pairs may have limited liquidity. Route through WFLR recommended.";
      }
    }
    return null;
  };

  // Check allowance for ERC-20 tokens
  useEffect(() => {
    if (!evmAddress || !walletConnectProvider || !isConfigured || selectedInputAsset.isNative) {
      setNeedsApproval(false);
      return;
    }

    const checkAllowance = async () => {
      try {
        const provider = new ethers.BrowserProvider(walletConnectProvider);
        const token = new ethers.Contract(selectedInputAsset.address, ERC20_ABI, provider);
        const allowance = await token.allowance(evmAddress, contracts.SPARKDEX_ROUTER);
        setCurrentAllowance(allowance);
        
        if (inputAmount && parseFloat(inputAmount) > 0) {
          const inputAmountWei = parseTokenAmount(inputAmount, selectedInputAsset.decimals);
          setNeedsApproval(allowance < inputAmountWei);
        } else {
          setNeedsApproval(false);
        }
      } catch (error) {
        console.error("Failed to check allowance:", error);
        setNeedsApproval(false);
      }
    };

    checkAllowance();
  }, [evmAddress, walletConnectProvider, isConfigured, selectedInputAsset, inputAmount, contracts.SPARKDEX_ROUTER]);

  // Get real-time quote when input changes
  useEffect(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !evmAddress || !walletConnectProvider || !isConfigured) {
      setOutputAmount("");
      setPathValidationError("");
      return;
    }

    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setPathValidationError("");
      try {
        if (!walletConnectProvider) {
          console.error("🚨 [Swap] walletConnectProvider is null");
          setOutputAmount("");
          return;
        }

        const provider = new ethers.BrowserProvider(walletConnectProvider);
        const router = new ethers.Contract(contracts.SPARKDEX_ROUTER, ROUTER_ABI, provider);

        const inputAmountWei = parseTokenAmount(inputAmount, selectedInputAsset.decimals);
        const path = buildSwapPath();
        
        // Validate path
        const validationError = validateSwapPath(path);
        if (validationError) {
          setPathValidationError(validationError);
        }
        
        const outputWei = await getSwapQuote(router, inputAmountWei, path);
        const outputFormatted = formatTokenAmount(outputWei, selectedOutputAsset.decimals, 6);
        
        setOutputAmount(outputFormatted);
        
        // Calculate exchange rate
        const rate = parseFloat(outputFormatted) / parseFloat(inputAmount);
        setExchangeRate(rate);
      } catch (error) {
        console.error("🚨 [Swap] Failed to get quote:", error);
        setOutputAmount("");
        
        // Provide helpful error messages
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (errorMessage.includes("INSUFFICIENT_LIQUIDITY") || errorMessage.includes("execution reverted")) {
          setPathValidationError(`No liquidity pool exists for ${selectedInputAsset.symbol} → ${selectedOutputAsset.symbol}. Try a different pair.`);
        } else {
          toast({
            title: "Quote Error",
            description: errorMessage || "Unable to fetch price. Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [inputAmount, selectedInputAsset, selectedOutputAsset, evmAddress, walletConnectProvider, contracts, toast, isConfigured, isBuyingShield]);

  const handleApprove = async (unlimited: boolean = false) => {
    if (!evmAddress || !walletConnectProvider) return;

    setIsApproving(true);
    try {
      const provider = new ethers.BrowserProvider(walletConnectProvider);
      const signer = await provider.getSigner();
      const inputToken = new ethers.Contract(selectedInputAsset.address, ERC20_ABI, signer);

      const approvalAmount = unlimited 
        ? ethers.MaxUint256 
        : parseTokenAmount(inputAmount, selectedInputAsset.decimals);

      toast({
        title: "Approval Requested",
        description: unlimited 
          ? `Approving unlimited ${selectedInputAsset.symbol}...` 
          : `Approving ${inputAmount} ${selectedInputAsset.symbol}...`,
      });

      const approveTx = await inputToken.approve(contracts.SPARKDEX_ROUTER, approvalAmount);
      await approveTx.wait();

      setCurrentAllowance(approvalAmount);
      setNeedsApproval(false);

      toast({
        title: "Approval Successful",
        description: unlimited 
          ? `Unlimited ${selectedInputAsset.symbol} approved. You can now swap.`
          : `${selectedInputAsset.symbol} approved. You can now swap.`,
      });
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve token. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!evmAddress || !walletConnectProvider) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to swap",
        variant: "destructive",
      });
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid swap amount",
        variant: "destructive",
      });
      return;
    }

    if (pathValidationError) {
      toast({
        title: "Invalid Swap Path",
        description: pathValidationError,
        variant: "destructive",
      });
      return;
    }

    setIsSwapping(true);

    try {
      const provider = new ethers.BrowserProvider(walletConnectProvider);
      const signer = await provider.getSigner();
      const router = new ethers.Contract(contracts.SPARKDEX_ROUTER, ROUTER_ABI, signer);

      const inputAmountWei = parseTokenAmount(inputAmount, selectedInputAsset.decimals);
      const path = buildSwapPath();

      const outputWei = await getSwapQuote(router, inputAmountWei, path);
      const minOutputWei = applySlippage(outputWei, slippageTolerance);
      const deadline = getDeadline();

      let tx;

      if (isBuyingShield) {
        // Buying SHIELD
        if (selectedInputAsset.isNative) {
          // FLR → SHIELD (swapExactETHForTokens)
          tx = await router.swapExactETHForTokens(
            minOutputWei,
            path,
            evmAddress,
            deadline,
            { value: inputAmountWei }
          );
        } else {
          // ERC-20 → SHIELD (swapExactTokensForTokens)
          tx = await router.swapExactTokensForTokens(
            inputAmountWei,
            minOutputWei,
            path,
            evmAddress,
            deadline
          );
        }
      } else {
        // Selling SHIELD
        if (selectedOutputAsset.isNative) {
          // SHIELD → FLR (swapExactTokensForETH)
          tx = await router.swapExactTokensForETH(
            inputAmountWei,
            minOutputWei,
            path,
            evmAddress,
            deadline
          );
        } else {
          // SHIELD → ERC-20 (swapExactTokensForTokens)
          tx = await router.swapExactTokensForTokens(
            inputAmountWei,
            minOutputWei,
            path,
            evmAddress,
            deadline
          );
        }
      }

      toast({
        title: "Swap Submitted",
        description: "Waiting for confirmation...",
      });

      await tx.wait();

      // Success! Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setSwappedAmount(outputAmount);
      setSuccessModalOpen(true);
      setInputAmount("");
      setOutputAmount("");

      toast({
        title: "Swap Successful! 🎉",
        description: `Swapped ${inputAmount} ${selectedInputAsset.symbol} for ${outputAmount} ${selectedOutputAsset.symbol}`,
      });
    } catch (error: any) {
      console.error("Swap error:", error);
      const errorMsg = error.message || "Transaction failed. Please try again.";
      toast({
        title: "Swap Failed",
        description: errorMsg.includes("user rejected") ? "Transaction rejected by user" : errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  if (!isEvmConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Sparkles className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Connect your wallet with Flare Network support to swap for $SHIELD
          </p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <AlertTriangle className="h-16 w-16 text-yellow-500" />
          <h2 className="text-2xl font-semibold">Swap Not Available</h2>
          <p className="text-muted-foreground text-center max-w-md">
            $SHIELD token address not configured. Please set VITE_SHIELD_TOKEN_ADDRESS environment variable.
          </p>
          <Alert className="max-w-md border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2 text-sm">
              This feature will be available once $SHIELD is deployed on {isTestnet ? "Coston2 testnet" : "Flare mainnet"}.
            </AlertDescription>
          </Alert>
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
            data-testid="logo-swap-header"
          />
          Swap $SHIELD
        </h1>
        <p className="text-muted-foreground text-lg">
          Buy $SHIELD instantly and stake for APY boosts on your shXRP deposits
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-8 border-primary/20 bg-primary/5">
        <Info className="h-5 w-5 text-primary" />
        <AlertDescription className="text-base ml-2">
          <strong>Why buy $SHIELD?</strong> Stake 100 $SHIELD = +1% APY on all your shXRP positions.
          Every swap helps burn supply through trading fees, making $SHIELD deflationary! 🔥
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Swap Card */}
        <div className="lg:col-span-2">
          <Card className="backdrop-blur-md bg-card/95 border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownUp className="h-5 w-5 text-primary" />
                    Instant Swap
                  </CardTitle>
                  <CardDescription>
                    {isBuyingShield 
                      ? "Buy $SHIELD with FLR, WFLR, or USDT" 
                      : "Sell $SHIELD for FLR, WFLR, or USDT"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsBuyingShield(!isBuyingShield);
                    setInputAmount("");
                    setOutputAmount("");
                    setSelectedInputAsset(isBuyingShield ? allAssets[3] : allAssets[0]);
                    setSelectedOutputAsset(isBuyingShield ? allAssets[0] : allAssets[3]);
                  }}
                  data-testid="button-toggle-direction"
                >
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  {isBuyingShield ? "Sell" : "Buy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>You Pay</Label>
                  <span className="text-sm text-muted-foreground">
                    Balance: <span className="font-semibold text-foreground">
                      {formatBalance(selectedInputAsset.symbol)}
                    </span>
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    className="text-2xl font-semibold h-16 pr-40"
                    data-testid="input-swap-amount"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <AssetSelector
                      selectedAsset={selectedInputAsset}
                      availableAssets={availableInputAssets}
                      balances={assetBalances}
                      onSelectAsset={(asset) => {
                        setSelectedInputAsset(asset);
                        setInputAmount("");
                        setOutputAmount("");
                      }}
                      disabled={isSwapping || isApproving}
                    />
                  </div>
                </div>
              </div>

              {/* Arrow Separator with Swap Direction */}
              <div className="flex justify-center">
                <div className="rounded-full h-10 w-10 bg-muted flex items-center justify-center">
                  <ArrowDownUp className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              </div>

              {/* Output */}
              <div className="space-y-2">
                <Label>You Receive (estimated)</Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="0.0"
                    value={isLoadingQuote ? "Loading..." : outputAmount}
                    readOnly
                    className="text-2xl font-semibold h-16 pr-40 bg-muted/50"
                    data-testid="text-swap-output"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isBuyingShield ? (
                      <div className="bg-primary/10 px-3 py-1.5 rounded-md">
                        <span className="font-semibold">SHIELD</span>
                      </div>
                    ) : (
                      <AssetSelector
                        selectedAsset={selectedOutputAsset}
                        availableAssets={availableOutputAssets}
                        balances={assetBalances}
                        onSelectAsset={(asset) => {
                          setSelectedOutputAsset(asset);
                          setInputAmount("");
                          setOutputAmount("");
                        }}
                        disabled={isSwapping || isApproving}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Path Validation Error */}
              {pathValidationError && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    {pathValidationError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Price Impact Warning */}
              {priceImpact > 2 && (
                <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <strong>High Price Impact:</strong> ~{priceImpact.toFixed(1)}% estimated - Consider a smaller amount
                  </AlertDescription>
                </Alert>
              )}

              {/* Exchange Rate */}
              {exchangeRate > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  1 {selectedInputAsset.symbol} ≈ {exchangeRate.toFixed(6)} {selectedOutputAsset.symbol}
                  {priceImpact > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Est. impact: ~{priceImpact.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}

              {/* Approval UI */}
              {needsApproval && !selectedInputAsset.isNative && (
                <div className="space-y-2">
                  <Alert className="border-primary/20 bg-primary/5">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="ml-2">
                      <strong>Approval Required:</strong> You need to approve {selectedInputAsset.symbol} before swapping.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => handleApprove(false)}
                      disabled={isApproving || !inputAmount || parseFloat(inputAmount) <= 0}
                      data-testid="button-approve-exact"
                    >
                      {isApproving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <img src={shieldLogo} alt="Shield" className="mr-2 h-4 w-4" />
                      )}
                      Approve {inputAmount}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApprove(true)}
                      disabled={isApproving}
                      data-testid="button-approve-unlimited"
                    >
                      {isApproving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Approve Unlimited
                    </Button>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <Button
                onClick={handleSwap}
                disabled={
                  !inputAmount || 
                  parseFloat(inputAmount) <= 0 || 
                  isSwapping || 
                  isLoadingQuote || 
                  isApproving || 
                  needsApproval ||
                  !!pathValidationError
                }
                className="w-full h-14 text-lg font-semibold"
                data-testid="button-execute-swap"
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Swapping...
                  </>
                ) : needsApproval ? (
                  <>
                    <img src={shieldLogo} alt="Shield" className="mr-2 h-5 w-5" />
                    Approve {selectedInputAsset.symbol} First
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Swap {selectedInputAsset.symbol} for {selectedOutputAsset.symbol}
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Slippage tolerance: {slippageTolerance}% • Powered by SparkDEX V3
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-6">
          <GlassStatsCard
            label={`Your ${selectedInputAsset.symbol} Balance`}
            value={formatBalance(selectedInputAsset.symbol)}
            icon={<Coins className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Best Price"
            value="SparkDEX V3"
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Est. Price Impact"
            value={priceImpact > 0 ? `~${priceImpact.toFixed(1)}%` : "—"}
            icon={<Info className="h-6 w-6" />}
          />
          <GlassStatsCard
            label="Slippage Tolerance"
            value={`${slippageTolerance}%`}
            icon={<img src={shieldLogo} alt="Shield" className="h-6 w-6" />}
          />

          <Card className="backdrop-blur-md bg-card/95 border-2">
            <CardHeader>
              <CardTitle className="text-lg">Why $SHIELD?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p>Boost shXRP APY by +1% per 100 SHIELD staked</p>
              </div>
              <div className="flex items-start gap-2">
                <img src={shieldLogo} alt="Shield" className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Deflationary supply through automated burns</p>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p>Fair launch with locked liquidity</p>
              </div>

              <Button variant="outline" className="w-full mt-4" asChild>
                <a
                  href="https://docs.sparkdex.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-sparkdex-docs"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Learn More
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="modal-swap-success">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
              Swap Successful! 🎉
            </DialogTitle>
            <DialogDescription className="text-base">
              You received <strong>{swappedAmount} SHIELD</strong> tokens
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="border-primary/20 bg-primary/5">
              <TrendingUp className="h-5 w-5 text-primary" />
              <AlertDescription className="ml-2">
                <strong>Maximize your rewards!</strong> Stake your SHIELD now to boost your shXRP APY.
                {swappedAmount && parseFloat(swappedAmount) >= 100 && (
                  <p className="mt-2 text-sm">
                    With {Math.floor(parseFloat(swappedAmount) / 100) * 100} SHIELD,
                    you'll get <strong>+{Math.floor(parseFloat(swappedAmount) / 100)}% APY boost</strong>!
                  </p>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={() => setSuccessModalOpen(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-close-success-modal"
              >
                Close
              </Button>
              <Link href="/staking">
                <Button className="flex-1" data-testid="button-goto-staking">
                  <img src={shieldLogo} alt="Shield" className="mr-2 h-4 w-4" />
                  Stake for Boost
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
