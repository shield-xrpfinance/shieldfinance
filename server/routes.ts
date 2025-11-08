import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema } from "@shared/schema";
import { XummSdk } from "xumm-sdk";
import { Client } from "xrpl";

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
      const validatedData = insertPositionSchema.parse(req.body);
      const network = req.body.network || "mainnet";
      const position = await storage.createPosition(validatedData);
      
      // Create transaction record for deposit
      await storage.createTransaction({
        vaultId: position.vaultId,
        positionId: position.id,
        type: "deposit",
        amount: position.amount,
        rewards: "0",
        status: "completed",
        txHash: `deposit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network,
      });
      
      res.status(201).json(position);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create position" });
      }
    }
  });

  // Delete position (withdraw)
  app.delete("/api/positions/:id", async (req, res) => {
    try {
      const network = req.query.network as string || "mainnet";
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
      
      // THEN create transaction record for withdrawal (position_id is nullable)
      await storage.createTransaction({
        vaultId: positionData.vaultId,
        positionId: null,
        type: "withdraw",
        amount: positionData.amount,
        rewards: positionData.rewards,
        status: "completed",
        txHash: `withdraw-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        network: network,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("DELETE /api/positions/:id error:", error);
      if (error instanceof Error) {
        res.status(500).json({ error: `Failed to delete position: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to delete position" });
      }
    }
  });

  // Claim rewards (update position rewards to 0)
  app.patch("/api/positions/:id/claim", async (req, res) => {
    try {
      const network = req.body.network || "mainnet";
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      
      const claimedRewards = position.rewards;
      
      // Create transaction record for claim
      await storage.createTransaction({
        vaultId: position.vaultId,
        positionId: position.id,
        type: "claim",
        amount: "0",
        rewards: claimedRewards,
        status: "completed",
        txHash: `claim-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

      if (!apiKey || !apiSecret) {
        // Return demo payload
        return res.json({ 
          uuid: "demo-payload-uuid",
          qrUrl: "demo",
          deepLink: "",
          demo: true
        });
      }

      const xumm = new XummSdk(apiKey, apiSecret);
      
      const payload = await xumm.payload?.create({
        TransactionType: "SignIn",
      });

      if (!payload) {
        throw new Error("Failed to create Xaman payload");
      }

      res.json({
        uuid: payload.uuid,
        qrUrl: payload.refs?.qr_png,
        deepLink: payload.next?.always,
        demo: false
      });
    } catch (error) {
      console.error("Xaman payload creation error:", error);
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
        signed: payload.response?.signed,
        account: payload.response?.account,
        meta_opened: payload.meta?.opened,
        meta_resolved: payload.meta?.resolved,
        meta_signed: payload.meta?.signed,
        meta_cancelled: payload.meta?.cancelled
      });

      // Xumm SDK stores signed status in meta.signed, not response.signed
      const signed = payload.meta?.signed || false;
      const account = payload.response?.account || null;

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
