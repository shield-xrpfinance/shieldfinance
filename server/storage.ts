import { type Vault, type InsertVault, type Position, type InsertPosition, type Transaction, type InsertTransaction, type VaultMetrics, type InsertVaultMetrics, type WithdrawalRequest, type InsertWithdrawalRequest, type Escrow, type InsertEscrow, type InsertXrpToFxrpBridge, type SelectXrpToFxrpBridge, type InsertFxrpToXrpRedemption, type SelectFxrpToXrpRedemption, type InsertFirelightPosition, type SelectFirelightPosition, type InsertCompoundingRun, type SelectCompoundingRun, type InsertServiceState, type ServiceState, type InsertStakingPosition, type StakingPosition, type InsertDashboardSnapshot, type DashboardSnapshot, type InsertUserNotification, type UserNotification, type NotificationType, vaults, positions, transactions, vaultMetricsDaily, withdrawalRequests, escrows, xrpToFxrpBridges, fxrpToXrpRedemptions, firelightPositions, compoundingRuns, serviceState, stakingPositions, dashboardSnapshots, userNotifications } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte, gt, asc } from "drizzle-orm";

// Redemption expiry: FAssets redemptions typically complete within hours
// 24h provides safety margin while preventing old expired redemptions from matching
const REDEMPTION_AWAITING_PROOF_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface IStorage {
  getVaults(): Promise<Vault[]>;
  getVaultsByAssetType(assetType: 'crypto' | 'rwa' | 'tokenized_security'): Promise<Vault[]>;
  getAllVaults(): Promise<Vault[]>;
  getVault(id: string): Promise<Vault | undefined>;
  createVault(vault: InsertVault): Promise<Vault>;
  
  getPositions(walletAddress?: string): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  getPositionByWalletAndVault(walletAddress: string, vaultId: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<Position>): Promise<Position>;
  deletePosition(id: string): Promise<boolean>;
  
  getTransactions(limit?: number, walletAddress?: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByTxHash(txHash: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  getTransactionSummary(walletAddress?: string): Promise<{ totalDeposits: string; totalWithdrawals: string; totalRewards: string; depositCount: number; withdrawalCount: number; claimCount: number }>;
  
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
  getStuckBridgesForMetrics(minutesThreshold?: number): Promise<SelectXrpToFxrpBridge[]>;
  getRecoverableBridges(): Promise<SelectXrpToFxrpBridge[]>;
  updateBridge(id: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void>;
  updateBridgeStatus(id: string, status: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void>;
  
  createRedemption(redemption: InsertFxrpToXrpRedemption): Promise<SelectFxrpToXrpRedemption>;
  getRedemptionById(id: string): Promise<SelectFxrpToXrpRedemption | undefined>;
  getRedemptionsByWallet(walletAddress: string): Promise<SelectFxrpToXrpRedemption[]>;
  updateRedemption(id: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void>;
  updateRedemptionStatus(id: string, status: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void>;
  getAllPendingRedemptions(): Promise<SelectFxrpToXrpRedemption[]>;
  getStuckRedemptionsForMetrics(minutesThreshold?: number): Promise<SelectFxrpToXrpRedemption[]>;
  getRedemptionByMatch(userAddress: string, agentAddress: string, amountDrops: string): Promise<SelectFxrpToXrpRedemption | null>;
  getRedemptionsNeedingRetry(): Promise<SelectFxrpToXrpRedemption[]>;
  getRedemptionsWithPendingPayouts(): Promise<SelectFxrpToXrpRedemption[]>;
  
  createFirelightPosition(position: InsertFirelightPosition): Promise<SelectFirelightPosition>;
  getFirelightPositionByVault(vaultId: string): Promise<SelectFirelightPosition | undefined>;
  updateFirelightYield(id: string, yieldAmount: string, newBalance: string): Promise<void>;
  
  createCompoundingRun(run: InsertCompoundingRun): Promise<SelectCompoundingRun>;
  completeCompoundingRun(id: string, txHash: string, newBalance: string): Promise<void>;
  
  getServiceState(key: string): Promise<ServiceState | undefined>;
  setServiceState(key: string, value: string): Promise<void>;
  
  getStakeInfo(walletAddress: string): Promise<StakingPosition | null>;
  recordStake(walletAddress: string, amount: string, stakedAt: string, unlockTime: string): Promise<void>;
  recordUnstake(walletAddress: string, amount: string): Promise<void>;
  
  // Dashboard snapshots for portfolio history
  createDashboardSnapshot(snapshot: InsertDashboardSnapshot): Promise<DashboardSnapshot>;
  getDashboardSnapshots(walletAddress: string, fromDate: Date, toDate: Date): Promise<DashboardSnapshot[]>;
  getLatestDashboardSnapshot(walletAddress: string): Promise<DashboardSnapshot | undefined>;
  
  // User notifications for persistent notification center
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  getUserNotifications(walletAddress: string, limit?: number, unreadOnly?: boolean): Promise<UserNotification[]>;
  getUnreadNotificationCount(walletAddress: string): Promise<number>;
  markNotificationAsRead(id: number): Promise<void>;
  markAllNotificationsAsRead(walletAddress: string): Promise<void>;
  deleteNotification(id: number): Promise<void>;
  
  getProtocolOverview(): Promise<{ tvl: string; avgApy: string; activeVaults: number; totalStakers: number }>;
  getApyHistory(days?: number): Promise<Array<{ date: string; stable: number | null; high: number | null; maximum: number | null }>>;
  getTvlHistory(days?: number): Promise<Array<{ date: string; value: number | null }>>;
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

    const vaultData: InsertVault[] = [
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
        name: "FXRP Vault",
        asset: "FXRP",
        apy: "5.5",
        apyLabel: "5.5% (Firelight Yield)",
        tvl: "500000",
        liquidity: "150000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "active",
        comingSoon: false,
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
      // RWA Vaults - US Treasuries
      {
        name: "US Treasury Bills",
        asset: "T-BILLS",
        apy: "4.2",
        apyLabel: "4.2% (3-Month T-Bills)",
        tvl: "25000000",
        liquidity: "25000000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "US Treasury Bills (3-6 Month)",
        currencyDenomination: "USD",
        minInvestmentUsd: "1000",
        custodian: "Blackrock",
        riskDisclosure: "Subject to interest rate risk and US government credit risk.",
      },
      {
        name: "US Treasury 10-Year Bonds",
        asset: "T-BONDS",
        apy: "4.8",
        apyLabel: "4.8% (10-Year Treasury)",
        tvl: "18000000",
        liquidity: "15000000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "US Treasury Bonds (10-Year)",
        currencyDenomination: "USD",
        minInvestmentUsd: "5000",
        custodian: "Fidelity",
        riskDisclosure: "Duration risk - sensitive to interest rate changes.",
      },
      // RWA Vaults - Private Credit
      {
        name: "Diversified Private Loans",
        asset: "PRIV-CREDIT",
        apy: "9.5",
        apyLabel: "9.5% (Senior Secured Loans)",
        tvl: "12000000",
        liquidity: "2400000",
        lockPeriod: 90,
        riskLevel: "medium",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: true,
        jurisdiction: "US, EU, UK, SG, UAE",
        underlyingInstrument: "Senior Secured Corporate Loans",
        currencyDenomination: "USD",
        minInvestmentUsd: "25000",
        custodian: "Apollo Global",
        riskDisclosure: "Credit risk, illiquidity risk. Accredited investors only.",
      },
      {
        name: "Real Estate Debt Fund",
        asset: "RE-DEBT",
        apy: "8.2",
        apyLabel: "8.2% (Commercial RE Loans)",
        tvl: "8500000",
        liquidity: "1700000",
        lockPeriod: 180,
        riskLevel: "medium",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: true,
        jurisdiction: "US, EU, UK",
        underlyingInstrument: "Commercial Real Estate Mortgages",
        currencyDenomination: "USD",
        minInvestmentUsd: "50000",
        custodian: "Blackstone",
        riskDisclosure: "Real estate market risk, interest rate risk. Accredited investors only.",
      },
      // RWA Vaults - Commodities
      {
        name: "Gold-Backed Yield",
        asset: "GOLD",
        apy: "2.5",
        apyLabel: "2.5% (Gold Lending)",
        tvl: "15000000",
        liquidity: "12000000",
        lockPeriod: 30,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "Physical Gold (LBMA)",
        currencyDenomination: "USD",
        minInvestmentUsd: "1000",
        custodian: "Brinks",
        riskDisclosure: "Commodity price risk. Yield from gold lending activities.",
      },
      {
        name: "Silver Commodity Vault",
        asset: "SILVER",
        apy: "3.1",
        apyLabel: "3.1% (Silver Lending)",
        tvl: "5000000",
        liquidity: "4000000",
        lockPeriod: 30,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "Physical Silver (LBMA)",
        currencyDenomination: "USD",
        minInvestmentUsd: "500",
        custodian: "Brinks",
        riskDisclosure: "Commodity price risk. Higher volatility than gold.",
      },
      // RWA Vaults - Corporate Bonds
      {
        name: "Investment Grade Bonds",
        asset: "IG-BONDS",
        apy: "5.8",
        apyLabel: "5.8% (AAA-BBB Rated)",
        tvl: "20000000",
        liquidity: "16000000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "Investment Grade Corporate Bonds",
        currencyDenomination: "USD",
        minInvestmentUsd: "2500",
        custodian: "Vanguard",
        riskDisclosure: "Credit risk, interest rate risk. Diversified bond portfolio.",
      },
      {
        name: "High Yield Corporate Bonds",
        asset: "HY-BONDS",
        apy: "8.9",
        apyLabel: "8.9% (BB-B Rated)",
        tvl: "7500000",
        liquidity: "3750000",
        lockPeriod: 30,
        riskLevel: "medium",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "High Yield Corporate Bonds",
        currencyDenomination: "USD",
        minInvestmentUsd: "5000",
        custodian: "PIMCO",
        riskDisclosure: "Higher credit risk. Below investment grade bonds.",
      },
      // Tokenized Securities
      {
        name: "S&P 500 Index Token",
        asset: "SPX-TOKEN",
        apy: "11.5",
        apyLabel: "11.5% (Historical Avg)",
        tvl: "30000000",
        liquidity: "24000000",
        lockPeriod: 0,
        riskLevel: "medium",
        status: "coming_soon",
        comingSoon: true,
        assetType: "tokenized_security",
        kycRequired: true,
        accreditationRequired: true,
        jurisdiction: "US, EU (MiFID II)",
        underlyingInstrument: "S&P 500 Index Fund",
        currencyDenomination: "USD",
        minInvestmentUsd: "10000",
        custodian: "DTCC",
        riskDisclosure: "Equity market risk. Past performance not indicative of future results.",
      },
      {
        name: "NASDAQ-100 Token",
        asset: "NDX-TOKEN",
        apy: "14.2",
        apyLabel: "14.2% (Historical Avg)",
        tvl: "22000000",
        liquidity: "17600000",
        lockPeriod: 0,
        riskLevel: "high",
        status: "coming_soon",
        comingSoon: true,
        assetType: "tokenized_security",
        kycRequired: true,
        accreditationRequired: true,
        jurisdiction: "US, EU (MiFID II)",
        underlyingInstrument: "NASDAQ-100 Index Fund",
        currencyDenomination: "USD",
        minInvestmentUsd: "10000",
        custodian: "DTCC",
        riskDisclosure: "High volatility tech-focused equity exposure. Accredited investors only.",
      },
      {
        name: "Global Dividend Portfolio",
        asset: "DIV-TOKEN",
        apy: "6.8",
        apyLabel: "6.8% (Dividend Yield)",
        tvl: "14000000",
        liquidity: "11200000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "tokenized_security",
        kycRequired: true,
        accreditationRequired: true,
        jurisdiction: "US, EU (MiFID II)",
        underlyingInstrument: "Global Dividend Aristocrats",
        currencyDenomination: "USD",
        minInvestmentUsd: "5000",
        custodian: "State Street",
        riskDisclosure: "Equity market risk. Dividend payments not guaranteed.",
      },
      // Institutional Money Market
      {
        name: "Institutional Money Market",
        asset: "MM-FUND",
        apy: "5.2",
        apyLabel: "5.2% (Money Market)",
        tvl: "50000000",
        liquidity: "50000000",
        lockPeriod: 0,
        riskLevel: "low",
        status: "coming_soon",
        comingSoon: true,
        assetType: "rwa",
        kycRequired: true,
        accreditationRequired: false,
        jurisdiction: "Global (excl. sanctioned)",
        underlyingInstrument: "Prime Money Market Fund",
        currencyDenomination: "USD",
        minInvestmentUsd: "100000",
        custodian: "JP Morgan",
        riskDisclosure: "Low risk. Near-cash equivalent with stable NAV.",
      },
    ];

    await db.insert(vaults).values(vaultData);
  }

  async getVaults(): Promise<Vault[]> {
    return await db.select().from(vaults);
  }

  async getVaultsByAssetType(assetType: 'crypto' | 'rwa' | 'tokenized_security'): Promise<Vault[]> {
    return await db.select().from(vaults).where(eq(vaults.assetType, assetType));
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
      return await db.select().from(positions).where(
        and(
          eq(positions.walletAddress, walletAddress),
          eq(positions.status, "active")
        )
      );
    }
    return await db.select().from(positions).where(eq(positions.status, "active"));
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position || undefined;
  }

  async getPositionByWalletAndVault(walletAddress: string, vaultId: string): Promise<Position | undefined> {
    const [position] = await db.select()
      .from(positions)
      .where(and(
        eq(positions.walletAddress, walletAddress),
        eq(positions.vaultId, vaultId)
      ))
      // No status filter - return closed positions too (will be reactivated on deposit)
      .limit(1);
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

  async getTransactions(limit: number = 50, walletAddress?: string): Promise<Transaction[]> {
    if (walletAddress) {
      // Filter directly by wallet address column
      return await db.select()
        .from(transactions)
        .where(eq(transactions.walletAddress, walletAddress))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);
    }
    
    return await db.select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction || undefined;
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

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const [transaction] = await db.update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    if (!transaction) {
      throw new Error(`Transaction ${id} not found`);
    }
    return transaction;
  }

  async getTransactionSummary(walletAddress?: string): Promise<{ totalDeposits: string; totalWithdrawals: string; totalRewards: string; depositCount: number; withdrawalCount: number; claimCount: number }> {
    let allTransactions;
    
    if (walletAddress) {
      // Filter directly by wallet address column
      allTransactions = await db.select({
        type: transactions.type,
        amount: transactions.amount,
        rewards: transactions.rewards,
      })
        .from(transactions)
        .where(eq(transactions.walletAddress, walletAddress));
    } else {
      allTransactions = await db.select().from(transactions);
    }
    
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalRewards = 0;
    let depositCount = 0;
    let withdrawalCount = 0;
    let claimCount = 0;

    for (const tx of allTransactions) {
      const amount = parseFloat(tx.amount);
      const rewards = parseFloat(tx.rewards || "0");
      
      if (tx.type === "deposit" || tx.type === "direct_fxrp_deposit") {
        totalDeposits += amount;
        depositCount++;
      } else if (tx.type === "withdraw" || tx.type === "withdrawal" || tx.type === "direct_fxrp_withdrawal") {
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

  async getApyHistory(days: number = 180): Promise<Array<{ date: string; stable: number | null; high: number | null; maximum: number | null }>> {
    const allVaults = await this.getVaults();
    
    const stableVaults = allVaults.filter(v => v.riskLevel === "low");
    const highVaults = allVaults.filter(v => v.riskLevel === "medium");
    const maxVaults = allVaults.filter(v => v.riskLevel === "high");
    
    const avgStable = stableVaults.length > 0 
      ? stableVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / stableVaults.length 
      : null;
    const avgHigh = highVaults.length > 0 
      ? highVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / highVaults.length 
      : null;
    const avgMax = maxVaults.length > 0 
      ? maxVaults.reduce((sum, v) => sum + parseFloat(v.apy), 0) / maxVaults.length 
      : null;

    // Generate last 6 months based on current date
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    // For testnet: only show data for current month (when we have live data)
    // Historical months return null to indicate no verified historical data exists
    return months.map((month, i) => ({
      date: month,
      stable: i === months.length - 1 ? (avgStable !== null ? parseFloat(avgStable.toFixed(1)) : null) : null,
      high: i === months.length - 1 ? (avgHigh !== null ? parseFloat(avgHigh.toFixed(1)) : null) : null,
      maximum: i === months.length - 1 ? (avgMax !== null ? parseFloat(avgMax.toFixed(1)) : null) : null,
    }));
  }

  async getTvlHistory(days: number = 180): Promise<Array<{ date: string; value: number | null }>> {
    const allVaults = await this.getVaults();
    const totalTvl = allVaults.reduce((sum, v) => sum + parseFloat(v.tvl), 0);
    
    // Generate last 6 months based on current date
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }

    // For testnet: only show data for current month (when we have live data)
    // Historical months return null to indicate no verified historical data exists
    return months.map((month, i) => ({
      date: month,
      value: i === months.length - 1 ? Math.round(totalTvl) : null,
    }));
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

  async getStuckBridgesForMetrics(minutesThreshold: number = 30): Promise<SelectXrpToFxrpBridge[]> {
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);
    
    // Terminal statuses that should NOT be considered stuck
    const terminalStatuses = ['completed', 'vault_minted', 'cancelled', 'failed', 'vault_mint_failed'];
    
    // Get all bridges older than threshold with non-terminal status
    const allBridges = await db.query.xrpToFxrpBridges.findMany({
      where: sql`${xrpToFxrpBridges.createdAt} < ${thresholdDate}`,
      orderBy: desc(xrpToFxrpBridges.createdAt),
    });
    
    // Filter out terminal statuses
    return allBridges.filter(bridge => !terminalStatuses.includes(bridge.status));
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
    const bridge = await this.getBridgeById(id);
    const previousStatus = bridge?.status;
    
    await db.update(xrpToFxrpBridges)
      .set(updates)
      .where(eq(xrpToFxrpBridges.id, id));

    if (updates.status === "vault_minted" && previousStatus !== "vault_minted" && bridge) {
      const xrpAmount = parseFloat(bridge.xrpAmount);
      await this.createUserNotification({
        walletAddress: bridge.walletAddress,
        type: "deposit",
        title: "Deposit Complete",
        message: `Your deposit of ${xrpAmount.toFixed(2)} XRP has been completed. Vault shares have been minted to your wallet.`,
        metadata: { xrpAmount, bridgeId: id, vaultId: bridge.vaultId },
        relatedTxHash: bridge.vaultMintTxHash || updates.vaultMintTxHash || undefined,
        relatedVaultId: bridge.vaultId,
        read: false,
      });
    }
  }

  async updateBridgeStatus(id: string, status: string, updates: Partial<SelectXrpToFxrpBridge>): Promise<void> {
    const bridge = await this.getBridgeById(id);
    const previousStatus = bridge?.status;
    
    await db.update(xrpToFxrpBridges)
      .set({ status: status as any, ...updates, completedAt: status === 'completed' ? new Date() : undefined })
      .where(eq(xrpToFxrpBridges.id, id));

    if (status === "vault_minted" && previousStatus !== "vault_minted" && bridge) {
      const xrpAmount = parseFloat(bridge.xrpAmount);
      await this.createUserNotification({
        walletAddress: bridge.walletAddress,
        type: "deposit",
        title: "Deposit Complete",
        message: `Your deposit of ${xrpAmount.toFixed(2)} XRP has been completed. Vault shares have been minted to your wallet.`,
        metadata: { xrpAmount, bridgeId: id, vaultId: bridge.vaultId },
        relatedTxHash: bridge.vaultMintTxHash || updates.vaultMintTxHash || undefined,
        relatedVaultId: bridge.vaultId,
        read: false,
      });
    }
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
    const redemption = await this.getRedemptionById(id);
    const previousUserStatus = redemption?.userStatus;
    
    await db.update(fxrpToXrpRedemptions)
      .set(updates)
      .where(eq(fxrpToXrpRedemptions.id, id));

    if (updates.userStatus === "completed" && previousUserStatus !== "completed" && redemption) {
      const xrpAmountStr = updates.xrpSent || redemption.xrpSent || updates.fxrpRedeemed || redemption.fxrpRedeemed || redemption.shareAmount;
      const xrpAmount = xrpAmountStr ? parseFloat(xrpAmountStr) : 0;
      const txHash = updates.xrplPayoutTxHash || redemption.xrplPayoutTxHash;
      
      if (!isNaN(xrpAmount) && xrpAmount > 0) {
        await this.createUserNotification({
          walletAddress: redemption.walletAddress,
          type: "withdrawal",
          title: "Withdrawal Complete",
          message: `Your withdrawal of ${xrpAmount.toFixed(2)} XRP has been completed and sent to your XRPL wallet.`,
          metadata: { xrpAmount, redemptionId: id },
          relatedTxHash: txHash || undefined,
          read: false,
        });
      }
    }
  }

  async updateRedemptionStatus(id: string, status: string, updates: Partial<SelectFxrpToXrpRedemption>): Promise<void> {
    const redemption = await this.getRedemptionById(id);
    const previousUserStatus = redemption?.userStatus;
    
    await db.update(fxrpToXrpRedemptions)
      .set({ status: status as any, ...updates, completedAt: status === 'completed' ? new Date() : undefined })
      .where(eq(fxrpToXrpRedemptions.id, id));

    if (updates.userStatus === "completed" && previousUserStatus !== "completed" && redemption) {
      const xrpAmountStr = updates.xrpSent || redemption.xrpSent || updates.fxrpRedeemed || redemption.fxrpRedeemed || redemption.shareAmount;
      const xrpAmount = xrpAmountStr ? parseFloat(xrpAmountStr) : 0;
      const txHash = updates.xrplPayoutTxHash || redemption.xrplPayoutTxHash;
      
      if (!isNaN(xrpAmount) && xrpAmount > 0) {
        await this.createUserNotification({
          walletAddress: redemption.walletAddress,
          type: "withdrawal",
          title: "Withdrawal Complete",
          message: `Your withdrawal of ${xrpAmount.toFixed(2)} XRP has been completed and sent to your XRPL wallet.`,
          metadata: { xrpAmount, redemptionId: id },
          relatedTxHash: txHash || undefined,
          read: false,
        });
      }
    }
  }

  async getAllPendingRedemptions(): Promise<SelectFxrpToXrpRedemption[]> {
    return db.query.fxrpToXrpRedemptions.findMany({
      where: eq(fxrpToXrpRedemptions.status, "awaiting_proof"),
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });
  }

  async getStuckRedemptionsForMetrics(minutesThreshold: number = 30): Promise<SelectFxrpToXrpRedemption[]> {
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);
    
    // Terminal statuses that should NOT be considered stuck
    const terminalStatuses = ['completed', 'failed'];
    
    // Get all redemptions older than threshold with non-terminal status
    const allRedemptions = await db.query.fxrpToXrpRedemptions.findMany({
      where: sql`${fxrpToXrpRedemptions.createdAt} < ${thresholdDate}`,
      orderBy: desc(fxrpToXrpRedemptions.createdAt),
    });
    
    // Filter out terminal statuses
    return allRedemptions.filter(redemption => !terminalStatuses.includes(redemption.status));
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

  async getRedemptionsWithPendingPayouts(): Promise<SelectFxrpToXrpRedemption[]> {
    // Query redemptions with:
    // - xrplPayoutTxHash IS NOT NULL (payout was initiated)
    // - userStatus != 'completed' (user-facing status not yet complete)
    // These are withdrawals where XRP may have arrived but userStatus wasn't updated
    return db.query.fxrpToXrpRedemptions.findMany({
      where: and(
        sql`${fxrpToXrpRedemptions.xrplPayoutTxHash} IS NOT NULL`,
        sql`${fxrpToXrpRedemptions.userStatus} != 'completed'`
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

  async getStakeInfo(walletAddress: string): Promise<StakingPosition | null> {
    const position = await db.query.stakingPositions.findFirst({
      where: eq(stakingPositions.walletAddress, walletAddress)
    });
    return position || null;
  }

  async recordStake(walletAddress: string, amount: string, stakedAt: string, unlockTime: string): Promise<void> {
    // Use upsert pattern: insert new stake or update existing stake
    await db.insert(stakingPositions)
      .values({
        walletAddress,
        amount,
        stakedAt,
        unlockTime
      })
      .onConflictDoUpdate({
        target: stakingPositions.walletAddress,
        set: {
          amount,
          stakedAt,
          unlockTime
        }
      });
  }

  async recordUnstake(walletAddress: string, amount: string): Promise<void> {
    // Get current staking position
    const currentPosition = await this.getStakeInfo(walletAddress);
    if (!currentPosition) {
      throw new Error("No staking position found");
    }

    // Calculate new amount (subtract unstake amount from current)
    const currentAmount = BigInt(currentPosition.amount);
    const unstakeAmount = BigInt(amount);
    const newAmount = currentAmount - unstakeAmount;

    if (newAmount < BigInt(0)) {
      throw new Error("Unstake amount exceeds staked balance");
    }

    if (newAmount === BigInt(0)) {
      // Delete the position if fully unstaked
      await db.delete(stakingPositions)
        .where(eq(stakingPositions.walletAddress, walletAddress));
    } else {
      // Update the position with reduced amount
      await db.update(stakingPositions)
        .set({ amount: newAmount.toString() })
        .where(eq(stakingPositions.walletAddress, walletAddress));
    }
  }

  // Dashboard snapshot methods
  async createDashboardSnapshot(snapshot: InsertDashboardSnapshot): Promise<DashboardSnapshot> {
    const [created] = await db.insert(dashboardSnapshots).values(snapshot).returning();
    return created;
  }

  async getDashboardSnapshots(walletAddress: string, fromDate: Date, toDate: Date): Promise<DashboardSnapshot[]> {
    return db.select()
      .from(dashboardSnapshots)
      .where(
        and(
          eq(dashboardSnapshots.walletAddress, walletAddress),
          gte(dashboardSnapshots.snapshotDate, fromDate),
          lte(dashboardSnapshots.snapshotDate, toDate)
        )
      )
      .orderBy(asc(dashboardSnapshots.snapshotDate));
  }

  async getLatestDashboardSnapshot(walletAddress: string): Promise<DashboardSnapshot | undefined> {
    const results = await db.select()
      .from(dashboardSnapshots)
      .where(eq(dashboardSnapshots.walletAddress, walletAddress))
      .orderBy(desc(dashboardSnapshots.snapshotDate))
      .limit(1);
    return results[0];
  }

  // User notification methods
  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [created] = await db.insert(userNotifications).values(notification).returning();
    return created;
  }

  async getUserNotifications(walletAddress: string, limit: number = 50, unreadOnly: boolean = false): Promise<UserNotification[]> {
    const conditions = [eq(userNotifications.walletAddress, walletAddress)];
    if (unreadOnly) {
      conditions.push(eq(userNotifications.read, false));
    }
    return db.select()
      .from(userNotifications)
      .where(and(...conditions))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(walletAddress: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.walletAddress, walletAddress),
          eq(userNotifications.read, false)
        )
      );
    return result[0]?.count ?? 0;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db.update(userNotifications)
      .set({ read: true, readAt: new Date() })
      .where(eq(userNotifications.id, id));
  }

  async markAllNotificationsAsRead(walletAddress: string): Promise<void> {
    await db.update(userNotifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.walletAddress, walletAddress),
          eq(userNotifications.read, false)
        )
      );
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(userNotifications)
      .where(eq(userNotifications.id, id));
  }
}

export const storage = new DatabaseStorage();
