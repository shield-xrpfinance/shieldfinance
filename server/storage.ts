import { type Vault, type InsertVault, type Position, type InsertPosition, type Transaction, type InsertTransaction, type VaultMetrics, type InsertVaultMetrics, type WithdrawalRequest, type InsertWithdrawalRequest, type Escrow, type InsertEscrow, type InsertXrpToFxrpBridge, type SelectXrpToFxrpBridge, type InsertFxrpToXrpRedemption, type SelectFxrpToXrpRedemption, type InsertFirelightPosition, type SelectFirelightPosition, type InsertCompoundingRun, type SelectCompoundingRun, vaults, positions, transactions, vaultMetricsDaily, withdrawalRequests, escrows, xrpToFxrpBridges, fxrpToXrpRedemptions, firelightPositions, compoundingRuns } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getVaults(): Promise<Vault[]>;
  getAllVaults(): Promise<Vault[]>;
  getVault(id: string): Promise<Vault | undefined>;
  createVault(vault: InsertVault): Promise<Vault>;
  
  getPositions(walletAddress?: string): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<Position>): Promise<Position>;
  deletePosition(id: string): Promise<boolean>;
  
  getTransactions(limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionSummary(): Promise<{ totalDeposits: string; totalWithdrawals: string; totalRewards: string; depositCount: number; withdrawalCount: number; claimCount: number }>;
  
  getWithdrawalRequests(status?: string, walletAddress?: string): Promise<WithdrawalRequest[]>;
  getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined>;
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  updateWithdrawalRequest(id: string, updates: Partial<InsertWithdrawalRequest>): Promise<WithdrawalRequest>;
  
  getEscrows(walletAddress?: string, status?: string): Promise<Escrow[]>;
  getEscrow(id: string): Promise<Escrow | undefined>;
  createEscrow(escrow: InsertEscrow): Promise<Escrow>;
  updateEscrow(id: string, updates: Partial<InsertEscrow>): Promise<Escrow>;
  
  createBridge(bridge: InsertXrpToFxrpBridge): Promise<SelectXrpToFxrpBridge>;
  getBridgeById(id: string): Promise<SelectXrpToFxrpBridge | undefined>;
  getBridgeByRequestId(requestId: string): Promise<SelectXrpToFxrpBridge | undefined>;
  getBridgesByWallet(walletAddress: string): Promise<SelectXrpToFxrpBridge[]>;
  getBridgeByAgentAddress(agentAddress: string): Promise<SelectXrpToFxrpBridge | undefined>;
  getPendingBridges(): Promise<SelectXrpToFxrpBridge[]>;
  getStuckBridges(): Promise<SelectXrpToFxrpBridge[]>;
  getRecoverableBridges(): Promise<SelectXrpToFxrpBridge[]>;
  updateBridge(id: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void>;
  updateBridgeStatus(id: string, status: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void>;
  
  createRedemption(redemption: InsertFxrpToXrpRedemption): Promise<SelectFxrpToXrpRedemption>;
  getRedemptionById(id: string): Promise<SelectFxrpToXrpRedemption | undefined>;
  getRedemptionsByWallet(walletAddress: string): Promise<SelectFxrpToXrpRedemption[]>;
  updateRedemption(id: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void>;
  updateRedemptionStatus(id: string, status: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void>;
  
  createFirelightPosition(position: InsertFirelightPosition): Promise<SelectFirelightPosition>;
  getFirelightPositionByVault(vaultId: string): Promise<SelectFirelightPosition | undefined>;
  updateFirelightYield(id: string, yieldAmount: string, newBalance: string): Promise<void>;
  
  createCompoundingRun(run: InsertCompoundingRun): Promise<SelectCompoundingRun>;
  completeCompoundingRun(id: string, txHash: string, newBalance: string): Promise<void>;
  
  getProtocolOverview(): Promise<{ tvl: string; avgApy: string; activeVaults: number; totalStakers: number }>;
  getApyHistory(days?: number): Promise<Array<{ date: string; stable: number; high: number; maximum: number }>>;
  getTvlHistory(days?: number): Promise<Array<{ date: string; value: number }>>;
  getVaultDistribution(): Promise<Array<{ name: string; percentage: number }>>;
  getTopPerformingVaults(): Promise<Array<{ name: string; apy: string; riskLevel: string; asset: string }>>;
  
  initializeVaults(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async initializeVaults(): Promise<void> {
    const existingVaults = await db.select().from(vaults);
    if (existingVaults.length > 0) {
      return;
    }

    const vaultData = [
      {
        name: "Shield XRP",
        asset: "XRP",
        apy: "6.2",
        apyLabel: "6.2% (Spark LP + Simulated)",
        tvl: "1200000",
        liquidity: "300000",
        lockPeriod: 7,
        riskLevel: "low",
      },
      {
        name: "XRP Stable Yield",
        asset: "XRP",
        apy: "7.5",
        tvl: "8200000",
        liquidity: "2100000",
        lockPeriod: 30,
        riskLevel: "low",
      },
      {
        name: "RLUSD + USDC Pool",
        asset: "RLUSD,USDC",
        apy: "12.8",
        tvl: "5400000",
        liquidity: "1300000",
        lockPeriod: 90,
        riskLevel: "medium",
      },
      {
        name: "XRP Maximum Returns",
        asset: "XRP",
        apy: "18.5",
        tvl: "3100000",
        liquidity: "750000",
        lockPeriod: 180,
        riskLevel: "high",
      },
      {
        name: "XRP + RLUSD Balanced",
        asset: "XRP,RLUSD",
        apy: "9.2",
        tvl: "12500000",
        liquidity: "4200000",
        lockPeriod: 14,
        riskLevel: "low",
      },
      {
        name: "Triple Asset Pool",
        asset: "XRP,RLUSD,USDC",
        apy: "15.5",
        tvl: "6800000",
        liquidity: "1800000",
        lockPeriod: 60,
        riskLevel: "medium",
      },
      {
        name: "USDC Conservative",
        asset: "USDC",
        apy: "6.3",
        tvl: "2400000",
        liquidity: "520000",
        lockPeriod: 7,
        riskLevel: "low",
      },
    ];

    await db.insert(vaults).values(vaultData);
  }

  async getVaults(): Promise<Vault[]> {
    return await db.select().from(vaults);
  }

  async getAllVaults() {
    return db.query.vaults.findMany();
  }

  async getVault(id: string): Promise<Vault | undefined> {
    const [vault] = await db.select().from(vaults).where(eq(vaults.id, id));
    return vault || undefined;
  }

  async createVault(insertVault: InsertVault): Promise<Vault> {
    const [vault] = await db.insert(vaults).values(insertVault).returning();
    return vault;
  }

  async getPositions(walletAddress?: string): Promise<Position[]> {
    if (walletAddress) {
      return await db.select().from(positions).where(eq(positions.walletAddress, walletAddress));
    }
    return await db.select().from(positions);
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position || undefined;
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(insertPosition).returning();
    return position;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position> {
    const [position] = await db.update(positions)
      .set(updates)
      .where(eq(positions.id, id))
      .returning();
    if (!position) {
      throw new Error(`Position ${id} not found`);
    }
    return position;
  }

  async deletePosition(id: string): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTransactions(limit: number = 50): Promise<Transaction[]> {
    return await db.select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async getTransactionSummary(): Promise<{ totalDeposits: string; totalWithdrawals: string; totalRewards: string; depositCount: number; withdrawalCount: number; claimCount: number }> {
    const allTransactions = await db.select().from(transactions);
    
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalRewards = 0;
    let depositCount = 0;
    let withdrawalCount = 0;
    let claimCount = 0;

    for (const tx of allTransactions) {
      const amount = parseFloat(tx.amount);
      const rewards = parseFloat(tx.rewards || "0");
      
      if (tx.type === "deposit") {
        totalDeposits += amount;
        depositCount++;
      } else if (tx.type === "withdraw") {
        totalWithdrawals += amount;
        withdrawalCount++;
      } else if (tx.type === "claim") {
        totalRewards += rewards;
        claimCount++;
      }
    }

    return {
      totalDeposits: totalDeposits.toFixed(2),
      totalWithdrawals: totalWithdrawals.toFixed(2),
      totalRewards: totalRewards.toFixed(2),
      depositCount,
      withdrawalCount,
      claimCount,
    };
  }

  async getProtocolOverview(): Promise<{ tvl: string; avgApy: string; activeVaults: number; totalStakers: number }> {
    const allVaults = await this.getVaults();
    const allPositions = await this.getPositions();
    
    const totalTvl = allVaults.reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    const avgApy = allVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / allVaults.length;
    const activeVaults = allVaults.filter(v => v.status === "active").length;
    const totalStakers = allPositions.length;

    return {
      tvl: totalTvl.toFixed(0),
      avgApy: avgApy.toFixed(1),
      activeVaults,
      totalStakers,
    };
  }

  async getApyHistory(days: number = 180): Promise<Array<{ date: string; stable: number; high: number; maximum: number }>> {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const allVaults = await this.getVaults();
    
    const stableVaults = allVaults.filter(v => v.riskLevel === "low");
    const highVaults = allVaults.filter(v => v.riskLevel === "medium");
    const maxVaults = allVaults.filter(v => v.riskLevel === "high");
    
    const avgStable = stableVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / (stableVaults.length || 1);
    const avgHigh = highVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / (highVaults.length || 1);
    const avgMax = maxVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / (maxVaults.length || 1);

    return months.map((month, i) => ({
      date: month,
      stable: parseFloat((avgStable + (Math.random() - 0.5) * 1).toFixed(1)),
      high: parseFloat((avgHigh + (Math.random() - 0.5) * 2).toFixed(1)),
      maximum: parseFloat((avgMax + (Math.random() - 0.5) * 3).toFixed(1)),
    }));
  }

  async getTvlHistory(days: number = 180): Promise<Array<{ date: string; value: number }>> {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    const overview = await this.getProtocolOverview();
    const currentTvl = parseFloat(overview.tvl);
    
    return months.map((month, i) => {
      const factor = 0.6 + (i / months.length) * 0.4;
      return {
        date: month,
        value: Math.round(currentTvl * factor),
      };
    });
  }

  async getVaultDistribution(): Promise<Array<{ name: string; percentage: number }>> {
    const allVaults = await this.getVaults();
    const totalTvl = allVaults.reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    
    const lowTvl = allVaults.filter(v => v.riskLevel === "low").reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    const mediumTvl = allVaults.filter(v => v.riskLevel === "medium").reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    const highTvl = allVaults.filter(v => v.riskLevel === "high").reduce((sum, v) => sum + parseFloat(v.tvl), 0);

    return [
      { name: "Stable Yield Pools", percentage: Math.round((lowTvl / totalTvl) * 100) },
      { name: "High Yield Vaults", percentage: Math.round((mediumTvl / totalTvl) * 100) },
      { name: "Maximum Returns", percentage: Math.round((highTvl / totalTvl) * 100) },
    ];
  }

  async getTopPerformingVaults(): Promise<Array<{ name: string; apy: string; riskLevel: string; asset: string }>> {
    const allVaults = await this.getVaults();
    return allVaults
      .sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy))
      .slice(0, 3)
      .map(v => ({
        name: v.name,
        apy: v.apy,
        riskLevel: v.riskLevel,
        asset: v.asset,
      }));
  }

  async getWithdrawalRequests(status?: string, walletAddress?: string): Promise<WithdrawalRequest[]> {
    const conditions = [];
    
    if (status) {
      conditions.push(eq(withdrawalRequests.status, status));
    }
    
    if (walletAddress) {
      conditions.push(eq(withdrawalRequests.walletAddress, walletAddress));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(withdrawalRequests).where(and(...conditions)).orderBy(desc(withdrawalRequests.requestedAt));
    }
    
    return await db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.requestedAt));
  }

  async getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined> {
    const [request] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, id));
    return request || undefined;
  }

  async createWithdrawalRequest(insertRequest: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    const [request] = await db.insert(withdrawalRequests).values(insertRequest).returning();
    return request;
  }

  async updateWithdrawalRequest(id: string, updates: Partial<InsertWithdrawalRequest>): Promise<WithdrawalRequest> {
    const [request] = await db.update(withdrawalRequests).set(updates).where(eq(withdrawalRequests.id, id)).returning();
    return request;
  }

  async getEscrows(walletAddress?: string, status?: string): Promise<Escrow[]> {
    const conditions = [];
    
    if (walletAddress) {
      conditions.push(eq(escrows.walletAddress, walletAddress));
    }
    
    if (status) {
      conditions.push(eq(escrows.status, status));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(escrows).where(and(...conditions)).orderBy(desc(escrows.createdAt));
    }
    
    return await db.select().from(escrows).orderBy(desc(escrows.createdAt));
  }

  async getEscrow(id: string): Promise<Escrow | undefined> {
    const [escrow] = await db.select().from(escrows).where(eq(escrows.id, id));
    return escrow || undefined;
  }

  async createEscrow(insertEscrow: InsertEscrow): Promise<Escrow> {
    const [escrow] = await db.insert(escrows).values(insertEscrow).returning();
    return escrow;
  }

  async updateEscrow(id: string, updates: Partial<InsertEscrow>): Promise<Escrow> {
    const [escrow] = await db.update(escrows).set(updates).where(eq(escrows.id, id)).returning();
    return escrow;
  }

  async createBridge(bridge: InsertXrpToFxrpBridge): Promise<SelectXrpToFxrpBridge> {
    const [created] = await db.insert(xrpToFxrpBridges).values(bridge).returning();
    return created;
  }

  async getBridgeById(id: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return db.query.xrpToFxrpBridges.findFirst({ where: eq(xrpToFxrpBridges.id, id) });
  }

  async getBridgeByRequestId(requestId: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return db.query.xrpToFxrpBridges.findFirst({ where: eq(xrpToFxrpBridges.requestId, requestId) });
  }

  async getBridgesByWallet(walletAddress: string): Promise<SelectXrpToFxrpBridge[]> {
    return db.query.xrpToFxrpBridges.findMany({
      where: eq(xrpToFxrpBridges.walletAddress, walletAddress),
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });
  }

  async getBridgeByAgentAddress(agentAddress: string): Promise<SelectXrpToFxrpBridge | undefined> {
    return db.query.xrpToFxrpBridges.findFirst({
      where: eq(xrpToFxrpBridges.agentUnderlyingAddress, agentAddress),
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });
  }

  async getPendingBridges(): Promise<SelectXrpToFxrpBridge[]> {
    return db.query.xrpToFxrpBridges.findMany({
      where: eq(xrpToFxrpBridges.status, "awaiting_payment"),
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });
  }

  async getStuckBridges(): Promise<SelectXrpToFxrpBridge[]> {
    return db.query.xrpToFxrpBridges.findMany({
      where: and(
        eq(xrpToFxrpBridges.status, "xrpl_confirmed"),
        sql`${xrpToFxrpBridges.fdcProofData} IS NULL`
      ),
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });
  }

  async getRecoverableBridges(): Promise<SelectXrpToFxrpBridge[]> {
    const allBridges = await db.query.xrpToFxrpBridges.findMany({
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });

    return allBridges.filter(bridge => {
      // Status-based recoverable states
      if (bridge.status === "fdc_timeout") return true;
      if (bridge.status === "vault_mint_failed") return true;
      
      // Stuck at xrpl_confirmed without proof data
      if (bridge.status === "xrpl_confirmed" && !bridge.fdcProofData) return true;
      
      // Stuck at fdc_proof_generated without minting
      if (bridge.status === "fdc_proof_generated" && !bridge.flareTxHash) return true;
      
      // Failed status with recoverable error patterns
      if (bridge.status === "failed" && bridge.errorMessage) {
        const errorMsg = bridge.errorMessage.toLowerCase();
        return (
          errorMsg.includes("already known") ||
          errorMsg.includes("attestation request not found") ||
          errorMsg.includes("fdc") ||
          errorMsg.includes("timeout")
        );
      }
      
      return false;
    });
  }

  async updateBridge(id: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void> {
    await db.update(xrpToFxrpBridges)
      .set(updates)
      .where(eq(xrpToFxrpBridges.id, id));
  }

  async updateBridgeStatus(id: string, status: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void> {
    await db.update(xrpToFxrpBridges)
      .set({ status: status as any, ...updates, completedAt: status === 'completed' ? new Date() : undefined })
      .where(eq(xrpToFxrpBridges.id, id));
  }

  async createRedemption(redemption: InsertFxrpToXrpRedemption): Promise<SelectFxrpToXrpRedemption> {
    const [created] = await db.insert(fxrpToXrpRedemptions).values(redemption).returning();
    return created;
  }

  async getRedemptionById(id: string): Promise<SelectFxrpToXrpRedemption | undefined> {
    return db.query.fxrpToXrpRedemptions.findFirst({ where: eq(fxrpToXrpRedemptions.id, id) });
  }

  async getRedemptionsByWallet(walletAddress: string): Promise<SelectFxrpToXrpRedemption[]> {
    return db.query.fxrpToXrpRedemptions.findMany({
      where: eq(fxrpToXrpRedemptions.walletAddress, walletAddress),
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });
  }

  async updateRedemption(id: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void> {
    await db.update(fxrpToXrpRedemptions)
      .set(updates)
      .where(eq(fxrpToXrpRedemptions.id, id));
  }

  async updateRedemptionStatus(id: string, status: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void> {
    await db.update(fxrpToXrpRedemptions)
      .set({ status: status as any, ...updates, completedAt: status === 'completed' ? new Date() : undefined })
      .where(eq(fxrpToXrpRedemptions.id, id));
  }

  async createFirelightPosition(position: InsertFirelightPosition): Promise<SelectFirelightPosition> {
    const [created] = await db.insert(firelightPositions).values(position).returning();
    return created;
  }

  async getFirelightPositionByVault(vaultId: string): Promise<SelectFirelightPosition | undefined> {
    return db.query.firelightPositions.findFirst({ where: eq(firelightPositions.vaultId, vaultId) });
  }

  async updateFirelightYield(id: string, yieldAmount: string, newBalance: string): Promise<void> {
    await db.update(firelightPositions)
      .set({
        yieldAccrued: yieldAmount,
        currentStxrpBalance: newBalance,
        lastYieldUpdate: new Date(),
      })
      .where(eq(firelightPositions.id, id));
  }

  async createCompoundingRun(run: InsertCompoundingRun): Promise<SelectCompoundingRun> {
    const [created] = await db.insert(compoundingRuns).values(run).returning();
    return created;
  }

  async completeCompoundingRun(id: string, txHash: string, newBalance: string): Promise<void> {
    await db.update(compoundingRuns)
      .set({
        status: 'completed',
        txHash,
        newStxrpBalance: newBalance,
        completedAt: new Date(),
      })
      .where(eq(compoundingRuns.id, id));
  }
}

export const storage = new DatabaseStorage();
