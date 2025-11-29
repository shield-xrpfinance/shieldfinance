import type { Transaction } from "@shared/schema";

export const sampleTransactions: Transaction[] = [
  {
    id: "tx-1",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-1",
    positionId: "position-1",
    type: "deposit",
    amount: "1000",
    rewards: "0",
    status: "completed",
    txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    network: "mainnet",
    createdAt: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "tx-2",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-2",
    positionId: "position-2",
    type: "deposit",
    amount: "500",
    rewards: "0",
    status: "completed",
    txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    network: "mainnet",
    createdAt: new Date("2024-02-20T14:30:00Z"),
  },
  {
    id: "tx-3",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-1",
    positionId: "position-1",
    type: "claim",
    amount: "0",
    rewards: "50",
    status: "completed",
    txHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    network: "mainnet",
    createdAt: new Date("2024-03-01T12:00:00Z"),
  },
  {
    id: "tx-4",
    walletAddress: "rTestWallet2ZYXWVUTSRQPONMLKJIHGFEDCBA",
    vaultId: "vault-1",
    positionId: "position-3",
    type: "deposit",
    amount: "2500",
    rewards: "0",
    status: "completed",
    txHash: "0xcafebabe1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    network: "mainnet",
    createdAt: new Date("2024-03-10T08:15:00Z"),
  },
  {
    id: "tx-5",
    walletAddress: "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    vaultId: "vault-1",
    positionId: "position-1",
    type: "withdrawal",
    amount: "200",
    rewards: "0",
    status: "completed",
    txHash: "0xfeedface1234567890abcdef1234567890abcdef1234567890abcdef12345678",
    network: "mainnet",
    createdAt: new Date("2024-03-15T16:00:00Z"),
  },
  {
    id: "tx-6",
    walletAddress: "rTestWallet3MNOPQRSTUVWXYZABCDEFGHIJK",
    vaultId: "vault-3",
    positionId: "position-4",
    type: "deposit",
    amount: "750",
    rewards: "0",
    status: "pending",
    txHash: null,
    network: "testnet",
    createdAt: new Date("2024-04-05T16:45:00Z"),
  },
];

export const createTestTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: `tx-test-${Date.now()}`,
  walletAddress: "rTestWalletABCDEFGHIJKLMNOPQRSTUVWXYZ",
  vaultId: "vault-1",
  positionId: null,
  type: "deposit",
  amount: "100",
  rewards: "0",
  status: "completed",
  txHash: `0x${Date.now().toString(16).padStart(64, "0")}`,
  network: "mainnet",
  createdAt: new Date(),
  ...overrides,
});

export const transactionsByType = {
  deposits: sampleTransactions.filter((t) => t.type === "deposit"),
  withdrawals: sampleTransactions.filter((t) => t.type === "withdrawal"),
  claims: sampleTransactions.filter((t) => t.type === "claim"),
};

export const transactionsByStatus = {
  completed: sampleTransactions.filter((t) => t.status === "completed"),
  pending: sampleTransactions.filter((t) => t.status === "pending"),
};

export const transactionsByWallet = {
  wallet1: sampleTransactions.filter((t) => t.walletAddress === "rTestWallet1ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  wallet2: sampleTransactions.filter((t) => t.walletAddress === "rTestWallet2ZYXWVUTSRQPONMLKJIHGFEDCBA"),
  wallet3: sampleTransactions.filter((t) => t.walletAddress === "rTestWallet3MNOPQRSTUVWXYZABCDEFGHIJK"),
};

export const testTxHashes = {
  deposit: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  withdrawal: "0xfeedface1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  claim: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
  pending: null,
};
