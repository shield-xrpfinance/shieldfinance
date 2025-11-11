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
    privateKey: process.env.DEPLOYER_PRIVATE_KEY, // Optional: for operator txs
  });

  // Initialize services
  const bridgeService = new BridgeService({
    network: "coston2",
    storage,
    flareClient,
    operatorPrivateKey: process.env.DEPLOYER_PRIVATE_KEY || "",
    demoMode: true, // Enable demo mode for Coston2 testing
  });

  console.log(`🌉 BridgeService initialized (${bridgeService.demoMode ? 'DEMO MODE' : 'PRODUCTION MODE'})`);

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

  const depositService = new DepositService({
    storage,
    bridgeService,
    vaultService,
    yieldService,
  });

  // Start XRPL deposit listener (optional, can be started via API)
  // const xrplListener = new XRPLDepositListener({
  //   network: "testnet",
  //   vaultAddress: "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY",
  //   storage,
  //   onDeposit: async (deposit) => {
  //     await depositService.processDeposit(deposit, "default-vault-id");
  //   },
  // });
  // await xrplListener.start();

  // Start compounding service (runs every hour)
  // compoundingService.start(60);

  log("✅ All services initialized");
  
  const server = await registerRoutes(app);

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
