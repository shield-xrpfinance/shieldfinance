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

  // Get all positions
  app.get("/api/positions", async (_req, res) => {
    try {
      const positions = await storage.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // Create new position (deposit)
  app.post("/api/positions", async (req, res) => {
    try {
      const validatedData = insertPositionSchema.parse(req.body);
      const position = await storage.createPosition(validatedData);
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
      const success = await storage.deletePosition(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Position not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete position" });
    }
  });

  // Claim rewards (update position rewards to 0)
  app.patch("/api/positions/:id/claim", async (req, res) => {
    try {
      const position = await storage.getPosition(req.params.id);
      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }
      
      const claimedRewards = position.rewards;
      
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

  // Get wallet balance from XRP Ledger
  app.get("/api/wallet/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({ error: "Wallet address required" });
      }

      // Connect to XRP Ledger (using public server)
      const client = new Client("wss://xrplcluster.com");
      await client.connect();

      try {
        // Fetch account info
        const accountInfo = await client.request({
          command: "account_info",
          account: address,
          ledger_index: "validated"
        });

        // XRP balance is in drops (1 XRP = 1,000,000 drops)
        const balanceInDrops = accountInfo.result.account_data.Balance;
        const balanceInXRP = Number(balanceInDrops) / 1000000;

        // Fetch current XRP price in USD (simplified - using a fixed conversion for now)
        // In production, you'd call a price API like CoinGecko
        const xrpPriceUSD = 2.45; // Approximate current price
        const balanceInUSD = balanceInXRP * xrpPriceUSD;

        res.json({
          address,
          balanceXRP: balanceInXRP.toFixed(2),
          balanceUSD: balanceInUSD.toFixed(2),
          xrpPriceUSD
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
          balanceXRP: "0.00",
          balanceUSD: "0.00",
          xrpPriceUSD: 2.45,
          error: "Account not found or not activated"
        });
      }
      
      res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
