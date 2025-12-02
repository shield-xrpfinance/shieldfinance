import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRightLeft, 
  Loader2, 
  Clock, 
  Fuel, 
  Percent, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Wallet
} from "lucide-react";
import { useWallet } from "@/lib/walletContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BridgeProgressTracker } from "@/components/BridgeProgressTracker";
import { 
  NETWORKS, 
  BRIDGE_TOKENS, 
  getTokensForNetwork, 
  getRouteBetweenNetworks,
  DEFAULT_BRIDGE_ROUTES,
  type NetworkId, 
  type BridgeTokenId,
  type NetworkConfig,
  type TokenConfig
} from "@shared/bridgeConfig";

interface RouteLeg {
  legIndex: number;
  fromNetwork: NetworkId;
  fromToken: BridgeTokenId;
  toNetwork: NetworkId;
  toToken: BridgeTokenId;
  protocol: string;
  estimatedTimeMinutes: number;
  feePercentage: number;
  gasFeeUsd: number;
  bridgeFeeUsd: number;
}

interface BridgeQuote {
  id: string;
  sourceNetwork: NetworkId;
  sourceToken: BridgeTokenId;
  sourceAmount: string;
  destNetwork: NetworkId;
  destToken: BridgeTokenId;
  destAmountEstimate: string;
  legs: RouteLeg[];
  totalFeeUsd: number;
  gasFeeUsd: number;
  bridgeFeeUsd: number;
  slippageUsd: number;
  estimatedTimeMinutes: number;
  expiresAt: string;
  priceData: Record<string, number>;
}

type LegStatus = "pending" | "executing" | "awaiting_confirm" | "bridging" | "awaiting_dest" | "completed" | "failed" | "refunded";
type JobStatus = "pending" | "quoted" | "confirmed" | "executing" | "awaiting_source" | "awaiting_dest" | "completed" | "partially_failed" | "failed" | "cancelled" | "refunded";

interface BridgeLeg {
  id: string;
  legIndex: number;
  fromNetwork: NetworkId;
  fromToken: BridgeTokenId;
  fromAmount: string;
  toNetwork: NetworkId;
  toToken: BridgeTokenId;
  toAmountExpected: string | null;
  toAmountReceived: string | null;
  protocol: string;
  routerAddress: string | null;
  sourceTxHash: string | null;
  bridgeTxHash: string | null;
  destTxHash: string | null;
  status: LegStatus;
  errorMessage: string | null;
  gasFeeSourceUsd: string | null;
  gasFeeDestUsd: string | null;
  bridgeFeeUsd: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface BridgeJob {
  id: string;
  walletAddress: string;
  sourceNetwork: NetworkId;
  sourceToken: BridgeTokenId;
  sourceAmount: string;
  destNetwork: NetworkId;
  destToken: BridgeTokenId;
  destAmount: string | null;
  destAmountReceived: string | null;
  recipientAddress: string;
  route: RouteLeg[];
  totalLegs: number;
  currentLeg: number;
  quoteId: string | null;
  totalFeeUsd: string | null;
  estimatedTimeMinutes: number | null;
  slippageToleranceBps: number | null;
  status: JobStatus;
  errorMessage: string | null;
  errorCode: string | null;
  createdAt: string;
  quotedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  legs: BridgeLeg[];
}

function NetworkIcon({ network, size = "md" }: { network: NetworkConfig; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-6 h-6";
  const fontSize = size === "sm" ? "text-[8px]" : size === "lg" ? "text-sm" : "text-[10px]";
  
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${fontSize} text-white`}
      style={{ backgroundColor: network.color }}
      data-testid={`icon-network-${network.id}`}
    >
      {network.shortName.charAt(0)}
    </div>
  );
}

function TokenIcon({ token, size = "md" }: { token: TokenConfig; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-6 h-6";
  const fontSize = size === "sm" ? "text-[8px]" : size === "lg" ? "text-sm" : "text-[10px]";
  
  return (
    <div 
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${fontSize} text-white`}
      style={{ backgroundColor: token.color }}
      data-testid={`icon-token-${token.id}`}
    >
      {token.symbol.charAt(0)}
    </div>
  );
}

function ChainSelector({ 
  label, 
  value, 
  onChange, 
  networks,
  excludeNetwork,
  testId
}: { 
  label: string;
  value: NetworkId | null;
  onChange: (networkId: NetworkId) => void;
  networks: NetworkConfig[];
  excludeNetwork?: NetworkId | null;
  testId: string;
}) {
  const filteredNetworks = excludeNetwork 
    ? networks.filter(n => n.id !== excludeNetwork)
    : networks;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <Select value={value || ""} onValueChange={(v) => onChange(v as NetworkId)}>
        <SelectTrigger className="w-full" data-testid={testId}>
          <SelectValue placeholder="Select network">
            {value && (
              <div className="flex items-center gap-2">
                <NetworkIcon network={NETWORKS[value]} size="sm" />
                <span>{NETWORKS[value].name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {filteredNetworks.map((network) => (
            <SelectItem 
              key={network.id} 
              value={network.id}
              data-testid={`select-item-network-${network.id}`}
            >
              <div className="flex items-center gap-2">
                <NetworkIcon network={network} size="sm" />
                <span>{network.name}</span>
                {!network.isMainnetReady && (
                  <Badge variant="secondary" className="text-xs ml-2">Testnet</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TokenSelector({
  label,
  value,
  onChange,
  tokens,
  testId
}: {
  label: string;
  value: BridgeTokenId | null;
  onChange: (tokenId: BridgeTokenId) => void;
  tokens: TokenConfig[];
  testId: string;
}) {
  if (tokens.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
        <div className="flex items-center justify-center h-9 rounded-md border border-input bg-muted text-muted-foreground text-sm">
          Select networks first
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <Select value={value || ""} onValueChange={(v) => onChange(v as BridgeTokenId)}>
        <SelectTrigger className="w-full" data-testid={testId}>
          <SelectValue placeholder="Select token">
            {value && (
              <div className="flex items-center gap-2">
                <TokenIcon token={BRIDGE_TOKENS[value]} size="sm" />
                <span>{BRIDGE_TOKENS[value].symbol}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tokens.map((token) => (
            <SelectItem 
              key={token.id} 
              value={token.id}
              data-testid={`select-item-token-${token.id}`}
            >
              <div className="flex items-center gap-2">
                <TokenIcon token={token} size="sm" />
                <span className="font-medium">{token.symbol}</span>
                <span className="text-muted-foreground text-sm">{token.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function RoutePreview({ route, isLoading }: { route: string[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (route.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
        Select networks and token to see route
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-4 flex-wrap" data-testid="route-preview">
      {route.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className="font-mono"
            data-testid={`route-step-${index}`}
          >
            {step}
          </Badge>
          {index < route.length - 1 && (
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function FeeBreakdown({ 
  quote, 
  isLoading 
}: { 
  quote: BridgeQuote | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center text-muted-foreground text-sm py-4">
            Get a quote to see fee breakdown
          </div>
        </CardContent>
      </Card>
    );
  }

  const destToken = BRIDGE_TOKENS[quote.destToken];
  
  const formatUsd = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "$0.00";
    return `$${value.toFixed(2)}`;
  };
  
  return (
    <Card data-testid="card-fee-breakdown">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fee Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Fuel className="w-4 h-4" />
            <span className="text-sm">Gas Fee</span>
          </div>
          <span className="font-mono text-sm" data-testid="text-gas-fee">{formatUsd(quote.gasFeeUsd)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="text-sm">Bridge Fee</span>
          </div>
          <span className="font-mono text-sm" data-testid="text-bridge-fee">{formatUsd(quote.bridgeFeeUsd)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Percent className="w-4 h-4" />
            <span className="text-sm">Slippage</span>
          </div>
          <span className="font-mono text-sm" data-testid="text-slippage">{formatUsd(quote.slippageUsd)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Estimated Time</span>
          </div>
          <span className="font-medium" data-testid="text-estimated-time">
            ~{quote.estimatedTimeMinutes ?? 0} min
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">You will receive</span>
          <span className="font-mono font-bold text-lg" data-testid="text-estimated-output">
            {parseFloat(quote.destAmountEstimate || "0").toFixed(6)} {destToken?.symbol || quote.destToken}
          </span>
        </div>
        <div className="text-xs text-muted-foreground text-right" data-testid="text-total-fee">
          Total fees: {formatUsd(quote.totalFeeUsd)}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Bridge() {
  const { address, evmAddress, isConnected } = useWallet();
  const { toast } = useToast();
  const walletAddr = address || evmAddress;

  const [sourceNetwork, setSourceNetwork] = useState<NetworkId | null>(null);
  const [destNetwork, setDestNetwork] = useState<NetworkId | null>(null);
  const [sourceToken, setSourceToken] = useState<BridgeTokenId | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const networks = useMemo(() => Object.values(NETWORKS), []);

  const availableTokens = useMemo(() => {
    if (!sourceNetwork || !destNetwork) return [];
    
    const route = getRouteBetweenNetworks(sourceNetwork, destNetwork);
    if (!route) return [];
    
    return route.tokens.map(tokenId => BRIDGE_TOKENS[tokenId]);
  }, [sourceNetwork, destNetwork]);

  const routeConfig = useMemo(() => {
    if (!sourceNetwork || !destNetwork) return null;
    return getRouteBetweenNetworks(sourceNetwork, destNetwork);
  }, [sourceNetwork, destNetwork]);

  const previewRoute = useMemo(() => {
    if (!sourceToken || !sourceNetwork || !destNetwork) return [];
    
    const sourceTokenConfig = BRIDGE_TOKENS[sourceToken];
    
    if (sourceNetwork === "xrpl" && destNetwork === "flare") {
      return ["XRP", "FXRP"];
    }
    if (sourceNetwork === "flare" && destNetwork === "xrpl") {
      return ["FXRP", "XRP"];
    }
    
    return [sourceTokenConfig.symbol, sourceTokenConfig.symbol];
  }, [sourceToken, sourceNetwork, destNetwork]);

  useEffect(() => {
    setSourceToken(null);
    setQuote(null);
  }, [sourceNetwork, destNetwork]);

  useEffect(() => {
    setQuote(null);
  }, [sourceToken, amount]);

  const swapNetworks = () => {
    const temp = sourceNetwork;
    setSourceNetwork(destNetwork);
    setDestNetwork(temp);
  };

  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!sourceNetwork || !destNetwork || !sourceToken || !amount) {
        throw new Error("Please fill in all fields");
      }
      const response = await apiRequest("POST", "/api/bridge/quote", {
        sourceNetwork,
        destNetwork,
        sourceToken,
        amount,
        walletAddress: walletAddr,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setQuote(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Quote Failed",
        description: error.message || "Failed to get bridge quote",
        variant: "destructive",
      });
    },
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !sourceNetwork || !destNetwork || !sourceToken || !amount) {
        throw new Error("Please get a quote first");
      }
      const response = await apiRequest("POST", "/api/bridge/initiate", {
        sourceNetwork,
        destNetwork,
        sourceToken,
        amount,
        walletAddress: walletAddr,
        quote,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      toast({
        title: "Bridge Initiated",
        description: "Your bridge transaction has been started",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bridge Failed",
        description: error.message || "Failed to initiate bridge",
        variant: "destructive",
      });
    },
  });

  const { data: activeJob, isLoading: isLoadingJob } = useQuery<BridgeJob>({
    queryKey: ["/api/bridge/job", activeJobId],
    enabled: !!activeJobId,
    refetchInterval: 5000,
  });

  const canGetQuote = sourceNetwork && destNetwork && sourceToken && amount && parseFloat(amount) > 0;
  const canExecute = quote && isConnected && !initiateMutation.isPending;

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
            <p className="text-center text-muted-foreground" data-testid="text-connect-prompt">
              Connect your wallet to use the multi-chain bridge
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeJobId && activeJob) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Bridge</h1>
            <p className="text-muted-foreground mt-1">Track your bridge transaction</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setActiveJobId(null)}
            data-testid="button-new-bridge"
          >
            New Bridge
          </Button>
        </div>

        <BridgeProgressTracker job={activeJob} isLoading={isLoadingJob} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Bridge</h1>
        <p className="text-muted-foreground mt-1">Transfer assets across multiple chains</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Networks</CardTitle>
          <CardDescription>Choose source and destination chains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <ChainSelector
              label="From"
              value={sourceNetwork}
              onChange={setSourceNetwork}
              networks={networks}
              excludeNetwork={destNetwork}
              testId="select-source-network"
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={swapNetworks}
              className="self-center mt-6 md:mt-0"
              data-testid="button-swap-networks"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </Button>
            
            <ChainSelector
              label="To"
              value={destNetwork}
              onChange={setDestNetwork}
              networks={networks}
              excludeNetwork={sourceNetwork}
              testId="select-dest-network"
            />
          </div>

          {routeConfig && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Route available via {routeConfig.protocols.join(", ")}</span>
            </div>
          )}

          {sourceNetwork && destNetwork && !routeConfig && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>No direct route available between these networks</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Token & Amount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TokenSelector
            label="Token"
            value={sourceToken}
            onChange={setSourceToken}
            tokens={availableTokens}
            testId="select-token"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">Amount</Label>
              <span className="text-xs text-muted-foreground" data-testid="text-balance">
                Balance: 0.00 {sourceToken || "---"}
              </span>
            </div>
            <div className="relative">
              <Input
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-20 font-mono"
                data-testid="input-amount"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                onClick={() => setAmount("100")}
                data-testid="button-max-amount"
              >
                MAX
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Route Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <RoutePreview route={previewRoute} isLoading={quoteMutation.isPending} />
        </CardContent>
      </Card>

      <FeeBreakdown quote={quote} isLoading={quoteMutation.isPending} />

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => quoteMutation.mutate()}
          disabled={!canGetQuote || quoteMutation.isPending}
          data-testid="button-get-quote"
        >
          {quoteMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting Quote...
            </>
          ) : (
            "Get Quote"
          )}
        </Button>
        
        <Button
          className="flex-1"
          onClick={() => initiateMutation.mutate()}
          disabled={!canExecute}
          data-testid="button-execute-bridge"
        >
          {initiateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initiating...
            </>
          ) : (
            "Execute Bridge"
          )}
        </Button>
      </div>

      {quote && (
        <div className="text-center text-xs text-muted-foreground">
          Quote valid for 60 seconds. Rates may vary at execution time.
        </div>
      )}
    </div>
  );
}
