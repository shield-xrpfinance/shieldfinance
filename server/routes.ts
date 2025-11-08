import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPositionSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
