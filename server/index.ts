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
import { DepositWatchdogService } from "./services/DepositWatchdogService";
import { WithdrawalRetryService } from "./services/WithdrawalRetryService";
import { readinessRegistry } from "./services/ReadinessRegistry";

const app = express();

// Module-level references to services (assigned when initialized)
let realBridgeService: BridgeService | null = null;
let realFlareClient: FlareClient | null = null;

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

/**
 * Async service initialization with retry logic
 * Initializes services in background without blocking HTTP server
 */
async function initializeServices() {
  console.log("🔄 Initializing services asynchronously...");

  // Validate required environment variables
  if (!process.env.ETHERSPOT_BUNDLER_API_KEY) {
    const error = 'ETHERSPOT_BUNDLER_API_KEY is required for smart account functionality. Get your API key from: https://dashboard.etherspot.io';
    readinessRegistry.setError('flareClient', error);
    console.error('❌', error);
    return; // Don't crash server, just mark service as failed
  }
  
  if (!process.env.OPERATOR_PRIVATE_KEY) {
    const error = 'OPERATOR_PRIVATE_KEY is required';
    readinessRegistry.setError('flareClient', error);
    console.error('❌', error);
    return; // Don't crash server, just mark service as failed
  }

  const demoMode = process.env.DEMO_MODE === "true";
  
  if (demoMode) {
    console.warn("⚠️  DEMO MODE ENABLED - This should only be used for testing!");
    console.warn("⚠️  Set DEMO_MODE=false or remove it from environment to run in production.");
  }

  // Step 1: Initialize FlareClient with retry logic
  let flareClient: FlareClient | undefined;
  try {
    flareClient = await initializeFlareClientWithRetry({
      network: "coston2",
      privateKey: process.env.OPERATOR_PRIVATE_KEY!,
      bundlerApiKey: process.env.ETHERSPOT_BUNDLER_API_KEY!,
      enablePaymaster: process.env.ENABLE_PAYMASTER === "true",
    });
    readinessRegistry.setReady('flareClient');
    
    // Assign to module-level variable so proxy can forward to it
    realFlareClient = flareClient;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    readinessRegistry.setError('flareClient', errorMsg);
    console.error('❌ FlareClient initialization failed:', errorMsg);
    // Don't return - try to initialize other services even if FlareClient fails
  }

  // Step 2: Initialize services in parallel (where possible)
  let vaultService: VaultService | undefined;
  let yieldService: YieldService | undefined;
  let compoundingService: CompoundingService | undefined;

  if (flareClient) {
    try {
      // These services can be initialized in parallel since they don't depend on each other
      const [vault, yield_, compounding] = await Promise.allSettled([
        Promise.resolve(new VaultService({ storage, flareClient })),
        Promise.resolve(new YieldService({
          storage,
          flareClient,
          firelightVaultAddress: "0x...", // TODO: Add from config
        })),
        Promise.resolve(new CompoundingService({
          storage,
          flareClient,
          vaultControllerAddress: "0x...", // TODO: Add from deployment
          minCompoundAmount: "1.0",
        })),
      ]);

      if (vault.status === 'fulfilled') {
        vaultService = vault.value;
        readinessRegistry.setReady('vaultService');
      } else {
        readinessRegistry.setError('vaultService', vault.reason?.message || 'Initialization failed');
      }

      if (yield_.status === 'fulfilled') {
        yieldService = yield_.value;
        readinessRegistry.setReady('yieldService');
      } else {
        readinessRegistry.setError('yieldService', yield_.reason?.message || 'Initialization failed');
      }

      if (compounding.status === 'fulfilled') {
        compoundingService = compounding.value;
        readinessRegistry.setReady('compoundingService');
      } else {
        readinessRegistry.setError('compoundingService', compounding.reason?.message || 'Initialization failed');
      }
    } catch (error) {
      console.error('❌ Service initialization error:', error);
    }
  } else {
    // FlareClient failed, mark dependent services as unavailable
    readinessRegistry.setError('vaultService', 'FlareClient unavailable');
    readinessRegistry.setError('yieldService', 'FlareClient unavailable');
    readinessRegistry.setError('compoundingService', 'FlareClient unavailable');
  }

  // Step 3: Initialize XRPL Listener and BridgeService (have circular dependencies)
  let xrplListener: XRPLDepositListener | undefined;
  let bridgeService: BridgeService | undefined;

  try {
    // Create XRPL listener without callbacks
    xrplListener = new XRPLDepositListener({
      network: "testnet",
      vaultAddress: "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY",
      storage,
      onDeposit: async (deposit) => {
        console.log(`📥 Direct vault deposit detected: ${deposit.amount} XRP from ${deposit.walletAddress}`);
      },
    });
    
    // Create bridge service
    bridgeService = new BridgeService({
      network: "coston2",
      storage,
      flareClient: demoMode ? undefined : flareClient,
      vaultService: demoMode ? undefined : vaultService,
      operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || "",
      demoMode,
    });

    console.log(`🌉 BridgeService initialized (${bridgeService.demoMode ? 'DEMO MODE' : 'PRODUCTION MODE'})`);

    // Assign to module-level variable so proxy can forward to it
    realBridgeService = bridgeService;

    // Wire up circular dependencies
    bridgeService.setXrplListener(xrplListener);
    
    // Register agent payment handler
    xrplListener.setAgentPaymentHandler(async (payment) => {
      console.log(`🔗 FAssets agent payment detected: ${payment.amount} XRP to ${payment.agentAddress}`);
      console.log(`   TX: ${payment.txHash}`);
      console.log(`   Memo: ${payment.memo || '(none)'}`);
      
      try {
        const bridge = await storage.getBridgeByAgentAddress(payment.agentAddress);
        
        if (!bridge) {
          console.log(`⚠️  No bridge found for agent ${payment.agentAddress}`);
          return;
        }

        const terminalStates = ['completed', 'cancelled', 'failed', 'vault_mint_failed'];
        if (terminalStates.includes(bridge.status)) {
          console.warn(`⚠️  Rejecting payment for bridge in terminal state`, {
            bridgeId: bridge.id,
            status: bridge.status,
            agentAddress: payment.agentAddress,
            txHash: payment.txHash
          });
          return;
        }

        if (bridge.expiresAt && new Date() > bridge.expiresAt) {
          console.warn(`⚠️  Rejecting payment for expired bridge`, {
            bridgeId: bridge.id,
            expiresAt: bridge.expiresAt.toISOString(),
            currentTime: new Date().toISOString(),
            agentAddress: payment.agentAddress,
            txHash: payment.txHash
          });
          
          if (!terminalStates.includes(bridge.status)) {
            await storage.updateBridge(bridge.id, {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'expired'
            });
          }
          
          if (bridge.agentUnderlyingAddress) {
            await xrplListener.removeAgentAddress(bridge.agentUnderlyingAddress);
          }
          
          return;
        }
        
        if (!payment.memo || !bridge.paymentReference) {
          console.log(`⚠️  Payment validation failed: missing memo or payment reference`);
          return;
        }
        
        if (payment.memo !== bridge.paymentReference) {
          console.log(`⚠️  Payment reference mismatch for bridge ${bridge.id}`);
          return;
        }
        
        if (!bridge.reservedValueUBA || !bridge.reservedFeeUBA) {
          console.log(`⚠️  Bridge ${bridge.id} missing reserved amounts`);
          return;
        }
        
        const expectedDrops = BigInt(bridge.reservedValueUBA) + BigInt(bridge.reservedFeeUBA);
        
        let receivedDrops: bigint;
        try {
          const trimmedAmount = payment.amount.trim();
          const parts = trimmedAmount.split('.');
          
          if (parts.length > 2) {
            throw new Error('Multiple decimal points not allowed');
          }
          
          const [rawIntegerPart = '0', fractionalPart = ''] = parts;
          const integerPart = rawIntegerPart || '0';
          
          if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) {
            throw new Error('Invalid number format');
          }
          
          if (fractionalPart.length > 6) {
            throw new Error('Too many decimal places (max 6 for XRP)');
          }
          
          const paddedFractional = fractionalPart.padEnd(6, '0');
          const dropsString = integerPart + paddedFractional;
          receivedDrops = BigInt(dropsString);
          
          if (receivedDrops <= BigInt(0)) {
            throw new Error('Amount must be positive');
          }
        } catch (error) {
          console.log(`⚠️  Invalid payment amount for bridge ${bridge.id}: ${payment.amount}`);
          return;
        }
        
        if (receivedDrops !== expectedDrops) {
          console.log(`❌ Payment amount mismatch for bridge ${bridge.id}`);
          
          await storage.updateBridge(bridge.id, {
            status: 'failed',
            failureCode: 'amount_mismatch',
            receivedAmountDrops: receivedDrops.toString(),
            expectedAmountDrops: expectedDrops.toString(),
            xrplTxHash: payment.txHash,
            xrplConfirmedAt: new Date(),
            errorMessage: `Payment amount mismatch: received ${receivedDrops} drops (${payment.amount} XRP), expected ${expectedDrops} drops`
          });
          
          return;
        }
        
        const canProcess = 
          bridge.status === "awaiting_payment" || 
          (bridge.status === "xrpl_confirmed" && !bridge.fdcProofData);
        
        if (!canProcess) {
          console.log(`⏭️  Bridge ${bridge.id} already processed (status: ${bridge.status}, has proof: ${!!bridge.fdcProofData})`);
          return;
        }
        
        console.log(`✅ Payment validated successfully for bridge ${bridge.id}`);
        
        // Execute FAssets minting with FDC proof
        await bridgeService!.executeMintingWithProof(bridge.id, payment.txHash);
        
        // Complete the mint by tracking FXRP Transfer event and triggering vault minting
        // This fetches the actual minted amount from the Transfer event and creates vault position
        await bridgeService!.completeMint(bridge.id, payment.txHash);
        
        console.log(`🎉 Bridge ${bridge.id} completed successfully!`);
      } catch (error) {
        console.error(`❌ Error completing bridge for agent ${payment.agentAddress}:`, error);
      }
    });
    
    // Register redemption payment handler
    xrplListener.setRedemptionPaymentHandler(async (payment) => {
      await bridgeService!.handleRedemptionPayment(payment);
    });
    
    // Start listener
    await xrplListener.start();
    readinessRegistry.setReady('xrplListener');
    
    // Mark bridge service as ready
    readinessRegistry.setReady('bridgeService');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    readinessRegistry.setError('xrplListener', errorMsg);
    readinessRegistry.setError('bridgeService', errorMsg);
    console.error('❌ XRPL/Bridge initialization failed:', errorMsg);
  }

  // Step 4: Re-register pending bridges (only in production mode)
  if (!demoMode && bridgeService && xrplListener) {
    try {
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

      // Automatic recovery for stuck bridges
      console.log(`🔍 Checking for stuck bridges at xrpl_confirmed without FDC proofs...`);
      const stuckBridges = await storage.getStuckBridges();
      
      if (stuckBridges.length > 0) {
        console.log(`🔧 Found ${stuckBridges.length} stuck bridge(s) - resuming proof generation...`);
        
        for (const bridge of stuckBridges) {
          try {
            console.log(`   🔄 Resuming proof generation for bridge ${bridge.id} (TX: ${bridge.xrplTxHash})`);
            bridgeService.executeMintingWithProof(bridge.id, bridge.xrplTxHash!).catch((error) => {
              console.error(`   ❌ Failed to resume proof generation for bridge ${bridge.id}:`, error);
            });
          } catch (error) {
            console.error(`   ❌ Error initiating recovery for bridge ${bridge.id}:`, error);
          }
        }
      }

      // Automatic reconciliation on startup
      const autoReconcileEnabled = process.env.AUTO_RECONCILE_ON_START !== "false";
      if (autoReconcileEnabled) {
        bridgeService.reconcileRecoverableBridgesOnStartup().catch((error) => {
          console.error(`❌ Startup reconciliation failed:`, error);
        });
        
        const reconcileIntervalMinutes = process.env.AUTO_RECONCILE_INTERVAL_MINUTES 
          ? parseInt(process.env.AUTO_RECONCILE_INTERVAL_MINUTES, 10) 
          : undefined;
        
        if (reconcileIntervalMinutes && reconcileIntervalMinutes > 0) {
          console.log(`⏰ Scheduling periodic reconciliation every ${reconcileIntervalMinutes} minute(s)`);
          let reconciliationInProgress = false;
          
          setInterval(async () => {
            if (reconciliationInProgress) {
              console.warn(`⏭️  [PERIODIC RECONCILIATION] Skipping - previous run still in progress`);
              return;
            }
            
            try {
              reconciliationInProgress = true;
              console.log(`\n⏰ [PERIODIC RECONCILIATION] Starting scheduled reconciliation...`);
              await bridgeService!.reconcileRecoverableBridgesOnStartup();
            } catch (error) {
              console.error(`❌ [PERIODIC RECONCILIATION] Failed:`, error);
            } finally {
              reconciliationInProgress = false;
            }
          }, reconcileIntervalMinutes * 60 * 1000);
        }
      }
    } catch (error) {
      console.error('❌ Bridge recovery failed:', error);
    }
  }

  // Step 5: Initialize deposit service (needs bridgeService)
  if (bridgeService && vaultService && yieldService) {
    try {
      new DepositService({
        storage,
        bridgeService,
        vaultService,
        yieldService,
      });
      readinessRegistry.setReady('depositService');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      readinessRegistry.setError('depositService', errorMsg);
    }
  }

  // Step 6: Initialize Deposit Watchdog Service (production mode only)
  // This service polls for stuck deposits at xrpl_confirmed status and completes them
  if (!demoMode && bridgeService && flareClient) {
    try {
      console.log(`🐕 Initializing DepositWatchdogService...`);
      
      // Get FAssetsClient from BridgeService
      const fassetsClient = (bridgeService as any).fassetsClient;
      
      if (fassetsClient) {
        const watchdog = new DepositWatchdogService({
          storage,
          flareClient,
          fassetsClient,
          bridgeService,
          pollIntervalMs: 60000, // 60 seconds
        });
        
        watchdog.start();
        readinessRegistry.setReady('depositWatchdog');
        console.log(`✅ DepositWatchdogService started`);
      } else {
        const errorMsg = 'FAssetsClient not available - watchdog disabled';
        console.warn(`⚠️  ${errorMsg}`);
        readinessRegistry.setError('depositWatchdog', errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      readinessRegistry.setError('depositWatchdog', errorMsg);
      console.error(`❌ DepositWatchdogService initialization failed:`, errorMsg);
    }
  } else {
    readinessRegistry.setError('depositWatchdog', demoMode ? 'Disabled in demo mode' : 'Required services unavailable');
  }

  // Step 7: Initialize Withdrawal Retry Service (production mode only)
  // This service polls for failed withdrawal confirmations and retries them when balance is sufficient
  if (!demoMode && bridgeService && flareClient) {
    try {
      console.log(`🔄 Initializing WithdrawalRetryService...`);
      
      const retryService = new WithdrawalRetryService({
        storage,
        flareClient,
        bridgeService,
        pollIntervalMs: 60000, // 60 seconds
        minBalanceFLR: "0.1", // Minimum 0.1 FLR required for gas
        maxRetries: 10,
        retryBackoffMs: 60000, // 1 minute base backoff
      });
      
      retryService.start();
      readinessRegistry.setReady('withdrawalRetry');
      console.log(`✅ WithdrawalRetryService started`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      readinessRegistry.setError('withdrawalRetry', errorMsg);
      console.error(`❌ WithdrawalRetryService initialization failed:`, errorMsg);
    }
  } else {
    readinessRegistry.setError('withdrawalRetry', demoMode ? 'Disabled in demo mode' : 'Required services unavailable');
  }

  console.log("✅ All services initialized");
}

/**
 * Initialize FlareClient with exponential backoff retry
 */
async function initializeFlareClientWithRetry(config: {
  network: string;
  privateKey: string;
  bundlerApiKey: string;
  enablePaymaster: boolean;
}, maxRetries = 5): Promise<FlareClient> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Initializing FlareClient (attempt ${attempt}/${maxRetries})...`);
      
      const client = new FlareClient(config as any);
      await client.initialize();
      
      console.log(`✅ FlareClient initialized successfully`);
      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ FlareClient initialization attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        console.log(`⏱️  Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`FlareClient initialization failed after ${maxRetries} attempts: ${lastError?.message}`);
}

(async () => {
  // Step 1: Initialize storage (required, fast)
  await storage.initializeVaults();
  readinessRegistry.setReady('storage');
  console.log("✅ Storage initialized");
  
  // Step 2: Start HTTP server immediately (before service initialization)
  // Create proxies that will forward to real services once initialized
  const bridgeServiceProxy = new Proxy({} as BridgeService, {
    get(target, prop) {
      if (!realBridgeService) {
        // Return safe defaults for properties accessed during route registration
        if (prop === 'demoMode') return true; // Safe default until real service ready
        
        // For method calls, throw clear error
        if (typeof prop === 'string' && prop !== 'constructor') {
          throw new Error(`BridgeService.${prop} called before service initialization - please wait for /readyz to return 200`);
        }
        return undefined;
      }
      const value = (realBridgeService as any)[prop];
      if (typeof value === 'function') {
        return value.bind(realBridgeService);
      }
      return value;
    }
  });
  
  const flareClientProxy = new Proxy({} as FlareClient, {
    get(target, prop) {
      if (!realFlareClient) {
        // Return undefined for optional usage (routes handle gracefully)
        return undefined;
      }
      const value = (realFlareClient as any)[prop];
      if (typeof value === 'function') {
        return value.bind(realFlareClient);
      }
      return value;
    }
  });
  
  const server = await registerRoutes(app, bridgeServiceProxy, flareClientProxy);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite before starting server
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`✅ HTTP server listening on port ${port}`);
  });
  
  // Step 3: Initialize services asynchronously in background
  // This doesn't block the HTTP server from responding to health checks
  initializeServices().catch((error) => {
    console.error("❌ Service initialization error:", error);
    // Don't crash server, services will be marked as failed in readiness registry
  });
})();
