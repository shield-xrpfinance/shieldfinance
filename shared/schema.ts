import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vaults = pgTable("vaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  asset: text("asset").notNull().default("XRP"),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }).notNull(),
  liquidity: decimal("liquidity", { precision: 18, scale: 2 }).notNull(),
  lockPeriod: integer("lock_period").notNull(),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull().default("active"),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  rewards: decimal("rewards", { precision: 18, scale: 2 }).notNull().default("0"),
  depositedAt: timestamp("deposited_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  positionId: varchar("position_id").references(() => positions.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  rewards: decimal("rewards", { precision: 18, scale: 2 }).default("0"),
  status: text("status").notNull().default("completed"),
  txHash: text("tx_hash"),
  network: text("network").notNull().default("mainnet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vaultMetricsDaily = pgTable("vault_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  date: timestamp("date").notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }).notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  stakers: integer("stakers").notNull(),
  rewardsAccrued: decimal("rewards_accrued", { precision: 18, scale: 2 }).notNull(),
});

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull(),
  positionId: varchar("position_id").references(() => positions.id),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  asset: text("asset").notNull(),
  status: text("status").notNull().default("pending"),
  network: text("network").notNull().default("mainnet"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  txHash: text("tx_hash"),
  rejectionReason: text("rejection_reason"),
});

export const insertVaultSchema = createInsertSchema(vaults).omit({
  id: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  depositedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertVaultMetricsSchema = createInsertSchema(vaultMetricsDaily).omit({
  id: true,
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  requestedAt: true,
});

export type InsertVault = z.infer<typeof insertVaultSchema>;
export type Vault = typeof vaults.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertVaultMetrics = z.infer<typeof insertVaultMetricsSchema>;
export type VaultMetrics = typeof vaultMetricsDaily.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
