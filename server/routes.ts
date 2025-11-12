import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema, insertWithdrawalRequestSchema, insertEscrowSchema } from "@shared/schema";
import { XummSdk } from "xumm-sdk";
import { Client } from "xrpl";
import { createEscrow, finishEscrow, cancelEscrow } from "./xrpl-escrow";
import type { BridgeService } from "./services/BridgeService";
import type { FlareClient } from "./utils/flare-client";

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

      // Create bridge record
      const bridge = await storage.createBridge({
        vaultId,
        walletAddress,
        xrpAmount: amount,
        fxrpExpected: amount, // 1:1 for now
        status: 'pending',
      });

      // Reserve collateral and get agent address (fast, no delays)
      await bridgeService.reserveCollateralQuick(bridge.id);

      // Get updated bridge with agent address
      const updatedBridge = await storage.getBridgeById(bridge.id);
      if (!updatedBridge) {
        throw new Error("Bridge not found after collateral reservation");
      }

      // Build payment request
      const paymentRequest = bridgeService.buildPaymentRequest(updatedBridge);

      // For demo mode, continue with rest of bridge simulation in background
      if (bridgeService.demoMode) {
        bridgeService.initiateBridge(bridge.id).catch(async (error) => {
          console.error("Background bridge simulation error:", error);
        });
      }

      // Return bridge info with payment request
      res.json({
        success: true,
        bridgeId: bridge.id,
        amount: bridge.xrpAmount,
        status: updatedBridge.status,
        paymentRequest,
        message: "Bridge initiated. Please send payment to complete the bridge.",
        demo: bridgeService.demoMode,
      });
    } catch (error) {
      console.error("Deposit error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create deposit" });
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
      
      // 3. Check if this is an XRP vault (only create escrows for XRP deposits)
      const vaultAssets = vault.asset.split(",").map(a => a.trim());
      const isXRPVault = vaultAssets.includes("XRP");
      
      if (isXRPVault) {
        // XRP Vault: Create escrow to lock funds
        // 3a. Create transaction record with "initiated" status
        const transaction = await storage.createTransaction({
          vaultId: position.vaultId,
          positionId: position.id,
          type: "deposit",
          amount: position.amount,
          rewards: "0",
          status: "initiated",
          txHash: txHash || `deposit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          network: network,
        });
        
        try {
          // 4. Create escrow using vault credentials
          const vaultSecret = "sEd7kzvj3erqU5675pPkk5o4LwXVNGW";
          const vaultAddress = "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY";
          
          // Use 6-decimal precision for XRP amounts
          const escrowAmount = depositAmount.toFixed(6);
          
          const escrowResult = await createEscrow({
            sourceAddress: vaultAddress,
            sourceSecret: vaultSecret,
            destinationAddress: validatedData.walletAddress,
            amount: escrowAmount,
            network: network,
            finishAfterSeconds: 60, // Can finish after 1 minute
            cancelAfterSeconds: 86400, // Can cancel after 24 hours
          });
          
          if (!escrowResult.success) {
            // Create failed escrow record for tracking
            await storage.createEscrow({
              positionId: position.id,
              vaultId: position.vaultId,
              walletAddress: validatedData.walletAddress,
              destinationAddress: validatedData.walletAddress,
              amount: escrowAmount,
              asset: "XRP",
              status: "failed",
              network: network,
              createTxHash: null,
              escrowSequence: null,
              finishAfter: null,
              cancelAfter: null,
              finishTxHash: null,
              cancelTxHash: null,
              condition: null,
              fulfillment: null,
              finishedAt: null,
              cancelledAt: null,
            });
            
            // Rollback: Update transaction status to failed
            await storage.createTransaction({
              vaultId: position.vaultId,
              positionId: position.id,
              type: "deposit",
              amount: position.amount,
              rewards: "0",
              status: "failed",
              txHash: txHash || `deposit-failed-${Date.now()}`,
              network: network,
            });
            
            console.error(`❌ Escrow creation failed for position ${position.id}: ${escrowResult.error}`);
            
            return res.status(400).json({ 
              error: "Failed to create XRPL escrow. Please ensure the vault has sufficient funds and try again.",
              details: escrowResult.error,
              positionId: position.id
            });
          }
          
          // 5. Store escrow record with status "pending"
          const escrow = await storage.createEscrow({
            positionId: position.id,
            vaultId: position.vaultId,
            walletAddress: validatedData.walletAddress,
            destinationAddress: validatedData.walletAddress,
            amount: escrowAmount,
            asset: "XRP",
            status: "pending",
            network: network,
            createTxHash: escrowResult.txHash,
            escrowSequence: escrowResult.escrowSequence,
            finishAfter: new Date(Date.now() + 60000), // 1 minute from now
            cancelAfter: new Date(Date.now() + 86400000), // 24 hours from now
            finishTxHash: null,
            cancelTxHash: null,
            condition: null,
            fulfillment: null,
            finishedAt: null,
            cancelledAt: null,
          });
          
          // 6. Update transaction to "pending_settlement"
          await storage.createTransaction({
            vaultId: position.vaultId,
            positionId: position.id,
            type: "deposit",
            amount: position.amount,
            rewards: "0",
            status: "pending_settlement",
            txHash: escrowResult.txHash || txHash,
            network: network,
          });
          
          console.log(`✅ XRP deposit with escrow created successfully. Position: ${position.id}, Escrow: ${escrow.id}`);
          
          res.status(201).json({ 
            position, 
            escrow,
            message: "XRP deposit successful. Funds are held in escrow and can be withdrawn after the lock period."
          });
        } catch (escrowError) {
          console.error("Escrow creation exception during XRP deposit:", escrowError);
          
          // Create failed escrow record for tracking
          try {
            await storage.createEscrow({
              positionId: position.id,
              vaultId: position.vaultId,
              walletAddress: validatedData.walletAddress,
              destinationAddress: validatedData.walletAddress,
              amount: validatedData.amount,
              asset: "XRP",
              status: "failed",
              network: network,
              createTxHash: null,
              escrowSequence: null,
              finishAfter: null,
              cancelAfter: null,
              finishTxHash: null,
              cancelTxHash: null,
              condition: null,
              fulfillment: null,
              finishedAt: null,
              cancelledAt: null,
            });
          } catch (dbError) {
            console.error("Failed to create failed escrow record:", dbError);
          }
          
          // Rollback: Mark transaction as failed
          await storage.createTransaction({
            vaultId: position.vaultId,
            positionId: position.id,
            type: "deposit",
            amount: position.amount,
            rewards: "0",
            status: "failed",
            txHash: txHash || `deposit-failed-${Date.now()}`,
            network: network,
          });
          
          throw escrowError;
        }
      } else {
        // Non-XRP Vault (RLUSD/USDC): No escrow needed, mark as completed
        console.log(`💰 Non-XRP deposit (${vault.asset}) - skipping escrow creation`);
        
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
      }
    } catch (error) {
      console.error("Deposit error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create position" });
      }
    }
  });

  // Withdraw position (changed from DELETE to POST to accept transaction hash in body)
  app.post("/api/positions/:id/withdraw", async (req, res) => {
    try {
      const network = req.body.network || "testnet"; // Default to testnet for Coston2
      const txHash = req.body.txHash; // Get transaction hash from Xaman
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      
      // Save position data before deletion
      const positionData = {
        vaultId: position.vaultId,
        positionId: position.id,
        amount: position.amount,
        rewards: position.rewards,
      };
      
      // Delete position FIRST to avoid FK constraint violation
      const success = await storage.deletePosition(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Position not found" });
      }
      
      // THEN create transaction record for withdrawal (position_id is nullable) with real or mock txHash
      await storage.createTransaction({
        vaultId: positionData.vaultId,
        positionId: null,
        type: "withdraw",
        amount: positionData.amount,
        rewards: positionData.rewards,
        status: "completed",
        txHash: txHash || `withdraw-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("POST /api/positions/:id/withdraw error:", error);
      if (error instanceof Error) {
        res.status(500).json({ error: `Failed to withdraw position: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to withdraw position" });
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
        demo: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get payload status" });
    }
  });

  // Create Xaman payment request for bridge deposit
  app.post("/api/wallet/xaman/payment", async (req, res) => {
    try {
      const { destination, amount, memo, network } = req.body;

      if (!destination || !amount || !memo) {
        return res.status(400).json({ error: "Missing required fields: destination, amount, memo" });
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
        Amount: amount,
        Memos: [
          {
            Memo: {
              MemoData: Buffer.from(memo).toString("hex").toUpperCase(),
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

  // Create withdrawal request (vault operator approval required)
  app.post("/api/withdrawal-requests", async (req, res) => {
    try {
      const { amount, asset, userAddress, network, positionId, vaultId } = req.body;
      
      if (!amount || !asset || !userAddress || !vaultId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const request = await storage.createWithdrawalRequest({
        walletAddress: userAddress,
        positionId: positionId || null,
        vaultId: vaultId,
        type: "withdrawal",
        amount: amount,
        asset: asset,
        status: "pending",
        network: network || "mainnet",
        processedAt: null,
        txHash: null,
        rejectionReason: null,
      });

      res.json({
        success: true,
        requestId: request.id,
        message: "Withdrawal request submitted. A vault operator will review and approve your request.",
      });
    } catch (error) {
      console.error("Withdrawal request creation error:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });

  // Create claim request (vault operator approval required)
  app.post("/api/claim-requests", async (req, res) => {
    try {
      const { amount, asset, userAddress, network, positionId, vaultId } = req.body;
      
      if (!amount || !asset || !userAddress || !positionId || !vaultId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const request = await storage.createWithdrawalRequest({
        walletAddress: userAddress,
        positionId: positionId,
        vaultId: vaultId,
        type: "claim",
        amount: amount,
        asset: asset,
        status: "pending",
        network: network || "mainnet",
        processedAt: null,
        txHash: null,
        rejectionReason: null,
      });

      res.json({
        success: true,
        requestId: request.id,
        message: "Claim request submitted. A vault operator will review and approve your request.",
      });
    } catch (error) {
      console.error("Claim request creation error:", error);
      res.status(500).json({ error: "Failed to create claim request" });
    }
  });

  // Get all withdrawal requests (admin)
  app.get("/api/withdrawal-requests", async (req, res) => {
    try {
      const { status, walletAddress } = req.query;
      const requests = await storage.getWithdrawalRequests(status as string, walletAddress as string);
      res.json(requests);
    } catch (error) {
      console.error("Get withdrawal requests error:", error);
      res.status(500).json({ error: "Failed to get withdrawal requests" });
    }
  });

  // Approve withdrawal request (admin)
  app.patch("/api/withdrawal-requests/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const { txHash } = req.body;

      if (!txHash) {
        return res.status(400).json({ error: "Transaction hash is required" });
      }

      const request = await storage.getWithdrawalRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Withdrawal request not found" });
      }

      // 1. Find escrow associated with this withdrawal's position (only for XRP withdrawals)
      let escrow = null;
      const isXRPWithdrawal = request.asset === "XRP";
      
      if (isXRPWithdrawal && request.positionId) {
        const escrows = await storage.getEscrows(undefined, "pending");
        escrow = escrows.find(e => 
          e.positionId === request.positionId && 
          e.status === "pending" &&
          e.asset === "XRP"
        );
        
        if (!escrow) {
          console.log(`⚠️ No pending XRP escrow found for withdrawal ${id} (position: ${request.positionId}). This might be an old deposit or non-escrow withdrawal.`);
        }
      }

      // 2. If escrow exists for XRP withdrawal, finish it
      if (escrow && escrow.escrowSequence) {
        try {
          const vaultSecret = "sEd7kzvj3erqU5675pPkk5o4LwXVNGW";
          const vaultAddress = "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY";

          // Call finishEscrow() using vault wallet
          const finishResult = await finishEscrow({
            accountAddress: vaultAddress,
            accountSecret: vaultSecret,
            escrowOwner: vaultAddress,
            escrowSequence: escrow.escrowSequence,
            network: escrow.network,
            condition: escrow.condition || undefined,
            fulfillment: escrow.fulfillment || undefined,
          });

          if (finishResult.success) {
            // Update escrow to status: "finished"
            await storage.updateEscrow(escrow.id, {
              status: "finished",
              finishTxHash: finishResult.txHash,
              finishedAt: new Date(),
            });
            console.log(`✅ Escrow ${escrow.id} finished successfully for withdrawal ${id}`);
          } else {
            // Escrow finishing failed - update withdrawal request to failed status
            const errorMessage = `Failed to release escrow: ${finishResult.error}`;
            console.error(`❌ Failed to finish escrow ${escrow.id}:`, finishResult.error);
            
            await storage.updateWithdrawalRequest(id, {
              status: "failed",
              processedAt: new Date(),
              rejectionReason: errorMessage,
            } as any);
            
            return res.status(400).json({ 
              error: errorMessage,
              escrowId: escrow.id
            });
          }
        } catch (escrowError) {
          // Escrow finishing error - update withdrawal request to failed status
          const errorMessage = `Error finishing escrow: ${escrowError instanceof Error ? escrowError.message : 'Unknown error'}`;
          console.error("Error finishing escrow during withdrawal approval:", escrowError);
          
          await storage.updateWithdrawalRequest(id, {
            status: "failed",
            processedAt: new Date(),
            rejectionReason: errorMessage,
          } as any);
          
          return res.status(500).json({ 
            error: errorMessage,
            escrowId: escrow?.id
          });
        }
      }

      // 3. Create withdrawal transaction (status: "completed")
      await storage.createTransaction({
        vaultId: request.vaultId,
        positionId: request.positionId || null,
        type: "withdraw",
        amount: request.amount,
        rewards: "0",
        status: "completed",
        txHash: txHash,
        network: request.network,
      });

      // 4. Mark withdrawal request status: "approved" (settled)
      const updatedRequest = await storage.updateWithdrawalRequest(id, {
        status: "approved",
        processedAt: new Date(),
        txHash: txHash,
      } as any);

      res.json({ 
        success: true, 
        request: updatedRequest,
        escrowFinished: !!escrow,
        message: escrow 
          ? "Withdrawal approved and escrow released successfully"
          : "Withdrawal approved successfully"
      });
    } catch (error) {
      console.error("Approve withdrawal request error:", error);
      res.status(500).json({ error: "Failed to approve withdrawal request" });
    }
  });

  // Reject withdrawal request (admin)
  app.patch("/api/withdrawal-requests/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const updatedRequest = await storage.updateWithdrawalRequest(id, {
        status: "rejected",
        processedAt: new Date(),
        rejectionReason: reason,
      } as any);

      res.json({ success: true, request: updatedRequest });
    } catch (error) {
      console.error("Reject withdrawal request error:", error);
      res.status(500).json({ error: "Failed to reject withdrawal request" });
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

  // ============= ESCROW ENDPOINTS =============

  // Get all escrows with optional filters
  app.get("/api/escrows", async (req, res) => {
    try {
      const { walletAddress, status, vaultId } = req.query;
      
      let escrows = await storage.getEscrows(
        walletAddress as string | undefined,
        status as string | undefined
      );

      // Additional filter by vaultId if provided
      if (vaultId) {
        escrows = escrows.filter(e => e.vaultId === vaultId);
      }

      res.json(escrows);
    } catch (error) {
      console.error("Get escrows error:", error);
      res.status(500).json({ error: "Failed to fetch escrows" });
    }
  });

  // Get single escrow by ID
  app.get("/api/escrows/:id", async (req, res) => {
    try {
      const escrow = await storage.getEscrow(req.params.id);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }
      res.json(escrow);
    } catch (error) {
      console.error("Get escrow error:", error);
      res.status(500).json({ error: "Failed to fetch escrow" });
    }
  });

  // Create escrow (for manual testing)
  app.post("/api/escrows", async (req, res) => {
    try {
      const validatedData = insertEscrowSchema.parse(req.body);
      
      // Use vault credentials for escrow creation
      const vaultSecret = "sEd7kzvj3erqU5675pPkk5o4LwXVNGW";
      const vaultAddress = "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY";
      const network = validatedData.network || "testnet";

      // Create escrow on XRPL
      const result = await createEscrow({
        sourceAddress: vaultAddress,
        sourceSecret: vaultSecret,
        destinationAddress: validatedData.destinationAddress,
        amount: validatedData.amount,
        network: network,
        finishAfterSeconds: 60, // Can finish after 1 minute
        cancelAfterSeconds: 86400, // Can cancel after 24 hours
        condition: validatedData.condition || undefined,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to create escrow on XRPL" });
      }

      // Store escrow in database
      const escrow = await storage.createEscrow({
        ...validatedData,
        createTxHash: result.txHash,
        escrowSequence: result.escrowSequence,
        status: "pending",
        finishAfter: new Date(Date.now() + 60000), // 1 minute from now
        cancelAfter: new Date(Date.now() + 86400000), // 24 hours from now
      });

      res.status(201).json(escrow);
    } catch (error) {
      console.error("Create escrow error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create escrow" });
      }
    }
  });

  // Finish escrow and release XRP
  app.post("/api/escrows/:id/finish", async (req, res) => {
    try {
      const escrow = await storage.getEscrow(req.params.id);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }

      if (escrow.status === "finished") {
        return res.status(400).json({ error: "Escrow already finished" });
      }

      if (escrow.status === "cancelled") {
        return res.status(400).json({ error: "Escrow already cancelled" });
      }

      if (!escrow.escrowSequence) {
        return res.status(400).json({ error: "Escrow sequence not found" });
      }

      // Use vault credentials to finish escrow
      const vaultSecret = "sEd7kzvj3erqU5675pPkk5o4LwXVNGW";
      const vaultAddress = "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY";

      // Finish escrow on XRPL
      // Note: Anyone can finish an escrow after FinishAfter time (if no Condition)
      // We use the vault account to finish since it has the credentials
      const result = await finishEscrow({
        accountAddress: vaultAddress, // Vault finishes the escrow
        accountSecret: vaultSecret,
        escrowOwner: vaultAddress, // Vault is the owner
        escrowSequence: escrow.escrowSequence,
        network: escrow.network,
        condition: escrow.condition || undefined,
        fulfillment: escrow.fulfillment || undefined,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to finish escrow on XRPL" });
      }

      // Update escrow status
      const updatedEscrow = await storage.updateEscrow(req.params.id, {
        status: "finished",
        finishTxHash: result.txHash,
        finishedAt: new Date(),
      });

      res.json({ success: true, escrow: updatedEscrow });
    } catch (error) {
      console.error("Finish escrow error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to finish escrow" });
      }
    }
  });

  // Cancel escrow and return XRP
  app.post("/api/escrows/:id/cancel", async (req, res) => {
    try {
      const escrow = await storage.getEscrow(req.params.id);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }

      if (escrow.status === "finished") {
        return res.status(400).json({ error: "Cannot cancel finished escrow" });
      }

      if (escrow.status === "cancelled") {
        return res.status(400).json({ error: "Escrow already cancelled" });
      }

      if (!escrow.escrowSequence) {
        return res.status(400).json({ error: "Escrow sequence not found" });
      }

      // Use vault credentials to cancel escrow
      const vaultSecret = "sEd7kzvj3erqU5675pPkk5o4LwXVNGW";
      const vaultAddress = "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY";

      // Cancel escrow on XRPL
      const result = await cancelEscrow({
        accountAddress: vaultAddress, // Owner can cancel
        accountSecret: vaultSecret,
        escrowOwner: vaultAddress,
        escrowSequence: escrow.escrowSequence,
        network: escrow.network,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to cancel escrow on XRPL" });
      }

      // Update escrow status
      const updatedEscrow = await storage.updateEscrow(req.params.id, {
        status: "cancelled",
        cancelTxHash: result.txHash,
        cancelledAt: new Date(),
      });

      res.json({ success: true, escrow: updatedEscrow });
    } catch (error) {
      console.error("Cancel escrow error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to cancel escrow" });
      }
    }
  });

  // Retry failed escrow operation
  app.post("/api/escrows/:id/retry", async (req, res) => {
    try {
      const escrow = await storage.getEscrow(req.params.id);
      if (!escrow) {
        return res.status(404).json({ error: "Escrow not found" });
      }

      if (escrow.status !== "failed") {
        return res.status(400).json({ error: "Can only retry failed escrows" });
      }

      // Reset status to pending for retry
      const updatedEscrow = await storage.updateEscrow(req.params.id, {
        status: "pending",
      });

      res.json({ success: true, escrow: updatedEscrow, message: "Escrow status reset to pending. You can now finish or cancel it." });
    } catch (error) {
      console.error("Retry escrow error:", error);
      res.status(500).json({ error: "Failed to retry escrow" });
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

  // Manual bridge trigger (for testing)
  app.post("/api/bridges/process", async (req, res) => {
    try {
      const { walletAddress, vaultId, xrpAmount, xrplTxHash } = req.body;
      
      // Create bridge request
      const requestId = `bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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

  const httpServer = createServer(app);
  return httpServer;
}
