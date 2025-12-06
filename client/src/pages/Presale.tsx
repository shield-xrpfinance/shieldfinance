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

function PurchaseCard({ selectedChain }: { selectedChain: number }) {
  const [amount, setAmount] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const { toast } = useToast();
  const { isConnected } = useWallet();

  const currentStage = PRESALE_STAGES[0];
  const shieldAmount = amount ? (parseFloat(amount) / currentStage.price).toFixed(0) : "0";
  const bonusAmount = amount ? (parseFloat(shieldAmount) * currentStage.bonus / 100).toFixed(0) : "0";
  const totalAmount = parseInt(shieldAmount) + parseInt(bonusAmount);

  const handlePurchase = () => {
    if (!isConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to participate in the presale.",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) < 10) {
      toast({
        title: "Minimum Purchase",
        description: "Minimum purchase amount is $10 USD.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Purchase Initiated",
      description: `Processing purchase of ${totalAmount.toLocaleString()} SHIELD tokens.`,
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
          <label className="text-sm text-muted-foreground">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="10"
              className="w-full pl-7 pr-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              data-testid="input-presale-amount"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: $10</span>
            <span>Max: $50,000 (KYC)</span>
          </div>
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
          data-testid="button-buy-shield"
        >
          <Zap className="w-4 h-4 mr-2" />
          Buy SHIELD
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
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <PurchaseCard selectedChain={selectedChain} />
            <ReferralCard />
          </div>
          <div className="space-y-6">
            <VestingInfoCard />
            <TokenomicsCard />
          </div>
        </div>
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
