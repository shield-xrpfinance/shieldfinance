import { useState, useEffect } from "react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useFlrBalance } from "@/hooks/useFlrBalance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownUp, TrendingUp, Info, Sparkles, Shield, AlertTriangle, ExternalLink, Loader2, Coins } from "lucide-react";
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

export default function Swap() {
  const { evmAddress, isEvmConnected, walletConnectProvider } = useWallet();
  const { isTestnet } = useNetwork();
  const { toast } = useToast();
  const { balance: flrBalance } = useFlrBalance();

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isFLRToSHIELD, setIsFLRToSHIELD] = useState(true);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [swappedAmount, setSwappedAmount] = useState("");

  const contracts = getContracts(isTestnet);
  const isConfigured = validateContracts(contracts);
  const slippageTolerance = 0.5; // 0.5% slippage
  
  // Conservative price impact estimation based on trade size
  const priceImpact = estimatePriceImpact(inputAmount);

  // Get real-time quote when input changes
  useEffect(() => {
    if (!inputAmount || parseFloat(inputAmount) <= 0 || !evmAddress || !walletConnectProvider || !isConfigured) {
      setOutputAmount("");
      return;
    }

    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      try {
        if (!walletConnectProvider) {
          console.error("🚨 [Swap] walletConnectProvider is null");
          setOutputAmount("");
          return;
        }

        const provider = new ethers.BrowserProvider(walletConnectProvider);
        const router = new ethers.Contract(contracts.SPARKDEX_ROUTER, ROUTER_ABI, provider);

        const inputAmountWei = parseTokenAmount(inputAmount, 18);
        const path = isFLRToSHIELD
          ? [contracts.WFLR, contracts.SHIELD_TOKEN]
          : [contracts.SHIELD_TOKEN, contracts.WFLR];
        
        const outputWei = await getSwapQuote(router, inputAmountWei, path);

        const outputFormatted = formatTokenAmount(outputWei, 18, 6);
        
        setOutputAmount(outputFormatted);
        
        // Calculate exchange rate
        const rate = parseFloat(outputFormatted) / parseFloat(inputAmount);
        setExchangeRate(rate);
      } catch (error) {
        console.error("🚨 [Swap] Failed to get quote:", error);
        setOutputAmount("");
        toast({
          title: "Quote Error",
          description: error instanceof Error ? error.message : "Unable to fetch price. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [inputAmount, isFLRToSHIELD, evmAddress, walletConnectProvider, contracts, toast, isConfigured]);

  const handleSwapDirection = () => {
    setIsFLRToSHIELD(!isFLRToSHIELD);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
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

    setIsSwapping(true);

    try {
      const provider = new ethers.BrowserProvider(walletConnectProvider);
      const signer = await provider.getSigner();
      const router = new ethers.Contract(contracts.SPARKDEX_ROUTER, ROUTER_ABI, signer);

      const inputAmountWei = parseTokenAmount(inputAmount, 18);
      const path = isFLRToSHIELD
        ? [contracts.WFLR, contracts.SHIELD_TOKEN]
        : [contracts.SHIELD_TOKEN, contracts.WFLR];

      const outputWei = await getSwapQuote(router, inputAmountWei, path);
      const minOutputWei = applySlippage(outputWei, slippageTolerance);
      const deadline = getDeadline();

      let tx;

      if (isFLRToSHIELD) {
        // FLR → SHIELD (swapExactETHForTokens)
        tx = await router.swapExactETHForTokens(
          minOutputWei,
          path,
          evmAddress,
          deadline,
          { value: inputAmountWei }
        );
      } else {
        // SHIELD → FLR (swapExactTokensForETH)
        // First approve router
        const shieldToken = new ethers.Contract(contracts.SHIELD_TOKEN, ERC20_ABI, signer);
        const allowance = await shieldToken.allowance(evmAddress, contracts.SPARKDEX_ROUTER);

        if (allowance < inputAmountWei) {
          toast({
            title: "Approval Required",
            description: "Approving SHIELD token for swap...",
          });
          const approveTx = await shieldToken.approve(contracts.SPARKDEX_ROUTER, inputAmountWei);
          await approveTx.wait();
        }

        tx = await router.swapExactTokensForETH(
          inputAmountWei,
          minOutputWei,
          path,
          evmAddress,
          deadline
        );
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
        description: `Swapped ${inputAmount} ${isFLRToSHIELD ? "FLR" : "SHIELD"} for ${outputAmount} ${isFLRToSHIELD ? "SHIELD" : "FLR"}`,
      });
    } catch (error: any) {
      console.error("Swap error:", error);
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction failed. Please try again.",
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
            Connect your wallet with Flare Network support to swap FLR for $SHIELD
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
          <Sparkles className="h-10 w-10 text-primary" />
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
              <CardTitle className="flex items-center gap-2">
                <ArrowDownUp className="h-5 w-5 text-primary" />
                Instant Swap
              </CardTitle>
              <CardDescription>
                Swap FLR for $SHIELD using SparkDEX V3 liquidity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>You Pay</Label>
                  {isFLRToSHIELD && (
                    <span className="text-sm text-muted-foreground">
                      Balance: <span className="font-semibold text-foreground">{parseFloat(flrBalance).toFixed(4)} FLR</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    className="text-2xl font-semibold h-16 pr-24"
                    data-testid="input-swap-amount"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted px-3 py-1.5 rounded-md">
                    <span className="font-semibold">{isFLRToSHIELD ? "FLR" : "SHIELD"}</span>
                  </div>
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSwapDirection}
                  className="rounded-full h-10 w-10"
                  data-testid="button-swap-direction"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
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
                    className="text-2xl font-semibold h-16 pr-24 bg-muted/50"
                    data-testid="text-swap-output"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary/10 px-3 py-1.5 rounded-md">
                    <span className="font-semibold">{isFLRToSHIELD ? "SHIELD" : "FLR"}</span>
                  </div>
                </div>
              </div>

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
                  1 {isFLRToSHIELD ? "FLR" : "SHIELD"} ≈ {exchangeRate.toFixed(6)} {isFLRToSHIELD ? "SHIELD" : "FLR"}
                  {priceImpact > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Est. impact: ~{priceImpact.toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}

              {/* Swap Button */}
              <Button
                onClick={handleSwap}
                disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isSwapping || isLoadingQuote}
                className="w-full h-14 text-lg font-semibold"
                data-testid="button-execute-swap"
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Swapping...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Swap & Stake for Boost
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
            label="Your FLR Balance"
            value={parseFloat(flrBalance).toFixed(4)}
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
            icon={<Shield className="h-6 w-6" />}
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
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
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
                  <Shield className="mr-2 h-4 w-4" />
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
