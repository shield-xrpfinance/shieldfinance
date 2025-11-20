import { type Vault, type InsertVault, type Position, type InsertPosition, type Transaction, type InsertTransaction, type VaultMetrics, type InsertVaultMetrics, type WithdrawalRequest, type InsertWithdrawalRequest, type Escrow, type InsertEscrow, type InsertXrpToFxrpBridge, type SelectXrpToFxrpBridge, type InsertFxrpToXrpRedemption, type SelectFxrpToXrpRedemption, type InsertFirelightPosition, type SelectFirelightPosition, type InsertCompoundingRun, type SelectCompoundingRun, type InsertServiceState, type ServiceState, vaults, positions, transactions, vaultMetricsDaily, withdrawalRequests, escrows, xrpToFxrpBridges, fxrpToXrpRedemptions, firelightPositions, compoundingRuns, serviceState } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, gt } from "drizzle-orm";

// Redemption expiry: FAssets redemptions typically complete within hours
// 24h provides safety margin while preventing old expired redemptions from matching
const REDEMPTION_AWAITING_PROOF_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  getTransactionByTxHash(txHash: string): Promise<Transaction | undefined>;
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
  getBridgesByStatus(statuses: string[]): Promise<SelectXrpToFxrpBridge[]>;
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
  getAllPendingRedemptions(): Promise<SelectFxrpToXrpRedemption[]>;
  getRedemptionByMatch(userAddress: string, agentAddress: string, amountDrops: string): Promise<SelectFxrpToXrpRedemption | null>;
  getRedemptionsNeedingRetry(): Promise<SelectFxrpToXrpRedemption[]>;
  
  createFirelightPosition(position: InsertFirelightPosition): Promise<SelectFirelightPosition>;
  getFirelightPositionByVault(vaultId: string): Promise<SelectFirelightPosition | undefined>;
  updateFirelightYield(id: string, yieldAmount: string, newBalance: string): Promise<void>;
  
  createCompoundingRun(run: InsertCompoundingRun): Promise<SelectCompoundingRun>;
  completeCompoundingRun(id: string, txHash: string, newBalance: string): Promise<void>;
  
  getServiceState(key: string): Promise<ServiceState | undefined>;
  setServiceState(key: string, value: string): Promise<void>;
  
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

  async getTransactionByTxHash(txHash: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select()
      .from(transactions)
      .where(eq(transactions.txHash, txHash));
    return transaction || undefined;
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

  async getBridgesByStatus(statuses: string[]): Promise<SelectXrpToFxrpBridge[]> {
    if (statuses.length === 0) {
      return [];
    }
    
    if (statuses.length === 1) {
      return db.query.xrpToFxrpBridges.findMany({
        where: eq(xrpToFxrpBridges.status, statuses[0] as any),
        orderBy: desc(xrpToFxrpBridges.createdAt),
      });
    }

    // For multiple statuses, use IN operator via sql template
    const statusConditions = statuses.map(s => `'${s}'`).join(',');
    return db.query.xrpToFxrpBridges.findMany({
      where: sql`${xrpToFxrpBridges.status}::text IN (${sql.raw(statusConditions)})`,
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
      if (bridge.status === "failed") {
        // If XRPL payment confirmed but never minted, it's recoverable
        if (bridge.xrplConfirmedAt && !bridge.vaultMintTxHash) {
          return true;
        }
        
        // Check error message patterns
        if (bridge.errorMessage) {
          const errorMsg = bridge.errorMessage.toLowerCase();
          return (
            errorMsg.includes("already known") ||
            errorMsg.includes("attestation request not found") ||
            errorMsg.includes("fdc") ||
            errorMsg.includes("timeout") ||
            errorMsg.includes("fee too low") ||
            errorMsg.includes("user op cannot be replaced")
          );
        }
      }
      
      // Stuck at minting status without completion
      if (bridge.status === "minting" && !bridge.vaultMintTxHash) return true;
      
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

  async getAllPendingRedemptions(): Promise<SelectFxrpToXrpRedemption[]> {
    return db.query.fxrpToXrpRedemptions.findMany({
      where: eq(fxrpToXrpRedemptions.status, "awaiting_proof"),
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });
  }

  async getRedemptionsNeedingRetry(): Promise<SelectFxrpToXrpRedemption[]> {
    const { inArray } = await import("drizzle-orm");
    
    // Query redemptions with:
    // - backendStatus IN ('manual_review', 'retry_pending')
    // - userStatus = 'completed' (user has XRP successfully)
    // - status IN ('awaiting_proof', 'xrpl_received')
    return db.query.fxrpToXrpRedemptions.findMany({
      where: and(
        inArray(fxrpToXrpRedemptions.backendStatus, ["manual_review", "retry_pending"]),
        eq(fxrpToXrpRedemptions.userStatus, "completed")
      ),
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });
  }

  async getRedemptionByMatch(
    userAddress: string,
    agentAddress: string,
    amountDrops: string
  ): Promise<SelectFxrpToXrpRedemption | null> {
    // Calculate expiry cutoff (24h ago)
    const cutoffDate = new Date(Date.now() - REDEMPTION_AWAITING_PROOF_TTL_MS);
    
    // Build conditional where clause
    // If agentAddress is available, use it for matching (more precise)
    // If not available (null/undefined), match on user address and amount only (fallback)
    const whereConditions = [
      eq(fxrpToXrpRedemptions.status, "awaiting_proof"),
      eq(fxrpToXrpRedemptions.walletAddress, userAddress),
      gt(fxrpToXrpRedemptions.createdAt, cutoffDate)
    ];
    
    // Only filter by agent address if it's known (not null/undefined)
    if (agentAddress) {
      whereConditions.push(eq(fxrpToXrpRedemptions.agentUnderlyingAddress, agentAddress));
      console.log(`🔍 Matching redemption WITH agent filter:`, {
        userAddress,
        agentAddress,
        amountDrops,
        cutoffDate: cutoffDate.toISOString()
      });
    } else {
      console.warn(`⚠️  Matching redemption WITHOUT agent filter (agent address unknown):`, {
        userAddress,
        amountDrops,
        cutoffDate: cutoffDate.toISOString()
      });
    }
    
    // Find redemptions awaiting proof that match the payment details
    // Only consider redemptions created within the last 24 hours to avoid matching expired requests
    const redemptions = await db.query.fxrpToXrpRedemptions.findMany({
      where: and(...whereConditions),
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });

    // Convert amountDrops (decimal string like "29.85") to raw UBA units for comparison
    // amountDrops is formatted as XRP with up to 6 decimals (e.g., "29.85")
    // expectedXrpDrops is stored as raw UBA units (e.g., "29850000")
    // Use parseUnits for exact decimal-to-UBA conversion (avoids floating-point precision errors)
    const { parseUnits } = await import("ethers");
    const amountUBA = parseUnits(amountDrops, 6).toString();

    for (const redemption of redemptions) {
      // Primary match: Use expectedXrpDrops (net amount after fees)
      // This is the correct field that accounts for FAssets redemption fees
      if (redemption.expectedXrpDrops) {
        if (redemption.expectedXrpDrops === amountUBA) {
          console.log(`✅ Matched redemption ${redemption.id} using expectedXrpDrops`);
          console.log(`   Expected: ${redemption.expectedXrpDrops} UBA (${parseFloat(redemption.expectedXrpDrops) / 1_000_000} XRP)`);
          console.log(`   Received: ${amountUBA} UBA (${amountDrops} XRP)`);
          return redemption;
        }
      }
      
      // Fallback: Match against xrpSent for backwards compatibility
      // This handles old redemptions created before the fee fix
      if (redemption.xrpSent && redemption.xrpSent === amountDrops) {
        console.log(`✅ Matched redemption ${redemption.id} using xrpSent (legacy)`);
        console.log(`   Expected: ${redemption.xrpSent} XRP`);
        console.log(`   Received: ${amountDrops} XRP`);
        return redemption;
      }
    }

    console.log(`❌ No matching redemption found for payment:`);
    console.log(`   User: ${userAddress}`);
    console.log(`   Agent: ${agentAddress || '(unknown - will match without agent filter)'}`);
    console.log(`   Amount: ${amountDrops} XRP (${amountUBA} UBA)`);
    console.log(`   Checked ${redemptions.length} awaiting_proof redemption(s) created after ${cutoffDate.toISOString()}`);
    console.log(`   Note: Redemptions older than ${REDEMPTION_AWAITING_PROOF_TTL_MS / (60 * 60 * 1000)}h are automatically excluded`);
    
    // Log details of each redemption checked to help debug
    if (redemptions.length > 0) {
      console.log(`\n📋 Redemptions checked for matching:`);
      for (const r of redemptions) {
        console.log(`   - ID: ${r.id}`);
        console.log(`     Wallet: ${r.walletAddress}`);
        console.log(`     Agent: ${r.agentUnderlyingAddress || '(unknown)'}`);
        console.log(`     Expected XRP: ${r.expectedXrpDrops ? (parseFloat(r.expectedXrpDrops) / 1_000_000).toFixed(6) : 'N/A'} (${r.expectedXrpDrops || 'N/A'} UBA)`);
        console.log(`     XRP Sent: ${r.xrpSent || 'N/A'} XRP`);
        console.log(`     Created: ${r.createdAt.toISOString()}`);
      }
    }

    return null;
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

  async getServiceState(key: string): Promise<ServiceState | undefined> {
    return db.query.serviceState.findFirst({ where: eq(serviceState.key, key) });
  }

  async setServiceState(key: string, value: string): Promise<void> {
    // Use upsert pattern: try insert, if conflict update
    await db.insert(serviceState)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: serviceState.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

export const storage = new DatabaseStorage();
