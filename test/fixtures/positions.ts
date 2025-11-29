import type { Position } from "@shared/schema";

export const samplePositions: Position[] = [
  {
    id: "position-1",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-1",
    amount: "1000",
    rewards: "50",
    status: "active",
    createdAt: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "position-2",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-2",
    amount: "500",
    rewards: "25",
    status: "active",
    createdAt: new Date("2024-02-20T14:30:00Z"),
  },
  {
    id: "position-3",
    walletAddress: "rTestWallet2ZYXWVUTSRQPONMLKJIHGFEDCBA",
    vaultId: "vault-1",
    amount: "2500",
    rewards: "125",
    status: "active",
    createdAt: new Date("2024-03-10T08:15:00Z"),
  },
  {
    id: "position-4",
    walletAddress: "rTestWallet3MNOPQRSTUVWXYZABCDEFGHIJK",
    vaultId: "vault-3",
    amount: "750",
    rewards: "0",
    status: "active",
    createdAt: new Date("2024-04-05T16:45:00Z"),
  },
];

export const createTestPosition = (overrides: Partial<Position> = {}): Position => ({
  id: `position-test-${Date.now()}`,
  walletAddress: "rTestWalletABCDEFGHIJKLMNOPQRSTUVWXYZ",
  vaultId: "vault-1",
  amount: "100",
  rewards: "0",
  status: "active",
  createdAt: new Date(),
  ...overrides,
});

export const positionsByWallet = {
  wallet1: samplePositions.filter((p) => p.walletAddress === "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  wallet2: samplePositions.filter((p) => p.walletAddress === "rTestWallet2ZYXWVUTSRQPONMLKJIHGFEDCBA"),
  wallet3: samplePositions.filter((p) => p.walletAddress === "rTestWallet3MNOPQRSTUVWXYZABCDEFGHIJK"),
};

export const positionsByVault = {
  vault1: samplePositions.filter((p) => p.vaultId === "vault-1"),
  vault2: samplePositions.filter((p) => p.vaultId === "vault-2"),
  vault3: samplePositions.filter((p) => p.vaultId === "vault-3"),
};

export const activePositions = samplePositions.filter((p) => p.status === "active");

export const positionsWithRewards = samplePositions.filter((p) => parseFloat(p.rewards) > 0);

export const testWallets = {
  wallet1: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  wallet2: "rTestWallet2ZYXWVUTSRQPONMLKJIHGFEDCBA",
  wallet3: "rTestWallet3MNOPQRSTUVWXYZABCDEFGHIJK",
  newWallet: "rNewTestWalletABCDEFGHIJKLMNOPQRSTUV",
};
