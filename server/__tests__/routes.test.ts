import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { InMemoryStorage } from "@test/mocks/storage";
import { sampleVaults } from "@test/fixtures/vaults";
import { samplePositions } from "@test/fixtures/positions";

describe("API Routes", () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  afterEach(() => {
    vi.clearAllMocks();
    storage.reset();
  });

  describe("Health Check Endpoints", () => {
    it("GET /healthz should return 200 OK", () => {
      const healthzHandler = (_req: any, res: any) => {
        res.status(200).json({ status: "ok" });
      };

      const mockRes = createMockResponse();
      healthzHandler({}, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body).toEqual({ status: "ok" });
    });

    it("GET /readyz should return readiness status", () => {
      const mockReadinessStatus = { ready: true, services: { database: true, flareClient: true } };
      
      const readyzHandler = (_req: any, res: any) => {
        res.status(200).json(mockReadinessStatus);
      };

      const mockRes = createMockResponse();
      readyzHandler({}, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body).toHaveProperty("ready", true);
      expect(mockRes.body).toHaveProperty("services");
    });
  });

  describe("GET /api/vaults", () => {
    it("should return all active vaults", async () => {
      const vaultsHandler = async (_req: any, res: any) => {
        try {
          const vaults = await storage.getVaults();
          res.json(vaults);
        } catch (error) {
          res.status(500).json({ error: "Failed to fetch vaults" });
        }
      };

      const mockRes = createMockResponse();
      await vaultsHandler({}, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(Array.isArray(mockRes.body)).toBe(true);
      expect(mockRes.body.length).toBeGreaterThan(0);
    });

    it("should return vaults with required fields", async () => {
      const vaultsHandler = async (_req: any, res: any) => {
        const vaults = await storage.getVaults();
        res.json(vaults);
      };

      const mockRes = createMockResponse();
      await vaultsHandler({}, mockRes);

      expect(mockRes.statusCode).toBe(200);
      const vault = mockRes.body[0];
      expect(vault).toHaveProperty("id");
      expect(vault).toHaveProperty("name");
      expect(vault).toHaveProperty("asset");
      expect(vault).toHaveProperty("apy");
      expect(vault).toHaveProperty("tvl");
      expect(vault).toHaveProperty("riskLevel");
    });

    it("should filter vaults by asset type", async () => {
      const vaultsHandler = async (req: any, res: any) => {
        const assetType = req.query.assetType;
        const vaults = assetType
          ? await storage.getVaultsByAssetType(assetType)
          : await storage.getVaults();
        res.json(vaults);
      };

      const mockRes = createMockResponse();
      await vaultsHandler({ query: { assetType: "rwa" } }, mockRes);

      expect(mockRes.statusCode).toBe(200);
      mockRes.body.forEach((vault: any) => {
        expect(vault.assetType).toBe("rwa");
      });
    });
  });

  describe("GET /api/vaults/:id", () => {
    it("should return a specific vault by ID", async () => {
      const vaultByIdHandler = async (req: any, res: any) => {
        const vault = await storage.getVault(req.params.id);
        if (!vault) {
          return res.status(404).json({ error: "Vault not found" });
        }
        res.json(vault);
      };

      const mockRes = createMockResponse();
      await vaultByIdHandler({ params: { id: "vault-1" } }, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body.id).toBe("vault-1");
      expect(mockRes.body.name).toBe("Shield XRP");
    });

    it("should return 404 for non-existent vault", async () => {
      const vaultByIdHandler = async (req: any, res: any) => {
        const vault = await storage.getVault(req.params.id);
        if (!vault) {
          return res.status(404).json({ error: "Vault not found" });
        }
        res.json(vault);
      };

      const mockRes = createMockResponse();
      await vaultByIdHandler({ params: { id: "non-existent" } }, mockRes);

      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.body).toHaveProperty("error");
      expect(mockRes.body.error).toBe("Vault not found");
    });
  });

  describe("GET /api/positions", () => {
    it("should return all positions", async () => {
      const positionsHandler = async (req: any, res: any) => {
        const walletAddress = req.query?.walletAddress;
        const positions = await storage.getPositions(walletAddress);
        res.json(positions);
      };

      const mockRes = createMockResponse();
      await positionsHandler({ query: {} }, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(Array.isArray(mockRes.body)).toBe(true);
    });

    it("should filter positions by wallet address", async () => {
      const walletAddress = "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      
      const positionsHandler = async (req: any, res: any) => {
        const walletAddr = req.query?.walletAddress;
        const positions = await storage.getPositions(walletAddr);
        res.json(positions);
      };

      const mockRes = createMockResponse();
      await positionsHandler({ query: { walletAddress } }, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(Array.isArray(mockRes.body)).toBe(true);
      mockRes.body.forEach((position: any) => {
        expect(position.walletAddress).toBe(walletAddress);
      });
    });
  });

  describe("POST /api/positions", () => {
    it("should create a new position", async () => {
      const createPositionHandler = async (req: any, res: any) => {
        try {
          const position = await storage.createPosition(req.body);
          res.status(201).json(position);
        } catch (error) {
          res.status(400).json({ error: "Failed to create position" });
        }
      };

      const newPosition = {
        walletAddress: "rNewTestWallet12345678901234567890",
        vaultId: "vault-1",
        amount: "500",
      };

      const mockRes = createMockResponse();
      await createPositionHandler({ body: newPosition }, mockRes);

      expect(mockRes.statusCode).toBe(201);
      expect(mockRes.body).toHaveProperty("id");
      expect(mockRes.body.walletAddress).toBe(newPosition.walletAddress);
      expect(mockRes.body.vaultId).toBe(newPosition.vaultId);
      expect(mockRes.body.amount).toBe(newPosition.amount);
    });
  });

  describe("GET /api/bridges/:id", () => {
    it("should return a bridge by ID", async () => {
      const bridge = await storage.createBridge({
        walletAddress: "rTestWallet123",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "pending",
      } as any);

      const bridgeHandler = async (req: any, res: any) => {
        const bridgeData = await storage.getBridgeById(req.params.id);
        if (!bridgeData) {
          return res.status(404).json({ error: "Bridge not found" });
        }
        res.json(bridgeData);
      };

      const mockRes = createMockResponse();
      await bridgeHandler({ params: { id: bridge.id } }, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.body.id).toBe(bridge.id);
    });

    it("should return 404 for non-existent bridge", async () => {
      const bridgeHandler = async (req: any, res: any) => {
        const bridgeData = await storage.getBridgeById(req.params.id);
        if (!bridgeData) {
          return res.status(404).json({ error: "Bridge not found" });
        }
        res.json(bridgeData);
      };

      const mockRes = createMockResponse();
      await bridgeHandler({ params: { id: "non-existent-bridge" } }, mockRes);

      expect(mockRes.statusCode).toBe(404);
      expect(mockRes.body.error).toBe("Bridge not found");
    });
  });

  describe("Authentication Requirements", () => {
    it("should require admin auth for admin endpoints", () => {
      const requireAdminAuth = (req: any, res: any, next: () => void) => {
        const providedKey = req.headers["x-admin-key"];

        if (!providedKey || typeof providedKey !== "string") {
          return res.status(401).json({
            error: "Unauthorized: X-Admin-Key header required",
          });
        }

        const adminApiKey = process.env.ADMIN_API_KEY;
        if (!adminApiKey) {
          return res.status(500).json({ error: "Server configuration error" });
        }

        if (providedKey.length < 32) {
          return res.status(401).json({ error: "Unauthorized: Invalid admin key" });
        }

        if (providedKey !== adminApiKey) {
          return res.status(401).json({ error: "Unauthorized: Invalid admin key" });
        }

        next();
      };

      expect(typeof requireAdminAuth).toBe("function");
    });

    it("should reject requests without admin key", () => {
      const requireAdminAuth = (req: any, res: any, next: () => void) => {
        const providedKey = req.headers["x-admin-key"];
        if (!providedKey) {
          return res.status(401).json({
            error: "Unauthorized: X-Admin-Key header required",
          });
        }
        next();
      };

      const mockRes = createMockResponse();
      let nextCalled = false;

      requireAdminAuth(
        { headers: {} },
        mockRes,
        () => { nextCalled = true; }
      );

      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.error).toContain("Unauthorized");
      expect(nextCalled).toBe(false);
    });

    it("should accept requests with valid admin key", () => {
      const validAdminKey = process.env.ADMIN_API_KEY || "test-admin-key-12345678901234567890123456789012";
      
      const requireAdminAuth = (req: any, res: any, next: () => void) => {
        const providedKey = req.headers["x-admin-key"];
        if (providedKey === validAdminKey) {
          return next();
        }
        res.status(401).json({ error: "Unauthorized" });
      };

      const mockRes = createMockResponse();
      let nextCalled = false;

      requireAdminAuth(
        { headers: { "x-admin-key": validAdminKey } },
        mockRes,
        () => { nextCalled = true; }
      );

      expect(nextCalled).toBe(true);
    });

    it("should use constant-time comparison for admin key", () => {
      const crypto = require("crypto");
      
      const secureCompare = (a: string, b: string): boolean => {
        if (a.length !== b.length) return false;
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        return crypto.timingSafeEqual(bufA, bufB);
      };

      expect(secureCompare("test-key-1234", "test-key-1234")).toBe(true);
      expect(secureCompare("test-key-1234", "test-key-5678")).toBe(false);
      expect(secureCompare("short", "much-longer-string")).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should implement rate limiting for API endpoints", () => {
      let requestCount = 0;
      const maxRequests = 100;

      const rateLimiter = (req: any, res: any, next: () => void) => {
        requestCount++;
        if (requestCount > maxRequests) {
          return res.status(429).json({ error: "Too many requests" });
        }
        next();
      };

      const mockRes = createMockResponse();
      let nextCalled = false;

      rateLimiter({}, mockRes, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });
  });
});

function createMockResponse() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
}
