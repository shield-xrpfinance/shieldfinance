import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { FlareClient } from "./utils/flare-client";
import { XRPLDepositListener } from "./listeners/XRPLDepositListener";
import { BridgeService } from "./services/BridgeService";
import { YieldService } from "./services/YieldService";
import { CompoundingService } from "./services/CompoundingService";
import { VaultService } from "./services/VaultService";
import { DepositService } from "./services/DepositService";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await storage.initializeVaults();
  
  // Initialize Flare Network client
  const flareClient = new FlareClient({
    network: "coston2", // Use testnet for now
    privateKey: process.env.OPERATOR_PRIVATE_KEY, // For operator txs
  });

  // Initialize services (note: bridgeService needs xrplListener, so we create it after listener is initialized)
  const demoMode = process.env.DEMO_MODE !== "false"; // Default to true unless explicitly set to false

  const vaultService = new VaultService({
    storage,
    flareClient,
  });

  const yieldService = new YieldService({
    storage,
    flareClient,
    firelightVaultAddress: "0x...", // TODO: Add from config
  });

  const compoundingService = new CompoundingService({
    storage,
    flareClient,
    vaultControllerAddress: "0x...", // TODO: Add from deployment
    minCompoundAmount: "1.0", // Minimum 1 FXRP before compounding
  });

  // Two-phase initialization to eliminate temporal dead zone
  // Phase 1: Create services without circular dependencies
  
  // Create XRPL listener without callbacks
  const xrplListener = new XRPLDepositListener({
    network: "testnet",
    vaultAddress: "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY", // Optional vault monitoring
    storage,
    onDeposit: async (deposit) => {
      // Handle direct vault deposits if needed
      console.log(`📥 Direct vault deposit detected: ${deposit.amount} XRP from ${deposit.walletAddress}`);
    },
  });
  
  // Create bridge service without listener reference
  const bridgeService = new BridgeService({
    network: "coston2",
    storage,
    flareClient,
    vaultService,
    operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || "",
    demoMode,
  });

  console.log(`🌉 BridgeService initialized (${bridgeService.demoMode ? 'DEMO MODE' : 'PRODUCTION MODE'})`);

  // Phase 2: Wire up the circular dependencies
  
  // Register listener with bridge service (for agent address registration)
  bridgeService.setXrplListener(xrplListener);
  
  // Register agent payment handler with listener (now that bridgeService exists)
  xrplListener.setAgentPaymentHandler(async (payment) => {
    console.log(`🔗 FAssets agent payment detected: ${payment.amount} XRP to ${payment.agentAddress}`);
    console.log(`   TX: ${payment.txHash}`);
    console.log(`   Memo: ${payment.memo || '(none)'}`);
    
    try {
      // Find the bridge waiting for this agent payment
      const bridge = await storage.getBridgeByAgentAddress(payment.agentAddress);
      
      if (!bridge) {
        console.log(`⚠️  No bridge found for agent ${payment.agentAddress}`);
        return;
      }
      
      // Validate payment reference (memo) matches
      if (!payment.memo || !bridge.paymentReference) {
        console.log(`⚠️  Payment validation failed: missing memo or payment reference`);
        console.log(`   Payment memo: ${payment.memo || '(none)'}`);
        console.log(`   Expected reference: ${bridge.paymentReference || '(none)'}`);
        console.log(`   Skipping payment - incorrect reference`);
        return;
      }
      
      if (payment.memo !== bridge.paymentReference) {
        console.log(`⚠️  Payment reference mismatch for bridge ${bridge.id}`);
        console.log(`   Received memo: ${payment.memo}`);
        console.log(`   Expected reference: ${bridge.paymentReference}`);
        console.log(`   Skipping payment - incorrect reference`);
        return;
      }
      
      // Validate exact amount matches (reservedValueUBA + reservedFeeUBA)
      if (!bridge.reservedValueUBA || !bridge.reservedFeeUBA) {
        console.log(`⚠️  Bridge ${bridge.id} missing reserved amounts`);
        console.log(`   Cannot validate payment amount`);
        return;
      }
      
      // Calculate expected amount in drops (UBA) - use BigInt for precision
      const expectedDrops = BigInt(bridge.reservedValueUBA) + BigInt(bridge.reservedFeeUBA);
      
      // Convert payment amount (XRP string) to drops without floating point
      // XRP has 6 decimal places, so 1 XRP = 1,000,000 drops
      let receivedDrops: bigint;
      try {
        // Trim whitespace and split on decimal point
        const trimmedAmount = payment.amount.trim();
        const parts = trimmedAmount.split('.');
        
        // Reject malformed amounts with multiple decimal points (e.g., "5..1")
        if (parts.length > 2) {
          throw new Error('Multiple decimal points not allowed');
        }
        
        const [rawIntegerPart = '0', fractionalPart = ''] = parts;
        
        // Normalize integer part (treat empty string as "0" for amounts like ".5")
        const integerPart = rawIntegerPart || '0';
        
        // Validate format (digits only)
        if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) {
          throw new Error('Invalid number format');
        }
        
        // XRP allows max 6 decimal places
        if (fractionalPart.length > 6) {
          throw new Error('Too many decimal places (max 6 for XRP)');
        }
        
        // Pad fractional part to 6 digits and combine
        const paddedFractional = fractionalPart.padEnd(6, '0');
        const dropsString = integerPart + paddedFractional;
        receivedDrops = BigInt(dropsString);
        
        // Validate non-zero positive amount
        if (receivedDrops <= 0n) {
          throw new Error('Amount must be positive');
        }
      } catch (error) {
        console.log(`⚠️  Invalid payment amount for bridge ${bridge.id}: ${payment.amount}`);
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log(`   Skipping payment - invalid amount format`);
        return;
      }
      
      // Compare amounts in drops (exact match required)
      if (receivedDrops !== expectedDrops) {
        console.log(`⚠️  Payment amount mismatch for bridge ${bridge.id}`);
        console.log(`   Received: ${receivedDrops} drops (${payment.amount} XRP)`);
        console.log(`   Expected: ${expectedDrops} drops`);
        console.log(`   Difference: ${receivedDrops - expectedDrops} drops`);
        console.log(`   Skipping payment - incorrect amount`);
        return;
      }
      
      // Allow processing if:
      // 1. Status is awaiting_payment (normal flow)
      // 2. Status is xrpl_confirmed BUT no FDC proof yet (recovery/retry from manual reconciliation or duplicate detection)
      const canProcess = 
        bridge.status === "awaiting_payment" || 
        (bridge.status === "xrpl_confirmed" && !bridge.fdcProofData);
      
      if (!canProcess) {
        console.log(`⏭️  Bridge ${bridge.id} already processed (status: ${bridge.status}, has proof: ${!!bridge.fdcProofData})`);
        return;
      }
      
      console.log(`✅ Payment validated successfully for bridge ${bridge.id}`);
      console.log(`   Payment reference: ${payment.memo}`);
      console.log(`   Amount: ${payment.amount} XRP (${receivedDrops} drops)`);
      console.log(`   Executing minting with proof...`);
      
      // Execute minting with the detected transaction
      await bridgeService.executeMintingWithProof(bridge.id, payment.txHash);
      
      console.log(`🎉 Bridge ${bridge.id} completed successfully!`);
    } catch (error) {
      console.error(`❌ Error completing bridge for agent ${payment.agentAddress}:`, error);
    }
  });
  
  // Start listener last (after all wiring is complete)
  await xrplListener.start();

  // Re-register pending bridges with XRPL listener (for restart recovery)
  if (!demoMode) {
    const pendingBridges = await storage.getPendingBridges();
    console.log(`🔄 Found ${pendingBridges.length} pending bridge(s) to monitor`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const bridge of pendingBridges) {
      if (bridge.agentUnderlyingAddress) {
        try {
          await xrplListener.addAgentAddress(bridge.agentUnderlyingAddress);
          console.log(`   ✅ Re-monitoring agent: ${bridge.agentUnderlyingAddress} (Bridge: ${bridge.id})`);
          successCount++;
        } catch (error) {
          console.error(`   ❌ Failed to re-monitor agent ${bridge.agentUnderlyingAddress} (Bridge: ${bridge.id}):`, error);
          failureCount++;
        }
      }
    }
    
    console.log(`📊 Reconciliation complete: ${successCount} successful, ${failureCount} failed`);
    if (failureCount > 0) {
      console.warn(`⚠️  Warning: ${failureCount} pending bridge(s) not monitored. Manual intervention may be required.`);
    }

    // Automatic recovery: Resume FDC proof generation for stuck bridges
    console.log(`🔍 Checking for stuck bridges at xrpl_confirmed without FDC proofs...`);
    const stuckBridges = await storage.getStuckBridges();
    
    if (stuckBridges.length > 0) {
      console.log(`🔧 Found ${stuckBridges.length} stuck bridge(s) - resuming proof generation...`);
      
      for (const bridge of stuckBridges) {
        try {
          console.log(`   🔄 Resuming proof generation for bridge ${bridge.id} (TX: ${bridge.xrplTxHash})`);
          // Resume proof generation in background (don't await to avoid blocking startup)
          bridgeService.executeMintingWithProof(bridge.id, bridge.xrplTxHash!).catch((error) => {
            console.error(`   ❌ Failed to resume proof generation for bridge ${bridge.id}:`, error);
          });
        } catch (error) {
          console.error(`   ❌ Error initiating recovery for bridge ${bridge.id}:`, error);
        }
      }
      
      console.log(`✅ Automatic recovery initiated for ${stuckBridges.length} bridge(s)`);
    } else {
      console.log(`✅ No stuck bridges found`);
    }

    // Automatic reconciliation: Recover all other failed/stuck bridges
    const autoReconcileEnabled = process.env.AUTO_RECONCILE_ON_START !== "false"; // Default enabled
    if (autoReconcileEnabled) {
      // Run in background to avoid blocking server startup
      bridgeService.reconcileRecoverableBridgesOnStartup().catch((error) => {
        console.error(`❌ Startup reconciliation failed:`, error);
      });
      
      // Optional: Set up periodic reconciliation
      const reconcileIntervalMinutes = process.env.AUTO_RECONCILE_INTERVAL_MINUTES 
        ? parseInt(process.env.AUTO_RECONCILE_INTERVAL_MINUTES, 10) 
        : undefined;
      
      if (reconcileIntervalMinutes && reconcileIntervalMinutes > 0) {
        console.log(`⏰ Scheduling periodic reconciliation every ${reconcileIntervalMinutes} minute(s)`);
        let reconciliationInProgress = false;
        
        setInterval(async () => {
          // In-flight guard: Skip if previous reconciliation is still running
          if (reconciliationInProgress) {
            console.warn(`⏭️  [PERIODIC RECONCILIATION] Skipping - previous run still in progress`);
            return;
          }
          
          try {
            reconciliationInProgress = true;
            console.log(`\n⏰ [PERIODIC RECONCILIATION] Starting scheduled reconciliation...`);
            await bridgeService.reconcileRecoverableBridgesOnStartup();
          } catch (error) {
            console.error(`❌ [PERIODIC RECONCILIATION] Failed:`, error);
          } finally {
            reconciliationInProgress = false;
          }
        }, reconcileIntervalMinutes * 60 * 1000);
      }
    } else {
      console.log(`ℹ️  Automatic reconciliation disabled (AUTO_RECONCILE_ON_START=false)`);
    }
  }

  // Initialize deposit service (needs bridgeService)
  const depositService = new DepositService({
    storage,
    bridgeService,
    vaultService,
    yieldService,
  });

  // Start compounding service (runs every hour)
  // compoundingService.start(60);

  log("✅ All services initialized");
  
  // Pass shared services to routes (ensures agent addresses are registered with listener)
  const server = await registerRoutes(app, bridgeService);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
