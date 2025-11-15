import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Bridge status enum for XRP → FXRP bridges
export const bridgeStatusEnum = pgEnum("bridge_status", [
  "pending",
  "reserving_collateral",
  "bridging", 
  "awaiting_payment",
  "xrpl_confirmed",
  "generating_proof",
  "fdc_timeout",
  "proof_generated",
  "fdc_proof_generated",
  "minting",
  "vault_minting",
  "vault_minted",
  "completed",
  "vault_mint_failed",
  "cancelled",
  "failed"
]);

// Redemption status enum for FXRP → XRP redemptions (withdrawal flow)
export const redemptionStatusEnum = pgEnum("redemption_status", [
  "pending",              // Withdrawal request created
  "redeeming_shares",     // Burning shXRP shares via ERC-4626 redeem()
  "redeemed_fxrp",        // FXRP recovered from vault
  "redeeming_fxrp",       // FAssets redemption in progress
  "awaiting_proof",       // Waiting for FDC attestation proof
  "xrpl_payout",          // Sending XRP to depositor's wallet
  "completed",            // XRP successfully sent to depositor
  "awaiting_liquidity",   // Queued - not enough FXRP in vault
  "failed"                // Redemption failed
]);

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
  requestedXrpAmount: decimal("requested_xrp_amount", { precision: 18, scale: 6 }), // User's original input before lot rounding
  fxrpExpected: decimal("fxrp_expected", { precision: 18, scale: 6 }).notNull(),
  fxrpReceived: decimal("fxrp_received", { precision: 18, scale: 6 }),
  
  status: bridgeStatusEnum("status").notNull().default("pending"),
  
  xrplTxHash: text("xrpl_tx_hash"),
  flareTxHash: text("flare_tx_hash"),
  vaultMintTxHash: text("vault_mint_tx_hash"),
  
  collateralReservationId: varchar("collateral_reservation_id"),
  paymentReference: varchar("payment_reference"),
  agentVaultAddress: varchar("agent_vault_address"),
  agentUnderlyingAddress: varchar("agent_underlying_address"),
  mintingFeeBIPS: varchar("minting_fee_bips"),
  reservedValueUBA: varchar("reserved_value_uba"),
  reservedFeeUBA: varchar("reserved_fee_uba"),
  totalAmountUBA: varchar("total_amount_uba"),
  reservationTxHash: varchar("reservation_tx_hash"),
  collateralReservationFeePaid: varchar("collateral_reservation_fee_paid"),
  reservationExpiry: timestamp("reservation_expiry"),
  lastUnderlyingBlock: varchar("last_underlying_block"),
  lastUnderlyingTimestamp: timestamp("last_underlying_timestamp"),
  fdcAttestationTxHash: varchar("fdc_attestation_tx_hash"),
  fdcProofHash: varchar("fdc_proof_hash"),
  fdcVotingRoundId: varchar("fdc_voting_round_id"),
  fdcRequestBytes: text("fdc_request_bytes"),
  fdcProofData: text("fdc_proof_data"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  xrplConfirmedAt: timestamp("xrpl_confirmed_at"),
  bridgeStartedAt: timestamp("bridge_started_at"),
  fxrpReceivedAt: timestamp("fxrp_received_at"),
  completedAt: timestamp("completed_at"),
  
  expiresAt: timestamp("expires_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  failureCode: text("failure_code"),
  receivedAmountDrops: varchar("received_amount_drops"),
  expectedAmountDrops: varchar("expected_amount_drops"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
});

// FXRP → XRP Redemptions (Withdrawal flow)
export const fxrpToXrpRedemptions = pgTable("fxrp_to_xrp_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  positionId: varchar("position_id").notNull().references(() => positions.id),
  walletAddress: text("wallet_address").notNull(), // Original depositor's XRPL wallet
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  
  // Amounts
  shareAmount: decimal("share_amount", { precision: 18, scale: 6 }).notNull(), // shXRP shares to redeem
  fxrpRedeemed: decimal("fxrp_redeemed", { precision: 18, scale: 6 }), // FXRP received from vault
  xrpSent: decimal("xrp_sent", { precision: 18, scale: 6 }), // XRP sent to depositor
  
  // Status machine
  status: redemptionStatusEnum("status").notNull().default("pending"),
  
  // Transaction hashes
  vaultRedeemTxHash: text("vault_redeem_tx_hash"), // Flare TX: ERC-4626 redeem()
  fassetsRedemptionTxHash: text("fassets_redemption_tx_hash"), // Flare TX: FAssets redemption request
  xrplPayoutTxHash: text("xrpl_payout_tx_hash"), // XRPL TX: Payment to depositor
  
  // FAssets redemption details (mirroring bridge fields)
  redemptionRequestId: varchar("redemption_request_id"),
  agentVaultAddress: varchar("agent_vault_address"), // Agent's Flare contract address
  agentUnderlyingAddress: varchar("agent_underlying_address"), // Agent's XRPL address (payment source)
  expectedXrpDrops: varchar("expected_xrp_drops"), // Expected XRP amount in drops for matching
  confirmationTxHash: varchar("confirmation_tx_hash"), // Flare TX: Confirmation of redemption payment
  fdcAttestationTxHash: varchar("fdc_attestation_tx_hash"),
  fdcVotingRoundId: varchar("fdc_voting_round_id"),
  fdcRequestBytes: text("fdc_request_bytes"),
  fdcProofHash: varchar("fdc_proof_hash"),
  fdcProofData: text("fdc_proof_data"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sharesRedeemedAt: timestamp("shares_redeemed_at"),
  fxrpRedeemedAt: timestamp("fxrp_redeemed_at"),
  xrplPayoutAt: timestamp("xrpl_payout_at"),
  completedAt: timestamp("completed_at"),
  
  // Error handling
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
}).extend({
  expiresAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
});

export const insertFxrpToXrpRedemptionSchema = createInsertSchema(fxrpToXrpRedemptions).omit({
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
export type InsertFxrpToXrpRedemption = z.infer<typeof insertFxrpToXrpRedemptionSchema>;
export type SelectFxrpToXrpRedemption = typeof fxrpToXrpRedemptions.$inferSelect;
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

// Unified bridge history entry (deposits + withdrawals)
// Note: Dates are serialized as ISO strings by JSON, not Date objects
export interface BridgeHistoryEntry {
  id: string;
  type: "deposit" | "withdrawal";
  walletAddress: string;
  amount: string; // Always populated, never null
  status: string;
  xrplTxHash: string | null;
  flareTxHash: string | null;
  createdAt: string; // ISO date string
  completedAt: string | null; // ISO date string or null
  errorMessage: string | null;
}
