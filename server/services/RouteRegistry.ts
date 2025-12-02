/**
 * Route Registry Service
 * 
 * Calculates optimal bridging paths between chains using LayerZero, Stargate, and FAssets protocols.
 * Supports multi-hop routes through Flare as hub for non-direct pairs.
 * 
 * Architecture:
 * - Direct routes: A→B when supported
 * - Hub routes: A→Flare→B for chains without direct connection
 * - Token swaps: Integrated DEX swaps when token conversion needed on same chain
 */

import { 
  NETWORKS, 
  BRIDGE_TOKENS, 
  DEFAULT_BRIDGE_ROUTES,
  NetworkId, 
  BridgeTokenId, 
  BridgeProtocol,
  NetworkConfig,
  TokenConfig,
  BridgeRouteConfig
} from "@shared/bridgeConfig";

// Price data for fee calculations (in production, fetch from oracle/API)
const TOKEN_PRICES_USD: Partial<Record<BridgeTokenId, number>> = {
  XRP: 2.50,
  FXRP: 2.50,
  FLR: 0.02,
  WFLR: 0.02,
  ETH: 3500,
  WETH: 3500,
  USDC: 1.00,
  USDT: 1.00,
  sFLR: 0.022,
  flrETH: 3600,
  SHIELD: 0.10,
  shXRP: 2.55,
  SPRK: 0.05,
};

// Gas costs per network (in native currency)
const GAS_COSTS: Partial<Record<NetworkId, { bridgeGas: number; swapGas: number; priceUsd: number }>> = {
  ethereum: { bridgeGas: 150000, swapGas: 120000, priceUsd: 3500 },
  base: { bridgeGas: 80000, swapGas: 60000, priceUsd: 3500 },
  optimism: { bridgeGas: 80000, swapGas: 60000, priceUsd: 3500 },
  arbitrum: { bridgeGas: 100000, swapGas: 80000, priceUsd: 3500 },
  polygon: { bridgeGas: 100000, swapGas: 80000, priceUsd: 0.50 },
  flare: { bridgeGas: 50000, swapGas: 40000, priceUsd: 0.02 },
};

export interface RouteLeg {
  legIndex: number;
  fromNetwork: NetworkId;
  fromToken: BridgeTokenId;
  toNetwork: NetworkId;
  toToken: BridgeTokenId;
  protocol: BridgeProtocol;
  estimatedTimeMinutes: number;
  feePercentage: number;
  gasFeeUsd: number;
  bridgeFeeUsd: number;
}

export interface RouteQuote {
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
  expiresAt: Date;
  priceData: Record<string, number>;
}

export interface RouteOptions {
  slippageToleranceBps?: number; // Default 50 = 0.5%
  preferredProtocol?: BridgeProtocol;
  maxHops?: number; // Default 3
}

class RouteRegistryClass {
  private readonly HUB_NETWORK: NetworkId = "flare";
  private readonly QUOTE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a quote for bridging between two chains/tokens
   */
  async getQuote(
    sourceNetwork: NetworkId,
    sourceToken: BridgeTokenId,
    destNetwork: NetworkId,
    destToken: BridgeTokenId,
    amount: string,
    options: RouteOptions = {}
  ): Promise<RouteQuote | null> {
    const { slippageToleranceBps = 50, maxHops = 3 } = options;

    // Validate networks exist
    if (!NETWORKS[sourceNetwork] || !NETWORKS[destNetwork]) {
      console.error(`[RouteRegistry] Invalid network: ${sourceNetwork} or ${destNetwork}`);
      return null;
    }

    // Validate tokens exist
    if (!BRIDGE_TOKENS[sourceToken] || !BRIDGE_TOKENS[destToken]) {
      console.error(`[RouteRegistry] Invalid token: ${sourceToken} or ${destToken}`);
      return null;
    }

    // Calculate route
    const legs = this.calculateRoute(
      sourceNetwork,
      sourceToken,
      destNetwork,
      destToken,
      amount,
      maxHops
    );

    if (!legs || legs.length === 0) {
      console.warn(`[RouteRegistry] No route found: ${sourceNetwork}/${sourceToken} → ${destNetwork}/${destToken}`);
      return null;
    }

    // Calculate fees
    const fees = this.calculateFees(legs, amount, slippageToleranceBps);
    
    // Calculate output amount
    const destAmount = this.calculateOutputAmount(amount, sourceToken, destToken, fees);

    // Generate quote
    const quote: RouteQuote = {
      id: crypto.randomUUID(),
      sourceNetwork,
      sourceToken,
      sourceAmount: amount,
      destNetwork,
      destToken,
      destAmountEstimate: destAmount,
      legs,
      totalFeeUsd: fees.totalFeeUsd,
      gasFeeUsd: fees.gasFeeUsd,
      bridgeFeeUsd: fees.bridgeFeeUsd,
      slippageUsd: fees.slippageUsd,
      estimatedTimeMinutes: legs.reduce((sum, leg) => sum + leg.estimatedTimeMinutes, 0),
      expiresAt: new Date(Date.now() + this.QUOTE_EXPIRY_MS),
      priceData: { ...TOKEN_PRICES_USD } as Record<string, number>,
    };

    console.log(`[RouteRegistry] Quote generated: ${quote.id}, ${legs.length} legs, $${fees.totalFeeUsd.toFixed(2)} fees`);
    return quote;
  }

  /**
   * Calculate the optimal route between source and destination
   */
  private calculateRoute(
    sourceNetwork: NetworkId,
    sourceToken: BridgeTokenId,
    destNetwork: NetworkId,
    destToken: BridgeTokenId,
    amount: string,
    maxHops: number
  ): RouteLeg[] {
    const legs: RouteLeg[] = [];
    let legIndex = 0;
    let currentNetwork = sourceNetwork;
    let currentToken = sourceToken;

    // Special case: same network (swap only)
    if (sourceNetwork === destNetwork) {
      if (sourceToken !== destToken) {
        legs.push(this.createSwapLeg(legIndex++, sourceNetwork, sourceToken, destToken));
      }
      return legs;
    }

    // Check for direct route
    const directRoute = this.findDirectRoute(sourceNetwork, destNetwork, sourceToken);
    if (directRoute) {
      // Direct bridge
      legs.push(this.createBridgeLeg(legIndex++, sourceNetwork, destNetwork, sourceToken, directRoute));
      currentNetwork = destNetwork;
      currentToken = sourceToken;

      // Final swap if needed
      if (currentToken !== destToken) {
        legs.push(this.createSwapLeg(legIndex++, destNetwork, currentToken, destToken));
      }
      return legs;
    }

    // Multi-hop through hub (Flare)
    if (sourceNetwork !== this.HUB_NETWORK && destNetwork !== this.HUB_NETWORK && maxHops >= 2) {
      // Leg 1: Source → Flare
      const toHubRoute = this.findDirectRoute(sourceNetwork, this.HUB_NETWORK, sourceToken);
      if (toHubRoute) {
        legs.push(this.createBridgeLeg(legIndex++, sourceNetwork, this.HUB_NETWORK, sourceToken, toHubRoute));
        currentNetwork = this.HUB_NETWORK;
        currentToken = sourceToken;
      } else if (sourceNetwork === "xrpl" && sourceToken === "XRP") {
        // Special: XRPL→Flare via FAssets
        legs.push(this.createFAssetsLeg(legIndex++, "xrpl", "flare", "XRP", "FXRP"));
        currentNetwork = this.HUB_NETWORK;
        currentToken = "FXRP";
      }

      // Intermediate swap on hub if needed
      const hubToken = this.findBestHubToken(destNetwork, destToken);
      if (currentToken !== hubToken && hubToken) {
        legs.push(this.createSwapLeg(legIndex++, this.HUB_NETWORK, currentToken, hubToken));
        currentToken = hubToken;
      }

      // Leg 2: Flare → Destination
      const fromHubRoute = this.findDirectRoute(this.HUB_NETWORK, destNetwork, currentToken);
      if (fromHubRoute) {
        legs.push(this.createBridgeLeg(legIndex++, this.HUB_NETWORK, destNetwork, currentToken, fromHubRoute));
        currentNetwork = destNetwork;
      }

      // Final swap if needed
      if (currentToken !== destToken && currentNetwork === destNetwork) {
        legs.push(this.createSwapLeg(legIndex++, destNetwork, currentToken, destToken));
      }

      return legs;
    }

    // Handle XRPL specifically (FAssets only)
    if (sourceNetwork === "xrpl") {
      // XRP → FXRP on Flare
      legs.push(this.createFAssetsLeg(legIndex++, "xrpl", "flare", "XRP", "FXRP"));
      currentNetwork = "flare";
      currentToken = "FXRP";

      if (destNetwork !== "flare") {
        // Need to continue from Flare
        const remainingLegs = this.calculateRoute(
          "flare",
          currentToken,
          destNetwork,
          destToken,
          amount,
          maxHops - 1
        );
        for (const leg of remainingLegs) {
          leg.legIndex = legIndex++;
          legs.push(leg);
        }
      } else if (currentToken !== destToken) {
        legs.push(this.createSwapLeg(legIndex++, "flare", currentToken, destToken));
      }

      return legs;
    }

    if (destNetwork === "xrpl") {
      // First get to Flare with FXRP
      if (sourceNetwork !== "flare") {
        const toFlareLegs = this.calculateRoute(
          sourceNetwork,
          sourceToken,
          "flare",
          "FXRP",
          amount,
          maxHops - 1
        );
        legs.push(...toFlareLegs);
        legIndex = legs.length;
      } else if (sourceToken !== "FXRP") {
        legs.push(this.createSwapLeg(legIndex++, "flare", sourceToken, "FXRP"));
      }

      // FXRP → XRP on XRPL
      legs.push(this.createFAssetsLeg(legIndex++, "flare", "xrpl", "FXRP", "XRP"));
      return legs;
    }

    return legs;
  }

  /**
   * Find a direct route configuration between two networks
   */
  private findDirectRoute(
    from: NetworkId,
    to: NetworkId,
    token: BridgeTokenId
  ): BridgeRouteConfig | null {
    return DEFAULT_BRIDGE_ROUTES.find(
      route => 
        route.from === from && 
        route.to === to && 
        route.tokens.includes(token) &&
        route.isEnabled
    ) || null;
  }

  /**
   * Find the best token to use on the hub for routing
   */
  private findBestHubToken(destNetwork: NetworkId, destToken: BridgeTokenId): BridgeTokenId | null {
    // If we can use same token, prefer it
    const directRoute = this.findDirectRoute(this.HUB_NETWORK, destNetwork, destToken);
    if (directRoute) return destToken;

    // Otherwise try stablecoins first
    for (const token of ["USDC", "USDT"] as BridgeTokenId[]) {
      if (this.findDirectRoute(this.HUB_NETWORK, destNetwork, token)) {
        return token;
      }
    }

    return null;
  }

  /**
   * Create a bridge leg using LayerZero or Stargate
   */
  private createBridgeLeg(
    legIndex: number,
    fromNetwork: NetworkId,
    toNetwork: NetworkId,
    token: BridgeTokenId,
    route: BridgeRouteConfig
  ): RouteLeg {
    const protocol = route.protocols.includes("stargate") ? "stargate" : "layerzero";
    const gasCost = GAS_COSTS[fromNetwork];
    
    return {
      legIndex,
      fromNetwork,
      fromToken: token,
      toNetwork,
      toToken: token,
      protocol,
      estimatedTimeMinutes: route.estimatedTimeMinutes,
      feePercentage: route.feePercentage,
      gasFeeUsd: gasCost ? (gasCost.bridgeGas * 30e-9 * gasCost.priceUsd) : 5,
      bridgeFeeUsd: 0, // Calculated from fee percentage
    };
  }

  /**
   * Create an FAssets bridge leg (XRP↔FXRP)
   */
  private createFAssetsLeg(
    legIndex: number,
    fromNetwork: NetworkId,
    toNetwork: NetworkId,
    fromToken: BridgeTokenId,
    toToken: BridgeTokenId
  ): RouteLeg {
    const isMinting = fromNetwork === "xrpl";
    
    return {
      legIndex,
      fromNetwork,
      fromToken,
      toNetwork,
      toToken,
      protocol: "fassets",
      estimatedTimeMinutes: isMinting ? 5 : 15, // Minting is faster than redemption
      feePercentage: 0.5,
      gasFeeUsd: isMinting ? 0.01 : 0.50, // XRPL tx fee vs Flare gas
      bridgeFeeUsd: 0,
    };
  }

  /**
   * Create a swap leg on the same chain
   */
  private createSwapLeg(
    legIndex: number,
    network: NetworkId,
    fromToken: BridgeTokenId,
    toToken: BridgeTokenId
  ): RouteLeg {
    const gasCost = GAS_COSTS[network];
    
    return {
      legIndex,
      fromNetwork: network,
      fromToken,
      toNetwork: network,
      toToken,
      protocol: "swap",
      estimatedTimeMinutes: 1,
      feePercentage: 0.3, // DEX swap fee
      gasFeeUsd: gasCost ? (gasCost.swapGas * 30e-9 * gasCost.priceUsd) : 1,
      bridgeFeeUsd: 0,
    };
  }

  /**
   * Calculate total fees for the route
   */
  private calculateFees(
    legs: RouteLeg[],
    amount: string,
    slippageBps: number
  ): { totalFeeUsd: number; gasFeeUsd: number; bridgeFeeUsd: number; slippageUsd: number } {
    const amountNum = parseFloat(amount);
    
    let gasFeeUsd = 0;
    let bridgeFeeUsd = 0;

    for (const leg of legs) {
      gasFeeUsd += leg.gasFeeUsd;
      const tokenPrice = TOKEN_PRICES_USD[leg.fromToken] || 1;
      bridgeFeeUsd += (amountNum * tokenPrice * leg.feePercentage) / 100;
    }

    // Slippage estimation based on tolerance
    const estimatedSlippage = amountNum * (slippageBps / 10000);
    const sourcePrice = TOKEN_PRICES_USD[legs[0]?.fromToken] || 1;
    const slippageUsd = estimatedSlippage * sourcePrice;

    return {
      totalFeeUsd: gasFeeUsd + bridgeFeeUsd + slippageUsd,
      gasFeeUsd,
      bridgeFeeUsd,
      slippageUsd,
    };
  }

  /**
   * Calculate estimated output amount after fees
   */
  private calculateOutputAmount(
    inputAmount: string,
    sourceToken: BridgeTokenId,
    destToken: BridgeTokenId,
    fees: { totalFeeUsd: number }
  ): string {
    const inputNum = parseFloat(inputAmount);
    const sourcePrice = TOKEN_PRICES_USD[sourceToken] || 1;
    const destPrice = TOKEN_PRICES_USD[destToken] || 1;

    // Calculate value in USD, subtract fees, convert to dest token
    const inputValueUsd = inputNum * sourcePrice;
    const outputValueUsd = inputValueUsd - fees.totalFeeUsd;
    const outputAmount = outputValueUsd / destPrice;

    // Format with appropriate decimals
    const destDecimals = BRIDGE_TOKENS[destToken]?.decimals || 6;
    return outputAmount.toFixed(Math.min(destDecimals, 8));
  }

  /**
   * Get all available destination networks from a source
   */
  getAvailableDestinations(sourceNetwork: NetworkId): NetworkId[] {
    const destinations = new Set<NetworkId>();

    // Direct routes
    for (const route of DEFAULT_BRIDGE_ROUTES) {
      if (route.from === sourceNetwork && route.isEnabled) {
        destinations.add(route.to);
      }
    }

    // Hub routes (through Flare)
    if (sourceNetwork !== this.HUB_NETWORK) {
      const canReachHub = this.findDirectRoute(sourceNetwork, this.HUB_NETWORK, "USDC") ||
                          (sourceNetwork === "xrpl"); // XRPL can always reach Flare via FAssets

      if (canReachHub) {
        for (const route of DEFAULT_BRIDGE_ROUTES) {
          if (route.from === this.HUB_NETWORK && route.isEnabled) {
            destinations.add(route.to);
          }
        }
      }
    }

    // Add XRPL if we're on Flare (FAssets redemption)
    if (sourceNetwork === this.HUB_NETWORK) {
      destinations.add("xrpl");
    }

    // Remove self
    destinations.delete(sourceNetwork);

    return Array.from(destinations);
  }

  /**
   * Get available tokens for a network pair
   */
  getAvailableTokens(
    sourceNetwork: NetworkId,
    destNetwork: NetworkId
  ): { sourceTokens: BridgeTokenId[]; destTokens: BridgeTokenId[] } {
    const sourceTokens = new Set<BridgeTokenId>();
    const destTokens = new Set<BridgeTokenId>();

    // Check direct routes
    for (const route of DEFAULT_BRIDGE_ROUTES) {
      if (route.from === sourceNetwork && route.to === destNetwork && route.isEnabled) {
        route.tokens.forEach(t => {
          sourceTokens.add(t);
          destTokens.add(t);
        });
      }
    }

    // Handle XRPL specifically
    if (sourceNetwork === "xrpl") {
      sourceTokens.add("XRP");
      if (destNetwork === "flare") {
        destTokens.add("FXRP");
      }
    }

    if (destNetwork === "xrpl") {
      destTokens.add("XRP");
      if (sourceNetwork === "flare") {
        sourceTokens.add("FXRP");
      }
    }

    // Add all Flare tokens for hub routing
    if (sourceNetwork === "flare" || this.findDirectRoute(sourceNetwork, "flare", "USDC")) {
      const flareTokens: BridgeTokenId[] = ["FXRP", "FLR", "WFLR", "USDC", "USDT", "sFLR", "flrETH"];
      flareTokens.forEach(t => {
        if (BRIDGE_TOKENS[t]?.addresses.flare) {
          sourceTokens.add(t);
        }
      });
    }

    return {
      sourceTokens: Array.from(sourceTokens),
      destTokens: Array.from(destTokens),
    };
  }

  /**
   * Validate a route is still executable
   */
  isRouteValid(quote: RouteQuote): boolean {
    // Check expiry
    if (new Date() > quote.expiresAt) {
      return false;
    }

    // Verify all legs still have valid routes
    for (const leg of quote.legs) {
      if (leg.protocol === "swap" || leg.protocol === "native") continue;
      
      if (leg.protocol === "fassets") {
        // FAssets always valid between XRPL and Flare
        continue;
      }

      const route = this.findDirectRoute(leg.fromNetwork, leg.toNetwork, leg.fromToken);
      if (!route) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get network configuration
   */
  getNetwork(id: NetworkId): NetworkConfig | undefined {
    return NETWORKS[id];
  }

  /**
   * Get token configuration
   */
  getToken(id: BridgeTokenId): TokenConfig | undefined {
    return BRIDGE_TOKENS[id];
  }

  /**
   * Get token price in USD
   */
  getTokenPrice(id: BridgeTokenId): number {
    return TOKEN_PRICES_USD[id] || 0;
  }
}

export const RouteRegistry = new RouteRegistryClass();
