import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/walletContext";
import ConnectWalletEmptyState from "@/components/ConnectWalletEmptyState";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Coins, 
  Landmark, 
  BarChart3,
  ShieldCheck,
  ExternalLink,
  Loader2,
  DollarSign,
  Percent,
  Clock,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale
} from "lucide-react";

type RwaCategory = 'all' | 'treasury' | 'commodity' | 'credit' | 'fund' | 'equity';

interface RwaListing {
  id: string;
  assetKey: string;
  name: string;
  description: string | null;
  category: string;
  currentPrice: string;
  priceChange24h: string | null;
  marketCap: string | null;
  volume24h: string | null;
  apy: string | null;
  yieldFrequency: string | null;
  underlyingAsset: string | null;
  issuer: string | null;
  custodian: string | null;
  kycRequired: boolean;
  minOrderSize: string | null;
  maxOrderSize: string | null;
  tradingEnabled: boolean;
  status: string;
}

interface RwaStats {
  totalListings: number;
  totalMarketCap: number;
  totalVolume24h: number;
  avgApy: number;
  categoryBreakdown: Record<string, number>;
}

interface RwaHolding {
  id: string;
  walletAddress: string;
  listingId: string;
  quantity: string;
  averageCost: string;
  listing: RwaListing | null;
  currentValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

const categoryConfig: Record<RwaCategory, { label: string; icon: typeof Building2; description: string }> = {
  all: { label: "All Assets", icon: BarChart3, description: "Browse all tokenized real world assets" },
  treasury: { label: "Treasuries", icon: Landmark, description: "US Government debt instruments" },
  commodity: { label: "Commodities", icon: Coins, description: "Physical assets like gold & silver" },
  credit: { label: "Credit", icon: Building2, description: "Private credit & bonds" },
  fund: { label: "Funds", icon: DollarSign, description: "Money market & investment funds" },
  equity: { label: "Equities", icon: TrendingUp, description: "Tokenized stock indices" },
};

function formatCurrency(value: number | string, compact = false): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  
  if (compact) {
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentage(value: number | string | null): string {
  if (value === null) return '--';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

export default function Marketplace() {
  const [category, setCategory] = useState<RwaCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<RwaListing | null>(null);
  const [quantity, setQuantity] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'portfolio'>('browse');
  
  const { toast } = useToast();
  const { address, evmAddress, isConnected } = useWallet();
  const walletAddress = evmAddress || address;

  const { data: listings = [], isLoading: listingsLoading } = useQuery<RwaListing[]>({
    queryKey: ['/api/rwa/listings', category === 'all' ? undefined : category],
    queryFn: async () => {
      const url = category === 'all' 
        ? '/api/rwa/listings' 
        : `/api/rwa/listings?category=${category}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch listings');
      return res.json();
    },
  });

  const { data: stats } = useQuery<RwaStats>({
    queryKey: ['/api/rwa/stats'],
  });

  const { data: holdings = [], isLoading: holdingsLoading } = useQuery<RwaHolding[]>({
    queryKey: ['/api/rwa/holdings', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      const res = await fetch(`/api/rwa/holdings/${walletAddress}`);
      if (!res.ok) throw new Error('Failed to fetch holdings');
      return res.json();
    },
    enabled: !!walletAddress,
  });

  const buyMutation = useMutation({
    mutationFn: async (data: { listingId: string; quantity: string; price: string }) => {
      const response = await apiRequest('POST', '/api/rwa/orders', {
        walletAddress: walletAddress?.toLowerCase(),
        listingId: data.listingId,
        orderType: 'buy',
        quantity: data.quantity,
        price: data.price,
        paymentToken: 'USDC',
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.trade ? "Trade Executed" : "Order Placed",
        description: data.trade 
          ? `Successfully purchased ${quantity} ${selectedAsset?.assetKey}` 
          : "Your order has been placed and is pending execution",
      });
      setBuyModalOpen(false);
      setSelectedAsset(null);
      setQuantity('');
      queryClient.invalidateQueries({ queryKey: ['/api/rwa/holdings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rwa/listings'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order",
      });
    },
  });

  const filteredListings = useMemo(() => {
    if (!searchQuery) return listings;
    const query = searchQuery.toLowerCase();
    return listings.filter(l => 
      l.name.toLowerCase().includes(query) ||
      l.assetKey.toLowerCase().includes(query) ||
      l.description?.toLowerCase().includes(query) ||
      l.issuer?.toLowerCase().includes(query)
    );
  }, [listings, searchQuery]);

  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  const totalUnrealizedPnl = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.unrealizedPnl, 0);
  }, [holdings]);

  const openBuyModal = (listing: RwaListing) => {
    if (!isConnected) {
      toast({
        variant: "destructive",
        title: "Wallet Required",
        description: "Please connect your wallet to trade",
      });
      return;
    }
    setSelectedAsset(listing);
    setBuyModalOpen(true);
  };

  const handleBuy = () => {
    if (!selectedAsset || !quantity) return;
    
    const minSize = parseFloat(selectedAsset.minOrderSize || '0');
    const orderQty = parseFloat(quantity);
    
    if (orderQty < minSize) {
      toast({
        variant: "destructive",
        title: "Invalid Quantity",
        description: `Minimum order size is ${minSize}`,
      });
      return;
    }
    
    buyMutation.mutate({
      listingId: selectedAsset.id,
      quantity,
      price: selectedAsset.currentPrice,
    });
  };

  const orderTotal = selectedAsset && quantity 
    ? parseFloat(quantity) * parseFloat(selectedAsset.currentPrice)
    : 0;

  if (!isConnected && activeTab === 'portfolio') {
    return (
      <div className="p-6">
        <ConnectWalletEmptyState />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-marketplace-title">
            RWA Marketplace
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Trade tokenized real world assets on-chain
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'browse' | 'portfolio')}>
          <TabsList>
            <TabsTrigger value="browse" data-testid="tab-browse">
              <BarChart3 className="h-4 w-4 mr-2" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">
              <Wallet className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <BarChart3 className="h-4 w-4" />
                Total Assets
              </div>
              <div className="text-2xl font-bold text-foreground mt-1" data-testid="text-total-assets">
                {stats.totalListings}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <DollarSign className="h-4 w-4" />
                Market Cap
              </div>
              <div className="text-2xl font-bold text-foreground mt-1" data-testid="text-market-cap">
                {formatCurrency(stats.totalMarketCap, true)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                24h Volume
              </div>
              <div className="text-2xl font-bold text-foreground mt-1" data-testid="text-volume">
                {formatCurrency(stats.totalVolume24h, true)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Percent className="h-4 w-4" />
                Avg APY
              </div>
              <div className="text-2xl font-bold text-green-500 mt-1" data-testid="text-avg-apy">
                {stats.avgApy.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'browse' ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={category} onValueChange={(v) => setCategory(v as RwaCategory)}>
              <TabsList className="flex-wrap">
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <TabsTrigger key={key} value={key} data-testid={`tab-category-${key}`}>
                      <Icon className="h-4 w-4 mr-2" />
                      {config.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          {listingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-60" />
                      </div>
                      <Skeleton className="h-10 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No Assets Found</h3>
                <p className="text-muted-foreground mt-2">
                  {searchQuery ? "Try adjusting your search terms" : "No assets available in this category"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((listing) => {
                const priceChange = parseFloat(listing.priceChange24h || '0');
                const isPositive = priceChange >= 0;
                
                return (
                  <Card key={listing.id} className="hover-elevate transition-all" data-testid={`card-listing-${listing.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {listing.category === 'treasury' && <Landmark className="h-6 w-6 text-primary" />}
                            {listing.category === 'commodity' && <Coins className="h-6 w-6 text-amber-500" />}
                            {listing.category === 'credit' && <Building2 className="h-6 w-6 text-blue-500" />}
                            {listing.category === 'fund' && <DollarSign className="h-6 w-6 text-green-500" />}
                            {listing.category === 'equity' && <TrendingUp className="h-6 w-6 text-purple-500" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground truncate">{listing.name}</h3>
                              <Badge variant="secondary" className="shrink-0">{listing.assetKey}</Badge>
                              {listing.kycRequired && (
                                <Badge variant="outline" className="shrink-0">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  KYC
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {listing.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {listing.issuer && <span>Issuer: {listing.issuer}</span>}
                              {listing.custodian && <span>Custodian: {listing.custodian}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 lg:gap-8">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-foreground">
                              {formatCurrency(listing.currentPrice)}
                            </div>
                            <div className={`text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                              {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {formatPercentage(priceChange)}
                            </div>
                          </div>

                          {listing.apy && (
                            <div className="text-right hidden sm:block">
                              <div className="text-sm text-muted-foreground">APY</div>
                              <div className="text-lg font-semibold text-green-500">
                                {parseFloat(listing.apy).toFixed(2)}%
                              </div>
                            </div>
                          )}

                          <div className="text-right hidden md:block">
                            <div className="text-sm text-muted-foreground">Volume 24h</div>
                            <div className="text-sm font-medium text-foreground">
                              {formatCurrency(listing.volume24h || '0', true)}
                            </div>
                          </div>

                          <Button 
                            onClick={() => openBuyModal(listing)}
                            disabled={!listing.tradingEnabled}
                            data-testid={`button-buy-${listing.id}`}
                          >
                            {listing.tradingEnabled ? 'Trade' : 'Coming Soon'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Portfolio Value</div>
                <div className="text-2xl font-bold text-foreground mt-1" data-testid="text-portfolio-value">
                  {formatCurrency(totalPortfolioValue)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                <div className={`text-2xl font-bold mt-1 ${totalUnrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`} data-testid="text-unrealized-pnl">
                  {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Positions</div>
                <div className="text-2xl font-bold text-foreground mt-1" data-testid="text-positions-count">
                  {holdings.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {holdingsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-60" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : holdings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No Holdings Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Browse the marketplace to start building your RWA portfolio
                </p>
                <Button 
                  onClick={() => setActiveTab('browse')} 
                  className="mt-4"
                  data-testid="button-browse-assets"
                >
                  Browse Assets
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {holdings.map((holding) => {
                const isProfit = holding.unrealizedPnl >= 0;
                
                return (
                  <Card key={holding.id} data-testid={`card-holding-${holding.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Scale className="h-6 w-6 text-primary" />
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {holding.listing?.name || 'Unknown Asset'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {parseFloat(holding.quantity).toFixed(4)} units @ {formatCurrency(holding.averageCost)} avg
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 lg:gap-8">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Current Value</div>
                            <div className="text-lg font-semibold text-foreground">
                              {formatCurrency(holding.currentValue)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">P&L</div>
                            <div className={`text-lg font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                              {isProfit ? '+' : ''}{formatCurrency(holding.unrealizedPnl)}
                            </div>
                            <div className={`text-xs ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                              ({formatPercentage(holding.unrealizedPnlPercent)})
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={buyModalOpen} onOpenChange={setBuyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Trade {selectedAsset?.name}
              <Badge variant="secondary">{selectedAsset?.assetKey}</Badge>
            </DialogTitle>
            <DialogDescription>
              Current price: {formatCurrency(selectedAsset?.currentPrice || '0')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedAsset?.kycRequired && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>KYC Required</strong>
                  <p className="text-xs mt-1">This asset requires identity verification before trading.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder={`Min: ${selectedAsset?.minOrderSize || '0'}`}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-quantity"
              />
              {selectedAsset?.minOrderSize && (
                <p className="text-xs text-muted-foreground">
                  Minimum order: {selectedAsset.minOrderSize} units
                </p>
              )}
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price per unit</span>
                <span className="text-foreground">{formatCurrency(selectedAsset?.currentPrice || '0')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="text-foreground">{quantity || '0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Protocol Fee (0.1%)</span>
                <span className="text-foreground">{formatCurrency(orderTotal * 0.001)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-foreground">{formatCurrency(orderTotal * 1.001)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBuy}
              disabled={!quantity || parseFloat(quantity) <= 0 || buyMutation.isPending}
              data-testid="button-confirm-buy"
            >
              {buyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Buy ${selectedAsset?.assetKey}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
