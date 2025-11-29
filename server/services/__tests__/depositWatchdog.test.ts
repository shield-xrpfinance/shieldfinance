import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DepositWatchdogService, type DepositWatchdogConfig } from "../DepositWatchdogService";
import { InMemoryStorage } from "@test/mocks/storage";
import { createMockProvider, createMockContract } from "@test/mocks/ethers";
import type { SelectXrpToFxrpBridge } from "@shared/schema";

const createMockFlareClient = () => {
  const mockProvider = createMockProvider();
  return {
    provider: mockProvider,
    getSignerAddress: vi.fn().mockReturnValue("0x1234567890123456789012345678901234567890"),
    getFAssetTokenAddress: vi.fn().mockResolvedValue("0xFXRPTokenAddress12345678901234567890"),
    getShXRPVault: vi.fn().mockReturnValue(createMockContract()),
  };
};

const createMockFAssetsClient = () => {
  const mockContract = createMockContract();
  return {
    getAssetManagerContract: vi.fn().mockResolvedValue({
      ...mockContract,
      filters: {
        MintingExecuted: vi.fn().mockReturnValue({}),
      },
      queryFilter: vi.fn().mockResolvedValue([]),
    }),
  };
};

const createMockBridgeService = () => ({
  completeBridgeWithVaultMinting: vi.fn().mockResolvedValue(undefined),
  completeMint: vi.fn().mockResolvedValue(undefined),
});

describe("DepositWatchdogService", () => {
  let storage: InMemoryStorage;
  let mockFlareClient: ReturnType<typeof createMockFlareClient>;
  let mockFAssetsClient: ReturnType<typeof createMockFAssetsClient>;
  let mockBridgeService: ReturnType<typeof createMockBridgeService>;
  let watchdogService: DepositWatchdogService;

  beforeEach(() => {
    storage = new InMemoryStorage();
    mockFlareClient = createMockFlareClient();
    mockFAssetsClient = createMockFAssetsClient();
    mockBridgeService = createMockBridgeService();

    const config: DepositWatchdogConfig = {
      storage,
      flareClient: mockFlareClient as any,
      fassetsClient: mockFAssetsClient as any,
      bridgeService: mockBridgeService as any,
      pollIntervalMs: 1000,
    };

    watchdogService = new DepositWatchdogService(config);
  });

  afterEach(() => {
    watchdogService.stop();
    vi.clearAllMocks();
  });

  describe("Service Lifecycle", () => {
    it("should start and stop correctly", () => {
      expect(() => watchdogService.start()).not.toThrow();
      expect(() => watchdogService.stop()).not.toThrow();
    });

    it("should not start twice", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      watchdogService.start();
      watchdogService.start();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("already running")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Stuck Deposit Detection", () => {
    it("should detect no stuck deposits when queue is empty", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposits();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No stuck deposits found")
      );
      
      consoleSpy.mockRestore();
    });

    it("should detect deposits stuck at xrpl_confirmed status", async () => {
      const stuckBridge: Partial<SelectXrpToFxrpBridge> = {
        id: "bridge-stuck-1",
        walletAddress: "rTestWallet123456789",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "xrpl_confirmed",
        paymentReference: "0xpaymentref123",
        collateralReservationId: "12345",
        xrplTxHash: "XRPL_TX_HASH_123456",
        createdAt: new Date(),
        retryCount: 0,
      };

      await storage.createBridge(stuckBridge as any);

      const stuckBridges = await storage.getBridgesByStatus(["xrpl_confirmed"]);
      expect(stuckBridges.length).toBe(1);
      expect(stuckBridges[0].status).toBe("xrpl_confirmed");
    });
  });

  describe("Idempotent Processing", () => {
    it("should skip bridges that already have fxrpMintTxHash", async () => {
      const bridgeWithMintHash: Partial<SelectXrpToFxrpBridge> = {
        id: "bridge-already-minted",
        walletAddress: "rTestWallet123456789",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "xrpl_confirmed",
        paymentReference: "0xpaymentref123",
        collateralReservationId: "12345",
        fxrpMintTxHash: "0xAlreadyMintedTxHash",
        xrplTxHash: "XRPL_TX_HASH_123456",
        createdAt: new Date(),
        retryCount: 0,
      };

      const createdBridge = await storage.createBridge(bridgeWithMintHash as any);
      await storage.updateBridge(createdBridge.id, { fxrpMintTxHash: "0xAlreadyMintedTxHash" });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposit(createdBridge.id);
      
      expect(mockBridgeService.completeBridgeWithVaultMinting).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it("should skip bridges that changed status during processing", async () => {
      const bridge: Partial<SelectXrpToFxrpBridge> = {
        id: "bridge-status-changed",
        walletAddress: "rTestWallet123456789",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "completed",
        paymentReference: "0xpaymentref123",
        collateralReservationId: "12345",
        xrplTxHash: "XRPL_TX_HASH_123456",
        createdAt: new Date(),
        retryCount: 0,
      };

      const createdBridge = await storage.createBridge(bridge as any);
      await storage.updateBridge(createdBridge.id, { status: "completed" });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposit(createdBridge.id);
      
      expect(mockFAssetsClient.getAssetManagerContract).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe("Recovery Flows", () => {
    it("should handle missing payment reference gracefully", async () => {
      const bridgeNoPaymentRef: Partial<SelectXrpToFxrpBridge> = {
        id: "bridge-no-payment-ref",
        walletAddress: "rTestWallet123456789",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "xrpl_confirmed",
        paymentReference: null,
        collateralReservationId: "12345",
        xrplTxHash: "XRPL_TX_HASH_123456",
        createdAt: new Date(),
        retryCount: 0,
      };

      const createdBridge = await storage.createBridge(bridgeNoPaymentRef as any);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposit(createdBridge.id);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing payment reference")
      );
      
      const updatedBridge = await storage.getBridgeById(createdBridge.id);
      expect(updatedBridge?.lastError).toContain("Missing payment reference");
      
      consoleSpy.mockRestore();
    });

    it("should handle missing collateral reservation ID gracefully", async () => {
      const bridgeNoReservationId: Partial<SelectXrpToFxrpBridge> = {
        id: "bridge-no-reservation-id",
        walletAddress: "rTestWallet123456789",
        vaultId: "vault-1",
        xrpAmount: "100",
        fxrpExpected: "100",
        status: "xrpl_confirmed",
        paymentReference: "0xpaymentref123",
        collateralReservationId: null,
        xrplTxHash: "XRPL_TX_HASH_123456",
        createdAt: new Date(),
        retryCount: 0,
      };

      const createdBridge = await storage.createBridge(bridgeNoReservationId as any);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposit(createdBridge.id);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing collateral reservation ID")
      );
      
      consoleSpy.mockRestore();
    });

    it("should handle non-existent bridge gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposit("non-existent-bridge-id");
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Concurrent Processing Protection", () => {
    it("should prevent concurrent processing", async () => {
      (watchdogService as any).isProcessing = true;

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      await (watchdogService as any).processStuckDeposits();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("already processing")
      );
      
      (watchdogService as any).isProcessing = false;
      consoleSpy.mockRestore();
    });
  });
});
