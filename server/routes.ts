import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema } from "@shared/schema";
import { XummSdk } from "xumm-sdk";
import { Client } from "xrpl";
import type { BridgeService } from "./services/BridgeService";
import { DepositService } from "./services/DepositService";
import { VaultService } from "./services/VaultService";
import { YieldService } from "./services/YieldService";
import type { FlareClient } from "./utils/flare-client";
import type { MetricsService } from "./services/MetricsService";
import type { AlertingService } from "./services/AlertingService";
import { VaultDataService, setVaultDataService } from "./services/VaultDataService";
import { getPriceService } from "./services/PriceService";
import { getPositionService } from "./services/PositionService";
import { db } from "./db";
import { fxrpToXrpRedemptions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { readinessRegistry } from "./services/ReadinessRegistry";
import crypto from "crypto";
import { generateFDCProof } from "./utils/fdc-proof";
import { globalRateLimiter, strictRateLimiter } from "./middleware/rateLimiter";

/**
 * Admin authentication middleware for operational endpoints
 * Requires X-Admin-Key header matching ADMIN_API_KEY environment variable
 * 
 * Security: Uses a dedicated ADMIN_API_KEY separate from SESSION_SECRET
 * to prevent session secret exposure from compromising admin endpoints.
 */
const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const providedKey = req.headers['x-admin-key'];
  
  if (!providedKey || typeof providedKey !== 'string') {
    return res.status(401).json({ 
      error: "Unauthorized: X-Admin-Key header required" 
    });
  }
  
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) {
    console.error("ADMIN_API_KEY not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  // Validate minimum key length for security (at least 32 characters)
  if (providedKey.length < 32) {
    console.warn(`⚠️  Invalid admin key format from ${req.ip}`);
    return res.status(401).json({ error: "Unauthorized: Invalid admin key" });
  }
  
  // Use constant-time comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(adminApiKey);
  
  if (providedBuffer.length !== expectedBuffer.length || 
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    console.warn(`⚠️  Unauthorized admin access attempt from ${req.ip}`);
    return res.status(401).json({ error: "Unauthorized: Invalid admin key" });
  }
  
  console.log(`✅ Admin authenticated from ${req.ip}`);  // Log successful access for audit
  
  next();
};

/**
 * Get the latest deployed vault address from deployment files
 */
function getVaultAddress(): string {
  // Prioritize environment variable (source of truth for production)
  let vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
  
  // Fall back to deployment files if env var not set
  if (!vaultAddress || vaultAddress === "0x...") {
    try {
      const deploymentsDir = path.join(process.cwd(), "deployments");
      const files = fs.readdirSync(deploymentsDir)
        .filter(f => 
          f.startsWith("coston2-") && 
          f.endsWith(".json") && 
          f !== "coston2-latest.json" &&
          f !== "coston2-deployment.json" &&
          /coston2-\d+\.json/.test(f)
        )
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestDeployment = JSON.parse(
          fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
        );
        vaultAddress = latestDeployment.contracts?.ShXRPVault?.address;
      }
    } catch (error) {
      console.warn("Failed to read deployment file:", error);
    }
  }
  
  if (!vaultAddress || vaultAddress === "0x...") {
    throw new Error("ShXRP Vault not deployed");
  }
  
  return vaultAddress;
}

// Background verification for wallet-auto-submitted transactions
async function verifyWalletAutoSubmittedTransaction(txHash: string, network: string) {
  console.log(`[Background Verification] Starting for tx: ${txHash}`);
  
  const isTestnet = network === "testnet";
  const xrplServer = isTestnet 
    ? "wss://s.altnet.rippletest.net:51233"
    : "wss://xrplcluster.com";

  const client = new Client(xrplServer);
  await client.connect();

  try {
    // Poll for up to 30 seconds
    const maxAttempts = 15;
    const delay = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const txResponse = await client.request({
          command: 'tx',
          transaction: txHash,
        }) as any;

        const validated = txResponse?.result?.validated;
        const txResult = txResponse?.result?.meta?.TransactionResult;

        console.log(`[Background Verification] Attempt ${attempt}: validated=${validated}, result=${txResult}`);

        if (validated) {
          if (txResult === "tesSUCCESS") {
            console.log(`[Background Verification] ✅ Transaction ${txHash} confirmed successful!`);
            // TODO: Update transaction status in database to "confirmed"
            return { success: true, txHash, result: txResponse.result };
          } else {
            console.log(`[Background Verification] ❌ Transaction ${txHash} failed with ${txResult}`);
            // TODO: Mark transaction as failed and rollback position
            return { success: false, txHash, error: txResult };
          }
        }

        // Not validated yet, wait and retry
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (err) {
        // Transaction not found yet, continue polling
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.log(`[Background Verification] ⏱️ Timeout waiting for ${txHash} to validate`);
    return { success: false, txHash, error: "Validation timeout" };
  } finally {
    await client.disconnect();
  }
}

export async function registerRoutes(
  app: Express,
  bridgeService: BridgeService,
  flareClient?: FlareClient,
  metricsService?: MetricsService,
  alertingService?: AlertingService
): Promise<Server> {
  // Initialize VaultDataService for live on-chain data
  let vaultDataService: VaultDataService | undefined;
  if (flareClient) {
    vaultDataService = new VaultDataService({
      storage,
      flareClient
    });
    // Register as singleton for PositionService to use
    setVaultDataService(vaultDataService);
    vaultDataService.initialize().catch(err => 
      console.warn("VaultDataService initialization warning:", err)
    );
  }

  // Health check endpoints (must be first for fast startup verification)
  
  // Liveness probe - Always returns 200 OK if server is running
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness probe - Returns 200 only if all critical services are ready
  app.get("/readyz", (_req, res) => {
    const status = readinessRegistry.getStatus();
    const httpStatus = status.ready ? 200 : 503;
    res.status(httpStatus).json(status);
  });

  // Serve whitepaper PDF
  app.get("/whitepaper.pdf", (_req, res) => {
    const pdfPath = path.resolve(import.meta.dirname, "..", "public", "whitepaper.pdf");
    if (fs.existsSync(pdfPath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=whitepaper.pdf");
      res.sendFile(pdfPath);
    } else {
      res.status(404).json({ error: "Whitepaper not found" });
    }
  });

  // Prometheus metrics endpoint - Exports metrics for external monitoring tools (Prometheus, Grafana)
  app.get("/metrics", async (_req, res) => {
    try {
      if (!metricsService || !metricsService.isReady()) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.status(503).send("# Metrics service not ready\n");
      }

      const [vaultMetrics, bridgeMetrics, txMetrics] = await Promise.all([
        metricsService.getVaultMetrics(),
        metricsService.getBridgeMetrics(),
        metricsService.getTransactionMetrics(),
      ]);

      // Format as Prometheus text format
      let output = "# HELP xrp_liquid_staking_tvl_usd Total value locked in USD\n";
      output += "# TYPE xrp_liquid_staking_tvl_usd gauge\n";
      output += `xrp_liquid_staking_tvl_usd ${parseFloat(vaultMetrics.tvl) || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_apy_percent Average APY percentage\n";
      output += "# TYPE xrp_liquid_staking_apy_percent gauge\n";
      output += `xrp_liquid_staking_apy_percent ${vaultMetrics.apy || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_active_users Number of active users\n";
      output += "# TYPE xrp_liquid_staking_active_users gauge\n";
      output += `xrp_liquid_staking_active_users ${vaultMetrics.activeUsers || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_total_stakers Total users staking SHIELD\n";
      output += "# TYPE xrp_liquid_staking_total_stakers gauge\n";
      output += `xrp_liquid_staking_total_stakers ${vaultMetrics.stakingAdoption.totalStakers || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_avg_boost_percentage Average SHIELD staking boost percentage\n";
      output += "# TYPE xrp_liquid_staking_avg_boost_percentage gauge\n";
      output += `xrp_liquid_staking_avg_boost_percentage ${vaultMetrics.stakingAdoption.avgBoostPercentage || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_total_shield_staked Total SHIELD tokens staked\n";
      output += "# TYPE xrp_liquid_staking_total_shield_staked gauge\n";
      output += `xrp_liquid_staking_total_shield_staked ${parseFloat(vaultMetrics.stakingAdoption.totalShieldStaked) || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_pending_operations Number of pending bridge operations\n";
      output += "# TYPE xrp_liquid_staking_bridge_pending_operations gauge\n";
      output += `xrp_liquid_staking_bridge_pending_operations ${bridgeMetrics.pendingOperations || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_avg_redemption_time_seconds Average redemption time in seconds\n";
      output += "# TYPE xrp_liquid_staking_bridge_avg_redemption_time_seconds gauge\n";
      output += `xrp_liquid_staking_bridge_avg_redemption_time_seconds ${bridgeMetrics.avgRedemptionTime || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_stuck_transactions Number of stuck bridge transactions\n";
      output += "# TYPE xrp_liquid_staking_bridge_stuck_transactions gauge\n";
      output += `xrp_liquid_staking_bridge_stuck_transactions ${bridgeMetrics.stuckTransactions || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_failure_rate_percent Bridge failure rate percentage\n";
      output += "# TYPE xrp_liquid_staking_bridge_failure_rate_percent gauge\n";
      output += `xrp_liquid_staking_bridge_failure_rate_percent ${bridgeMetrics.failureRate || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_success_rate_percent Bridge success rate percentage\n";
      output += "# TYPE xrp_liquid_staking_bridge_success_rate_percent gauge\n";
      output += `xrp_liquid_staking_bridge_success_rate_percent ${100 - (bridgeMetrics.failureRate || 0)}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_successful_24h Successful bridges in last 24 hours\n";
      output += "# TYPE xrp_liquid_staking_bridge_successful_24h gauge\n";
      output += `xrp_liquid_staking_bridge_successful_24h ${bridgeMetrics.successfulBridges24h || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_failures_fdc_proof Bridge failures due to FDC proof issues\n";
      output += "# TYPE xrp_liquid_staking_bridge_failures_fdc_proof gauge\n";
      output += `xrp_liquid_staking_bridge_failures_fdc_proof ${bridgeMetrics.failuresByType.fdcProof || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_failures_xrpl_payment Bridge failures due to XRPL payment issues\n";
      output += "# TYPE xrp_liquid_staking_bridge_failures_xrpl_payment gauge\n";
      output += `xrp_liquid_staking_bridge_failures_xrpl_payment ${bridgeMetrics.failuresByType.xrplPayment || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_failures_confirmation Bridge failures due to confirmation delays\n";
      output += "# TYPE xrp_liquid_staking_bridge_failures_confirmation gauge\n";
      output += `xrp_liquid_staking_bridge_failures_confirmation ${bridgeMetrics.failuresByType.confirmation || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_bridge_failures_other Bridge failures due to other reasons\n";
      output += "# TYPE xrp_liquid_staking_bridge_failures_other gauge\n";
      output += `xrp_liquid_staking_bridge_failures_other ${bridgeMetrics.failuresByType.other || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_etherspot_success_rate_percent Etherspot transaction success rate percentage\n";
      output += "# TYPE xrp_liquid_staking_etherspot_success_rate_percent gauge\n";
      output += `xrp_liquid_staking_etherspot_success_rate_percent ${txMetrics.etherspotSuccessRate || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_gas_sponsored_count Number of gas-sponsored transactions\n";
      output += "# TYPE xrp_liquid_staking_gas_sponsored_count gauge\n";
      output += `xrp_liquid_staking_gas_sponsored_count ${txMetrics.gasSponsoredCount || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_direct_payment_count Number of direct payment transactions\n";
      output += "# TYPE xrp_liquid_staking_direct_payment_count gauge\n";
      output += `xrp_liquid_staking_direct_payment_count ${txMetrics.directPaymentCount || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_failed_userops_count Number of failed UserOps\n";
      output += "# TYPE xrp_liquid_staking_failed_userops_count gauge\n";
      output += `xrp_liquid_staking_failed_userops_count ${txMetrics.failedUserOpsCount || 0}\n\n`;

      output += "# HELP xrp_liquid_staking_total_transactions_count Total transactions all-time\n";
      output += "# TYPE xrp_liquid_staking_total_transactions_count gauge\n";
      output += `xrp_liquid_staking_total_transactions_count ${txMetrics.totalTransactions || 0}\n\n`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(output);
    } catch (error) {
      console.error("Error generating metrics:", error);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.status(500).send("# Error generating metrics\n");
    }
  });

  // Readiness guard middleware - Return 503 for /api/* routes if services not ready
  app.use("/api", (req, res, next) => {
    if (!readinessRegistry.allCriticalServicesReady()) {
      const status = readinessRegistry.getStatus();
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "System is initializing. Please try again in a few moments.",
        services: status.services
      });
    }
    next();
  });

  // Global rate limiting for all API routes (100 requests per minute per IP)
  app.use("/api", globalRateLimiter);

  // Get all vaults with live on-chain data
  app.get("/api/vaults", async (_req, res) => {
    try {
      // Use VaultDataService for enriched vaults with on-chain TVL, price, etc.
      if (vaultDataService && vaultDataService.isReady()) {
        const enrichedVaults = await vaultDataService.getEnrichedVaults();
        return res.json(enrichedVaults);
      }
      
      // Fallback: try basic enrichment with flareClient if VaultDataService not ready
      const vaults = await storage.getVaults();
      
      if (flareClient && vaults.length > 0) {
        try {
          const vaultAddress = getVaultAddress();
          const vaultContract = flareClient.getShXRPVault(vaultAddress) as any;
          
          const [depositLimitRaw, paused] = await Promise.all([
            vaultContract.depositLimit().catch(() => null),
            vaultContract.paused().catch(() => null)
          ]);
          
          if (depositLimitRaw !== null && paused !== null) {
            const enrichedVaults = vaults.map((vault, index) => {
              if (index === 0) {
                return {
                  ...vault,
                  contractAddress: vaultAddress,
                  depositLimit: ethers.formatUnits(depositLimitRaw, 6).toString(),
                  depositLimitRaw: depositLimitRaw.toString(),
                  paused
                };
              }
              return { ...vault, contractAddress: vaultAddress };
            });
            return res.json(enrichedVaults);
          } else {
            const enrichedVaults = vaults.map((vault) => ({
              ...vault,
              contractAddress: vaultAddress
            }));
            return res.json(enrichedVaults);
          }
        } catch (contractError) {
          const vaultAddress = getVaultAddress();
          const enrichedVaults = vaults.map((vault) => ({
            ...vault,
            contractAddress: vaultAddress
          }));
          return res.json(enrichedVaults);
        }
      } else {
        return res.json(vaults);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vaults" });
    }
  });

  // Get vault by ID
  app.get("/api/vaults/:id", async (req, res) => {
    try {
      const vault = await storage.getVault(req.params.id);
      if (!vault) {
        return res.status(404).json({ error: "Vault not found" });
      }
      res.json(vault);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault" });
    }
  });

  // ============================================================
  // PRICE API ENDPOINTS
  // ============================================================

  /**
   * GET /api/prices
   * Get prices for multiple tokens
   * Query params: symbols=XRP,FLR,FXRP (comma-separated)
   */
  app.get("/api/prices", async (req, res) => {
    try {
      const priceService = getPriceService();
      if (!priceService.isReady()) {
        await priceService.initialize();
      }

      const symbolsParam = req.query.symbols as string;
      const symbols = symbolsParam 
        ? symbolsParam.split(',').map(s => s.trim().toUpperCase())
        : ['XRP', 'FLR', 'FXRP', 'SHIELD'];

      const priceMap = await priceService.getPrices(symbols);
      
      const prices: { [key: string]: number } = {};
      priceMap.forEach((price, symbol) => {
        prices[symbol] = price;
      });

      res.json({
        success: true,
        prices,
        timestamp: Date.now(),
        source: 'priceService'
      });
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch prices"
      });
    }
  });

  /**
   * GET /api/prices/stats
   * Get price service cache statistics
   * NOTE: Must be defined BEFORE /api/prices/:symbol to avoid matching as a symbol
   */
  app.get("/api/prices/stats", async (_req, res) => {
    try {
      const priceService = getPriceService();
      if (!priceService.isReady()) {
        await priceService.initialize();
      }

      const stats = priceService.getCacheStats();
      res.json({
        success: true,
        ...stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch price stats"
      });
    }
  });

  /**
   * GET /api/prices/:symbol
   * Get price for a specific token
   */
  app.get("/api/prices/:symbol", async (req, res) => {
    try {
      const priceService = getPriceService();
      if (!priceService.isReady()) {
        await priceService.initialize();
      }

      const symbol = req.params.symbol.toUpperCase();
      const price = await priceService.getPrice(symbol);
      const cached = priceService.getAllCachedPrices()[symbol];

      res.json({
        success: true,
        symbol,
        price,
        source: cached?.source || 'unknown',
        timestamp: cached?.timestamp || Date.now()
      });
    } catch (error) {
      console.error(`Failed to fetch price for ${req.params.symbol}:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch price"
      });
    }
  });

  // Get bridge by ID (for polling bridge status)
  app.get("/api/bridges/:id", async (req, res) => {
    try {
      const bridge = await storage.getBridgeById(req.params.id);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }
      res.json(bridge);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bridge status" });
    }
  });

  // Get FXRP vault information (read-only for frontend)
  app.get("/api/vaults/fxrp/info", async (_req, res) => {
    try {
      if (!flareClient) {
        return res.status(503).json({
          success: false,
          error: "Flare client not configured"
        });
      }

      // Get vault address from environment or deployment
      const vaultAddress = getVaultAddress();
      
      // Get FXRP token address from Flare AssetManager
      const fxrpTokenAddress = await flareClient.getFAssetTokenAddress();

      res.json({
        success: true,
        vaultAddress,
        fxrpTokenAddress,
      });
    } catch (error) {
      console.error("Failed to get vault info:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get vault information"
      });
    }
  });

  // Track FXRP deposit (no execution, only tracking) (stricter rate limit: 20/min)
  app.post("/api/deposits/fxrp/track", strictRateLimiter, async (req, res) => {
    try {
      const { 
        userAddress, 
        evmAddress, 
        amount, 
        depositHash, // New field name from frontend
        approveHash, // New field name from frontend
        vaultAddress, // New field from frontend
        tokenAddress, // New field from frontend
        // Backward compatibility - fallback to old field names
        txHash = depositHash, 
        approveTxHash = approveHash 
      } = req.body;
      
      // Use the resolved field names for validation
      if (!userAddress || !evmAddress || !amount || !txHash) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userAddress, evmAddress, amount, depositHash (or txHash)" 
        });
      }

      // Validate EVM address format
      if (!ethers.isAddress(evmAddress)) {
        return res.status(400).json({
          success: false,
          error: "Invalid EVM address format"
        });
      }

      // Look for FXRP vault in database
      const vaults = await storage.getVaults();
      const fxrpVault = vaults.find(v => v.asset === "FXRP" && v.status === "active");
      if (!fxrpVault) {
        return res.status(404).json({
          success: false,
          error: "FXRP vault not found or not active"
        });
      }

      // Create transaction record for tracking
      const transaction = await storage.createTransaction({
        walletAddress: userAddress,
        vaultId: fxrpVault.id,
        positionId: undefined,
        type: "direct_fxrp_deposit",
        amount,
        status: "completed", // Already completed on-chain
        txHash,
        network: (await flareClient?.provider._network)?.name === "flare" ? "mainnet" : "testnet",
      });

      // Update or create position
      let position = await storage.getPositionByWalletAndVault(userAddress, fxrpVault.id);
      
      if (position) {
        // Accumulate to existing position
        const newAmount = (parseFloat(position.amount) + parseFloat(amount)).toString();
        position = await storage.updatePosition(position.id, {
          amount: newAmount,
          status: "active",
        });
      } else {
        // Create new position
        position = await storage.createPosition({
          walletAddress: userAddress,
          vaultId: fxrpVault.id,
          amount,
          rewards: "0",
          status: "active",
        });
      }

      // Update transaction with position ID
      await storage.updateTransaction(transaction.id, {
        positionId: position.id,
      });

      res.json({
        success: true,
        depositId: transaction.id,
        positionId: position.id
      });
    } catch (error) {
      console.error("Failed to track FXRP deposit:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to track FXRP deposit"
      });
    }
  });

  // Track FXRP withdrawal (no execution, only tracking) (stricter rate limit: 20/min)
  app.post("/api/withdrawals/fxrp/track", strictRateLimiter, async (req, res) => {
    try {
      const { 
        userAddress, 
        evmAddress, 
        amount, 
        withdrawHash, // New field name from frontend
        vaultAddress, // New field from frontend
        tokenAddress, // New field from frontend
        // Backward compatibility - fallback to old field name
        txHash = withdrawHash 
      } = req.body;

      // Use the resolved field name for validation
      if (!userAddress || !evmAddress || !amount || !txHash) {
        return res.status(400).json({ 
          success: false,
          error: "Missing required fields: userAddress, evmAddress, amount, withdrawHash (or txHash)" 
        });
      }

      // Validate EVM address format
      if (!ethers.isAddress(evmAddress)) {
        return res.status(400).json({
          success: false,
          error: "Invalid EVM address format"
        });
      }

      // Look for FXRP vault in database
      const vaults = await storage.getVaults();
      const fxrpVault = vaults.find(v => v.asset === "FXRP" && v.status === "active");
      if (!fxrpVault) {
        return res.status(404).json({
          success: false,
          error: "FXRP vault not found or not active"
        });
      }

      // Create transaction record for tracking
      const transaction = await storage.createTransaction({
        walletAddress: userAddress,
        vaultId: fxrpVault.id,
        positionId: undefined,
        type: "direct_fxrp_withdrawal",
        amount,
        status: "completed", // Already completed on-chain
        txHash,
        network: (await flareClient?.provider._network)?.name === "flare" ? "mainnet" : "testnet",
      });

      // Get position for this user and vault
      const position = await storage.getPositionByWalletAndVault(userAddress, fxrpVault.id);
      if (position) {
        // Update position - reduce deposited amount
        const newAmount = Math.max(0, parseFloat(position.amount) - parseFloat(amount));
        
        if (newAmount > 0) {
          // Update position with reduced amount
          await storage.updatePosition(position.id, {
            amount: newAmount.toString(),
            status: "active",
          });
        } else {
          // Position fully withdrawn - mark as withdrawn
          await storage.updatePosition(position.id, {
            amount: "0",
            status: "withdrawn",
          });
        }

        // Update transaction with position ID
        await storage.updateTransaction(transaction.id, {
          positionId: position.id,
        });
      }

      res.json({
        success: true,
        withdrawalId: transaction.id,
        positionId: position?.id
      });
    } catch (error) {
      console.error("Failed to track FXRP withdrawal:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to track FXRP withdrawal"
      });
    }
  });

  // Get direct FXRP deposit status
  app.get("/api/deposits/fxrp/status/:depositId", async (req, res) => {
    try {
      const vaultService = new VaultService({
        storage,
        flareClient: flareClient!
      });

      const depositService = new DepositService({
        storage,
        bridgeService,
        vaultService,
        yieldService: new YieldService({
          storage,
          flareClient: flareClient!,
          firelightVaultAddress: process.env.FIRELIGHT_VAULT_ADDRESS || ""
        }),
        flareClient
      });

      const status = await depositService.getDirectTransactionStatus(req.params.depositId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch deposit status" 
      });
    }
  });

  // Get direct FXRP withdrawal status
  app.get("/api/withdrawals/fxrp/status/:withdrawalId", async (req, res) => {
    try {
      const vaultService = new VaultService({
        storage,
        flareClient: flareClient!
      });

      const depositService = new DepositService({
        storage,
        bridgeService,
        vaultService,
        yieldService: new YieldService({
          storage,
          flareClient: flareClient!,
          firelightVaultAddress: process.env.FIRELIGHT_VAULT_ADDRESS || ""
        }),
        flareClient
      });

      const status = await depositService.getDirectTransactionStatus(req.params.withdrawalId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        error: "Failed to fetch withdrawal status" 
      });
    }
  });

  // Manual payment reconciliation endpoint
  app.post("/api/bridges/:bridgeId/reconcile-payment", async (req, res) => {
    try {
      const { bridgeId } = req.params;
      const { xrplTxHash } = req.body;

      if (!xrplTxHash) {
        return res.status(400).json({ error: "Missing required field: xrplTxHash" });
      }

      console.log(`🔍 Manual reconciliation requested for bridge ${bridgeId}, tx: ${xrplTxHash}`);

      // 1. Get bridge and verify status
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      if (bridge.status !== "awaiting_payment") {
        return res.status(400).json({ 
          error: `Bridge is in '${bridge.status}' status, expected 'awaiting_payment'`,
          currentStatus: bridge.status 
        });
      }

      if (!bridge.agentUnderlyingAddress) {
        return res.status(400).json({ error: "Bridge does not have an agent address assigned" });
      }

      // 2. Determine network and connect to XRPL
      const network = bridge.walletAddress.startsWith("r") ? "testnet" : "testnet"; // Default to testnet for now
      const xrplServer = network === "testnet" 
        ? "wss://s.altnet.rippletest.net:51233"
        : "wss://xrplcluster.com";

      console.log(`Connecting to XRPL ${network} to verify transaction...`);
      const client = new Client(xrplServer);
      await client.connect();

      try {
        // 3. Fetch transaction from XRPL
        const txResponse = await client.request({
          command: 'tx',
          transaction: xrplTxHash,
        }) as any;

        console.log("Transaction fetched:", JSON.stringify(txResponse.result, null, 2));

        const validated = txResponse?.result?.validated;
        const txResult = txResponse?.result?.meta?.TransactionResult;
        const txType = txResponse?.result?.tx_json?.TransactionType;
        const destination = txResponse?.result?.tx_json?.Destination;
        const amount = txResponse?.result?.tx_json?.DeliverMax || txResponse?.result?.tx_json?.Amount;

        // 4. Validate transaction
        if (!validated) {
          await client.disconnect();
          return res.status(400).json({ 
            error: "Transaction is not yet validated on the ledger",
            validated: false 
          });
        }

        if (txResult !== "tesSUCCESS") {
          await client.disconnect();
          return res.status(400).json({ 
            error: `Transaction failed with result: ${txResult}`,
            txResult 
          });
        }

        if (txType !== "Payment") {
          await client.disconnect();
          return res.status(400).json({ 
            error: `Transaction is not a Payment, got: ${txType}`,
            txType 
          });
        }

        // 5. Validate destination matches agent address
        if (destination !== bridge.agentUnderlyingAddress) {
          await client.disconnect();
          return res.status(400).json({ 
            error: "Payment destination does not match bridge agent address",
            expected: bridge.agentUnderlyingAddress,
            actual: destination
          });
        }

        // 6. Validate amount (convert drops to XRP)
        let amountXRP: number;
        if (typeof amount === 'string') {
          amountXRP = parseInt(amount) / 1_000_000;
        } else {
          await client.disconnect();
          return res.status(400).json({ 
            error: "Invalid amount format in transaction",
            amount 
          });
        }

        const expectedXRP = parseFloat(bridge.xrpAmount.toString());
        if (amountXRP < expectedXRP) {
          await client.disconnect();
          return res.status(400).json({ 
            error: "Payment amount is less than bridge amount",
            expected: expectedXRP,
            actual: amountXRP
          });
        }

        console.log(`✅ Transaction validated: ${amountXRP} XRP sent to ${destination}`);

        // 7. Update bridge status to xrpl_confirmed
        await storage.updateBridgeStatus(bridgeId, "xrpl_confirmed", {
          xrplTxHash: xrplTxHash,
          xrplConfirmedAt: new Date(),
        });

        // 8. Trigger minting with proof
        console.log(`Triggering minting for bridge ${bridgeId}...`);
        await bridgeService.executeMintingWithProof(bridgeId, xrplTxHash);

        await client.disconnect();

        res.json({ 
          success: true, 
          message: "Payment reconciled successfully",
          bridgeId,
          xrplTxHash,
          amountXRP,
          destination
        });

      } catch (txError) {
        await client.disconnect();
        throw txError;
      }

    } catch (error) {
      console.error("Payment reconciliation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to reconcile payment" });
      }
    }
  });

  // Retry FDC proof generation for timed-out bridges
  app.post("/api/bridges/:id/retry-proof", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      
      console.log(`🔄 Retry proof generation requested for bridge ${bridgeId}`);

      // Call BridgeService.retryProofGeneration
      await bridgeService.retryProofGeneration(bridgeId);

      // Fetch updated bridge status
      const updatedBridge = await storage.getBridgeById(bridgeId);
      if (!updatedBridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      res.json({
        success: true,
        message: "FDC proof generation retry initiated",
        bridge: updatedBridge
      });
    } catch (error) {
      console.error("Retry proof generation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to retry proof generation" });
      }
    }
  });

  // Recovery endpoint: Trigger FDC proof generation for stuck bridges
  app.post("/api/bridges/:id/recover-proof", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      
      if (!bridgeId) {
        return res.status(400).json({ error: "Bridge ID is required" });
      }

      // 1. Get the bridge
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      // 2. Verify bridge is stuck at xrpl_confirmed
      if (bridge.status !== "xrpl_confirmed") {
        return res.status(400).json({ 
          error: "Bridge is not in xrpl_confirmed status",
          currentStatus: bridge.status,
          message: "This recovery endpoint is only for bridges stuck at xrpl_confirmed"
        });
      }

      // 3. Verify we have XRPL transaction hash
      if (!bridge.xrplTxHash) {
        return res.status(400).json({ 
          error: "Bridge has no XRPL transaction hash",
          message: "Cannot generate FDC proof without XRPL transaction hash"
        });
      }

      // 4. Check if proof already exists
      if (bridge.fdcProofData) {
        return res.status(400).json({ 
          error: "Bridge already has FDC proof data",
          message: "FDC proof was already generated. Bridge may be stuck at a later stage."
        });
      }

      console.log(`🔧 Recovery: Triggering FDC proof generation for bridge ${bridgeId}`);
      console.log(`   XRPL TX: ${bridge.xrplTxHash}`);

      // 5. Trigger proof generation and minting
      await bridgeService.executeMintingWithProof(bridgeId, bridge.xrplTxHash);

      res.json({ 
        success: true, 
        message: "FDC proof generation triggered successfully",
        bridgeId,
        xrplTxHash: bridge.xrplTxHash
      });

    } catch (error) {
      console.error("FDC proof recovery error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to recover FDC proof generation" });
      }
    }
  });

  // Reconcile individual bridge - smart recovery based on status and error
  app.post("/api/bridges/:id/reconcile", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      
      console.log(`🔄 Reconciliation requested for bridge ${bridgeId}`);

      const result = await bridgeService.reconcileBridge(bridgeId);

      // Fetch updated bridge status
      const updatedBridge = await storage.getBridgeById(bridgeId);

      res.json({
        success: result.success,
        message: result.message,
        action: result.action,
        bridge: updatedBridge
      });
    } catch (error) {
      console.error("Bridge reconciliation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to reconcile bridge" });
      }
    }
  });

  // Cancel a bridge deposit
  app.post("/api/bridges/:id/cancel", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      const { walletAddress, signedTxBlob } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: "Missing required field: walletAddress" });
      }

      if (!signedTxBlob) {
        return res.status(400).json({ 
          error: "Missing required field: signedTxBlob",
          message: "Please sign the cancellation request with your wallet"
        });
      }

      console.log(`🚫 Cancellation requested for bridge ${bridgeId} by ${walletAddress}`);

      // 1. Get bridge
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      // 2. Verify wallet ownership matches bridge
      if (bridge.walletAddress !== walletAddress) {
        return res.status(403).json({ 
          error: "Unauthorized - you can only cancel your own deposits",
          bridgeWallet: bridge.walletAddress,
          requestWallet: walletAddress
        });
      }

      // 3. Verify XRPL signature using verify-xrpl-signature library
      let verificationResult;
      try {
        const { verifySignature } = await import("verify-xrpl-signature");
        verificationResult = verifySignature(signedTxBlob);
        
        if (!verificationResult.signatureValid) {
          return res.status(401).json({ 
            error: "Invalid signature",
            message: "The signed transaction could not be verified"
          });
        }

        // Verify the signer matches the wallet address
        if (verificationResult.signedBy !== walletAddress) {
          return res.status(401).json({ 
            error: "Signature mismatch",
            message: `Transaction was signed by ${verificationResult.signedBy}, but expected ${walletAddress}`,
            signedBy: verificationResult.signedBy,
            expected: walletAddress
          });
        }

        console.log(`✅ Signature cryptographically verified for wallet ${walletAddress}`);
      } catch (signatureError) {
        console.error("Signature verification error:", signatureError);
        return res.status(401).json({ 
          error: "Signature verification failed",
          message: signatureError instanceof Error ? signatureError.message : "Unable to verify signature"
        });
      }

      // 4. Decode and verify transaction content to prevent replay attacks
      try {
        const { decode } = await import("ripple-binary-codec");
        const decodedTx = decode(signedTxBlob) as any;
        
        // Verify it's a SignIn transaction
        if (decodedTx.TransactionType !== "SignIn") {
          return res.status(400).json({ 
            error: "Invalid transaction type",
            message: `Expected SignIn transaction, got ${decodedTx.TransactionType}`
          });
        }

        // Extract and decode memo
        if (!decodedTx.Memos || decodedTx.Memos.length === 0) {
          return res.status(400).json({ 
            error: "Missing memo",
            message: "SignIn transaction must include cancellation message in memo"
          });
        }

        const memoData = decodedTx.Memos[0]?.Memo?.MemoData;
        if (!memoData) {
          return res.status(400).json({ 
            error: "Invalid memo format",
            message: "Memo data is missing"
          });
        }

        // Decode hex memo data to string
        const cancelMessage = Buffer.from(memoData, 'hex').toString('utf8');
        console.log(`📝 Decoded cancel message: ${cancelMessage}`);

        // Verify canonical format: cancel:{bridgeId}:{timestamp}
        const expectedPrefix = `cancel:${bridgeId}:`;
        if (!cancelMessage.startsWith(expectedPrefix)) {
          return res.status(400).json({ 
            error: "Invalid cancel message format",
            message: `Message must start with 'cancel:${bridgeId}:'`,
            received: cancelMessage.substring(0, 50)
          });
        }

        // Extract and verify timestamp
        const parts = cancelMessage.split(':');
        if (parts.length !== 3 || parts[0] !== 'cancel' || parts[1] !== bridgeId) {
          return res.status(400).json({ 
            error: "Malformed cancel message",
            message: "Expected format: cancel:{bridgeId}:{timestamp}",
            received: cancelMessage
          });
        }

        const messageTimestamp = parseInt(parts[2]);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        if (isNaN(messageTimestamp) || messageTimestamp > now || (now - messageTimestamp) > fiveMinutes) {
          return res.status(400).json({ 
            error: "Expired cancellation request",
            message: "Cancellation must be signed within the last 5 minutes",
            signedAt: new Date(messageTimestamp).toISOString(),
            expiresAfter: "5 minutes"
          });
        }

        console.log(`✅ Transaction content verified`);
        console.log(`   Transaction type: ${decodedTx.TransactionType}`);
        console.log(`   Bridge ID: ${parts[1]}`);
        console.log(`   Timestamp: ${new Date(messageTimestamp).toISOString()}`);
        console.log(`   Age: ${Math.round((now - messageTimestamp) / 1000)}s`);
        
        // 5. Check for replay attacks by tracking used cancel messages
        // In production, store nonces in database/Redis with TTL
        const usedNoncesKey = `cancel-nonces-${bridgeId}`;
        const globalNonces = (global as any)[usedNoncesKey] || new Set<string>();
        
        if (globalNonces.has(cancelMessage)) {
          return res.status(400).json({ 
            error: "Duplicate cancellation request",
            message: "This signature has already been used to cancel this bridge",
            detail: "Replay attack prevented"
          });
        }
        
        // Store nonce to prevent reuse
        globalNonces.add(cancelMessage);
        (global as any)[usedNoncesKey] = globalNonces;
        
        console.log(`✅ Nonce validated - first use of this signature`);
      } catch (decodeError) {
        console.error("Transaction decode error:", decodeError);
        return res.status(400).json({ 
          error: "Failed to decode transaction",
          message: decodeError instanceof Error ? decodeError.message : "Invalid transaction blob"
        });
      }

      // 6. Check if bridge is already in a terminal state
      if (["completed", "cancelled", "failed"].includes(bridge.status)) {
        return res.status(400).json({ 
          error: `Cannot cancel bridge in '${bridge.status}' status`,
          currentStatus: bridge.status
        });
      }

      // 7. Check if bridge has already started minting (point of no return)
      if (["minting", "vault_minting", "vault_minted"].includes(bridge.status)) {
        return res.status(400).json({ 
          error: "Cannot cancel bridge - minting has already started",
          currentStatus: bridge.status,
          message: "Please wait for the deposit to complete or contact support if there's an issue"
        });
      }

      // 8. Check if bridge is expired
      if (bridge.expiresAt && new Date() > bridge.expiresAt) {
        return res.status(400).json({ 
          error: "Bridge has already expired",
          expiredAt: bridge.expiresAt,
          message: "This deposit request has been automatically cancelled due to expiration"
        });
      }

      // 9. Cancel the bridge
      await storage.updateBridge(bridgeId, {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "user_cancelled"
      });

      console.log(`✅ Bridge ${bridgeId} cancelled successfully by user`);

      const updatedBridge = await storage.getBridgeById(bridgeId);
      res.json({
        success: true,
        message: "Deposit cancelled successfully",
        bridge: updatedBridge
      });
    } catch (error) {
      console.error("Bridge cancellation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to cancel bridge" });
      }
    }
  });

  // Get all recoverable bridges
  app.get("/api/bridges/recoverable", async (req, res) => {
    try {
      const recoverableBridges = await storage.getRecoverableBridges();
      res.json(recoverableBridges);
    } catch (error) {
      console.error("Failed to fetch recoverable bridges:", error);
      res.status(500).json({ error: "Failed to fetch recoverable bridges" });
    }
  });

  // Reconcile all recoverable bridges
  app.post("/api/bridges/reconcile-all", async (req, res) => {
    try {
      console.log(`🔄 Bulk reconciliation requested`);

      const result = await bridgeService.reconcileAll();

      res.json({
        success: true,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        results: result.results
      });
    } catch (error) {
      console.error("Bulk reconciliation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to reconcile bridges" });
      }
    }
  });

  // User-initiated bridge cancellation
  app.post("/api/bridges/:id/user-cancel", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: "Missing required field: walletAddress" });
      }

      if (!bridgeId) {
        return res.status(400).json({ error: "Missing required field: bridgeId" });
      }

      // Fetch bridge to validate status before cancellation
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      // Validate bridge can be cancelled (only before XRPL transaction is confirmed)
      // Once xrpl_confirmed, the XRP has been sent and minting is in progress
      const cancellableStatuses = ["pending", "reserving_collateral", "bridging", "awaiting_payment"];
      if (!cancellableStatuses.includes(bridge.status)) {
        console.warn(`⚠️ Cancellation blocked for bridge ${bridgeId}: status=${bridge.status} (after XRPL confirmation)`);
        return res.status(400).json({ 
          error: "Cannot cancel deposit", 
          message: "This deposit cannot be cancelled because the XRPL transaction has been confirmed and minting is in progress."
        });
      }

      console.log(`🚫 User-initiated cancellation for bridge ${bridgeId} by ${walletAddress}`);

      // Call BridgeService to cancel the bridge
      const result = await bridgeService.cancelBridge(bridgeId, walletAddress, "Cancelled by user");

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      // Fetch updated bridge to return to client
      const updatedBridge = await storage.getBridgeById(bridgeId);

      res.json({
        success: true,
        message: result.message,
        bridge: updatedBridge
      });
    } catch (error) {
      console.error("Bridge cancellation error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to cancel bridge" });
      }
    }
  });

  // Create deposit via FAssets bridge (stricter rate limit: 20/min)
  app.post("/api/deposits", strictRateLimiter, async (req, res) => {
    try {
      const { walletAddress, vaultId, amount, network } = req.body;
      
      if (!walletAddress || !vaultId || !amount) {
        return res.status(400).json({ error: "Missing required fields: walletAddress, vaultId, amount" });
      }

      // Get vault to check if it's an XRP vault
      const vault = await storage.getVault(vaultId);
      if (!vault) {
        return res.status(404).json({ error: "Vault not found" });
      }

      // Check if vault is coming soon
      if ((vault as any).comingSoon === true) {
        console.warn(`[DEPOSIT_BLOCKED] Vault ${vault.name} is coming soon - deposit rejected for ${walletAddress}`);
        return res.status(403).json({ 
          error: "Vault not available", 
          message: "This vault is currently under development and not accepting deposits yet." 
        });
      }

      const vaultAssets = vault.asset.split(",").map(a => a.trim());
      const isXRPVault = vaultAssets.includes("XRP");

      if (!isXRPVault) {
        return res.status(400).json({ error: "This endpoint is only for XRP deposits. Use POST /api/positions for other assets." });
      }

      // Calculate lot-rounded amount BEFORE creating bridge
      const lotCalculation = await bridgeService.calculateLotRoundedAmount(amount);

      // Create bridge record with 30-minute expiration
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const bridge = await storage.createBridge({
        vaultId,
        walletAddress,
        xrpAmount: lotCalculation.roundedAmount, // Lot-rounded amount (used for bridge)
        requestedXrpAmount: lotCalculation.requestedAmount, // Always store user's original input for audit trail
        fxrpExpected: lotCalculation.roundedAmount, // 1:1 for now
        status: 'pending',
        expiresAt,
      });

      // Get vault name for response
      const vaultName = vault.name;

      // Return immediately to frontend - collateral reservation will happen in background
      res.json({
        success: true,
        bridgeId: bridge.id,
        amount: bridge.xrpAmount,
        status: 'pending',
        vaultName,
        lotRounding: {
          requestedAmount: lotCalculation.requestedAmount,
          roundedAmount: lotCalculation.roundedAmount,
          lots: lotCalculation.lots,
          needsRounding: lotCalculation.needsRounding,
        },
        message: "Bridge created. Reserving collateral...",
        demo: bridgeService.demoMode,
      });

      // Start background job to reserve collateral (non-blocking)
      void (async () => {
        try {
          console.log(`🔄 [Background] Starting collateral reservation for bridge ${bridge.id}`);
          
          // Update status to reserving_collateral
          await storage.updateBridge(bridge.id, { status: 'reserving_collateral' });

          // Reserve collateral (this is the slow part - ~60 seconds in production)
          await bridgeService.reserveCollateralQuick(bridge.id);

          // Get updated bridge
          const updatedBridge = await storage.getBridgeById(bridge.id);
          if (!updatedBridge) {
            throw new Error("Bridge not found after collateral reservation");
          }

          // Update status to awaiting_payment
          await storage.updateBridge(bridge.id, { status: 'awaiting_payment' });

          console.log(`✅ [Background] Collateral reserved for bridge ${bridge.id}, status updated to awaiting_payment`);

          // For demo mode, continue with rest of bridge simulation
          if (bridgeService.demoMode) {
            bridgeService.initiateBridge(bridge.id).catch(async (error) => {
              console.error("Background bridge simulation error:", error);
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
          console.error(`❌ [Background] Collateral reservation failed for bridge ${bridge.id}:`, errorMessage);
          console.error('Full error details:', error);
          
          // Update bridge status to failed with error reason
          await storage.updateBridge(bridge.id, { 
            status: 'failed',
            cancellationReason: `Collateral reservation failed: ${errorMessage}`,
          }).catch(updateErr => {
            console.error(`Failed to update bridge status to failed:`, updateErr);
          });
        }
      })();

    } catch (error) {
      console.error("Deposit error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create deposit" });
      }
    }
  });

  // FXRP Direct Deposit Endpoint (EVM users deposit FXRP, get shXRP immediately) (stricter rate limit: 20/min)
  app.post("/api/deposits/fxrp", strictRateLimiter, async (req, res) => {
    try {
      const { walletAddress, vaultId, amount, network } = req.body;
      
      if (!walletAddress || !vaultId || !amount) {
        return res.status(400).json({ error: "Missing required fields: walletAddress, vaultId, amount" });
      }

      // Get vault to verify it's an FXRP vault
      const vault = await storage.getVault(vaultId);
      if (!vault) {
        return res.status(404).json({ error: "Vault not found" });
      }

      if ((vault as any).comingSoon === true) {
        return res.status(403).json({ 
          error: "Vault not available", 
          message: "This vault is currently under development and not accepting deposits yet." 
        });
      }

      const vaultAssets = vault.asset.split(",").map(a => a.trim());
      const isFXRPVault = vaultAssets.includes("FXRP");

      if (!isFXRPVault) {
        return res.status(400).json({ error: "This endpoint is only for FXRP deposits." });
      }

      const depositAmount = parseFloat(amount);
      const vaultLiquidity = parseFloat(vault.liquidity);
      
      if (depositAmount > vaultLiquidity) {
        return res.status(400).json({ 
          error: "Insufficient vault liquidity",
          available: vaultLiquidity,
          requested: depositAmount
        });
      }

      // Create position record with shXRP shares (1:1 ratio for now)
      const shXRPShares = amount; // Direct 1:1 mapping for FXRP → shXRP
      const position = await storage.createPosition({
        walletAddress,
        vaultId,
        amount: shXRPShares,
        rewards: "0",
      });

      // Create transaction record for deposit
      await storage.createTransaction({
        walletAddress: position.walletAddress,
        vaultId: position.vaultId,
        positionId: position.id,
        type: "deposit",
        amount: depositAmount.toString(),
        rewards: "0",
        status: "completed",
        txHash: `fxrp-deposit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network || "testnet",
      });

      // Return immediately - async deployment to Firelight happens in background
      res.status(201).json({
        success: true,
        position,
        shXRPShares,
        message: `${amount} FXRP deposited! Received ${shXRPShares} shXRP shares. Deploying to Firelight in background.`,
      });

      // Background job: Deploy FXRP to Firelight (non-blocking)
      void (async () => {
        try {
          console.log(`🔄 [Background] Deploying ${amount} FXRP to Firelight for position ${position.id}...`);
          
          // TODO: Integrate with Firelight yield service
          // This is where we'd call the Firelight SDK to deposit FXRP
          // For now, we just log and continue
          
          console.log(`✅ [Background] Firelight deployment initiated for position ${position.id}`);
        } catch (error) {
          console.error(`❌ [Background] Firelight deployment failed for position ${position.id}:`, error);
          // Position is still valid - user has their shXRP shares
          // Firelight deployment is async optimization
        }
      })();

    } catch (error) {
      console.error("FXRP deposit error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create FXRP deposit" });
      }
    }
  });

  // Get deposit/bridge status for polling
  app.get("/api/deposits/:bridgeId/status", async (req, res) => {
    try {
      const { bridgeId } = req.params;
      
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      // Build payment request if collateral is reserved
      let paymentRequest = null;
      let feeBreakdown = null;

      if (bridge.status === 'awaiting_payment' || bridge.status === 'bridging') {
        paymentRequest = bridgeService.buildPaymentRequest(bridge);
        
        // Calculate fee breakdown
        const baseAmountXRP = bridge.reservedValueUBA 
          ? (Number(bridge.reservedValueUBA) / 1_000_000).toFixed(6)
          : bridge.xrpAmount;
        const feeAmountXRP = bridge.reservedFeeUBA
          ? (Number(bridge.reservedFeeUBA) / 1_000_000).toFixed(6)
          : "0";
        const totalAmountXRP = bridge.totalAmountUBA
          ? (Number(bridge.totalAmountUBA) / 1_000_000).toFixed(6)
          : bridge.xrpAmount;
        const feePercentage = bridge.mintingFeeBIPS
          ? (Number(bridge.mintingFeeBIPS) / 100).toFixed(2)
          : "0.25";

        feeBreakdown = {
          baseAmount: baseAmountXRP,
          feeAmount: feeAmountXRP,
          totalAmount: totalAmountXRP,
          feePercentage: `${feePercentage}%`,
        };
      }

      res.json({
        success: true,
        bridgeId: bridge.id,
        status: bridge.status,
        amount: bridge.xrpAmount,
        paymentRequest,
        feeBreakdown,
        agentVaultAddress: bridge.agentVaultAddress,
        agentUnderlyingAddress: bridge.agentUnderlyingAddress,
        expiresAt: bridge.expiresAt,
        error: bridge.status === 'failed' ? bridge.cancellationReason : undefined,
      });
    } catch (error) {
      console.error("Bridge status fetch error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch bridge status" });
      }
    }
  });

  /**
   * GET /api/positions/enriched
   * Get positions with on-chain balance verification and USD values
   * Reconciles database positions with on-chain shXRP balances
   * NOTE: Must be defined BEFORE /api/positions to match correctly
   */
  app.get("/api/positions/enriched", async (req, res) => {
    try {
      const walletAddress = req.query.walletAddress as string;
      
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress query parameter required" });
      }

      const positionService = getPositionService();
      const summary = await positionService.getEnrichedPositions(walletAddress);
      
      res.json({
        success: true,
        ...summary
      });
    } catch (error) {
      console.error("Failed to get enriched positions:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch enriched positions" 
      });
    }
  });

  /**
   * POST /api/positions/discover
   * Discover on-chain positions that don't exist in database
   * Creates position records for shXRP balances without database entries
   * NOTE: Must be defined BEFORE /api/positions to match correctly
   */
  app.post("/api/positions/discover", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress required in request body" });
      }

      const positionService = getPositionService();
      const result = await positionService.discoverOnChainPositions(walletAddress);
      
      res.json({
        success: true,
        discovered: result.discovered,
        positions: result.positions,
        message: result.discovered > 0 
          ? `Discovered ${result.discovered} on-chain position(s)` 
          : "No new positions discovered"
      });
    } catch (error) {
      console.error("Failed to discover positions:", error);
      res.status(500).json({ error: "Failed to discover positions" });
    }
  });

  // Get all positions (optionally filtered by wallet address)
  app.get("/api/positions", async (req, res) => {
    try {
      const walletAddress = req.query.walletAddress as string | undefined;
      const positions = await storage.getPositions(walletAddress);
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  /**
   * POST /api/positions/:id/reconcile
   * Force reconcile a position with on-chain data
   * Updates database if discrepancy found (FXRP vaults only)
   */
  app.post("/api/positions/:id/reconcile", async (req, res) => {
    try {
      const positionService = getPositionService();
      const result = await positionService.reconcilePosition(req.params.id);
      
      if (!result.success) {
        return res.status(404).json({ error: "Position not found or reconciliation failed" });
      }
      
      res.json({
        success: true,
        position: result.position,
        onChainBalance: result.onChainBalance,
        updated: result.updated,
        message: result.updated 
          ? "Position updated with on-chain balance" 
          : "Position is in sync with on-chain data"
      });
    } catch (error) {
      console.error("Failed to reconcile position:", error);
      res.status(500).json({ error: "Failed to reconcile position" });
    }
  });

  // Create new position (deposit)
  app.post("/api/positions", async (req, res) => {
    try {
      console.log("Full req.body:", JSON.stringify(req.body, null, 2));
      const network = req.body.network || "testnet";
      const txHash = req.body.txHash; // Get transaction hash from Xaman
      const { network: _, txHash: __, ...positionData } = req.body;
      console.log("After extracting network and txHash, positionData:", JSON.stringify(positionData, null, 2));
      
      // 1. Validate request and data
      const validatedData = insertPositionSchema.parse(positionData);
      
      // Check vault liquidity
      const vault = await storage.getVault(validatedData.vaultId);
      if (!vault) {
        return res.status(404).json({ error: "Vault not found" });
      }
      
      // Check if vault is coming soon
      if ((vault as any).comingSoon === true) {
        console.warn(`[DEPOSIT_BLOCKED] Vault ${vault.name} is coming soon - position creation rejected for ${validatedData.walletAddress}`);
        return res.status(403).json({ 
          error: "Vault not available", 
          message: "This vault is currently under development and not accepting deposits yet." 
        });
      }
      
      const depositAmount = parseFloat(validatedData.amount);
      const vaultLiquidity = parseFloat(vault.liquidity);
      
      if (depositAmount > vaultLiquidity) {
        return res.status(400).json({ 
          error: "Insufficient vault liquidity",
          available: vaultLiquidity,
          requested: depositAmount
        });
      }
      
      // 2. Create pending position
      const position = await storage.createPosition(validatedData);
      
      // 3. Create transaction record for deposit
      await storage.createTransaction({
        walletAddress: position.walletAddress,
        vaultId: position.vaultId,
        positionId: position.id,
        type: "deposit",
        amount: position.amount,
        rewards: "0",
        status: "completed",
        txHash: txHash || `deposit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network,
      });
      
      res.status(201).json({ 
        position,
        message: `${vault.asset} deposit successful.`
      });
    } catch (error) {
      console.error("Deposit error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create position" });
      }
    }
  });

  // Claim rewards (update position rewards to 0)
  app.patch("/api/positions/:id/claim", async (req, res) => {
    try {
      const network = req.body.network || "testnet"; // Default to testnet for Coston2
      const txHash = req.body.txHash; // Get transaction hash from Xaman
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      
      const claimedRewards = position.rewards;
      
      // Create transaction record for claim with real or mock txHash
      await storage.createTransaction({
        walletAddress: position.walletAddress,
        vaultId: position.vaultId,
        positionId: position.id,
        type: "claim",
        amount: "0",
        rewards: claimedRewards,
        status: "completed",
        txHash: txHash || `claim-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network,
      });
      
      // In a real implementation, we'd update the position
      // For now, just return the claimed amount
      res.json({ 
        success: true, 
        claimedRewards,
        message: `Claimed ${claimedRewards} in rewards`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to claim rewards" });
    }
  });

  // Authenticate xApp session using OTT (One Time Token)
  // The frontend detects xApp context and sends the OTT to backend for secure verification
  // OTT is valid for 1 minute and can only be fetched once
  app.post("/api/wallet/xaman/xapp-auth", async (req, res) => {
    try {
      const { xAppToken } = req.body;
      
      console.log("🔐 xApp auth request received:", {
        hasToken: !!xAppToken,
        tokenPreview: xAppToken ? `${xAppToken.substring(0, 8)}...` : 'none',
      });
      
      if (!xAppToken) {
        return res.status(400).json({ success: false, error: "xAppToken is required" });
      }
      
      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();
      
      if (!apiKey || !apiSecret) {
        console.error("❌ Xaman credentials not configured");
        return res.status(500).json({ success: false, error: "Xaman credentials not configured" });
      }
      
      // Use the xumm-sdk to verify the OTT and get user info
      const xumm = new XummSdk(apiKey, apiSecret);
      
      // Get the xApp session info using the OTT
      // Note: OTT can only be fetched once and expires after 1 minute
      console.log("🔄 Fetching xApp OTT data...");
      const ottData = await xumm.xApp?.get(xAppToken);
      
      console.log("📦 xApp OTT response:", {
        hasData: !!ottData,
        keys: ottData ? Object.keys(ottData) : [],
        account: ottData?.account,
        accountClassic: (ottData as any)?.account_classic,
        sub: (ottData as any)?.sub,
      });
      
      // The response may have different field names - check multiple possibilities
      const account = ottData?.account || (ottData as any)?.account_classic || (ottData as any)?.sub;
      
      if (!ottData || !account) {
        console.error("❌ Invalid xApp token or no account:", { ottData });
        return res.status(401).json({ 
          success: false, 
          error: "Invalid xApp token or no account associated. Token may have expired or already been used." 
        });
      }
      
      console.log("✅ xApp auth successful:", {
        account: account,
        network: ottData.network || (ottData as any)?.networkType,
      });
      
      res.json({
        success: true,
        account: account,
        network: ottData.network || (ottData as any)?.networkType,
      });
    } catch (error) {
      console.error("❌ xApp auth error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ 
        success: false, 
        error: `Failed to authenticate xApp session: ${errorMessage}` 
      });
    }
  });

  // Create Xaman payload for wallet connection
  app.post("/api/wallet/xaman/payload", async (_req, res) => {
    try {
      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      console.log("Xaman API Key check:", {
        keyExists: !!apiKey,
        keyLength: apiKey?.length || 0,
        secretExists: !!apiSecret,
        secretLength: apiSecret?.length || 0,
      });

      if (!apiKey || !apiSecret || apiKey.length === 0 || apiSecret.length === 0) {
        console.warn("Xaman credentials not configured - falling back to demo mode");
        // Return demo payload
        return res.json({ 
          uuid: "demo-payload-uuid",
          qrUrl: "demo",
          deepLink: "",
          demo: true
        });
      }

      console.log("Initializing Xaman SDK...");
      const xumm = new XummSdk(apiKey, apiSecret);
      
      console.log("Attempting to create Xaman payload...");
      let payload;
      try {
        payload = await xumm.payload?.create({
          TransactionType: "SignIn",
        });
      } catch (sdkError) {
        console.error("Xaman SDK error:", {
          message: sdkError instanceof Error ? sdkError.message : String(sdkError),
          stack: sdkError instanceof Error ? sdkError.stack : undefined,
        });
        throw sdkError;
      }

      console.log("Xaman payload result:", {
        payloadExists: !!payload,
        uuid: payload?.uuid,
        qrExists: !!payload?.refs?.qr_png,
      });

      if (!payload) {
        throw new Error("Failed to create Xaman payload - SDK returned null. This usually means invalid API credentials.");
      }

      res.json({
        uuid: payload.uuid,
        qrUrl: payload.refs?.qr_png,
        deepLink: payload.next?.always,
        demo: false
      });
    } catch (error) {
      console.error("Xaman payload creation error details:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
      });
      // Return demo payload on error
      res.json({ 
        uuid: "demo-payload-uuid",
        qrUrl: "demo",
        deepLink: "",
        demo: true
      });
    }
  });

  // Get Xaman payload status
  app.get("/api/wallet/xaman/payload/:uuid", async (req, res) => {
    try {
      // Handle demo mode
      if (req.params.uuid === "demo-payload-uuid") {
        return res.json({
          signed: true,
          account: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
          demo: true
        });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: "Xaman credentials not configured" });
      }

      const xumm = new XummSdk(apiKey, apiSecret);
      const payload = await xumm.payload?.get(req.params.uuid);

      if (!payload) {
        return res.status(404).json({ error: "Payload not found" });
      }

      console.log("Xaman payload status:", {
        uuid: req.params.uuid,
        account: payload.response?.account,
        meta_resolved: payload.meta?.resolved,
        meta_signed: payload.meta?.signed,
        meta_cancelled: payload.meta?.cancelled,
        meta_expired: payload.meta?.expired
      });

      // Xumm SDK stores signed status in meta.signed
      const signed = payload.meta?.signed || false;
      const account = payload.response?.account || null;
      const signedTxBlob = payload.response?.hex || null; // Get signed transaction blob
      const cancelled = payload.meta?.cancelled || false;

      // Auto-cleanup: Cancel payload after it's been resolved (signed, cancelled, or expired)
      if (payload.meta?.resolved) {
        try {
          const cancelResult = await xumm.payload?.cancel(req.params.uuid);
          if (cancelResult?.result?.cancelled) {
            console.log(`Auto-cleanup: Cancelled resolved payload ${req.params.uuid}`);
          }
        } catch (cancelError) {
          console.warn(`Failed to cancel payload ${req.params.uuid}:`, cancelError);
        }
      }

      res.json({
        signed,
        account,
        signedTxBlob,
        cancelled,
        demo: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get payload status" });
    }
  });

  // Create Xaman SignIn request for bridge cancellation
  // Server controls the canonical message to prevent forgery
  app.post("/api/bridges/:id/cancel-request", async (req, res) => {
    try {
      const { id: bridgeId } = req.params;
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: "Missing required field: walletAddress" });
      }

      // Get bridge to verify ownership
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      if (bridge.walletAddress !== walletAddress) {
        return res.status(403).json({ 
          error: "Unauthorized - you can only cancel your own deposits"
        });
      }

      // Server creates canonical message (prevents client forgery)
      const timestamp = Date.now().toString();
      const canonicalMessage = `cancel:${bridgeId}:${timestamp}`;

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret || apiKey.length === 0 || apiSecret.length === 0) {
        console.warn("Xaman credentials not configured - falling back to demo mode");
        return res.json({
          uuid: `demo-cancel-${bridgeId}-${timestamp}`,
          message: canonicalMessage,
          qrUrl: "demo",
          deepLink: "",
          demo: true
        });
      }

      const xumm = new XummSdk(apiKey, apiSecret);

      // Create SignIn transaction with canonical cancellation message in memo
      const payload = await xumm.payload?.create({
        TransactionType: "SignIn",
        Memos: [
          {
            Memo: {
              MemoData: Buffer.from(canonicalMessage).toString("hex").toUpperCase(),
              MemoType: Buffer.from("cancellation").toString("hex").toUpperCase(),
              MemoFormat: Buffer.from("text/plain").toString("hex").toUpperCase(),
            },
          },
        ],
      });

      if (!payload) {
        throw new Error("Failed to create Xaman SignIn payload");
      }

      console.log(`🔐 Created server-controlled cancel request for bridge ${bridgeId}`);
      console.log(`   Canonical message: ${canonicalMessage}`);
      console.log(`   Payload UUID: ${payload.uuid}`);

      res.json({
        uuid: payload.uuid,
        message: canonicalMessage, // Return canonical message for client display
        qrUrl: payload.refs?.qr_png,
        deepLink: payload.next?.always,
        demo: false
      });
    } catch (error) {
      console.error("Cancel request creation error:", error);
      const timestamp = Date.now().toString();
      res.json({
        uuid: `demo-cancel-${req.params.id}-${timestamp}`,
        message: `cancel:${req.params.id}:${timestamp}`,
        qrUrl: "demo",
        deepLink: "",
        demo: true
      });
    }
  });

  // Create Xaman payment request for bridge deposit
  app.post("/api/wallet/xaman/payment", async (req, res) => {
    try {
      const { account, destination, amountDrops, memo, network } = req.body;

      if (!account || !destination || !amountDrops || !memo) {
        return res.status(400).json({ error: "Missing required fields: account, destination, amountDrops, memo" });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret || apiKey.length === 0 || apiSecret.length === 0) {
        console.warn("Xaman credentials not configured - falling back to demo mode");
        return res.json({
          uuid: `demo-payment-${Date.now()}`,
          qrUrl: "demo",
          deepLink: "",
          demo: true
        });
      }

      const xumm = new XummSdk(apiKey, apiSecret);

      const payload = await xumm.payload?.create({
        TransactionType: "Payment",
        Account: account,
        Destination: destination,
        Amount: amountDrops,
        Memos: [
          {
            Memo: {
              MemoData: memo.toUpperCase(),
              MemoType: Buffer.from("bridge_id").toString("hex").toUpperCase(),
              MemoFormat: Buffer.from("text/plain").toString("hex").toUpperCase(),
            },
          },
        ],
      });

      if (!payload) {
        throw new Error("Failed to create Xaman payment payload");
      }

      res.json({
        uuid: payload.uuid,
        qrUrl: payload.refs?.qr_png,
        deepLink: payload.next?.always,
        demo: false
      });
    } catch (error) {
      console.error("Xaman payment request error:", error);
      res.json({
        uuid: `demo-payment-${Date.now()}`,
        qrUrl: "demo",
        deepLink: "",
        demo: true
      });
    }
  });

  // Get Xaman payment status
  app.get("/api/wallet/xaman/payment/:uuid", async (req, res) => {
    try {
      if (req.params.uuid.startsWith("demo-payment-")) {
        return res.json({
          signed: true,
          txHash: `DEMO-${req.params.uuid}`,
          demo: true
        });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: "Xaman credentials not configured" });
      }

      const xumm = new XummSdk(apiKey, apiSecret);
      const payload = await xumm.payload?.get(req.params.uuid);

      if (!payload) {
        return res.status(404).json({ error: "Payload not found" });
      }

      const signed = payload.meta?.signed || false;
      const txHash = payload.response?.txid || null;

      res.json({
        signed,
        txHash,
        demo: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get payment status" });
    }
  });

  // xApp auto-signin: Resolve OTT (One-Time Token) to wallet address
  app.post("/api/wallet/xaman/xapp-signin", async (req, res) => {
    try {
      const { ott } = req.body;

      if (!ott || typeof ott !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required field: ott" 
        });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret || apiKey.length === 0 || apiSecret.length === 0) {
        console.warn("Xaman credentials not configured - xApp signin not available");
        return res.status(503).json({ 
          success: false, 
          error: "Xaman not configured on server" 
        });
      }

      console.log(`🔐 Resolving xApp OTT: ${ott.substring(0, 10)}...`);

      const xumm = new XummSdk(apiKey, apiSecret);
      
      // Resolve OTT to get payload with user info
      const payload = await xumm.payload?.get(ott);

      if (!payload) {
        console.error("❌ Failed to resolve OTT - payload not found");
        return res.status(404).json({ 
          success: false, 
          error: "Invalid or expired OTT" 
        });
      }

      // Extract wallet address from payload
      const address = payload.response?.account;

      if (!address) {
        console.error("❌ OTT resolved but no account found in payload");
        return res.status(400).json({ 
          success: false, 
          error: "No wallet address in OTT payload" 
        });
      }

      console.log(`✅ xApp OTT resolved successfully: ${address}`);

      res.json({
        success: true,
        address: address,
      });
    } catch (error) {
      console.error("xApp signin error:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to resolve OTT" 
      });
    }
  });

  // Get wallet balance from XRP Ledger (XRP, RLUSD, USDC)
  app.get("/api/wallet/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const network = req.query.network as string || "testnet"; // Default to testnet for Coston2
      
      if (!address) {
        return res.status(400).json({ error: "Wallet address required" });
      }

      // Select XRP Ledger server based on network
      const xrplServer = network === "testnet" 
        ? "wss://s.altnet.rippletest.net:51233" // Testnet
        : "wss://xrplcluster.com"; // Mainnet

      // RLUSD and USDC official issuer addresses
      // Source: Ripple official docs (RLUSD) and Circle (USDC)
      const issuers = {
        mainnet: {
          RLUSD: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", // Official Ripple RLUSD issuer (mainnet)
          USDC: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE" // Official Circle USDC issuer (mainnet)
        },
        testnet: {
          RLUSD: "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV", // Official Ripple RLUSD issuer (testnet)
          USDC: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE" // Note: Testnet USDC issuer may differ - verify with Circle
        }
      };

      const currentIssuers = issuers[network as keyof typeof issuers] || issuers.mainnet;

      // Connect to XRP Ledger
      const client = new Client(xrplServer);
      await client.connect();

      try {
        // Fetch account info for XRP balance
        const accountInfo = await client.request({
          command: "account_info",
          account: address,
          ledger_index: "validated"
        });

        // XRP balance is in drops (1 XRP = 1,000,000 drops)
        const balanceInDrops = accountInfo.result.account_data.Balance;
        const balanceInXRP = Number(balanceInDrops) / 1000000;

        // Fetch account_lines for issued currencies (RLUSD, USDC)
        let rlusdBalance = 0;
        let usdcBalance = 0;

        try {
          const accountLines = await client.request({
            command: "account_lines",
            account: address,
            ledger_index: "validated"
          });

          // Find RLUSD and USDC trust lines
          // RLUSD uses currency code "RLUSD" or hex "524C555344000000000000000000000000000000"
          // USDC uses currency code "USD" (standard 3-char code)
          for (const line of accountLines.result.lines) {
            // Match RLUSD by currency code AND issuer address
            if ((line.currency === "RLUSD" || line.currency === "524C555344000000000000000000000000000000") 
                && line.account === currentIssuers.RLUSD) {
              rlusdBalance = Math.max(rlusdBalance, parseFloat(line.balance) || 0);
            }
            // Match USDC by currency code "USD" AND issuer address
            if (line.currency === "USD" && line.account === currentIssuers.USDC) {
              usdcBalance = Math.max(usdcBalance, parseFloat(line.balance) || 0);
            }
          }
        } catch (linesError) {
          // If account_lines fails, just return 0 for issued currencies
          console.log("No trust lines found or error fetching account_lines:", linesError);
        }

        // Fixed prices for demo (in production, fetch from price API)
        const xrpPriceUSD = 2.45;
        const rlusdPriceUSD = 1.00; // RLUSD is pegged to USD
        const usdcPriceUSD = 1.00; // USDC is pegged to USD

        const totalUSD = (balanceInXRP * xrpPriceUSD) + (rlusdBalance * rlusdPriceUSD) + (usdcBalance * usdcPriceUSD);

        res.json({
          address,
          network,
          balances: {
            XRP: parseFloat(balanceInXRP.toFixed(6)),
            RLUSD: parseFloat(rlusdBalance.toFixed(6)),
            USDC: parseFloat(usdcBalance.toFixed(6))
          },
          balancesFormatted: {
            XRP: balanceInXRP.toFixed(2),
            RLUSD: rlusdBalance.toFixed(2),
            USDC: usdcBalance.toFixed(2)
          },
          prices: {
            XRP: xrpPriceUSD,
            RLUSD: rlusdPriceUSD,
            USDC: usdcPriceUSD
          },
          totalUSD: totalUSD.toFixed(2)
        });
      } finally {
        await client.disconnect();
      }
    } catch (error: any) {
      console.error("Balance fetch error:", error);
      
      // Handle account not found errors
      if (error?.data?.error === "actNotFound") {
        return res.json({
          address: req.params.address,
          network: req.query.network || "mainnet",
          balances: {
            XRP: 0,
            RLUSD: 0,
            USDC: 0
          },
          balancesFormatted: {
            XRP: "0.00",
            RLUSD: "0.00",
            USDC: "0.00"
          },
          prices: {
            XRP: 2.45,
            RLUSD: 1.00,
            USDC: 1.00
          },
          totalUSD: "0.00",
          error: "Account not found or not activated"
        });
      }
      
      res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
  });

  // Create Xaman payment payload for deposit
  app.post("/api/wallet/xaman/payment/deposit", async (req, res) => {
    try {
      const { amount, asset, vaultId, network } = req.body;
      
      if (!amount || !asset || !vaultId) {
        return res.status(400).json({ error: "Missing required fields: amount, asset, vaultId" });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      // Vault deposit address - all deposits go here
      const vaultAddress = "rpC7sRSUcK6F1nPb9E5U8z8bz5ee5mFEjC"; // Main vault address (mainnet & testnet)

      if (!apiKey || !apiSecret) {
        // Return demo payload
        return res.json({
          uuid: "demo-deposit-payload",
          qrUrl: "demo",
          deepLink: "",
          demo: true,
          txHash: `deposit-demo-${Date.now()}`
        });
      }

      const xumm = new XummSdk(apiKey, apiSecret);
      
      // Create payment transaction
      let paymentTx: any = {
        TransactionType: "Payment",
        Destination: vaultAddress,
      };

      // Handle different asset types
      if (asset === "XRP") {
        // XRP payment (amount in drops: 1 XRP = 1,000,000 drops)
        const drops = Math.floor(parseFloat(amount) * 1000000).toString();
        paymentTx.Amount = drops;
      } else if (asset === "RLUSD") {
        // RLUSD issued currency payment
        const rlusdIssuer = network === "testnet"
          ? "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV" // RLUSD testnet issuer
          : "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"; // RLUSD mainnet issuer
        
        paymentTx.Amount = {
          currency: "RLUSD",
          value: amount,
          issuer: rlusdIssuer
        };
      } else if (asset === "USDC") {
        // USDC issued currency payment
        const usdcIssuer = "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE"; // USDC mainnet issuer
        
        paymentTx.Amount = {
          currency: "USD", // USDC uses "USD" as currency code on XRPL
          value: amount,
          issuer: usdcIssuer
        };
      } else {
        return res.status(400).json({ error: `Unsupported asset: ${asset}` });
      }

      const payload = await xumm.payload?.create({
        ...paymentTx,
        Memos: [{
          Memo: {
            MemoData: Buffer.from(`Deposit to vault ${vaultId}`).toString('hex').toUpperCase()
          }
        }]
      });

      if (!payload) {
        throw new Error("Failed to create Xaman payment payload");
      }

      res.json({
        uuid: payload.uuid,
        qrUrl: payload.refs?.qr_png,
        deepLink: payload.next?.always,
        demo: false
      });
    } catch (error) {
      console.error("Xaman deposit payload creation error:", error);
      res.status(500).json({ error: "Failed to create deposit payment payload" });
    }
  });

  // Background processing function for redemptions
  async function processRedemptionBackground(redemptionId: string) {
    console.log(`\n🔄 Starting background withdrawal processing for ${redemptionId}`);
    
    try {
      // Atomic claim: Transition from "pending" to "redeeming_shares" in one atomic operation
      // This ensures only ONE worker can process this redemption (prevents race conditions)
      console.log(`⏳ Attempting to claim redemption ${redemptionId}...`);
      
      const claimResult = await db.update(fxrpToXrpRedemptions)
        .set({ status: "redeeming_shares" })
        .where(
          and(
            eq(fxrpToXrpRedemptions.id, redemptionId),
            eq(fxrpToXrpRedemptions.status, "pending")
          )
        )
        .returning();

      if (!claimResult || claimResult.length === 0) {
        console.log(`⏭️  Redemption ${redemptionId} already claimed by another worker`);
        console.log(`   Skipping duplicate background job`);
        return;
      }

      console.log(`✅ Successfully claimed redemption ${redemptionId} for processing`);

      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        throw new Error("Redemption not found");
      }

      const position = await storage.getPosition(redemption.positionId);
      if (!position) {
        throw new Error("Position not found");
      }

      // Step 1: Redeem shXRP shares → FXRP (status already set to "redeeming_shares" above)
      console.log(`⏳ Redeeming shXRP shares for redemption ${redemptionId}...`);

      // Get VaultService from the main application context
      const vaultService = (bridgeService as any).config?.vaultService;
      if (!vaultService) {
        throw new Error("VaultService not available");
      }

      // Step 2: Redeem shXRP shares → FXRP
      const { fxrpReceived, txHash: vaultRedeemTxHash } = await vaultService.redeemShares(
        position.vaultId,
        redemption.walletAddress,
        redemption.shareAmount
      );

      console.log(`✅ Redeemed ${redemption.shareAmount} shXRP → ${fxrpReceived} FXRP`);

      await storage.updateRedemption(redemptionId, {
        fxrpRedeemed: fxrpReceived,
        vaultRedeemTxHash,
        sharesRedeemedAt: new Date(),
        status: "redeemed_fxrp"
      });

      // Step 3: Redeem FXRP → XRP via FAssets
      console.log(`⏳ Requesting FXRP → XRP redemption...`);
      await storage.updateRedemptionStatus(redemptionId, "redeeming_fxrp", {});
      
      const redemptionTxHash = await bridgeService.redeemFxrpToXrp(
        redemptionId,
        fxrpReceived,
        redemption.walletAddress
      );

      console.log(`✅ FAssets redemption requested: ${redemptionTxHash}`);
      console.log(`   Request submitted to AssetManager`);
      console.log(`   Agent will send XRP to: ${redemption.walletAddress}`);
      console.log(`   ⏳ Waiting for FAssets agent payment...`);

      // Retrieve updated redemption to get AssetManager details
      const updatedRedemption = await storage.getRedemptionById(redemptionId);
      
      // Mark as awaiting agent payment (Phase 2 will be handled by XRPL listener)
      await storage.updateRedemptionStatus(redemptionId, "awaiting_proof", {
        fxrpRedeemedAt: new Date(),
      });
      
      console.log(`✅ Redemption phase 1 complete (shXRP → FXRP → Redemption Request)`);
      console.log(`   Status: awaiting_proof`);
      console.log(`   Request ID: ${updatedRedemption?.redemptionRequestId || 'pending'}`);
      console.log(`   Next: FAssets agent will send XRP, then proof confirmation will occur`);
      console.log(``);
      console.log(`⚠️  NOTE: Position and transaction records will be updated after full completion`);
      console.log(`   User's position shares remain unchanged until XRP is received`);
      console.log(`   This ensures data integrity if agent payment fails or stalls`);

      console.log(`\n✅ Background withdrawal ${redemptionId} phase 1 completed`);
      
    } catch (error) {
      console.error(`❌ Background withdrawal ${redemptionId} failed:`, error);
      await storage.updateRedemption(redemptionId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  // FXRP Direct Withdrawal Endpoint (EVM users withdraw shXRP, get FXRP back) (stricter rate limit: 20/min)
  app.post("/api/withdrawals/fxrp", strictRateLimiter, async (req, res) => {
    try {
      const { positionId, shareAmount, walletAddress } = req.body;

      if (!positionId || !shareAmount || !walletAddress) {
        return res.status(400).json({ error: "Missing required fields: positionId, shareAmount, walletAddress" });
      }

      // Validate position exists
      const position = await storage.getPosition(positionId);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      if (position.walletAddress !== walletAddress) {
        return res.status(403).json({ error: "Position does not belong to this wallet" });
      }

      const positionShares = parseFloat(position.amount);
      const requestedShares = parseFloat(shareAmount);

      if (requestedShares > positionShares) {
        return res.status(400).json({ 
          error: "Insufficient shares", 
          available: position.amount,
          requested: shareAmount 
        });
      }

      // Update position: deduct shares
      const remainingShares = (positionShares - requestedShares).toFixed(6);
      await storage.updatePosition(positionId, {
        amount: remainingShares,
      });

      // Create transaction record for withdrawal
      await storage.createTransaction({
        walletAddress: position.walletAddress,
        vaultId: position.vaultId,
        positionId: position.id,
        type: "withdrawal",
        amount: shareAmount,
        rewards: "0",
        status: "completed",
        txHash: `fxrp-withdrawal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: "testnet",
      });

      // Return immediately - async transfer to user wallet happens in background
      res.status(200).json({
        success: true,
        message: `Withdrawal initiated! ${shareAmount} shXRP will be converted to FXRP and sent to your wallet.`,
        withdrawalId: positionId,
        amount: shareAmount,
        fxrpAmount: shareAmount, // 1:1 mapping for now
      });

      // Background job: Transfer FXRP from vault to user wallet (non-blocking)
      void (async () => {
        try {
          console.log(`🔄 [Background] Processing FXRP withdrawal for position ${positionId}...`);
          console.log(`   Amount: ${shareAmount} shXRP → ${shareAmount} FXRP`);
          console.log(`   Destination: ${walletAddress}`);
          
          // TODO: Integrate with Firelight redemption service
          // This is where we'd:
          // 1. Redeem shares from vault
          // 2. Get FXRP back from Firelight
          // 3. Transfer FXRP to user's wallet on Flare
          
          console.log(`✅ [Background] FXRP withdrawal initiated for position ${positionId}`);
        } catch (error) {
          console.error(`❌ [Background] FXRP withdrawal failed for position ${positionId}:`, error);
          // Position was already updated - user has control via UI
        }
      })();

    } catch (error) {
      console.error("FXRP withdrawal error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to process FXRP withdrawal" });
      }
    }
  });

  // Automated withdrawal flow: shXRP → FXRP → XRP (Async version) (stricter rate limit: 20/min)
  app.post("/api/withdrawals", strictRateLimiter, async (req, res) => {
    const { positionId, shareAmount, userAddress } = req.body;

    // Validate request
    if (!positionId || !shareAmount || !userAddress) {
      return res.status(400).json({ error: "Missing required fields: positionId, shareAmount, userAddress" });
    }

    try {
      console.log(`\n🔄 Starting automated withdrawal flow`);
      console.log(`   Position ID: ${positionId}`);
      console.log(`   Share Amount: ${shareAmount}`);
      console.log(`   User XRPL Address: ${userAddress}`);

      // Step 1: Validate position exists and has sufficient shares
      const position = await storage.getPosition(positionId);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      if (position.walletAddress !== userAddress) {
        return res.status(403).json({ error: "Position does not belong to this wallet" });
      }

      const positionShares = parseFloat(position.amount);
      const requestedShares = parseFloat(shareAmount);

      if (requestedShares > positionShares) {
        return res.status(400).json({ 
          error: "Insufficient shares", 
          available: position.amount,
          requested: shareAmount 
        });
      }

      // Step 2: Create redemption record with status="pending"
      console.log("⏳ Creating redemption record...");
      const redemption = await storage.createRedemption({
        positionId,
        walletAddress: userAddress,
        vaultId: position.vaultId,
        shareAmount,
        fxrpRedeemed: null,
        xrpSent: null,
        status: "pending",
        vaultRedeemTxHash: null,
        fassetsRedemptionTxHash: null,
        xrplPayoutTxHash: null,
        redemptionRequestId: null,
        agentVaultAddress: null,
        fdcAttestationTxHash: null,
        fdcProofHash: null,
        fdcProofData: null,
        sharesRedeemedAt: null,
        fxrpRedeemedAt: null,
        xrplPayoutAt: null,
        completedAt: null,
        errorMessage: null,
        retryCount: 0,
      });

      console.log(`✅ Redemption record created: ${redemption.id}`);

      // Step 3: Return immediately with redemption ID
      res.json({ 
        success: true, 
        redemptionId: redemption.id,
        status: "pending",
        message: "Withdrawal initiated. Processing in background."
      });

      // Step 4: Process redemption in background (don't await!)
      processRedemptionBackground(redemption.id).catch(error => {
        console.error(`Background redemption ${redemption.id} failed:`, error);
      });

    } catch (error) {
      console.error("Withdrawal flow error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during withdrawal";
      
      res.status(500).json({ 
        error: "Withdrawal failed", 
        details: errorMessage 
      });
    }
  });

  // Manual recovery: Force retry with explicit TX hash (ADMIN ONLY)
  // IMPORTANT: This must be BEFORE the generic /api/withdrawals/:id route
  app.post("/api/withdrawals/:redemptionId/force-retry", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      const { txHash } = req.body;
      
      if (!txHash) {
        return res.status(400).json({ error: "txHash required in request body" });
      }
      
      console.log(`\n🔧 FORCE RETRY: Manual recovery for redemption ${redemptionId}`);
      console.log(`   TX Hash: ${txHash}`);
      
      // Get redemption from database
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
      
      console.log(`📊 Database state:`, {
        status: redemption.status,
        redemptionRequestId: redemption.redemptionRequestId,
        xrplPayoutTxHash: redemption.xrplPayoutTxHash,
        fdcProofData: redemption.fdcProofData ? "EXISTS" : "MISSING",
        fdcAttestationTxHash: redemption.fdcAttestationTxHash
      });
      
      // Check if we have request ID
      if (!redemption.redemptionRequestId) {
        return res.status(400).json({ 
          error: "Redemption request ID not found in database" 
        });
      }
      
      let proof = redemption.fdcProofData ? JSON.parse(redemption.fdcProofData) : null;
      
      // If proof doesn't exist, generate it from TX hash
      if (!proof) {
        console.log(`⚠️  No FDC proof in database, generating new proof...`);
        
        // Get network and flareClient from bridgeService
        const network = (bridgeService as any).config.network;
        const flareClient = (bridgeService as any).config.flareClient;
        
        // Generate FDC proof
        const fdcResult = await generateFDCProof(
          txHash,
          network,
          flareClient
        );
        
        proof = fdcResult.proof;
        
        // Store the proof in database
        await storage.updateRedemption(redemptionId, {
          fdcProofData: JSON.stringify(proof),
          fdcAttestationTxHash: fdcResult.attestationTxHash,
          fdcVotingRoundId: fdcResult.votingRoundId.toString()
        });
        
        console.log(`✅ FDC proof generated and stored`);
      } else {
        console.log(`✅ Using existing FDC proof from database`);
      }
      
      // DIAGNOSTIC: Try static call first to get actual contract revert reason
      console.log("\n🔍 TESTING: Attempting static call to check contract acceptance...");
      const fassetsClient = (bridgeService as any).fassetsClient;
      const assetManager = await fassetsClient.getAssetManager();
      
      // Encode proof for contract (inline from FAssetsClient.encodeProofForContract)
      const encodedProof = {
        merkleProof: proof.merkleProof,
        data: {
          attestationType: proof.data.attestationType,
          sourceId: proof.data.sourceId,
          votingRound: BigInt(proof.data.votingRound),
          lowestUsedTimestamp: BigInt(proof.data.lowestUsedTimestamp),
          requestBody: {
            transactionId: proof.data.requestBody.transactionId,
            inUtxo: BigInt(proof.data.requestBody.inUtxo),
            utxo: BigInt(proof.data.requestBody.utxo)
          },
          responseBody: {
            blockNumber: BigInt(proof.data.responseBody.blockNumber),
            blockTimestamp: BigInt(proof.data.responseBody.blockTimestamp),
            sourceAddressHash: proof.data.responseBody.sourceAddressHash,
            sourceAddressesRoot: proof.data.responseBody.sourceAddressesRoot,
            receivingAddressHash: proof.data.responseBody.receivingAddressHash,
            intendedReceivingAddressHash: proof.data.responseBody.intendedReceivingAddressHash,
            spentAmount: BigInt(proof.data.responseBody.spentAmount),
            intendedSpentAmount: BigInt(proof.data.responseBody.intendedSpentAmount),
            receivedAmount: BigInt(proof.data.responseBody.receivedAmount),
            intendedReceivedAmount: BigInt(proof.data.responseBody.intendedReceivedAmount),
            standardPaymentReference: proof.data.responseBody.standardPaymentReference,
            oneToOne: proof.data.responseBody.oneToOne,
            status: BigInt(proof.data.responseBody.status)
          }
        }
      };
      
      try {
        const staticResult = await assetManager.confirmRedemptionPayment.staticCall(
          encodedProof,
          BigInt(redemption.redemptionRequestId)
        );
        console.log("✅ Static call SUCCEEDED - contract accepts this proof");
        console.log(`   Result:`, staticResult);
      } catch (staticError: any) {
        console.error("❌ Static call FAILED - contract rejects this proof:");
        console.error(`   Error: ${staticError.message}`);
        console.error(`   Revert data:`, staticError.data);
        
        // Try to decode revert reason if possible
        if (staticError.data) {
          try {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ["string"],
              ethers.dataSlice(staticError.data, 4)
            );
            console.error(`   Decoded revert reason: ${decoded[0]}`);
          } catch (decodeError) {
            console.error(`   Could not decode revert reason`);
          }
        }
        
        throw new Error(`Contract rejects proof: ${staticError.message}`);
      }
      
      // Attempt to confirm payment on contract
      const confirmTxHash = await bridgeService.confirmRedemptionPayment(
        proof,
        BigInt(redemption.redemptionRequestId)
      );
      
      console.log(`✅ Redemption confirmed on contract: ${confirmTxHash}`);
      
      // Update redemption status to completed
      await storage.updateRedemption(redemptionId, {
        status: "completed",
        confirmationTxHash: confirmTxHash
      });
      
      return res.json({
        success: true,
        redemptionId,
        confirmTxHash,
        message: "Redemption successfully confirmed on contract"
      });
      
    } catch (error: any) {
      console.error("Force retry error:", error);
      return res.status(500).json({ 
        error: error.message,
        details: error.stack
      });
    }
  });

  // Debug: Fund smart account with CFLR (ADMIN ONLY)
  app.post("/api/admin/fund-smart-account", requireAdminAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const amountToSend = amount || "0.1";
      
      console.log(`\n💰 Funding smart account with ${amountToSend} CFLR...`);
      
      const flareClient = (bridgeService as any).config.flareClient;
      const smartAccountAddress = flareClient.getSignerAddress();
      
      console.log(`   Smart Account: ${smartAccountAddress}`);
      
      const provider = flareClient.provider;
      const operatorWallet = new ethers.Wallet(
        process.env.OPERATOR_PRIVATE_KEY!,
        provider
      );
      
      console.log(`   Funding from: ${operatorWallet.address}`);
      
      const tx = await operatorWallet.sendTransaction({
        to: smartAccountAddress,
        value: ethers.parseEther(amountToSend)
      });
      
      console.log(`   TX submitted: ${tx.hash}`);
      await tx.wait();
      
      const balance = await provider.getBalance(smartAccountAddress);
      console.log(`✅ Smart account funded!`);
      console.log(`   New balance: ${ethers.formatEther(balance)} CFLR`);
      
      return res.json({
        success: true,
        txHash: tx.hash,
        smartAccountAddress,
        amount: amountToSend,
        newBalance: ethers.formatEther(balance)
      });
      
    } catch (error: any) {
      console.error("Error funding smart account:", error);
      return res.status(500).json({ 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // P0 Security: Pause vault operations (ADMIN ONLY)
  app.post("/api/admin/vault/pause", requireAdminAuth, async (req, res) => {
    try {
      if (!flareClient) {
        return res.status(503).json({ error: "FlareClient not initialized" });
      }
      
      console.log(`\n⏸️  PAUSE VAULT: Emergency stop initiated`);
      
      const vaultAddress = getVaultAddress();
      const vaultContract = flareClient.getShXRPVault(vaultAddress) as any;
      
      console.log(`   Vault: ${vaultAddress}`);
      
      // Call pause() on the contract
      const tx = await vaultContract.pause();
      console.log(`   TX submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Vault paused successfully`);
      
      return res.json({
        success: true,
        txHash: receipt.hash,
        vaultAddress,
        message: "Vault operations paused - all deposits and withdrawals are now blocked"
      });
      
    } catch (error: any) {
      console.error("Error pausing vault:", error);
      return res.status(500).json({ 
        error: error.message,
        details: error.reason || error.stack
      });
    }
  });
  
  // P0 Security: Unpause vault operations (ADMIN ONLY)
  app.post("/api/admin/vault/unpause", requireAdminAuth, async (req, res) => {
    try {
      if (!flareClient) {
        return res.status(503).json({ error: "FlareClient not initialized" });
      }
      
      console.log(`\n▶️  UNPAUSE VAULT: Resuming normal operations`);
      
      const vaultAddress = getVaultAddress();
      const vaultContract = flareClient.getShXRPVault(vaultAddress) as any;
      
      console.log(`   Vault: ${vaultAddress}`);
      
      // Call unpause() on the contract
      const tx = await vaultContract.unpause();
      console.log(`   TX submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Vault unpaused successfully`);
      
      return res.json({
        success: true,
        txHash: receipt.hash,
        vaultAddress,
        message: "Vault operations resumed - deposits and withdrawals are now enabled"
      });
      
    } catch (error: any) {
      console.error("Error unpausing vault:", error);
      return res.status(500).json({ 
        error: error.message,
        details: error.reason || error.stack
      });
    }
  });
  
  // P0 Security: Update deposit limit (ADMIN ONLY)
  app.post("/api/admin/vault/set-deposit-limit", requireAdminAuth, async (req, res) => {
    try {
      if (!flareClient) {
        return res.status(503).json({ error: "FlareClient not initialized" });
      }
      
      const { newLimit } = req.body;
      
      if (!newLimit) {
        return res.status(400).json({ error: "newLimit required in request body (in FXRP, e.g., '2000000' for 2M FXRP)" });
      }
      
      console.log(`\n📊 UPDATE DEPOSIT LIMIT: Setting new capacity`);
      
      const vaultAddress = getVaultAddress();
      const vaultContract = flareClient.getShXRPVault(vaultAddress) as any;
      
      // Convert newLimit to contract units (FXRP uses 6 decimals)
      const newLimitRaw = ethers.parseUnits(newLimit, 6);
      
      console.log(`   Vault: ${vaultAddress}`);
      console.log(`   New Limit: ${newLimit} FXRP (${newLimitRaw.toString()} raw units)`);
      
      // Call setDepositLimit() on the contract
      const tx = await vaultContract.setDepositLimit(newLimitRaw);
      console.log(`   TX submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Deposit limit updated successfully`);
      
      return res.json({
        success: true,
        txHash: receipt.hash,
        vaultAddress,
        newLimit,
        newLimitRaw: newLimitRaw.toString(),
        message: `Deposit limit updated to ${newLimit} FXRP`
      });
      
    } catch (error: any) {
      console.error("Error updating deposit limit:", error);
      return res.status(500).json({ 
        error: error.message,
        details: error.reason || error.stack
      });
    }
  });

  // Debug: Check XRPL transaction details for redemption (ADMIN ONLY)
  app.get("/api/withdrawals/:redemptionId/check-xrpl-tx", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      
      console.log(`\n🔍 XRPL TX CHECK for redemption ${redemptionId}`);
      
      // Get redemption from database
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found in database" });
      }
      
      if (!redemption.xrplPayoutTxHash) {
        return res.status(400).json({ 
          error: "No XRPL payout TX hash found in database"
        });
      }
      
      // Use XRPL client to fetch transaction details
      const { Client } = await import('xrpl');
      const client = new Client('wss://testnet.xrpl-labs.com');
      await client.connect();
      
      try {
        const txResponse = await client.request({
          command: 'tx',
          transaction: redemption.xrplPayoutTxHash,
          binary: false
        });
        
        const tx: any = txResponse.result;
        
        // Extract key details
        const amount = tx.Amount;
        const destination = tx.Destination;
        const deliveredAmount = tx.meta?.delivered_amount || amount;
        
        // Extract memo if present
        let memo = null;
        let memoHex = null;
        if (tx.Memos && tx.Memos.length > 0 && tx.Memos[0].Memo) {
          memoHex = tx.Memos[0].Memo.MemoData;
          if (memoHex) {
            memo = Buffer.from(memoHex, 'hex').toString('utf-8');
          }
        }
        
        // Convert amount to drops
        const amountDrops = typeof amount === 'string' ? parseInt(amount) : amount;
        const deliveredDrops = typeof deliveredAmount === 'string' ? parseInt(deliveredAmount) : deliveredAmount;
        
        await client.disconnect();
        
        return res.json({
          redemptionId,
          xrplTransaction: {
            hash: redemption.xrplPayoutTxHash,
            amount: amountDrops,
            amountXRP: (amountDrops / 1000000).toFixed(6),
            deliveredAmount: deliveredDrops,
            deliveredXRP: (deliveredDrops / 1000000).toFixed(6),
            destination,
            memo,
            memoHex,
            validated: tx.validated
          },
          contractExpectations: {
            valueUBA: "20000000",
            feeUBA: "100000",
            netExpectedDrops: 19900000,
            netExpectedXRP: "19.9"
          },
          analysis: {
            amountMatch: deliveredDrops === 19900000 ? "✅ MATCH" : `❌ MISMATCH (expected 19900000, got ${deliveredDrops})`,
            memoPresent: memoHex ? "✅ YES" : "❌ NO"
          }
        });
        
      } finally {
        if (client.isConnected()) {
          await client.disconnect();
        }
      }
      
    } catch (error: any) {
      console.error("Error checking XRPL transaction:", error);
      return res.status(500).json({ 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Debug: Check on-chain redemption request status (ADMIN ONLY)
  // IMPORTANT: This must be BEFORE the generic /api/withdrawals/:id route
  app.get("/api/withdrawals/:redemptionId/check-contract-status", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      
      console.log(`\n🔍 CONTRACT STATUS CHECK for redemption ${redemptionId}`);
      
      // Get redemption from database
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found in database" });
      }
      
      if (!redemption.redemptionRequestId) {
        return res.status(400).json({ 
          error: "No redemption request ID found in database",
          redemption: {
            status: redemption.status,
            xrplPayoutTxHash: redemption.xrplPayoutTxHash
          }
        });
      }
      
      const requestId = BigInt(redemption.redemptionRequestId);
      
      console.log(`📊 Database state:`, {
        status: redemption.status,
        redemptionRequestId: redemption.redemptionRequestId,
        xrplPayoutTxHash: redemption.xrplPayoutTxHash,
        hasFdcProof: redemption.fdcProofData ? "YES" : "NO"
      });
      
      // Query contract state
      const fassetsClient = (bridgeService as any).fassetsClient;
      const contractStatus = await fassetsClient.getRedemptionRequestStatus(requestId);
      
      if (!contractStatus.exists) {
        return res.json({
          redemptionId,
          requestId: requestId.toString(),
          contractState: {
            exists: false,
            diagnosis: "Redemption request does not exist on-chain",
            possibleReasons: [
              "Request was already confirmed and removed from contract",
              "Request expired and was cleaned up",
              "Request ID is incorrect"
            ]
          },
          databaseState: {
            status: redemption.status,
            xrplPayoutTxHash: redemption.xrplPayoutTxHash,
            hasFdcProof: redemption.fdcProofData ? "YES" : "NO"
          }
        });
      }
      
      // Request exists, return full details
      const details = contractStatus.details!;
      
      return res.json({
        redemptionId,
        requestId: requestId.toString(),
        contractState: {
          exists: true,
          agentVault: details.agentVault,
          valueUBA: details.valueUBA.toString(),
          feeUBA: details.feeUBA.toString(),
          firstUnderlyingBlock: details.firstUnderlyingBlock.toString(),
          lastUnderlyingBlock: details.lastUnderlyingBlock.toString(),
          lastUnderlyingTimestamp: details.lastUnderlyingTimestamp.toString(),
          paymentAddress: details.paymentAddress,
          interpretation: {
            valueXRP: ethers.formatUnits(details.valueUBA, 6),
            feeXRP: ethers.formatUnits(details.feeUBA, 6),
            totalExpectedXRP: ethers.formatUnits(details.valueUBA + details.feeUBA, 6)
          }
        },
        databaseState: {
          status: redemption.status,
          xrplPayoutTxHash: redemption.xrplPayoutTxHash,
          hasFdcProof: redemption.fdcProofData ? "YES" : "NO",
          fdcAttestationTxHash: redemption.fdcAttestationTxHash
        }
      });
      
    } catch (error: any) {
      console.error("Error checking contract status:", error);
      return res.status(500).json({ 
        error: error.message,
        stack: error.stack 
      });
    }
  });

  // Debug: Direct contract query with known request ID (ADMIN ONLY)
  // IMPORTANT: This must be BEFORE the generic /api/withdrawals/:id route
  app.get("/api/withdrawals/:redemptionId/debug-direct", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      const requestIdParam = req.query.requestId as string;
      
      if (!requestIdParam) {
        return res.status(400).json({ error: "requestId query parameter required" });
      }
      
      console.log(`\n🔍 DIRECT DEBUG: Checking FAssets request state`);
      console.log(`   Redemption ID: ${redemptionId}`);
      console.log(`   Request ID: ${requestIdParam}`);
      
      // Get contract state directly through FAssetsClient
      const fassetsClient = (bridgeService as any).fassetsClient;
      const requestId = BigInt(requestIdParam);
      let requestState;
      
      try {
        requestState = await fassetsClient.getRedemptionRequest(requestId);
        console.log(`✅ Request state retrieved from contract`);
        console.log(`📊 Raw state:`, requestState);
        
        // The state is an object with named properties, not an array
        const stateInfo: any = {
          exists: true,
          agentVault: requestState.agentVault,
          valueUBA: requestState.valueUBA.toString(),
          feeUBA: requestState.feeUBA.toString(),
          firstUnderlyingBlock: requestState.firstUnderlyingBlock.toString(),
          lastUnderlyingBlock: requestState.lastUnderlyingBlock.toString(),
          lastUnderlyingTimestamp: requestState.lastUnderlyingTimestamp.toString(),
          paymentAddress: requestState.paymentAddress
        };
        
        console.log(`📊 Parsed Contract State:`, JSON.stringify(stateInfo, null, 2));
        
        return res.json({
          redemptionId,
          requestId: requestIdParam,
          contractState: stateInfo,
          interpretation: {
            valueXRP: ethers.formatUnits(stateInfo.valueUBA, 6),
            feeXRP: ethers.formatUnits(stateInfo.feeUBA, 6),
            netXRP: ethers.formatUnits(BigInt(stateInfo.valueUBA) - BigInt(stateInfo.feeUBA), 6),
            paymentAddress: stateInfo.paymentAddress,
            agentVault: stateInfo.agentVault
          }
        });
      } catch (e: any) {
        console.error(`❌ Failed to get request state:`, e.message);
        return res.status(200).json({
          redemptionId,
          requestId: requestIdParam,
          contractState: {
            exists: false,
            error: e.message,
            suggestion: "Request may have been deleted/expired or ID is incorrect"
          }
        });
      }
    } catch (error: any) {
      console.error("Error debugging redemption:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get redemption status by ID
  app.get("/api/withdrawals/:id", async (req, res) => {
    try {
      const redemption = await storage.getRedemptionById(req.params.id);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
      res.json(redemption);
    } catch (error) {
      console.error("Get redemption error:", error);
      res.status(500).json({ error: "Failed to get redemption status" });
    }
  });

  // Get withdrawal/redemption status for polling (mirrors deposit status endpoint)
  app.get("/api/withdrawals/:redemptionId/status", async (req, res) => {
    try {
      const { redemptionId } = req.params;
      
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Withdrawal not found" });
      }

      // Calculate the XRP amount being withdrawn
      const amount = redemption.xrpSent || redemption.fxrpRedeemed || redemption.shareAmount;

      // Use userStatus for determining what the user sees
      // This ensures users see "complete" when they receive XRP, even if backend confirmation fails
      let currentStep: "creating" | "processing" | "sending" | "complete" | "error";
      let displayError: string | undefined;
      
      if (redemption.userStatus === "completed") {
        // User has XRP successfully - show complete
        currentStep = "complete";
      } else if (redemption.userStatus === "failed") {
        // Withdrawal failed before user received XRP
        currentStep = "error";
        displayError = redemption.errorMessage || "Withdrawal failed";
      } else {
        // userStatus === "processing" - map legacy status for UI
        if (redemption.status === "pending") {
          currentStep = "creating";
        } else if (redemption.status === "xrpl_payout" || redemption.status === "xrpl_received") {
          currentStep = "sending";
        } else {
          // redeeming_shares, redeemed_fxrp, redeeming_fxrp, awaiting_proof, awaiting_liquidity
          currentStep = "processing";
        }
      }

      res.json({
        success: true,
        redemptionId: redemption.id,
        status: redemption.status, // Legacy field
        userStatus: redemption.userStatus, // User-facing status
        backendStatus: redemption.backendStatus, // Backend reconciliation status
        currentStep: currentStep,
        amount: amount,
        shareAmount: redemption.shareAmount,
        fxrpRedeemed: redemption.fxrpRedeemed,
        xrpSent: redemption.xrpSent,
        xrplTxHash: redemption.xrplPayoutTxHash,
        vaultRedeemTxHash: redemption.vaultRedeemTxHash,
        fassetsRedemptionTxHash: redemption.fassetsRedemptionTxHash,
        createdAt: redemption.createdAt,
        completedAt: redemption.completedAt,
        error: displayError,
        backendError: redemption.backendError, // Backend errors separate from user-facing errors
        lastError: redemption.lastError, // Most recent error message (user-friendly)
      });
    } catch (error) {
      console.error("Withdrawal status fetch error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to fetch withdrawal status" });
      }
    }
  });

  // Get all redemptions for a wallet
  app.get("/api/withdrawals/wallet/:address", async (req, res) => {
    try {
      const redemptions = await storage.getRedemptionsByWallet(req.params.address);
      res.json(redemptions);
    } catch (error) {
      console.error("Get wallet redemptions error:", error);
      res.status(500).json({ error: "Failed to get wallet redemptions" });
    }
  });

  // Manual retry for stuck redemptions (ADMIN ONLY)
  app.post("/api/withdrawals/:redemptionId/retry", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      
      // Get redemption details
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
      
      if (redemption.status !== "awaiting_proof") {
        return res.status(400).json({ 
          error: `Redemption is not in awaiting_proof status (current: ${redemption.status})` 
        });
      }
      
      // If xrplPayoutTxHash is already set, use it
      if (redemption.xrplPayoutTxHash) {
        console.log(`🔄 Using existing XRPL TX hash: ${redemption.xrplPayoutTxHash}`);
        await bridgeService.processRedemptionConfirmation(redemptionId, redemption.xrplPayoutTxHash);
        return res.json({ 
          success: true, 
          message: "Redemption retry triggered", 
          txHash: redemption.xrplPayoutTxHash 
        });
      }
      
      // Otherwise, try to find the XRPL payment
      // This would require XRPL client access - for now, return an error
      return res.status(400).json({ 
        error: "No XRPL payment TX hash found. Please provide the TX hash manually.",
        redemption: {
          id: redemption.id,
          userAddress: redemption.walletAddress,
          agentAddress: redemption.agentUnderlyingAddress,
          expectedXrp: redemption.expectedXrpDrops,
          status: redemption.status
        }
      });
    } catch (error) {
      console.error("Error retrying redemption:", error);
      res.status(500).json({ error: "Failed to retry redemption" });
    }
  });

  // Debug: Check redemption request state on AssetManager contract (ADMIN ONLY)
  app.get("/api/withdrawals/:redemptionId/debug", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
      
      if (!redemption.redemptionRequestId) {
        return res.status(400).json({ 
          error: "No FAssets redemption request ID found",
          redemption: {
            id: redemption.id,
            status: redemption.status
          }
        });
      }
      
      console.log(`\n🔍 DEBUG: Checking FAssets request state`);
      console.log(`   Redemption ID: ${redemptionId}`);
      console.log(`   Request ID: ${redemption.redemptionRequestId}`);
      
      // Get contract state through BridgeService's FAssets client
      const fassetsClient = (bridgeService as any).fassetsClient;
      const assetManager = await (fassetsClient as any).getAssetManager();
      
      // Query redemption request state
      const requestId = BigInt(redemption.redemptionRequestId);
      let requestState;
      
      try {
        // Try to get the request - this might fail if it doesn't exist
        requestState = await assetManager.getRedemptionRequest(requestId);
        console.log(`✅ Request state retrieved from contract`);
      } catch (e: any) {
        console.error(`❌ Failed to get request state:`, e.message);
        return res.status(200).json({
          redemption: {
            id: redemption.id,
            status: redemption.status,
            requestId: redemption.redemptionRequestId
          },
          contractState: {
            exists: false,
            error: e.message,
            suggestion: "Request may have been deleted/expired or ID is incorrect"
          }
        });
      }
      
      // Parse the request state
      const stateInfo: any = {
        exists: true,
        raw: {}
      };
      
      // Extract fields from the tuple (structure varies by contract version)
      if (requestState) {
        // Common fields in FAssets redemption requests
        try {
          stateInfo.raw = {
            redeemer: requestState[0]?.toString?.() || requestState.redeemer?.toString?.(),
            valueUBA: requestState[1]?.toString?.() || requestState.valueUBA?.toString?.(),
            feeUBA: requestState[2]?.toString?.() || requestState.feeUBA?.toString?.(),
            firstUnderlyingBlock: requestState[3]?.toString?.() || requestState.firstUnderlyingBlock?.toString?.(),
            lastUnderlyingBlock: requestState[4]?.toString?.() || requestState.lastUnderlyingBlock?.toString?.(),
            lastUnderlyingTimestamp: requestState[5]?.toString?.() || requestState.lastUnderlyingTimestamp?.toString?.(),
            paymentAddress: requestState[6]?.toString?.() || requestState.paymentAddress?.toString?.(),
            executor: requestState[7]?.toString?.() || requestState.executor?.toString?.(),
          };
          
          // Check if request has expired
          const currentBlock = await assetManager.provider.getBlockNumber();
          const lastBlock = BigInt(stateInfo.raw.lastUnderlyingBlock || "0");
          
          stateInfo.status = lastBlock > 0 && BigInt(currentBlock) > lastBlock ? "expired" : "active";
          stateInfo.expiresAtBlock = stateInfo.raw.lastUnderlyingBlock;
          stateInfo.currentBlock = currentBlock.toString();
          
        } catch (parseError: any) {
          console.warn(`⚠️  Could not parse all request fields:`, parseError.message);
          stateInfo.parseError = parseError.message;
        }
      }
      
      res.json({
        redemption: {
          id: redemption.id,
          status: redemption.status,
          requestId: redemption.redemptionRequestId,
          xrplTxHash: redemption.xrplPayoutTxHash
        },
        contractState: stateInfo
      });
      
    } catch (error: any) {
      console.error("Error debugging redemption:", error);
      res.status(500).json({ 
        error: "Failed to debug redemption",
        message: error.message 
      });
    }
  });

  // Manual retry with TX hash (ADMIN ONLY)
  app.post("/api/withdrawals/:redemptionId/complete", requireAdminAuth, async (req, res) => {
    try {
      const { redemptionId } = req.params;
      const { txHash } = req.body;
      
      if (!txHash) {
        return res.status(400).json({ error: "txHash is required" });
      }
      
      const redemption = await storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return res.status(404).json({ error: "Redemption not found" });
      }
      
      console.log(`🔧 Manually completing redemption ${redemptionId} with TX ${txHash}`);
      await bridgeService.processRedemptionConfirmation(redemptionId, txHash);
      
      res.json({ 
        success: true, 
        message: "Redemption completion triggered", 
        txHash 
      });
    } catch (error) {
      console.error("Error completing redemption:", error);
      res.status(500).json({ error: "Failed to complete redemption" });
    }
  });

  // Get payment transaction result
  app.get("/api/wallet/xaman/payment/:uuid", async (req, res) => {
    try {
      // Handle demo mode
      if (req.params.uuid.startsWith("demo-")) {
        return res.json({
          signed: true,
          txHash: `${req.params.uuid.replace('demo-', '')}-${Date.now()}`,
          demo: true
        });
      }

      const apiKey = process.env.XUMM_API_KEY?.trim();
      const apiSecret = process.env.XUMM_API_SECRET?.trim();

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: "Xaman credentials not configured" });
      }

      const xumm = new XummSdk(apiKey, apiSecret);
      const payload = await xumm.payload?.get(req.params.uuid);

      if (!payload) {
        return res.status(404).json({ error: "Payload not found" });
      }

      const signed = payload.meta?.signed || false;
      const txHash = payload.response?.txid || null;

      res.json({
        signed,
        txHash,
        demo: false
      });
    } catch (error) {
      console.error("Get payment status error:", error);
      res.status(500).json({ error: "Failed to get payment status" });
    }
  });

  // Submit signed XRPL transaction (for WalletConnect)
  app.post("/api/xrpl/submit", async (req, res) => {
    try {
      const { tx_blob, network } = req.body;

      if (!tx_blob) {
        return res.status(400).json({ error: "Missing tx_blob" });
      }

      // Compute transaction hash for verification
      const { hashes } = await import("xrpl");
      const txHash = hashes.hashSignedTx(tx_blob);

      // Connect to XRPL network
      const isTestnet = network === "testnet";
      const xrplServer = isTestnet 
        ? "wss://s.altnet.rippletest.net:51233"
        : "wss://xrplcluster.com";

      const client = new Client(xrplServer);
      await client.connect();

      try {
        // Submit the signed transaction
        const result = await client.submit(tx_blob);

        // Check if submission was successful (only tesSUCCESS is truly successful)
        if (result?.result?.engine_result === "tesSUCCESS") {
          return res.json({
            success: true,
            txHash: result.result.tx_json?.hash || txHash,
            result: result.result
          });
        }

        // Check if error is "sequence already used" - wallet may have auto-submitted
        const engineResult = result?.result?.engine_result || "";
        const engineMessage = result?.result?.engine_result_message || "";
        const isSequenceError = engineResult.includes("tefPAST_SEQ") || 
                               engineResult.includes("Sequence") ||
                               engineMessage.toLowerCase().includes("sequence");

        console.log("Transaction submission failed:");
        console.log("  Engine result:", engineResult);
        console.log("  Engine message:", engineMessage);
        console.log("  Is sequence error:", isSequenceError);
        console.log("  Transaction hash:", txHash);

        if (isSequenceError && txHash) {
          console.log("Detected sequence error - wallet likely auto-submitted the transaction");
          console.log("Transaction hash:", txHash);
          
          // Launch async verification in background (don't await)
          verifyWalletAutoSubmittedTransaction(txHash as string, network || "mainnet")
            .catch(err => console.error("Background verification error:", err));
          
          // Return success immediately so user doesn't wait
          // Frontend will create a "pending" position that gets confirmed when verification completes
          return res.json({
            success: true,
            txHash: txHash as string,
            walletAutoSubmitted: true,
            pending: true,
            message: "Transaction submitted by wallet - confirming on ledger..."
          });
        }

        // Transaction failed (including tec* codes or malformed responses)
        const errorMessage = result?.result?.engine_result_message || 
                            result?.result?.engine_result || 
                            "Transaction failed";
        
        return res.status(400).json({
          success: false,
          error: errorMessage,
          engineResult: engineResult,
          result: result?.result
        });
      } finally {
        // Always disconnect, even if there's an error
        await client.disconnect();
      }
    } catch (error) {
      console.error("XRPL submit error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to submit transaction" 
      });
    }
  });

  // Get all transactions (wallet-scoped - requires walletAddress)
  app.get("/api/transactions", async (req, res) => {
    try {
      const walletAddress = req.query.walletAddress as string | undefined;
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress parameter is required" });
      }
      const transactions = await storage.getTransactions(50, walletAddress);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Get transaction summary (wallet-scoped - requires walletAddress)
  app.get("/api/transactions/summary", async (req, res) => {
    try {
      const walletAddress = req.query.walletAddress as string | undefined;
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress parameter is required" });
      }
      const summary = await storage.getTransactionSummary(walletAddress);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction summary" });
    }
  });

  // Get SHIELD staking info for wallet address
  app.get("/api/staking/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      // Query database for staking position
      const stakeInfo = await storage.getStakeInfo(address);
      
      if (!stakeInfo) {
        // No staking position found - return zero state
        return res.json({
          amount: "0",
          stakedAt: "0",
          unlockTime: "0",
          boostPercentage: 0,
          isLocked: false
        });
      }
      
      // Calculate boost percentage (+1% per 100 SHIELD staked)
      const amountInTokens = parseFloat(stakeInfo.amount) / 1e18; // Convert from wei to tokens
      const boostPercentage = Math.floor(amountInTokens / 100); // 1% per 100 SHIELD
      
      // Check if tokens are locked (current time < unlock time)
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const unlockTimestamp = parseFloat(stakeInfo.unlockTime);
      const isLocked = currentTimestamp < unlockTimestamp;
      
      res.json({
        amount: stakeInfo.amount,
        stakedAt: stakeInfo.stakedAt,
        unlockTime: stakeInfo.unlockTime,
        boostPercentage,
        isLocked
      });
    } catch (error) {
      console.error("Failed to fetch staking info:", error);
      res.status(500).json({ error: "Failed to fetch staking info" });
    }
  });

  // Stake SHIELD tokens (MVP: database only, no contract interaction)
  app.post("/api/staking/stake", async (req, res) => {
    try {
      const { address, amount } = req.body;
      
      if (!address || !amount) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: address and amount" 
        });
      }

      // Validate amount is positive
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({
          success: false,
          error: "Amount must be a positive number"
        });
      }

      // Convert amount to wei (18 decimals)
      const amountWei = BigInt(Math.floor(amountNum * 1e18)).toString();
      
      // Calculate timestamps (in seconds)
      const stakedAt = Math.floor(Date.now() / 1000).toString();
      const unlockTime = (Math.floor(Date.now() / 1000) + 2592000).toString(); // 30 days = 2592000 seconds
      
      // Store in database
      await storage.recordStake(address, amountWei, stakedAt, unlockTime);
      
      // Generate mock txHash for MVP
      const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
      
      res.json({
        success: true,
        txHash: mockTxHash
      });
    } catch (error) {
      console.error("Failed to stake:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to stake tokens" 
      });
    }
  });

  // Unstake SHIELD tokens (MVP: database only, no contract interaction)
  app.post("/api/staking/unstake", async (req, res) => {
    try {
      const { address, amount } = req.body;
      
      if (!address || !amount) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: address and amount" 
        });
      }

      // Validate amount is positive
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({
          success: false,
          error: "Amount must be a positive number"
        });
      }

      // Get current staking position to check lock status
      const stakeInfo = await storage.getStakeInfo(address);
      if (!stakeInfo) {
        return res.status(400).json({
          success: false,
          error: "No staking position found"
        });
      }

      // Validate unlock time has passed
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const unlockTimestamp = parseFloat(stakeInfo.unlockTime);
      
      if (currentTimestamp < unlockTimestamp) {
        const timeRemaining = unlockTimestamp - currentTimestamp;
        const daysRemaining = Math.ceil(timeRemaining / 86400);
        return res.status(400).json({
          success: false,
          error: `Tokens are locked for ${daysRemaining} more day(s)`
        });
      }

      // Convert amount to wei (18 decimals)
      const amountWei = BigInt(Math.floor(amountNum * 1e18)).toString();
      
      // Update database
      await storage.recordUnstake(address, amountWei);
      
      res.json({
        success: true
      });
    } catch (error) {
      console.error("Failed to unstake:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to unstake tokens" 
      });
    }
  });

  // Get protocol overview analytics with live on-chain TVL
  app.get("/api/analytics/overview", async (_req, res) => {
    try {
      const overview = await storage.getProtocolOverview();
      
      // Enrich with live on-chain data if available
      if (vaultDataService && vaultDataService.isReady()) {
        try {
          const liveTvl = await vaultDataService.getLiveTVL();
          const liveApy = await vaultDataService.getLiveAPY();
          return res.json({
            ...overview,
            tvl: liveTvl,
            avgApy: liveApy,
            isLive: true
          });
        } catch (liveError) {
          console.warn("Failed to get live data, using database fallback:", liveError);
        }
      }
      
      res.json({ ...overview, isLive: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch protocol overview" });
    }
  });

  // Get APY history
  app.get("/api/analytics/apy", async (_req, res) => {
    try {
      const apyHistory = await storage.getApyHistory();
      res.json(apyHistory);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch APY history" });
    }
  });

  // Get TVL history
  app.get("/api/analytics/tvl", async (_req, res) => {
    try {
      const tvlHistory = await storage.getTvlHistory();
      res.json(tvlHistory);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch TVL history" });
    }
  });

  // Get vault distribution
  app.get("/api/analytics/distribution", async (_req, res) => {
    try {
      const distribution = await storage.getVaultDistribution();
      res.json(distribution);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vault distribution" });
    }
  });

  // Get top performing vaults
  app.get("/api/analytics/top-vaults", async (_req, res) => {
    try {
      const topVaults = await storage.getTopPerformingVaults();
      res.json(topVaults);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top vaults" });
    }
  });

  // Get revenue transparency metrics (Convex-style)
  app.get("/api/analytics/revenue-transparency", async (_req, res) => {
    try {
      // TODO: Once contracts are deployed on Flare mainnet, replace with real aggregated data from:
      // 1. FeeTransferred events from ShXRPVault contract:
      //    - Sum all deposit/withdrawal fees to get totalFeesCollected
      // 2. RevenueDistributed events from RevenueRouter contract:
      //    - Sum shieldBurned field from all events to get totalShieldBurned
      //    - Calculate burnedAmountUsd (50% of fees converted to SHIELD and burned)
      // 3. Staking boost calculations from ShXRPVault:
      //    - Track previewRedeemWithBoost bonus amounts to get extraYieldDistributed
      //
      // Implementation notes:
      // - Create burn_events table to track RevenueDistributed events
      // - Create fee_events table to track FeeTransferred events
      // - Add storage methods: getBurnEventsSummary(), getFeesSummary(), getStakingBoostSummary()
      // - Query contract events via ethers.js event listeners or The Graph indexer
      
      // Placeholder data (contracts not yet deployed per replit.md)
      const revenueData = {
        // Hero metrics
        totalFeesCollected: "2847000",      // Sum of all FeeTransferred events (USD)
        totalShieldBurned: "317000",        // Sum of shieldBurned from RevenueDistributed events
        totalShieldBurnedUsd: "126800",     // USD value of burned SHIELD tokens
        extraYieldDistributed: "425000",    // Extra yield from staking boost (USD)
        
        // Breakdown cards
        burnedAmountUsd: "1423500",         // 50% of fees used for buyback-burn (USD)
      };
      
      res.json(revenueData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch revenue transparency" });
    }
  });

  /**
   * GET /api/analytics/vault-metrics
   * 
   * Real-time vault performance metrics from MetricsService
   * Includes TVL, APY, deposits/withdrawals, active users, and staking adoption
   * 
   * Response uses 1-minute cache from MetricsService for fast performance
   */
  app.get("/api/analytics/vault-metrics", async (_req, res) => {
    try {
      // If MetricsService is available and ready, use real data
      if (metricsService && metricsService.isReady()) {
        const metrics = await metricsService.getVaultMetrics();
        return res.json(metrics);
      }

      // Fallback to placeholder data while system initializes
      const fallbackMetrics = {
        tvl: "0",
        apy: 10.9,
        totalDeposits: "0",
        totalWithdrawals: "0",
        shieldBurned: "0",
        activeUsers: 0,
        stakingAdoption: {
          totalStakers: 0,
          avgBoostPercentage: 0,
          totalShieldStaked: "0",
        },
      };
      
      res.json(fallbackMetrics);
    } catch (error) {
      console.error("Failed to fetch vault metrics:", error);
      res.status(500).json({ 
        error: "Failed to fetch vault metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * GET /api/analytics/bridge-status
   * 
   * Bridge operation monitoring metrics from MetricsService
   * Includes pending operations, avg redemption time, stuck transactions, and failure rates
   * 
   * Response uses 1-minute cache from MetricsService for fast performance
   */
  app.get("/api/analytics/bridge-status", async (_req, res) => {
    try {
      // If MetricsService is available and ready, use real data
      if (metricsService && metricsService.isReady()) {
        const metrics = await metricsService.getBridgeMetrics();
        return res.json(metrics);
      }

      // Fallback to placeholder data while system initializes
      const fallbackMetrics = {
        pendingOperations: 0,
        avgRedemptionTime: 0,
        stuckTransactions: 0,
        failureRate: 0,
        successfulBridges24h: 0,
        failuresByType: {
          fdcProof: 0,
          xrplPayment: 0,
          confirmation: 0,
          other: 0,
        },
      };
      
      res.json(fallbackMetrics);
    } catch (error) {
      console.error("Failed to fetch bridge status:", error);
      res.status(500).json({ 
        error: "Failed to fetch bridge status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * GET /api/analytics/revenue-stats
   * 
   * Alias endpoint for revenue transparency metrics
   * Redirects to /api/analytics/revenue-transparency for consistency
   * 
   * This endpoint exists for dashboard compatibility and matches the naming convention
   * of other analytics endpoints (vault-metrics, bridge-status, revenue-stats)
   */
  app.get("/api/analytics/revenue-stats", async (_req, res) => {
    try {
      // Reuse the same logic as revenue-transparency endpoint
      // Placeholder data (contracts not yet deployed per replit.md)
      const revenueData = {
        // Hero metrics
        totalFeesCollected: "2847000",      // Sum of all FeeTransferred events (USD)
        totalShieldBurned: "317000",        // Sum of shieldBurned from RevenueDistributed events
        totalShieldBurnedUsd: "126800",     // USD value of burned SHIELD tokens
        extraYieldDistributed: "425000",    // Extra yield from staking boost (USD)
        
        // Breakdown cards
        burnedAmountUsd: "1423500",         // 50% of fees used for buyback-burn (USD)
      };
      
      res.json(revenueData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch revenue stats" });
    }
  });

  // Bridge status tracking
  app.get("/api/bridges/wallet/:walletAddress", async (req, res) => {
    try {
      const bridges = await storage.getBridgesByWallet(req.params.walletAddress);
      res.json(bridges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bridges" });
    }
  });

  app.get("/api/bridges/request/:requestId", async (req, res) => {
    try {
      const bridge = await storage.getBridgeByRequestId(req.params.requestId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }
      res.json(bridge);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bridge" });
    }
  });

  // Unified bridge history (deposits + withdrawals)
  app.get("/api/bridge-history/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      // Fetch deposits
      const deposits = await storage.getBridgesByWallet(walletAddress);
      
      // Fetch withdrawals
      const withdrawals = await storage.getRedemptionsByWallet(walletAddress);
      
      // Normalize deposits to unified format
      const depositHistory = deposits.map(bridge => ({
        id: bridge.id,
        type: "deposit" as const,
        walletAddress: bridge.walletAddress,
        amount: bridge.xrpAmount,
        status: bridge.status,
        xrplTxHash: bridge.xrplTxHash,
        flareTxHash: bridge.flareTxHash || bridge.vaultMintTxHash,
        createdAt: bridge.createdAt,
        completedAt: bridge.completedAt,
        errorMessage: bridge.errorMessage,
      }));
      
      // Normalize withdrawals to unified format
      const withdrawalHistory = withdrawals.map(redemption => ({
        id: redemption.id,
        type: "withdrawal" as const,
        walletAddress: redemption.walletAddress,
        // Ensure amount is always a valid string (never undefined/null)
        amount: redemption.xrpSent || redemption.fxrpRedeemed || redemption.shareAmount || "0",
        status: redemption.status,
        xrplTxHash: redemption.xrplPayoutTxHash,
        flareTxHash: redemption.vaultRedeemTxHash || redemption.fassetsRedemptionTxHash,
        createdAt: redemption.createdAt,
        completedAt: redemption.completedAt,
        errorMessage: redemption.errorMessage,
      }));
      
      // Combine and sort by date (newest first)
      const combined = [...depositHistory, ...withdrawalHistory]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(combined);
    } catch (error) {
      console.error("Failed to fetch bridge history:", error);
      res.status(500).json({ error: "Failed to fetch bridge history" });
    }
  });

  // Manual bridge trigger (for testing)
  app.post("/api/bridges/process", async (req, res) => {
    try {
      const { walletAddress, vaultId, xrpAmount, xrplTxHash } = req.body;
      
      // Create bridge request with 30-minute expiration
      const requestId = `bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const bridge = await storage.createBridge({
        requestId,
        walletAddress,
        vaultId,
        positionId: null,
        xrpAmount,
        fxrpExpected: xrpAmount,
        fxrpReceived: null,
        status: "pending",
        xrplTxHash,
        flareTxHash: null,
        vaultMintTxHash: null,
        xrplConfirmedAt: new Date(),
        bridgeStartedAt: null,
        fxrpReceivedAt: null,
        completedAt: null,
        expiresAt,
        errorMessage: null,
        retryCount: 0,
      });
      
      res.json(bridge);
    } catch (error) {
      res.status(500).json({ error: "Failed to create bridge request" });
    }
  });

  // Admin endpoint: Manually complete minting with XRPL transaction hash
  app.post("/api/bridges/:bridgeId/complete-minting", async (req, res) => {
    try {
      const { bridgeId } = req.params;
      const { xrplTxHash } = req.body;
      
      if (!xrplTxHash) {
        return res.status(400).json({ error: "Missing required field: xrplTxHash" });
      }

      // Get bridge to verify it exists and is in correct state
      const bridge = await storage.getBridgeById(bridgeId);
      if (!bridge) {
        return res.status(404).json({ error: "Bridge not found" });
      }

      if (bridge.status === "completed") {
        return res.status(400).json({ error: "Bridge already completed" });
      }

      if (bridge.status !== "awaiting_payment") {
        return res.status(400).json({ 
          error: `Bridge must be in awaiting_payment status. Current status: ${bridge.status}` 
        });
      }

      // Use shared bridge service (with xrplListener) for minting completion
      // Execute minting with proof
      await bridgeService.executeMintingWithProof(bridgeId, xrplTxHash);
      
      const updatedBridge = await storage.getBridgeById(bridgeId);
      res.json({ 
        success: true, 
        message: "Minting completed successfully",
        bridge: updatedBridge
      });
    } catch (error) {
      console.error("Complete minting error:", error);
      res.status(500).json({ 
        error: "Failed to complete minting",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin endpoint: Query vault deposit events for reconciliation
  app.get("/api/admin/vault-events", async (req, res) => {
    try {
      console.log('\n📜 [VAULT EVENTS] Querying historical deposit/mint events...\n');
      
      const flareClient = (bridgeService as any).config.flareClient as FlareClient;
      const smartAccountAddress = flareClient.getSignerAddress();
      const vaultAddress = getVaultAddress();
      const provider = flareClient.provider;
      
      // Create vault contract instance with events
      const VAULT_ABI = [
        'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'function decimals() view returns (uint8)'
      ];
      const vault = new ethers.Contract(vaultAddress, VAULT_ABI, provider);
      const decimals = await vault.decimals();
      
      console.log(`Vault: ${vaultAddress}`);
      console.log(`Smart Account: ${smartAccountAddress}`);
      console.log(`Decimals: ${decimals}\n`);
      
      // Query Deposit events (ERC-4626) - these show FXRP deposited and shXRP minted
      const currentBlockBigInt = await provider.getBlockNumber();
      const currentBlock = Number(currentBlockBigInt); // Convert BigInt to number
      // Vault deployed on Nov 12, 2025 - query last 2000 blocks (about 4 days on Flare)
      const fromBlock = Math.max(0, currentBlock - 2000);
      const CHUNK_SIZE = 30; // Flare RPC max blocks per query
      
      console.log(`Querying blocks ${fromBlock} to ${currentBlock} in chunks of ${CHUNK_SIZE}...`);
      
      // Helper to query events in chunks
      const queryEventsInChunks = async (filter: any, from: number, to: number): Promise<any[]> => {
        const allEvents: any[] = [];
        for (let start = from; start <= to; start += CHUNK_SIZE) {
          const end = Math.min(start + CHUNK_SIZE - 1, to);
          try {
            const events = await vault.queryFilter(filter, start, end);
            allEvents.push(...events);
            console.log(`  Queried blocks ${start}-${end}: ${events.length} events`);
          } catch (err: any) {
            console.warn(`  Failed blocks ${start}-${end}: ${err.message}`);
          }
        }
        return allEvents;
      };
      
      const depositFilter = vault.filters.Deposit(null, smartAccountAddress);
      const depositEvents = await queryEventsInChunks(depositFilter, fromBlock, currentBlock);
      
      // Query Transfer events where from=0x0 (minting) to smart account
      const mintFilter = vault.filters.Transfer(ethers.ZeroAddress, smartAccountAddress);
      const mintEvents = await queryEventsInChunks(mintFilter, fromBlock, currentBlock);
      
      console.log(`Found ${depositEvents.length} Deposit events`);
      console.log(`Found ${mintEvents.length} Mint events\n`);
      
      // Process events (convert all BigInts to strings for JSON serialization)
      const deposits = await Promise.all(depositEvents.map(async (event: any) => {
        const block = await event.getBlock();
        return {
          type: 'Deposit',
          blockNumber: Number(event.blockNumber), // Convert BigInt to number
          timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
          txHash: event.transactionHash,
          sender: event.args.sender,
          owner: event.args.owner,
          fxrpDeposited: ethers.formatUnits(event.args.assets, decimals),
          sharesMinted: ethers.formatUnits(event.args.shares, decimals)
        };
      }));
      
      const mints = await Promise.all(mintEvents.map(async (event: any) => {
        const block = await event.getBlock();
        return {
          type: 'Mint',
          blockNumber: Number(event.blockNumber), // Convert BigInt to number
          timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
          txHash: event.transactionHash,
          to: event.args.to,
          sharesMinted: ethers.formatUnits(event.args.value, decimals)
        };
      }));
      
      // Combine and sort by block number
      const allEvents = [...deposits, ...mints].sort((a, b) => a.blockNumber - b.blockNumber);
      
      // Calculate totals
      const totalSharesFromDeposits = deposits.reduce((sum, e) => sum + parseFloat(e.sharesMinted), 0);
      const totalSharesFromMints = mints.reduce((sum, e) => sum + parseFloat(e.sharesMinted), 0);
      
      const summary = {
        vaultAddress,
        smartAccountAddress,
        decimals: Number(decimals),
        blockRange: { from: Number(fromBlock), to: Number(currentBlock) }, // Convert BigInts
        eventCounts: {
          deposits: depositEvents.length,
          mints: mintEvents.length,
          total: allEvents.length
        },
        totals: {
          sharesFromDeposits: totalSharesFromDeposits,
          sharesFromMints: totalSharesFromMints
        },
        events: allEvents
      };
      
      res.json(summary);
      
    } catch (error: any) {
      console.error('❌ [VAULT EVENTS] Error:', error);
      res.status(500).json({ 
        error: 'Failed to query vault events',
        details: error.message 
      });
    }
  });

  // Admin endpoint: Generate diagnostic snapshot of current system state
  app.get("/api/admin/diagnostic-snapshot", async (req, res) => {
    try {
      console.log('\n📊 [DIAGNOSTIC] Generating system snapshot...\n');
      
      const flareClient = (bridgeService as any).config.flareClient as FlareClient;
      const smartAccountAddress = flareClient.getSignerAddress();
      
      // On-chain balances
      // 1. Query CFLR balance
      const provider = flareClient.provider;
      const cflrBalanceRaw = await provider.getBalance(smartAccountAddress);
      const cflrBalance = ethers.formatEther(cflrBalanceRaw);
      
      // 2. Query FXRP balance
      const fxrpToken = await flareClient.getFXRPToken() as any;
      const fxrpBalanceRaw = await fxrpToken.balanceOf(smartAccountAddress);
      const fxrpBalance = ethers.formatUnits(fxrpBalanceRaw, 6);
      
      // 3. Query shXRP balance from vault contract
      const vaultAddress = getVaultAddress();
      const ERC20_ABI = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];
      const vaultContract = new ethers.Contract(vaultAddress, ERC20_ABI, provider) as any;
      const shxrpBalanceRaw = await vaultContract.balanceOf(smartAccountAddress);
      const shxrpBalance = ethers.formatUnits(shxrpBalanceRaw, 6);
      
      // Database state
      const positions = await storage.getPositions();
      const allRedemptions = await db.select().from(fxrpToXrpRedemptions);
      const transactions = await storage.getTransactions();
      
      // Calculate totals
      const totalShxrpInDb = positions.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
      const totalRedemptions = allRedemptions.length;
      const completedRedemptions = allRedemptions.filter(r => r.status === 'completed').length;
      const failedRedemptions = allRedemptions.filter(r => r.status === 'failed').length;
      
      // Detect discrepancies
      const shxrpDiscrepancy = totalShxrpInDb - parseFloat(shxrpBalance);
      const fxrpStuck = parseFloat(fxrpBalance);
      
      const snapshot = {
        timestamp: new Date().toISOString(),
        smartAccount: smartAccountAddress,
        onChain: {
          cflr: cflrBalance,
          fxrp: fxrpBalance,
          shxrp: shxrpBalance
        },
        database: {
          positions: {
            count: positions.length,
            totalShxrp: totalShxrpInDb.toFixed(6),
            records: positions.map((p: any) => ({
              id: p.id,
              walletAddress: p.walletAddress,
              amount: p.amount,
              status: p.status
            }))
          },
          redemptions: {
            total: totalRedemptions,
            completed: completedRedemptions,
            failed: failedRedemptions,
            pending: totalRedemptions - completedRedemptions - failedRedemptions
          },
          transactions: {
            count: transactions.length,
            byType: {
              deposit: transactions.filter((t: any) => t.type === 'deposit').length,
              withdrawal: transactions.filter((t: any) => t.type === 'withdrawal').length
            }
          }
        },
        discrepancies: {
          shxrpMismatch: {
            database: totalShxrpInDb.toFixed(6),
            onChain: shxrpBalance,
            difference: shxrpDiscrepancy.toFixed(6),
            critical: Math.abs(shxrpDiscrepancy) > 0.01
          },
          fxrpStuck: {
            amount: fxrpBalance,
            critical: fxrpStuck > 0.01
          },
          orphanedRedemptions: allRedemptions.filter(r => 
            r.fxrpRedeemed && !r.xrplPayoutTxHash && r.status !== 'failed'
          ).length
        }
      };
      
      console.log('✅ Diagnostic snapshot generated');
      console.log(`   shXRP: ${shxrpBalance} on-chain vs ${totalShxrpInDb.toFixed(6)} in DB`);
      console.log(`   FXRP stuck: ${fxrpBalance}`);
      console.log(`   Discrepancy: ${shxrpDiscrepancy > 0 ? 'CRITICAL' : 'OK'}`);
      
      res.json(snapshot);
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(500).json({ 
        error: "Failed to generate diagnostic snapshot",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Admin endpoint: Recover stuck FXRP by minting missing shXRP shares
  app.post("/api/admin/recover-stuck-fxrp", async (req, res) => {
    try {
      console.log('\n🔧 [RECOVERY] Starting stuck FXRP recovery...\n');
      
      // Access FlareClient from bridgeService config
      const flareClient = (bridgeService as any).config.flareClient as FlareClient;
      
      // Check current FXRP balance in smart account
      const smartAccountAddress = flareClient.getSignerAddress();
      const fxrpToken = await flareClient.getFXRPToken() as any;
      
      // Read decimals from contracts (don't hardcode!)
      const fxrpDecimals = await fxrpToken.decimals();
      console.log(`📊 Smart Account: ${smartAccountAddress}`);
      console.log(`🔢 FXRP Decimals: ${fxrpDecimals}`);
      
      const fxrpBalanceRaw = await fxrpToken.balanceOf(smartAccountAddress);
      const fxrpBalance = ethers.formatUnits(fxrpBalanceRaw, fxrpDecimals);
      console.log(`💵 FXRP Balance: ${fxrpBalance} FXRP`);
      
      // Get vault address and contract
      const vaultAddress = getVaultAddress();
      console.log(`🏦 Vault Contract: ${vaultAddress}`);
      const vaultContract = flareClient.getShXRPVault(vaultAddress) as any;
      
      // Read vault decimals
      const vaultDecimals = await vaultContract.decimals();
      console.log(`🔢 Vault (shXRP) Decimals: ${vaultDecimals}`);
      
      // Parse FXRP amount using actual decimals
      const fxrpAmountRaw = ethers.parseUnits(fxrpBalance, fxrpDecimals);
      
      // Safety check 1: Read minimum deposit from vault contract (FXRP-denominated, use fxrpDecimals!)
      const minDepositRaw = await vaultContract.minDeposit();
      // minDeposit returns FXRP amount (asset), NOT shXRP amount (shares)
      const minDeposit = ethers.formatUnits(minDepositRaw, fxrpDecimals);
      console.log(`💰 Vault Min Deposit: ${minDeposit} FXRP (${minDepositRaw.toString()} raw)`);
      
      // Compare raw bigint values (both in FXRP units) to avoid decimal precision errors
      if (fxrpAmountRaw < minDepositRaw) {
        return res.json({ 
          success: false, 
          message: `FXRP balance ${fxrpBalance} below vault minimum deposit of ${minDeposit} FXRP. Nothing to recover.`,
          fxrpBalance,
          minDeposit
        });
      }
      
      // Safety check 2: Record pre-mint shXRP balance for accurate delta reporting
      const shxrpBalanceBeforeRaw = await vaultContract.balanceOf(smartAccountAddress);
      const shxrpBalanceBefore = ethers.formatUnits(shxrpBalanceBeforeRaw, vaultDecimals);
      console.log(`📈 Current shXRP Balance: ${shxrpBalanceBefore}`);
      
      // Safety check 3: CFLR balance check
      console.log(`\n🔍 Running preflight checks...`);
      
      const provider = flareClient.provider;
      const cflrBalanceRaw = await provider.getBalance(smartAccountAddress);
      const cflrBalance = ethers.formatEther(cflrBalanceRaw);
      
      // Require minimum CFLR for gas (conservative estimate: 0.01 CFLR)
      const MIN_CFLR_FOR_GAS = ethers.parseEther("0.01");
      if (cflrBalanceRaw < MIN_CFLR_FOR_GAS) {
        throw new Error(`Insufficient CFLR for gas. Have: ${cflrBalance} CFLR, Need: at least 0.01 CFLR`);
      }
      console.log(`  ✅ Sufficient CFLR for gas: ${cflrBalance} CFLR`);
      
      // Safety check 4: Verify FXRP balance and vault capacity before approval
      console.log(`\n🔍 Verifying FXRP balance and vault capacity...`);
      
      // Re-confirm FXRP balance hasn't changed during preflight checks
      const fxrpBalanceRecheckRaw = await fxrpToken.balanceOf(smartAccountAddress);
      if (fxrpBalanceRecheckRaw < fxrpAmountRaw) {
        throw new Error(`FXRP balance changed during preflight. Expected ${fxrpBalance}, now ${ethers.formatUnits(fxrpBalanceRecheckRaw, fxrpDecimals)}`);
      }
      console.log(`  ✅ FXRP balance confirmed: ${fxrpBalance}`);
      
      // Check vault total assets to ensure capacity exists
      const vaultTotalAssets = await vaultContract.totalAssets();
      console.log(`  Vault Total Assets: ${ethers.formatUnits(vaultTotalAssets, fxrpDecimals)} FXRP`);
      // Note: ERC-4626 vaults typically don't have explicit deposit caps,
      // but checking totalAssets helps detect if vault is functional
      
      // Mint shXRP shares from stuck FXRP (direct vault deposit, no position creation)
      console.log(`\n💡 Minting ${fxrpBalance} FXRP into shXRP shares...`);
      
      // Step 1: Explicit allowance reset (short-circuit on failure)
      console.log(`  Resetting allowance to 0...`);
      let resetTx;
      try {
        resetTx = await fxrpToken.approve(vaultAddress, 0);
        await resetTx.wait();
        console.log(`  ✅ Allowance reset: ${resetTx.hash}`);
      } catch (resetError: any) {
        throw new Error(`Failed to reset allowance. Aborting recovery. ${resetError.message}`);
      }
      
      // Step 2: Set approval for exact deposit amount (short-circuit on failure)
      console.log(`  Approving ${fxrpBalance} FXRP for vault...`);
      let approveTx;
      try {
        approveTx = await fxrpToken.approve(vaultAddress, fxrpAmountRaw);
        await approveTx.wait();
        console.log(`  ✅ Approved: ${approveTx.hash}`);
      } catch (approveError: any) {
        throw new Error(`Failed to approve FXRP. Allowance remains at 0. ${approveError.message}`);
      }
      
      // Step 3: Deposit FXRP into vault with guaranteed cleanup
      console.log(`  Depositing ${fxrpBalance} FXRP into vault...`);
      
      let depositTx;
      let depositSucceeded = false;
      try {
        // ERC-4626: deposit(assets, receiver) -> mints shares to receiver
        depositTx = await vaultContract.deposit(fxrpAmountRaw, smartAccountAddress);
        const depositReceipt = await depositTx.wait();
        depositSucceeded = true;
        console.log(`  ✅ Deposited: ${depositTx.hash}`);
      } finally {
        // Cleanup: Always reset allowance to 0 after deposit attempt
        // This runs regardless of deposit success/failure
        if (!depositSucceeded) {
          console.error(`  ❌ Deposit failed, cleaning up approval...`);
          try {
            const cleanupTx = await fxrpToken.approve(vaultAddress, 0);
            const cleanupReceipt = await cleanupTx.wait();
            console.log(`  ✅ Allowance cleanup complete: ${cleanupTx.hash}`);
          } catch (cleanupError) {
            console.error(`  ⚠️  CRITICAL: Allowance cleanup failed. Manual intervention required.`);
            console.error(`  Vault retains approval to spend FXRP. Reset manually: fxrpToken.approve(${vaultAddress}, 0)`);
            throw cleanupError;
          }
          // Re-throw original deposit error after cleanup
          throw new Error(`Deposit transaction failed. Allowance has been reset.`);
        }
      }
      
      // Step 4: Calculate actual shares minted (delta, not total balance)
      const shxrpBalanceAfterRaw = await vaultContract.balanceOf(smartAccountAddress);
      const shxrpBalanceAfter = ethers.formatUnits(shxrpBalanceAfterRaw, vaultDecimals);
      const sharesMinted = (parseFloat(shxrpBalanceAfter) - parseFloat(shxrpBalanceBefore)).toFixed(Number(vaultDecimals));
      
      console.log(`\n✅ Recovery complete!`);
      console.log(`   FXRP Deposited: ${fxrpBalance}`);
      console.log(`   shXRP Minted: ${sharesMinted} (${shxrpBalanceBefore} → ${shxrpBalanceAfter})`);
      console.log(`   Transaction: ${depositTx.hash}`);
      console.log(`\n⚠️  Note: Shares minted to smart account. Run reconciliation to allocate to users.`);
      
      res.json({ 
        success: true, 
        message: "Stuck FXRP successfully minted into shXRP shares",
        fxrpDeposited: fxrpBalance,
        sharesMinted,
        shxrpBalanceBefore,
        shxrpBalanceAfter,
        txHash: depositTx.hash,
        note: "Shares minted to smart account. Run reconciliation to allocate to user positions."
      });
    } catch (error) {
      console.error("Recovery error:", error);
      res.status(500).json({ 
        error: "Failed to recover stuck FXRP",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ============================================================
  // SHIELD AIRDROP ENDPOINTS
  // ============================================================

  /**
   * METRICS ENDPOINTS
   * Test endpoints for monitoring and analytics
   */

  /**
   * Get vault metrics
   * GET /api/metrics/vault
   */
  app.get("/api/metrics/vault", async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      const metrics = await metricsService.getVaultMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Vault metrics error:", error);
      res.status(500).json({
        error: "Failed to get vault metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get bridge operation metrics
   * GET /api/metrics/bridge
   */
  app.get("/api/metrics/bridge", async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      const metrics = await metricsService.getBridgeMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Bridge metrics error:", error);
      res.status(500).json({
        error: "Failed to get bridge metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get transaction success metrics
   * GET /api/metrics/transaction
   */
  app.get("/api/metrics/transaction", async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      const metrics = await metricsService.getTransactionMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Transaction metrics error:", error);
      res.status(500).json({
        error: "Failed to get transaction metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get system health status
   * GET /api/metrics/health
   */
  app.get("/api/metrics/health", async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      const health = await metricsService.checkSystemHealth();
      
      // Return appropriate HTTP status based on health
      const statusCode = health.overall === "healthy" ? 200 
        : health.overall === "degraded" ? 200 
        : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        error: "Failed to check system health",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get historical vault metrics
   * GET /api/metrics/historical/:days
   * 
   * Query params:
   * - days: Number of days to fetch (default: 30)
   */
  app.get("/api/metrics/historical/:days?", async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      const days = parseInt(req.params.days || "30", 10);
      
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({ 
          error: "Invalid days parameter. Must be between 1 and 365" 
        });
      }

      const metrics = await metricsService.getHistoricalVaultMetrics(days);
      res.json({
        days,
        data: metrics
      });
    } catch (error) {
      console.error("Historical metrics error:", error);
      res.status(500).json({
        error: "Failed to get historical metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Aggregate daily metrics
   * POST /api/metrics/aggregate
   * 
   * Admin endpoint to manually trigger daily metrics aggregation
   */
  app.post("/api/metrics/aggregate", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      await metricsService.aggregateDailyMetrics();
      
      res.json({ 
        success: true,
        message: "Daily metrics aggregated successfully" 
      });
    } catch (error) {
      console.error("Metrics aggregation error:", error);
      res.status(500).json({
        error: "Failed to aggregate daily metrics",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Clear metrics cache
   * POST /api/metrics/cache/clear
   * 
   * Admin endpoint to clear metrics cache
   */
  app.post("/api/metrics/cache/clear", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      if (!metricsService) {
        return res.status(503).json({ error: "MetricsService not available" });
      }

      metricsService.clearCache();
      
      res.json({ 
        success: true,
        message: "Metrics cache cleared successfully" 
      });
    } catch (error) {
      console.error("Cache clear error:", error);
      res.status(500).json({
        error: "Failed to clear cache",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * ALERTING ENDPOINTS
   * Test endpoints for webhook alert notifications
   */

  /**
   * Trigger a test alert
   * POST /api/alerts/test
   * 
   * Body (optional):
   * - type: Alert type to test (redemption_delay, tx_failure, apy_drift, bridge_failure, rpc_issue, health_change)
   * 
   * Example: POST /api/alerts/test { "type": "redemption_delay" }
   */
  app.post("/api/alerts/test", async (req: Request, res: Response) => {
    try {
      if (!alertingService) {
        return res.status(503).json({ 
          error: "AlertingService not available",
          message: "Alerting service has not been initialized. Check server logs." 
        });
      }

      const { type } = req.body;
      
      // Validate alert type if provided
      const validTypes = ['redemption_delay', 'tx_failure', 'apy_drift', 'bridge_failure', 'rpc_issue', 'health_change'];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({ 
          error: "Invalid alert type",
          validTypes 
        });
      }

      console.log(`🧪 Test alert triggered via API${type ? ` (type: ${type})` : ''}`);
      await alertingService.sendTestAlert(type);

      res.json({ 
        success: true,
        message: `Test alert sent successfully${type ? ` for type: ${type}` : ''}`,
        note: "Check your configured Slack/Discord channels for the test notification"
      });
    } catch (error) {
      console.error("Test alert error:", error);
      res.status(500).json({
        error: "Failed to send test alert",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Manually trigger alert checks
   * POST /api/alerts/check
   * 
   * Admin endpoint to manually trigger alert condition checking
   */
  app.post("/api/alerts/check", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      if (!alertingService) {
        return res.status(503).json({ error: "AlertingService not available" });
      }

      console.log(`🔍 Manual alert check triggered via API`);
      await alertingService.checkAndAlert();

      res.json({ 
        success: true,
        message: "Alert check completed successfully",
        note: "Any triggered alerts have been sent to configured webhooks"
      });
    } catch (error) {
      console.error("Manual alert check error:", error);
      res.status(500).json({
        error: "Failed to check alerts",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Check if an address is eligible for SHIELD airdrop
   * GET /api/airdrop/check/:address
   * 
   * Returns: { eligible: boolean, claimed: boolean, amount?: string, proof?: string[], message?: string }
   * 
   * Priority: On-chain claim status is the single source of truth.
   * If claimed on-chain, eligible=false regardless of Merkle tree status.
   */
  app.get("/api/airdrop/check/:address", async (req: Request, res: Response) => {
    try {
      const address = req.params.address;

      // Validate address format
      if (!ethers.isAddress(address)) {
        return res.status(400).json({ error: "Invalid Ethereum address" });
      }

      // Checksum the address
      const checksummedAddress = ethers.getAddress(address);

      // FIRST: Check on-chain claim status
      let hasClaimed = false;
      const distributorAddress = process.env.VITE_MERKLE_DISTRIBUTOR_ADDRESS;
      
      if (distributorAddress && distributorAddress !== "0x...") {
        try {
          const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
          const distributorAbi = ["function hasClaimed(address account) external view returns (bool)"];
          const contract = new ethers.Contract(distributorAddress, distributorAbi, provider);
          hasClaimed = await contract.hasClaimed(checksummedAddress);
          console.log(`[Airdrop] On-chain claim check for ${checksummedAddress}: claimed=${hasClaimed}`);
        } catch (onChainError) {
          console.warn("[Airdrop] Failed to check on-chain claim status:", onChainError);
        }
      }

      // If already claimed on-chain, they're not eligible
      if (hasClaimed) {
        return res.json({
          eligible: false,
          claimed: true,
          message: "You have already claimed your SHIELD tokens",
        });
      }

      // Fetch eligibility from faucet API (single source of truth)
      try {
        const faucetResponse = await fetch(`https://faucet.shyield.finance/api/airdrop/check/${checksummedAddress}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (faucetResponse.ok) {
          const faucetData = await faucetResponse.json();
          console.log(`[Airdrop] Faucet eligibility check for ${checksummedAddress}:`, faucetData);
          
          // Return faucet data directly (it's the source of truth)
          return res.json({
            eligible: faucetData.eligible,
            claimed: faucetData.claimed || false,
            amount: faucetData.amount,
            proof: faucetData.proof || [],
            message: faucetData.message,
          });
        } else {
          console.warn(`[Airdrop] Faucet API returned ${faucetResponse.status}, falling back to local data`);
        }
      } catch (faucetError) {
        console.warn("[Airdrop] Failed to fetch from faucet API, falling back to local data:", faucetError);
      }

      // Fallback: Load local merkle tree data
      const merkleTreePath = path.join(process.cwd(), "data/merkle-tree.json");
      
      if (!fs.existsSync(merkleTreePath)) {
        return res.status(500).json({ error: "Airdrop data not available" });
      }

      const merkleTreeData = JSON.parse(fs.readFileSync(merkleTreePath, "utf-8"));

      // Find user's entry in merkle tree
      const userEntry = merkleTreeData.entries.find(
        (entry: any) => entry.address.toLowerCase() === checksummedAddress.toLowerCase()
      );

      if (!userEntry) {
        return res.json({ 
          eligible: false, 
          claimed: false,
          message: "This address is not eligible for the airdrop",
        });
      }

      // Eligible and not yet claimed
      res.json({
        eligible: true,
        claimed: false,
        amount: userEntry.amount,
        proof: userEntry.proof,
      });
    } catch (error) {
      console.error("Airdrop check error:", error);
      res.status(500).json({ 
        error: "Failed to check airdrop eligibility",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get merkle proof for an address
   * GET /api/airdrop/proof/:address
   * 
   * Returns: { proof: string[], amount: string }
   */
  app.get("/api/airdrop/proof/:address", async (req: Request, res: Response) => {
    try {
      const address = req.params.address;

      // Validate address format
      if (!ethers.isAddress(address)) {
        return res.status(400).json({ error: "Invalid Ethereum address" });
      }

      // Checksum the address
      const checksummedAddress = ethers.getAddress(address);

      // Load merkle tree data
      const merkleTreePath = path.join(process.cwd(), "data/merkle-tree.json");
      
      if (!fs.existsSync(merkleTreePath)) {
        return res.status(500).json({ error: "Airdrop data not available" });
      }

      const merkleTreeData = JSON.parse(fs.readFileSync(merkleTreePath, "utf-8"));

      // Find user's entry in merkle tree
      const userEntry = merkleTreeData.entries.find(
        (entry: any) => entry.address.toLowerCase() === checksummedAddress.toLowerCase()
      );

      if (!userEntry) {
        return res.status(404).json({ error: "Address not eligible for airdrop" });
      }

      res.json({
        proof: userEntry.proof,
        amount: userEntry.amount,
      });
    } catch (error) {
      console.error("Proof generation error:", error);
      res.status(500).json({ 
        error: "Failed to generate merkle proof",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Get airdrop statistics from faucet API (single source of truth)
   * GET /api/airdrop/root
   * 
   * Fetches live stats from faucet.shyield.finance to ensure main app and faucet stay in sync.
   * Returns: { root, totalAmount, totalEntries, totalClaimed, remainingAmount, claimedCount }
   */
  app.get("/api/airdrop/root", async (req: Request, res: Response) => {
    try {
      // Load local merkle tree data for root hash
      const merkleTreePath = path.join(process.cwd(), "data/merkle-tree.json");
      
      if (!fs.existsSync(merkleTreePath)) {
        return res.status(500).json({ error: "Airdrop data not available" });
      }

      const merkleTreeData = JSON.parse(fs.readFileSync(merkleTreePath, "utf-8"));

      // Fetch live stats from faucet API (single source of truth for ALL stats)
      let totalAmount = merkleTreeData.totalAmount;
      let totalClaimed = "0";
      let claimedCount = 0;
      let remainingAmount = merkleTreeData.totalAmount;
      let totalEntries = merkleTreeData.totalEntries;

      try {
        const faucetResponse = await fetch("https://faucet.shyield.finance/api/airdrop/stats", {
          method: "GET",
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (faucetResponse.ok) {
          const faucetStats = await faucetResponse.json();
          console.log(`[Airdrop] Fetched stats from faucet:`, faucetStats);
          
          // Use faucet data as source of truth for ALL values
          totalAmount = faucetStats.totalAmount || merkleTreeData.totalAmount;
          totalClaimed = faucetStats.totalClaimed || "0";
          claimedCount = faucetStats.claimedCount || 0;
          remainingAmount = faucetStats.remainingAmount || totalAmount;
          totalEntries = faucetStats.totalEntries || merkleTreeData.totalEntries;
        } else {
          console.warn(`[Airdrop] Faucet API returned ${faucetResponse.status}, using local data`);
        }
      } catch (faucetError) {
        console.warn("[Airdrop] Failed to fetch from faucet API, using local data:", faucetError);
      }

      res.json({
        root: merkleTreeData.root,
        totalAmount,
        totalEntries,
        timestamp: merkleTreeData.timestamp,
        totalClaimed,
        remainingAmount,
        claimedCount,
        eligibleCount: totalEntries - claimedCount,
      });
    } catch (error) {
      console.error("Merkle root retrieval error:", error);
      res.status(500).json({ 
        error: "Failed to retrieve merkle root",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
