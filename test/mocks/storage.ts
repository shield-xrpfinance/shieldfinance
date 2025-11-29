import { vi } from "vitest";
import type { IStorage } from "../../server/storage";
import type {
  Vault,
  InsertVault,
  Position,
  InsertPosition,
  Transaction,
  InsertTransaction,
  SelectXrpToFxrpBridge,
  InsertXrpToFxrpBridge,
  SelectFxrpToXrpRedemption,
  InsertFxrpToXrpRedemption,
  ServiceState,
} from "@shared/schema";
import { sampleVaults } from "../fixtures/vaults";
import { samplePositions } from "../fixtures/positions";
import { sampleTransactions } from "../fixtures/transactions";

export class InMemoryStorage implements IStorage {
  private vaults: Map<string, Vault> = new Map();
  private positions: Map<string, Position> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private bridges: Map<string, SelectXrpToFxrpBridge> = new Map();
  private redemptions: Map<string, SelectFxrpToXrpRedemption> = new Map();
  private serviceState: Map<string, ServiceState> = new Map();

  constructor() {
    this.initializeWithSampleData();
  }

  private initializeWithSampleData(): void {
    sampleVaults.forEach((vault) => {
      this.vaults.set(vault.id, vault as Vault);
    });
    samplePositions.forEach((position) => {
      this.positions.set(position.id, position as Position);
    });
    sampleTransactions.forEach((tx) => {
      this.transactions.set(tx.id, tx as Transaction);
    });
  }

  reset(): void {
    this.vaults.clear();
    this.positions.clear();
    this.transactions.clear();
    this.bridges.clear();
    this.redemptions.clear();
    this.serviceState.clear();
    this.initializeWithSampleData();
  }

  async getVaults(): Promise<Vault[]> {
    return Array.from(this.vaults.values()).filter(v => !v.comingSoon);
  }

  async getVaultsByAssetType(assetType: 'crypto' | 'rwa' | 'tokenized_security'): Promise<Vault[]> {
    return Array.from(this.vaults.values()).filter(v => v.assetType === assetType);
  }

  async getAllVaults(): Promise<Vault[]> {
    return Array.from(this.vaults.values());
  }

  async getVault(id: string): Promise<Vault | undefined> {
    return this.vaults.get(id);
  }

  async createVault(vault: InsertVault): Promise<Vault> {
    const newVault: Vault = {
      ...vault,
      id: `vault-${Date.now()}`,
      status: vault.status || "active",
      comingSoon: vault.comingSoon || false,
      assetType: vault.assetType || "crypto",
      kycRequired: vault.kycRequired || false,
      accreditationRequired: vault.accreditationRequired || false,
      jurisdiction: vault.jurisdiction || null,
      underlyingInstrument: vault.underlyingInstrument || null,
      currencyDenomination: vault.currencyDenomination || null,
      prospectusUrl: vault.prospectusUrl || null,
      riskDisclosure: vault.riskDisclosure || null,
      custodian: vault.custodian || null,
      valuationFrequency: vault.valuationFrequency || null,
      minInvestmentUsd: vault.minInvestmentUsd || null,
      apyLabel: vault.apyLabel || null,
    };
    this.vaults.set(newVault.id, newVault);
    return newVault;
  }

  async getPositions(walletAddress?: string): Promise<Position[]> {
    const all = Array.from(this.positions.values());
    if (walletAddress) {
      return all.filter((p) => p.walletAddress === walletAddress);
    }
    return all;
  }

  async getPosition(id: string): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async getPositionByWalletAndVault(walletAddress: string, vaultId: string): Promise<Position | undefined> {
    return Array.from(this.positions.values()).find(
      (p) => p.walletAddress === walletAddress && p.vaultId === vaultId
    );
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const newPosition: Position = {
      ...position,
      id: `position-${Date.now()}`,
      rewards: position.rewards || "0",
      status: position.status || "active",
      createdAt: new Date(),
    };
    this.positions.set(newPosition.id, newPosition);
    return newPosition;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
    const existing = this.positions.get(id);
    if (!existing) throw new Error(`Position ${id} not found`);
    const updated = { ...existing, ...updates };
    this.positions.set(id, updated);
    return updated;
  }

  async deletePosition(id: string): Promise<boolean> {
    return this.positions.delete(id);
  }

  async getTransactions(limit?: number, walletAddress?: string): Promise<Transaction[]> {
    let all = Array.from(this.transactions.values());
    if (walletAddress) {
      all = all.filter((t) => t.walletAddress === walletAddress);
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (limit) {
      return all.slice(0, limit);
    }
    return all;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionByTxHash(txHash: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values()).find((t) => t.txHash === txHash);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const newTx: Transaction = {
      ...transaction,
      id: `tx-${Date.now()}`,
      rewards: transaction.rewards || "0",
      status: transaction.status || "completed",
      network: transaction.network || "mainnet",
      createdAt: new Date(),
    };
    this.transactions.set(newTx.id, newTx);
    return newTx;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const existing = this.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found`);
    const updated = { ...existing, ...updates };
    this.transactions.set(id, updated);
    return updated;
  }

  async getTransactionSummary(_walletAddress?: string): Promise<{
    totalDeposits: string;
    totalWithdrawals: string;
    totalRewards: string;
    depositCount: number;
    withdrawalCount: number;
    claimCount: number;
  }> {
    return {
      totalDeposits: "10000",
      totalWithdrawals: "5000",
      totalRewards: "500",
      depositCount: 5,
      withdrawalCount: 2,
      claimCount: 1,
    };
  }

  async createBridge(bridge: InsertXrpToFxrpBridge): Promise<SelectXrpToFxrpBridge> {
    const newBridge: SelectXrpToFxrpBridge = {
      ...bridge,
      id: `bridge-${Date.now()}`,
      status: bridge.status || "pending",
      createdAt: new Date(),
      retryCount: 0,
    } as SelectXrpToFxrpBridge;
    this.bridges.set(newBridge.id, newBridge);
    return newBridge;
  }

  async getBridgeById(id: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return this.bridges.get(id);
  }

  async getBridgeByRequestId(requestId: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return Array.from(this.bridges.values()).find((b) => b.requestId === requestId);
  }

  async getBridgesByWallet(walletAddress: string): Promise<SelectXrpToFxrpBridge[]> {
    return Array.from(this.bridges.values()).filter((b) => b.walletAddress === walletAddress);
  }

  async getBridgeByAgentAddress(agentAddress: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return Array.from(this.bridges.values()).find((b) => b.agentVaultAddress === agentAddress);
  }

  async getBridgesByStatus(statuses: string[]): Promise<SelectXrpToFxrpBridge[]> {
    return Array.from(this.bridges.values()).filter((b) => statuses.includes(b.status));
  }

  async getPendingBridges(): Promise<SelectXrpToFxrpBridge[]> {
    return this.getBridgesByStatus(["pending", "bridging", "awaiting_payment"]);
  }

  async getStuckBridges(): Promise<SelectXrpToFxrpBridge[]> {
    return this.getBridgesByStatus(["xrpl_confirmed"]);
  }

  async getStuckBridgesForMetrics(_minutesThreshold?: number): Promise<SelectXrpToFxrpBridge[]> {
    return this.getStuckBridges();
  }

  async getRecoverableBridges(): Promise<SelectXrpToFxrpBridge[]> {
    return this.getBridgesByStatus(["xrpl_confirmed", "fdc_timeout"]);
  }

  async updateBridge(id: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void> {
    const existing = this.bridges.get(id);
    if (existing) {
      this.bridges.set(id, { ...existing, ...updates });
    }
  }

  async updateBridgeStatus(id: string, status: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void> {
    await this.updateBridge(id, { ...updates, status: status as any });
  }

  async getServiceState(key: string): Promise<ServiceState | undefined> {
    return this.serviceState.get(key);
  }

  async setServiceState(key: string, value: string): Promise<void> {
    this.serviceState.set(key, { key, value, updatedAt: new Date() });
  }

  async getWithdrawalRequests(): Promise<any[]> { return []; }
  async getWithdrawalRequest(): Promise<any> { return undefined; }
  async createWithdrawalRequest(): Promise<any> { return {}; }
  async updateWithdrawalRequest(): Promise<any> { return {}; }
  async getEscrows(): Promise<any[]> { return []; }
  async getEscrow(): Promise<any> { return undefined; }
  async createEscrow(): Promise<any> { return {}; }
  async updateEscrow(): Promise<any> { return {}; }
  async createRedemption(redemption: InsertFxrpToXrpRedemption): Promise<SelectFxrpToXrpRedemption> {
    const newRedemption = { ...redemption, id: `redemption-${Date.now()}`, createdAt: new Date(), retryCount: 0 } as SelectFxrpToXrpRedemption;
    this.redemptions.set(newRedemption.id, newRedemption);
    return newRedemption;
  }
  async getRedemptionById(id: string): Promise<SelectFxrpToXrpRedemption | undefined> {
    return this.redemptions.get(id);
  }
  async getRedemptionsByWallet(walletAddress: string): Promise<SelectFxrpToXrpRedemption[]> {
    return Array.from(this.redemptions.values()).filter(r => r.walletAddress === walletAddress);
  }
  async updateRedemption(id: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void> {
    const existing = this.redemptions.get(id);
    if (existing) {
      this.redemptions.set(id, { ...existing, ...updates });
    }
  }
  async updateRedemptionStatus(id: string, status: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void> {
    await this.updateRedemption(id, { ...updates, status: status as any });
  }
  async getAllPendingRedemptions(): Promise<SelectFxrpToXrpRedemption[]> { return []; }
  async getStuckRedemptionsForMetrics(): Promise<SelectFxrpToXrpRedemption[]> { return []; }
  async getRedemptionByMatch(): Promise<SelectFxrpToXrpRedemption | null> { return null; }
  async getRedemptionsNeedingRetry(): Promise<SelectFxrpToXrpRedemption[]> { return []; }
  async getRedemptionsWithPendingPayouts(): Promise<SelectFxrpToXrpRedemption[]> { return []; }
  async createFirelightPosition(): Promise<any> { return {}; }
  async getFirelightPositionByVault(): Promise<any> { return undefined; }
  async updateFirelightYield(): Promise<void> {}
  async createCompoundingRun(): Promise<any> { return {}; }
  async completeCompoundingRun(): Promise<void> {}
  async getStakeInfo(): Promise<any> { return null; }
  async recordStake(): Promise<void> {}
  async recordUnstake(): Promise<void> {}
  async getProtocolOverview(): Promise<any> {
    return { tvl: "1000000", avgApy: "8.5", activeVaults: 3, totalStakers: 100 };
  }
  async getApyHistory(): Promise<any[]> { return []; }
  async getTvlHistory(): Promise<any[]> { return []; }
  async getVaultDistribution(): Promise<any[]> { return []; }
  async getTopPerformingVaults(): Promise<any[]> { return []; }
  async initializeVaults(): Promise<void> {}
}

export function createMockStorage(): IStorage {
  return new InMemoryStorage();
}

export function createMockStorageFunctions(): IStorage {
  return {
    getVaults: vi.fn().mockResolvedValue(sampleVaults),
    getVaultsByAssetType: vi.fn().mockResolvedValue([]),
    getAllVaults: vi.fn().mockResolvedValue(sampleVaults),
    getVault: vi.fn().mockResolvedValue(sampleVaults[0]),
    createVault: vi.fn().mockResolvedValue(sampleVaults[0]),
    getPositions: vi.fn().mockResolvedValue(samplePositions),
    getPosition: vi.fn().mockResolvedValue(samplePositions[0]),
    getPositionByWalletAndVault: vi.fn().mockResolvedValue(samplePositions[0]),
    createPosition: vi.fn().mockResolvedValue(samplePositions[0]),
    updatePosition: vi.fn().mockResolvedValue(samplePositions[0]),
    deletePosition: vi.fn().mockResolvedValue(true),
    getTransactions: vi.fn().mockResolvedValue(sampleTransactions),
    getTransaction: vi.fn().mockResolvedValue(sampleTransactions[0]),
    getTransactionByTxHash: vi.fn().mockResolvedValue(sampleTransactions[0]),
    createTransaction: vi.fn().mockResolvedValue(sampleTransactions[0]),
    updateTransaction: vi.fn().mockResolvedValue(sampleTransactions[0]),
    getTransactionSummary: vi.fn().mockResolvedValue({
      totalDeposits: "10000",
      totalWithdrawals: "5000",
      totalRewards: "500",
      depositCount: 5,
      withdrawalCount: 2,
      claimCount: 1,
    }),
    getWithdrawalRequests: vi.fn().mockResolvedValue([]),
    getWithdrawalRequest: vi.fn().mockResolvedValue(undefined),
    createWithdrawalRequest: vi.fn().mockResolvedValue({}),
    updateWithdrawalRequest: vi.fn().mockResolvedValue({}),
    getEscrows: vi.fn().mockResolvedValue([]),
    getEscrow: vi.fn().mockResolvedValue(undefined),
    createEscrow: vi.fn().mockResolvedValue({}),
    updateEscrow: vi.fn().mockResolvedValue({}),
    createBridge: vi.fn().mockResolvedValue({}),
    getBridgeById: vi.fn().mockResolvedValue(undefined),
    getBridgeByRequestId: vi.fn().mockResolvedValue(undefined),
    getBridgesByWallet: vi.fn().mockResolvedValue([]),
    getBridgeByAgentAddress: vi.fn().mockResolvedValue(undefined),
    getBridgesByStatus: vi.fn().mockResolvedValue([]),
    getPendingBridges: vi.fn().mockResolvedValue([]),
    getStuckBridges: vi.fn().mockResolvedValue([]),
    getStuckBridgesForMetrics: vi.fn().mockResolvedValue([]),
    getRecoverableBridges: vi.fn().mockResolvedValue([]),
    updateBridge: vi.fn().mockResolvedValue(undefined),
    updateBridgeStatus: vi.fn().mockResolvedValue(undefined),
    createRedemption: vi.fn().mockResolvedValue({}),
    getRedemptionById: vi.fn().mockResolvedValue(undefined),
    getRedemptionsByWallet: vi.fn().mockResolvedValue([]),
    updateRedemption: vi.fn().mockResolvedValue(undefined),
    updateRedemptionStatus: vi.fn().mockResolvedValue(undefined),
    getAllPendingRedemptions: vi.fn().mockResolvedValue([]),
    getStuckRedemptionsForMetrics: vi.fn().mockResolvedValue([]),
    getRedemptionByMatch: vi.fn().mockResolvedValue(null),
    getRedemptionsNeedingRetry: vi.fn().mockResolvedValue([]),
    getRedemptionsWithPendingPayouts: vi.fn().mockResolvedValue([]),
    createFirelightPosition: vi.fn().mockResolvedValue({}),
    getFirelightPositionByVault: vi.fn().mockResolvedValue(undefined),
    updateFirelightYield: vi.fn().mockResolvedValue(undefined),
    createCompoundingRun: vi.fn().mockResolvedValue({}),
    completeCompoundingRun: vi.fn().mockResolvedValue(undefined),
    getServiceState: vi.fn().mockResolvedValue(undefined),
    setServiceState: vi.fn().mockResolvedValue(undefined),
    getStakeInfo: vi.fn().mockResolvedValue(null),
    recordStake: vi.fn().mockResolvedValue(undefined),
    recordUnstake: vi.fn().mockResolvedValue(undefined),
    getProtocolOverview: vi.fn().mockResolvedValue({
      tvl: "1000000",
      avgApy: "8.5",
      activeVaults: 3,
      totalStakers: 100,
    }),
    getApyHistory: vi.fn().mockResolvedValue([]),
    getTvlHistory: vi.fn().mockResolvedValue([]),
    getVaultDistribution: vi.fn().mockResolvedValue([]),
    getTopPerformingVaults: vi.fn().mockResolvedValue([]),
    initializeVaults: vi.fn().mockResolvedValue(undefined),
  };
}
