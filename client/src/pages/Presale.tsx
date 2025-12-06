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
  Zap
} from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useToast } from "@/hooks/use-toast";
import ConnectWalletEmptyState from "@/components/ConnectWalletEmptyState";
import { Skeleton } from "@/components/ui/skeleton";

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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SUPPORTED_CHAINS.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onSelect(chain.id)}
          className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
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

const PAYMENT_TOKENS: Record<number, { symbol: string; name: string; decimals: number; native: boolean }[]> = {
  114: [ // Flare/Coston2
    { symbol: "FLR", name: "Flare", decimals: 18, native: true },
    { symbol: "FXRP", name: "FAssets XRP", decimals: 6, native: false },
    { symbol: "USDC.e", name: "USDC (Bridged)", decimals: 6, native: false },
    { symbol: "WFLR", name: "Wrapped FLR", decimals: 18, native: false },
  ],
  84532: [ // Base Sepolia
    { symbol: "ETH", name: "Ethereum", decimals: 18, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false },
    { symbol: "WETH", name: "Wrapped ETH", decimals: 18, native: false },
  ],
  421614: [ // Arbitrum Sepolia
    { symbol: "ETH", name: "Ethereum", decimals: 18, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false },
    { symbol: "ARB", name: "Arbitrum", decimals: 18, native: false },
  ],
  11155111: [ // Sepolia
    { symbol: "ETH", name: "Ethereum", decimals: 18, native: true },
    { symbol: "USDC", name: "USD Coin", decimals: 6, native: false },
    { symbol: "WETH", name: "Wrapped ETH", decimals: 18, native: false },
  ],
};

const MOCK_BALANCES: Record<string, string> = {
  FLR: "1,234.56",
  FXRP: "5,000.00",
  "USDC.e": "500.00",
  WFLR: "0.00",
  ETH: "0.25",
  USDC: "100.00",
  WETH: "0.00",
  ARB: "50.00",
};

const MOCK_PRICES: Record<string, number> = {
  FLR: 0.015,
  FXRP: 2.15,
  "USDC.e": 1.00,
  WFLR: 0.015,
  ETH: 3200,
  USDC: 1.00,
  WETH: 3200,
  ARB: 0.85,
};

function PurchaseCard({ selectedChain }: { selectedChain: number }) {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const { toast } = useToast();
  const { isConnected } = useWallet();

  const availableTokens = PAYMENT_TOKENS[selectedChain] || PAYMENT_TOKENS[114];
  
  useEffect(() => {
    if (availableTokens.length > 0) {
      setSelectedToken(availableTokens[0].symbol);
    }
  }, [selectedChain]);

  const currentStage = PRESALE_STAGES[0];
  const tokenPrice = selectedToken ? MOCK_PRICES[selectedToken] || 1 : 1;
  const tokenAmount = amount ? parseFloat(amount) : 0;
  const usdValue = tokenAmount * tokenPrice;
  const shieldAmount = usdValue > 0 ? (usdValue / currentStage.price).toFixed(0) : "0";
  const bonusAmount = shieldAmount ? (parseFloat(shieldAmount) * currentStage.bonus / 100).toFixed(0) : "0";
  const totalAmount = parseInt(shieldAmount) + parseInt(bonusAmount);

  const currentBalance = selectedToken ? MOCK_BALANCES[selectedToken] || "0.00" : "0.00";
  const selectedTokenData = availableTokens.find(t => t.symbol === selectedToken);

  const handleMaxClick = () => {
    const balance = parseFloat(currentBalance.replace(/,/g, ''));
    setAmount(balance.toString());
  };

  const handlePurchase = () => {
    if (!isConnected) {
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

    toast({
      title: "Purchase Initiated",
      description: `Processing purchase of ${totalAmount.toLocaleString()} SHIELD with ${amount} ${selectedToken}.`,
    });
  };

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
            <span className="text-xs text-muted-foreground">
              Balance: <span className="font-mono">{currentBalance}</span> {selectedToken}
            </span>
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
                  <div className="text-right">
                    <div className="font-mono text-sm">{MOCK_BALANCES[token.symbol] || "0.00"}</div>
                    <div className="text-xs text-muted-foreground">
                      ${((parseFloat(MOCK_BALANCES[token.symbol]?.replace(/,/g, '') || '0')) * (MOCK_PRICES[token.symbol] || 0)).toFixed(2)}
                    </div>
                  </div>
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

        <Button 
          onClick={handlePurchase}
          className="w-full"
          size="lg"
          disabled={!amount || usdValue < 10}
          data-testid="button-buy-shield"
        >
          <Zap className="w-4 h-4 mr-2" />
          {usdValue < 10 && amount ? `Min. $10 USD (current: $${usdValue.toFixed(2)})` : "Buy SHIELD"}
        </Button>

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

export default function Presale() {
  const [selectedChain, setSelectedChain] = useState(114);
  const { isConnected } = useWallet();
  const { toast } = useToast();

  const presaleStats: PresaleStats = {
    totalRaised: 45000,
    totalParticipants: 127,
    currentStage: 1,
    stageProgress: 18,
    softCapReached: false,
    hardCapReached: false,
    endTime: Date.now() + 14 * 24 * 60 * 60 * 1000,
    isActive: true,
  };

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
