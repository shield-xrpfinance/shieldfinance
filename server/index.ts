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
    
    try {
      // Find the bridge waiting for this agent payment
      const bridge = await storage.getBridgeByAgentAddress(payment.agentAddress);
      
      if (!bridge) {
        console.log(`⚠️  No bridge found for agent ${payment.agentAddress}`);
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
      
      console.log(`✅ Matched payment to bridge ${bridge.id}`);
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
