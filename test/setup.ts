import { vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.VITE_SHXRP_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890";
  process.env.ADMIN_API_KEY = "test-admin-key-12345678901234567890123456789012";
  process.env.SESSION_SECRET = "test-session-secret";
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

vi.mock("xrpl", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue({ result: {} }),
    isConnected: vi.fn().mockReturnValue(true),
  })),
  Wallet: {
    fromSeed: vi.fn().mockReturnValue({
      address: "rTestWalletAddress123456789",
      publicKey: "test-public-key",
      privateKey: "test-private-key",
    }),
  },
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBlockNumber: vi.fn().mockResolvedValue(12345678),
      getTransactionReceipt: vi.fn().mockResolvedValue({
        logs: [],
        status: 1,
        blockNumber: 12345678,
      }),
      waitForTransaction: vi.fn().mockResolvedValue({
        status: 1,
        blockNumber: 12345678,
      }),
    })),
    Contract: vi.fn().mockImplementation(() => ({
      queryFilter: vi.fn().mockResolvedValue([]),
      filters: {
        MintingExecuted: vi.fn().mockReturnValue({}),
        Transfer: vi.fn().mockReturnValue({}),
      },
    })),
    formatUnits: actual.formatUnits,
    parseUnits: actual.parseUnits,
    id: actual.id,
    ZeroAddress: actual.ZeroAddress,
    getAddress: actual.getAddress,
  };
});

export function createTestHelpers() {
  return {
    async waitForCondition(
      condition: () => boolean | Promise<boolean>,
      timeout = 5000,
      interval = 100
    ): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await condition()) return;
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      throw new Error("Condition not met within timeout");
    },

    generateTestId(): string {
      return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    generateTestWallet(): string {
      return `r${Array(33).fill(0).map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("")}`;
    },

    generateTestEvmAddress(): string {
      return `0x${Array(40).fill(0).map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}`;
    },
  };
}

export const testHelpers = createTestHelpers();
