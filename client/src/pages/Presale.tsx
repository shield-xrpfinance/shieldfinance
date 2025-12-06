import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Clock, 
  Users, 
  TrendingUp, 
  Coins,
  Lock,
  Unlock,
  ArrowRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Zap,
  Loader2
} from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useToast } from "@/hooks/use-toast";
import ConnectWalletEmptyState from "@/components/ConnectWalletEmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, encodeAbiParameters, keccak256, toBytes, Address } from "viem";
import { PRESALE_ADDRESSES, SHIELD_PRESALE_ABI, ERC20_ABI, MOCK_ERC20_ABI } from "@/lib/presaleContracts";

const PRESALE_STAGES = [
  { stage: 1, price: 0.005, bonus: 5, cap: 250000, name: "Early Bird" },
  { stage: 2, price: 0.0075, bonus: 3, cap: 500000, name: "Stage 2" },
  { stage: 3, price: 0.01, bonus: 1, cap: 1000000, name: "Stage 3" },
  { stage: 4, price: 0.02, bonus: 0, cap: 2000000, name: "Final" },
];

const SUPPORTED_CHAINS = [
  { id: 114, name: "Flare", icon: "🔥", color: "bg-red-500/20 text-red-500" },
  { id: 84532, name: "Base", icon: "🔵", color: "bg-blue-500/20 text-blue-500" },
  { id: 421614, name: "Arbitrum", icon: "🔷", color: "bg-cyan-500/20 text-cyan-500" },
  { id: 11155111, name: "Ethereum", icon: "💎", color: "bg-purple-500/20 text-purple-500" },
];

interface PresaleStats {
  totalRaised: number;
  totalParticipants: number;
  currentStage: number;
  stageProgress: number;
  softCapReached: boolean;
  hardCapReached: boolean;
  endTime: number;
  isActive: boolean;
}

function CountdownTimer({ endTime }: { endTime: number }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = endTime - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums text-foreground">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );

  return (
    <div className="flex items-center justify-center gap-4 md:gap-6">
      <TimeUnit value={timeLeft.days} label="Days" />
      <span className="text-2xl text-muted-foreground">:</span>
      <TimeUnit value={timeLeft.hours} label="Hours" />
      <span className="text-2xl text-muted-foreground">:</span>
      <TimeUnit value={timeLeft.minutes} label="Mins" />
      <span className="text-2xl text-muted-foreground">:</span>
      <TimeUnit value={timeLeft.seconds} label="Secs" />
    </div>
  );
}

function StageIndicator({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto">
      {PRESALE_STAGES.map((stage, index) => (
        <div key={stage.stage} className="flex flex-col items-center relative">
          <div 
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              stage.stage < currentStage
                ? "bg-green-500 text-white"
                : stage.stage === currentStage
                ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {stage.stage < currentStage ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              stage.stage
            )}
          </div>
          <span className="text-xs mt-2 text-muted-foreground">{stage.name}</span>
          <span className={`text-sm font-medium ${stage.stage === currentStage ? "text-primary" : "text-muted-foreground"}`}>
            ${stage.price}
          </span>
          {index < PRESALE_STAGES.length - 1 && (
            <div 
              className={`absolute top-5 left-[calc(100%+0.5rem)] w-[calc(100%-1rem)] h-0.5 ${
                stage.stage < currentStage ? "bg-green-500" : "bg-muted"
              }`}
              style={{ width: "60px" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PriceTrajectoryCard() {
  const priceData = PRESALE_STAGES.map((stage, index) => ({
    stage: `Stage ${stage.stage}`,
    price: stage.price,
    label: stage.name,
    cap: stage.cap,
    isCurrent: index === 0,
  }));

  const listingPrice = 0.02;
  const maxPrice = listingPrice * 1.1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          Price Trajectory
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-32">
          <div className="absolute inset-0 flex items-end justify-between gap-2">
            {priceData.map((data, index) => {
              const heightPercent = (data.price / maxPrice) * 100;
              return (
                <div key={data.stage} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    ${data.price}
                  </span>
                  <div 
                    className={`w-full rounded-t-md transition-all ${
                      data.isCurrent 
                        ? "bg-primary ring-2 ring-primary/30" 
                        : "bg-muted"
                    }`}
                    style={{ height: `${heightPercent}%`, minHeight: "20px" }}
                  />
                  <span className={`text-xs ${data.isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {data.label}
                  </span>
                </div>
              );
            })}
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-green-500 font-semibold">
                ${listingPrice}
              </span>
              <div 
                className="w-full rounded-t-md bg-green-500"
                style={{ height: `${(listingPrice / maxPrice) * 100}%`, minHeight: "20px" }}
              />
              <span className="text-xs text-green-500 font-medium">
                Listing
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stage 1 Upside</span>
            <span className="text-lg font-bold text-green-500">+300%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Buy at $0.005, listing at $0.02
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShieldBridgeCard() {
  const [fromChain, setFromChain] = useState(114);
  const [toChain, setToChain] = useState(84532);
  const [bridgeAmount, setBridgeAmount] = useState("");
  const { toast } = useToast();

  const fromChainData = SUPPORTED_CHAINS.find(c => c.id === fromChain);
  const toChainData = SUPPORTED_CHAINS.find(c => c.id === toChain);

  const estimatedFee = bridgeAmount ? (parseFloat(bridgeAmount) * 0.001).toFixed(4) : "0.0000";

  const handleBridge = () => {
    if (!bridgeAmount || parseFloat(bridgeAmount) <= 0) {
      toast({
        title: "Enter Amount",
        description: "Please enter an amount to bridge.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Bridge Initiated",
      description: `Bridging ${bridgeAmount} SHIELD from ${fromChainData?.name} to ${toChainData?.name}.`,
    });
  };

  const handleSwapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRight className="w-5 h-5 text-primary" />
          Bridge SHIELD
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Transfer SHIELD tokens between chains using LayerZero.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg border border-border bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">From</div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{fromChainData?.icon}</span>
                <span className="font-medium">{fromChainData?.name}</span>
              </div>
            </div>
            <button 
              onClick={handleSwapChains}
              className="p-2 rounded-lg border border-border hover-elevate"
              data-testid="button-swap-chains"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="flex-1 p-3 rounded-lg border border-border bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">To</div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{toChainData?.icon}</span>
                <span className="font-medium">{toChainData?.name}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors font-mono"
                data-testid="input-bridge-amount"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                SHIELD
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bridge Fee</span>
              <span className="font-mono">{estimatedFee} SHIELD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Time</span>
              <span>~2-5 minutes</span>
            </div>
          </div>

          <Button 
            onClick={handleBridge}
            className="w-full"
            variant="outline"
            disabled={!bridgeAmount || parseFloat(bridgeAmount) <= 0}
            data-testid="button-bridge-shield"
          >
            Bridge SHIELD
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TokenomicsCard() {
  const allocations = [
    { name: "Presale", percentage: 20, color: "bg-primary" },
    { name: "Staking Rewards", percentage: 30, color: "bg-green-500" },
    { name: "Team & Advisors", percentage: 15, color: "bg-purple-500" },
    { name: "Liquidity", percentage: 15, color: "bg-blue-500" },
    { name: "Treasury", percentage: 10, color: "bg-yellow-500" },
    { name: "Marketing", percentage: 10, color: "bg-pink-500" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="w-5 h-5 text-primary" />
          SHIELD Tokenomics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-4 rounded-full overflow-hidden">
          {allocations.map((alloc) => (
            <div
              key={alloc.name}
              className={`${alloc.color}`}
              style={{ width: `${alloc.percentage}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allocations.map((alloc) => (
            <div key={alloc.name} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${alloc.color}`} />
              <span className="text-muted-foreground">{alloc.name}</span>
              <span className="ml-auto font-medium">{alloc.percentage}%</span>
            </div>
          ))}
        </div>
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Supply</span>
              <p className="font-semibold">100,000,000 SHIELD</p>
            </div>
            <div>
              <span className="text-muted-foreground">Listing Price</span>
              <p className="font-semibold text-primary">$0.02</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VestingInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="w-5 h-5 text-primary" />
          Vesting Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Unlock className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-semibold">TGE Release</p>
              <p className="text-sm text-muted-foreground">Available at launch</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-green-500">20%</span>
        </div>
        
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Linear Vesting</p>
              <p className="text-sm text-muted-foreground">Over 6 months</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-primary">80%</span>
        </div>

        <div className="text-sm text-muted-foreground">
          Tokens vest linearly over 180 days after TGE, claimable any time after unlock.
        </div>
      </CardContent>
    </Card>
  );
}

function ChainSelector({ 
  selectedChain, 
  onSelect 
}: { 
  selectedChain: number; 
  onSelect: (chainId: number) => void;
}) {
  const handleChainClick = (chainId: number) => {
    console.log("Chain selected:", chainId);
    onSelect(chainId);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SUPPORTED_CHAINS.map((chain) => (
        <button
          type="button"
          key={chain.id}
          onClick={() => handleChainClick(chain.id)}
          className={`flex items-center gap-2 p-3 rounded-lg border transition-all cursor-pointer ${
            selectedChain === chain.id
              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
              : "border-border hover-elevate"
          }`}
          data-testid={`button-chain-${chain.name.toLowerCase()}`}
        >
          <span className="text-xl">{chain.icon}</span>
          <span className="font-medium">{chain.name}</span>
        </button>
      ))}
    </div>
  );
}

const PAYMENT_TOKENS: Record<number, { symbol: string; name: string; decimals: number; native: boolean; address: string }[]> = {
  114: [ // Flare/Coston2 - Only Mock USDC (contract's payment token)
    { symbol: "USDC.e", name: "Mock USDC (Testnet)", decimals: 6, native: false, address: "0x6c6f38C14F75d94fCa6342290C72573F9743aB56" },
  ],
  84532: [ // Base Sepolia - Circle's testnet USDC
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false, address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  ],
  421614: [ // Arbitrum Sepolia - Circle's testnet USDC
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false, address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" },
  ],
  11155111: [ // Sepolia - Circle's testnet USDC
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false, address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  ],
};

// Token prices - fetched from API or use defaults for stablecoins
const DEFAULT_PRICES: Record<string, number> = {
  FLR: 0.015,
  FXRP: 2.15,
  "USDC.e": 1.00,
  WFLR: 0.015,
  ETH: 3200,
  USDC: 1.00,
  WETH: 3200,
  ARB: 0.85,
};

function useTokenPrices() {
  return useQuery({
    queryKey: ["/api/prices"],
    queryFn: async () => {
      const symbols = "FLR,FXRP,USDC,ETH,WETH,ARB,WFLR";
      const response = await fetch(`/api/prices?symbols=${symbols}`);
      const data = await response.json();
      if (data.success && data.prices) {
        return {
          ...data.prices,
          "USDC.e": 1.00,
          USDC: 1.00,
        };
      }
      return DEFAULT_PRICES;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}

function useTokenBalance(chainId: number, tokenSymbol: string, address: string | undefined) {
  const availableTokens = PAYMENT_TOKENS[chainId] || [];
  const tokenData = availableTokens.find(t => t.symbol === tokenSymbol);
  const tokenAddress = tokenData?.address || "0x0000000000000000000000000000000000000000";
  const decimals = tokenData?.decimals || 6;
  const isNative = tokenData?.native || false;
  
  const { data: nativeBalance } = useBalance({
    address: address as Address | undefined,
    chainId,
    query: { enabled: !!address && isNative },
  });

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId,
    query: { enabled: !!address && !isNative && !!tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000" },
  });

  if (!address) return "0.00";
  
  if (isNative && nativeBalance) {
    return formatUnits(nativeBalance.value, 18);
  }
  
  if (!isNative && tokenBalance !== undefined) {
    return formatUnits(tokenBalance as bigint, decimals);
  }

  return "0.00";
}

function MintTestUSDCButton({ 
  userAddress, 
  tokenAddress,
  onSuccess 
}: { 
  userAddress: string | undefined;
  tokenAddress: string;
  onSuccess?: () => void;
}) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { toast } = useToast();

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Test USDC Minted!",
        description: "100 Mock USDC has been added to your wallet.",
      });
      onSuccess?.();
    }
  }, [isSuccess]);

  const handleMint = () => {
    if (!userAddress) return;
    
    const mintAmount = parseUnits("100", 6);
    
    writeContract({
      address: tokenAddress as Address,
      abi: MOCK_ERC20_ABI,
      functionName: "mint",
      args: [userAddress as Address, mintAmount],
      chainId: 114,
    });

    toast({
      title: "Minting Test USDC",
      description: "Please confirm the transaction in your wallet.",
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleMint}
      disabled={isPending || !userAddress}
      className="h-6 text-xs px-2"
      data-testid="button-mint-test-usdc"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        "Get Test USDC"
      )}
    </Button>
  );
}

function TokenBalanceDisplay({ chainId, symbol, address, price }: { 
  chainId: number; 
  symbol: string; 
  address: string | undefined;
  price: number;
}) {
  const balance = useTokenBalance(chainId, symbol, address);
  const balanceNum = parseFloat(balance);
  const usdValue = balanceNum * price;

  return (
    <div className="text-right">
      <div className="font-mono text-sm">
        {balanceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
      </div>
      <div className="text-xs text-muted-foreground">
        ${usdValue.toFixed(2)}
      </div>
    </div>
  );
}

function PurchaseCard({ selectedChain }: { selectedChain: number }) {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();
  const { isConnected, evmAddress } = useWallet();
  const { address } = useAccount();
  const userAddress = evmAddress || address;
  
  const { data: pricesData } = useTokenPrices();
  const prices = (pricesData as Record<string, number>) || DEFAULT_PRICES;

  const availableTokens = PAYMENT_TOKENS[selectedChain] || [];
  
  useEffect(() => {
    if (availableTokens.length > 0) {
      setSelectedToken(availableTokens[0].symbol);
    }
  }, [selectedChain]);

  const currentBalance = useTokenBalance(selectedChain, selectedToken || "", userAddress);
  
  const presaleAddress = PRESALE_ADDRESSES[selectedChain as keyof typeof PRESALE_ADDRESSES]?.presale;
  const selectedTokenData = availableTokens.find(t => t.symbol === selectedToken);
  const paymentTokenAddress = selectedTokenData?.address || "0x0000000000000000000000000000000000000000";
  
  const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const currentStage = PRESALE_STAGES[0];
  const tokenPrice = selectedToken ? (prices[selectedToken] || DEFAULT_PRICES[selectedToken] || 1) : 1;
  const tokenAmount = amount ? parseFloat(amount) : 0;
  const usdValue = tokenAmount * tokenPrice;
  const shieldAmount = usdValue > 0 ? (usdValue / currentStage.price).toFixed(0) : "0";
  const bonusAmount = shieldAmount ? (parseFloat(shieldAmount) * currentStage.bonus / 100).toFixed(0) : "0";
  const totalAmount = parseInt(shieldAmount) + parseInt(bonusAmount);

  const usdAmountInDecimals = useMemo(() => {
    try {
      return usdValue > 0 ? parseUnits(usdValue.toFixed(6), 6) : BigInt(0);
    } catch {
      return BigInt(0);
    }
  }, [usdValue]);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: paymentTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress && presaleAddress ? [userAddress as Address, presaleAddress as Address] : undefined,
    chainId: selectedChain,
    query: { 
      enabled: !!userAddress && !!presaleAddress && presaleAddress !== "0x0000000000000000000000000000000000000000" && paymentTokenAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  const needsApproval = useMemo(() => {
    if (!allowance || !usdAmountInDecimals) return false;
    return (allowance as bigint) < usdAmountInDecimals;
  }, [allowance, usdAmountInDecimals]);

  const formattedBalance = parseFloat(currentBalance).toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 6 
  });

  useEffect(() => {
    refetchAllowance();
  }, [selectedChain, paymentTokenAddress, userAddress]);

  useEffect(() => {
    if (isTxSuccess) {
      toast({
        title: "Purchase Successful!",
        description: `Successfully purchased ${totalAmount.toLocaleString()} SHIELD tokens.`,
      });
      setAmount("");
      refetchAllowance();
    }
  }, [isTxSuccess]);

  const handleMaxClick = () => {
    const balance = parseFloat(currentBalance);
    if (balance > 0) {
      setAmount(balance.toString());
    }
  };

  const handleApprove = async () => {
    if (!presaleAddress || presaleAddress === "0x0000000000000000000000000000000000000000") {
      toast({
        title: "Not Available",
        description: "Presale is not yet deployed on this chain.",
        variant: "destructive",
      });
      return;
    }

    setIsApproving(true);
    try {
      const maxApproval = parseUnits("1000000", 6);
      
      writeContract({
        address: paymentTokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [presaleAddress as Address, maxApproval],
        chainId: selectedChain,
      });

      toast({
        title: "Approval Submitted",
        description: "Please confirm the approval transaction in your wallet.",
      });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to submit approval",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handlePurchase = async () => {
    if (!isConnected || !userAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to participate in the presale.",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Enter Amount",
        description: "Please enter an amount to purchase.",
        variant: "destructive",
      });
      return;
    }

    if (usdValue < 10) {
      toast({
        title: "Minimum Purchase",
        description: "Minimum purchase amount is $10 USD equivalent.",
        variant: "destructive",
      });
      return;
    }

    if (!presaleAddress || presaleAddress === "0x0000000000000000000000000000000000000000") {
      toast({
        title: "Not Available",
        description: "Presale is not yet deployed on this chain.",
        variant: "destructive",
      });
      return;
    }

    if (needsApproval) {
      toast({
        title: "Approval Required",
        description: "Please approve the presale contract to spend your tokens first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const referralBytes = referralCode 
        ? keccak256(toBytes(referralCode)) 
        : "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      writeContract({
        address: presaleAddress as Address,
        abi: SHIELD_PRESALE_ABI,
        functionName: "buy",
        args: [usdAmountInDecimals, referralBytes, [], []],
        chainId: selectedChain,
      });

      toast({
        title: "Transaction Submitted",
        description: `Processing purchase of ${totalAmount.toLocaleString()} SHIELD...`,
      });
    } catch (error: any) {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to submit transaction",
        variant: "destructive",
      });
    }
  };

  const isPending = isWritePending || isTxPending || isApproving;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Buy SHIELD
          </span>
          <Badge variant="secondary" className="text-xs">
            Stage 1 - {currentStage.bonus}% Bonus
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Pay With</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Balance: <span className="font-mono">{formattedBalance}</span> {selectedToken}
              </span>
              {selectedChain === 114 && (
                <MintTestUSDCButton 
                  userAddress={userAddress} 
                  tokenAddress={paymentTokenAddress}
                  onSuccess={() => {
                    refetchAllowance();
                  }}
                />
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors font-mono text-lg"
                data-testid="input-presale-amount"
              />
            </div>
            <button
              onClick={() => setShowTokenSelector(!showTokenSelector)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-background hover-elevate min-w-[120px]"
              data-testid="button-token-selector"
            >
              <span className="font-medium">{selectedToken}</span>
              <ArrowRight className="w-4 h-4 rotate-90" />
            </button>
          </div>

          <div className="flex justify-between text-xs">
            <button 
              onClick={handleMaxClick}
              className="text-primary hover:underline"
              data-testid="button-max-amount"
            >
              Use Max
            </button>
            <span className="text-muted-foreground">
              ≈ ${usdValue.toFixed(2)} USD
            </span>
          </div>
          
          {showTokenSelector && (
            <div className="mt-2 p-2 rounded-lg border border-border bg-card space-y-1">
              {availableTokens.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => {
                    setSelectedToken(token.symbol);
                    setShowTokenSelector(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                    selectedToken === token.symbol 
                      ? "bg-primary/10 text-primary" 
                      : "hover-elevate"
                  }`}
                  data-testid={`button-select-token-${token.symbol.toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {token.symbol.charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                  <TokenBalanceDisplay 
                    chainId={selectedChain} 
                    symbol={token.symbol} 
                    address={userAddress}
                    price={prices[token.symbol] || DEFAULT_PRICES[token.symbol] || 0}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Referral Code (Optional)</label>
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            placeholder="SHIELD123"
            className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors uppercase"
            data-testid="input-referral-code"
          />
        </div>

        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">You Pay</span>
            <span className="font-mono">{amount || "0"} {selectedToken}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">USD Value</span>
            <span className="font-mono">${usdValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base SHIELD</span>
            <span className="font-mono">{parseInt(shieldAmount).toLocaleString()}</span>
          </div>
          {parseInt(bonusAmount) > 0 && (
            <div className="flex justify-between text-sm text-green-500">
              <span>Stage Bonus (+{currentStage.bonus}%)</span>
              <span className="font-mono">+{parseInt(bonusAmount).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
            <span>Total SHIELD</span>
            <span className="text-primary font-mono">{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {needsApproval && usdValue >= 10 ? (
          <Button 
            onClick={handleApprove}
            className="w-full"
            size="lg"
            disabled={!amount || usdValue < 10 || isPending}
            data-testid="button-approve-token"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Approve USDC
              </>
            )}
          </Button>
        ) : (
          <Button 
            onClick={handlePurchase}
            className="w-full"
            size="lg"
            disabled={!amount || usdValue < 10 || isPending}
            data-testid="button-buy-shield"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                {usdValue < 10 && amount ? `Min. $10 USD (current: $${usdValue.toFixed(2)})` : "Buy SHIELD"}
              </>
            )}
          </Button>
        )}

        <div className="text-center text-xs text-muted-foreground">
          By purchasing, you agree to the{" "}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard() {
  const [copied, setCopied] = useState(false);
  const { isConnected, address, evmAddress } = useWallet();
  
  const walletAddress = address || evmAddress;
  const referralCode = walletAddress 
    ? `SHIELD${walletAddress.slice(-6).toUpperCase()}`
    : "Connect wallet to get your code";

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" />
          Referral Program
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Earn 5% bonus SHIELD for every friend who uses your referral code.
        </p>
        
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded-lg bg-muted/50 font-mono text-sm truncate">
            {referralCode}
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleCopy}
            disabled={!isConnected}
            data-testid="button-copy-referral"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">SHIELD Earned</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function usePresaleStats(chainId: number) {
  const presaleAddress = PRESALE_ADDRESSES[chainId as keyof typeof PRESALE_ADDRESSES]?.presale;
  
  const { data: totalRaised } = useReadContract({
    address: presaleAddress as Address,
    abi: SHIELD_PRESALE_ABI,
    functionName: "totalRaised",
    chainId,
    query: { enabled: !!presaleAddress && presaleAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: totalParticipants } = useReadContract({
    address: presaleAddress as Address,
    abi: SHIELD_PRESALE_ABI,
    functionName: "totalParticipants",
    chainId,
    query: { enabled: !!presaleAddress && presaleAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: currentStage } = useReadContract({
    address: presaleAddress as Address,
    abi: SHIELD_PRESALE_ABI,
    functionName: "currentStage",
    chainId,
    query: { enabled: !!presaleAddress && presaleAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: isActive } = useReadContract({
    address: presaleAddress as Address,
    abi: SHIELD_PRESALE_ABI,
    functionName: "isActive",
    chainId,
    query: { enabled: !!presaleAddress && presaleAddress !== "0x0000000000000000000000000000000000000000" },
  });

  const raised = totalRaised ? Number(formatUnits(totalRaised as bigint, 6)) : 0;
  const participants = totalParticipants ? Number(totalParticipants) : 0;
  const stage = currentStage ? Number(currentStage) + 1 : 1;
  const stageData = PRESALE_STAGES[stage - 1] || PRESALE_STAGES[0];
  const progress = stageData.cap > 0 ? (raised / stageData.cap) * 100 : 0;

  return {
    totalRaised: raised,
    totalParticipants: participants,
    currentStage: stage,
    stageProgress: Math.min(progress, 100),
    softCapReached: raised >= 25000,
    hardCapReached: raised >= 200000,
    endTime: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days from now
    isActive: isActive ?? true,
    isLoading: !presaleAddress || presaleAddress === "0x0000000000000000000000000000000000000000",
  };
}

export default function Presale() {
  const [selectedChain, setSelectedChain] = useState(114);
  const { isConnected } = useWallet();
  const { toast } = useToast();

  const presaleStats = usePresaleStats(selectedChain);

  const currentStageData = PRESALE_STAGES[presaleStats.currentStage - 1];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm">
          Community Allocation - Stage {presaleStats.currentStage}
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold">
          SHIELD Token Presale
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Join the Shield Finance community allocation. Early participants receive bonus tokens 
          and help bootstrap the governance layer of the XRP liquid staking protocol.
        </p>
      </div>

      <Card className="bg-shield-dark border-0">
        <CardContent className="py-8">
          <div className="text-center space-y-6">
            <div className="text-muted-foreground-light text-sm uppercase tracking-wide">
              Presale Ends In
            </div>
            <CountdownTimer endTime={presaleStats.endTime} />
            <StageIndicator currentStage={presaleStats.currentStage} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Raised</div>
            <div className="text-2xl font-bold font-mono">
              ${presaleStats.totalRaised.toLocaleString()}
            </div>
            <Progress value={presaleStats.stageProgress} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Participants</div>
            <div className="text-2xl font-bold font-mono">
              {presaleStats.totalParticipants}
            </div>
            <div className="text-xs text-muted-foreground mt-2">Across all chains</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Current Price</div>
            <div className="text-2xl font-bold text-primary font-mono">
              ${currentStageData.price}
            </div>
            <div className="text-xs text-green-500 mt-2">+{currentStageData.bonus}% bonus</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Listing Price</div>
            <div className="text-2xl font-bold font-mono">
              $0.02
            </div>
            <div className="text-xs text-green-500 mt-2">
              +{((0.02 / currentStageData.price - 1) * 100).toFixed(0)}% upside
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Select Chain</h2>
        <ChainSelector selectedChain={selectedChain} onSelect={setSelectedChain} />
      </div>

      {!isConnected ? (
        <ConnectWalletEmptyState />
      ) : (
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="buy" className="flex-1" data-testid="tab-buy">
              Buy SHIELD
            </TabsTrigger>
            <TabsTrigger value="bridge" className="flex-1" data-testid="tab-bridge">
              Bridge SHIELD
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1" data-testid="tab-info">
              Token Info
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <PurchaseCard selectedChain={selectedChain} />
                <ReferralCard />
              </div>
              <div className="space-y-6">
                <PriceTrajectoryCard />
                <VestingInfoCard />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="bridge">
            <div className="grid md:grid-cols-2 gap-6">
              <ShieldBridgeCard />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-primary" />
                    Your SHIELD Balances
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SUPPORTED_CHAINS.map((chain) => (
                    <div 
                      key={chain.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{chain.icon}</span>
                        <span className="font-medium">{chain.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold">0.00</div>
                        <div className="text-xs text-muted-foreground">SHIELD</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total SHIELD</span>
                      <span className="text-xl font-bold font-mono">0.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="info">
            <div className="grid md:grid-cols-2 gap-6">
              <TokenomicsCard />
              <div className="space-y-6">
                <PriceTrajectoryCard />
                <VestingInfoCard />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold">Important Information</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Minimum purchase: $10 USD equivalent</li>
                <li>Maximum without KYC: $1,000 USD</li>
                <li>Maximum with KYC: $50,000 USD</li>
                <li>20% tokens available at TGE, 80% vested over 6 months</li>
                <li>Referral bonus: 5% for both referrer and referee</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
