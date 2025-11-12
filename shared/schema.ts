import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vaults = pgTable("vaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  asset: text("asset").notNull().default("XRP"),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  apyLabel: text("apy_label"),
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

export const escrows = pgTable("escrows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  positionId: varchar("position_id").references(() => positions.id),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  walletAddress: text("wallet_address").notNull(),
  destinationAddress: text("destination_address").notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  asset: text("asset").notNull().default("XRP"),
  status: text("status").notNull().default("pending"),
  network: text("network").notNull().default("mainnet"),
  createTxHash: text("create_tx_hash"),
  finishTxHash: text("finish_tx_hash"),
  cancelTxHash: text("cancel_tx_hash"),
  escrowSequence: integer("escrow_sequence"),
  finishAfter: timestamp("finish_after"),
  cancelAfter: timestamp("cancel_after"),
  condition: text("condition"),
  fulfillment: text("fulfillment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const xrpToFxrpBridges = pgTable("xrp_to_fxrp_bridges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: text("request_id").unique(), // Optional - only for external payment requests (e.g. Xaman)
  walletAddress: text("wallet_address").notNull(),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  positionId: varchar("position_id").references(() => positions.id),
  
  xrpAmount: decimal("xrp_amount", { precision: 18, scale: 6 }).notNull(),
  fxrpExpected: decimal("fxrp_expected", { precision: 18, scale: 6 }).notNull(),
  fxrpReceived: decimal("fxrp_received", { precision: 18, scale: 6 }),
  
  status: text("status").notNull().default("pending"),
  
  xrplTxHash: text("xrpl_tx_hash"),
  flareTxHash: text("flare_tx_hash"),
  vaultMintTxHash: text("vault_mint_tx_hash"),
  
  collateralReservationId: varchar("collateral_reservation_id"),
  agentVaultAddress: varchar("agent_vault_address"),
  agentUnderlyingAddress: varchar("agent_underlying_address"),
  mintingFeeBIPS: varchar("minting_fee_bips"),
  collateralReservationFeePaid: varchar("collateral_reservation_fee_paid"),
  reservationExpiry: timestamp("reservation_expiry"),
  lastUnderlyingBlock: varchar("last_underlying_block"),
  lastUnderlyingTimestamp: timestamp("last_underlying_timestamp"),
  fdcProofHash: varchar("fdc_proof_hash"),
  fdcVotingRoundId: varchar("fdc_voting_round_id"),
  fdcRequestBytes: text("fdc_request_bytes"),
  fdcProofData: text("fdc_proof_data"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  xrplConfirmedAt: timestamp("xrpl_confirmed_at"),
  bridgeStartedAt: timestamp("bridge_started_at"),
  fxrpReceivedAt: timestamp("fxrp_received_at"),
  completedAt: timestamp("completed_at"),
  
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
});

export const firelightPositions = pgTable("firelight_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  
  fxrpDeposited: decimal("fxrp_deposited", { precision: 18, scale: 6 }).notNull(),
  stxrpReceived: decimal("stxrp_received", { precision: 18, scale: 6 }).notNull(),
  currentStxrpBalance: decimal("current_stxrp_balance", { precision: 18, scale: 6 }).notNull(),
  
  yieldAccrued: decimal("yield_accrued", { precision: 18, scale: 6 }).notNull().default("0"),
  lastYieldUpdate: timestamp("last_yield_update").notNull().defaultNow(),
  
  depositedAt: timestamp("deposited_at").notNull().defaultNow(),
  lastCompoundedAt: timestamp("last_compounded_at"),
  
  depositTxHash: text("deposit_tx_hash"),
});

export const compoundingRuns = pgTable("compounding_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  firelightPositionId: varchar("firelight_position_id").references(() => firelightPositions.id),
  
  yieldAmount: decimal("yield_amount", { precision: 18, scale: 6 }).notNull(),
  previousStxrpBalance: decimal("previous_stxrp_balance", { precision: 18, scale: 6 }).notNull(),
  newStxrpBalance: decimal("new_stxrp_balance", { precision: 18, scale: 6 }).notNull(),
  
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  errorMessage: text("error_message"),
  
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
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

export const insertEscrowSchema = createInsertSchema(escrows).omit({
  id: true,
  createdAt: true,
});

export const insertXrpToFxrpBridgeSchema = createInsertSchema(xrpToFxrpBridges).omit({
  id: true,
  createdAt: true,
});

export const insertFirelightPositionSchema = createInsertSchema(firelightPositions).omit({
  id: true,
  depositedAt: true,
  lastYieldUpdate: true,
});

export const insertCompoundingRunSchema = createInsertSchema(compoundingRuns).omit({
  id: true,
  startedAt: true,
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
export type InsertEscrow = z.infer<typeof insertEscrowSchema>;
export type Escrow = typeof escrows.$inferSelect;
export type InsertXrpToFxrpBridge = z.infer<typeof insertXrpToFxrpBridgeSchema>;
export type SelectXrpToFxrpBridge = typeof xrpToFxrpBridges.$inferSelect;
export type InsertFirelightPosition = z.infer<typeof insertFirelightPositionSchema>;
export type SelectFirelightPosition = typeof firelightPositions.$inferSelect;
export type InsertCompoundingRun = z.infer<typeof insertCompoundingRunSchema>;
export type SelectCompoundingRun = typeof compoundingRuns.$inferSelect;

export interface PaymentRequest {
  bridgeId: string;
  destination: string;
  amountDrops: string;
  memo: string;
  network: "mainnet" | "testnet";
}
