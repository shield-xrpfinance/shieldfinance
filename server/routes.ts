import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema } from "@shared/schema";
import { XummSdk } from "xumm-sdk";
import { Client } from "xrpl";
import type { BridgeService } from "./services/BridgeService";
import type { FlareClient } from "./utils/flare-client";
import { db } from "./db";
import { fxrpToXrpRedemptions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { readinessRegistry } from "./services/ReadinessRegistry";
import crypto from "crypto";
import { generateFDCProof } from "./utils/fdc-proof";

/**
 * Admin authentication middleware for operational endpoints
 * Requires X-Admin-Key header matching hashed SESSION_SECRET
 */
const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const providedKey = req.headers['x-admin-key'];
  
  if (!providedKey || typeof providedKey !== 'string') {
    return res.status(401).json({ 
      error: "Unauthorized: X-Admin-Key header required" 
    });
  }
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    console.error("SESSION_SECRET not configured");
    return res.status(500).json({ error: "Server configuration error" });
  }
  
  // Use constant-time comparison to prevent timing attacks
  const expectedKey = crypto
    .createHash('sha256')
    .update(sessionSecret)
    .digest('hex');
  
  // Validate hex format and length (SHA-256 produces 64 hex chars)
  if (providedKey.length !== 64 || !/^[0-9a-f]{64}$/i.test(providedKey)) {
    console.warn(`⚠️  Invalid admin key format from ${req.ip}`);
    return res.status(403).json({ error: "Forbidden: Invalid admin key format" });
  }
  
  // Compare provided hex digest directly against expected (no double hashing)
  if (!crypto.timingSafeEqual(
    Buffer.from(expectedKey, 'hex'),
    Buffer.from(providedKey.toLowerCase(), 'hex')
  )) {
    console.warn(`⚠️  Unauthorized admin access attempt from ${req.ip}`);
    return res.status(403).json({ error: "Forbidden: Invalid admin key" });
  }
  
  console.log(`✅ Admin authenticated from ${req.ip}`);  // Log successful access for audit
  
  next();
};

/**
 * Get the latest deployed vault address from deployment files
 */
function getVaultAddress(): string {
  let vaultAddress: string | undefined;
  
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
  
  if (!vaultAddress || vaultAddress === "0x...") {
    vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
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
  bridgeService: BridgeService
): Promise<Server> {
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

  // Get all vaults
  app.get("/api/vaults", async (_req, res) => {
    try {
      const vaults = await storage.getVaults();
      res.json(vaults);
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

  // Create deposit via FAssets bridge
  app.post("/api/deposits", async (req, res) => {
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
      const { destination, amountDrops, memo, network } = req.body;

      if (!destination || !amountDrops || !memo) {
        return res.status(400).json({ error: "Missing required fields: destination, amountDrops, memo" });
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

  // Automated withdrawal flow: shXRP → FXRP → XRP (Async version)
  app.post("/api/withdrawals", async (req, res) => {
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

      // Map redemption status to progress modal step
      let currentStep: "creating" | "processing" | "sending" | "complete" | "error";
      if (redemption.status === "failed") {
        currentStep = "error";
      } else if (redemption.status === "completed") {
        currentStep = "complete";
      } else if (redemption.status === "pending") {
        currentStep = "creating";
      } else if (redemption.status === "xrpl_payout") {
        currentStep = "sending";
      } else {
        // Processing statuses: redeeming_shares, redeemed_fxrp, redeeming_fxrp, awaiting_proof, awaiting_liquidity
        currentStep = "processing";
      }

      res.json({
        success: true,
        redemptionId: redemption.id,
        status: redemption.status,
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
        error: redemption.status === 'failed' ? redemption.errorMessage : undefined,
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

  // Get all transactions
  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions(50);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Get transaction summary
  app.get("/api/transactions/summary", async (_req, res) => {
    try {
      const summary = await storage.getTransactionSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction summary" });
    }
  });

  // Get protocol overview analytics
  app.get("/api/analytics/overview", async (_req, res) => {
    try {
      const overview = await storage.getProtocolOverview();
      res.json(overview);
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
      async function queryEventsInChunks(filter: any, from: number, to: number): Promise<any[]> {
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
      }
      
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

  const httpServer = createServer(app);
  return httpServer;
}
