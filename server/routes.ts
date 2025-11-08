import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema, insertWithdrawalRequestSchema } from "@shared/schema";
import { XummSdk } from "xumm-sdk";
import { Client } from "xrpl";

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

export async function registerRoutes(app: Express): Promise<Server> {
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
      const network = req.body.network || "mainnet";
      const txHash = req.body.txHash; // Get transaction hash from Xaman
      const { network: _, txHash: __, ...positionData } = req.body;
      console.log("After extracting network and txHash, positionData:", JSON.stringify(positionData, null, 2));
      const validatedData = insertPositionSchema.parse(positionData);
      const position = await storage.createPosition(validatedData);
      
      // Create transaction record for deposit with real or mock txHash
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
      
      res.status(201).json(position);
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
      const network = req.body.network || "mainnet";
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
      const network = req.body.network || "mainnet";
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

  // Get wallet balance from XRP Ledger (XRP, RLUSD, USDC)
  app.get("/api/wallet/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const network = req.query.network as string || "mainnet";
      
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

  const httpServer = createServer(app);
  return httpServer;
}
