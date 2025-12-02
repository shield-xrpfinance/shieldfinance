import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, pgEnum, boolean, unique, jsonb } from "drizzle-orm/pg-core";
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
  "xrpl_received",        // USER SUCCESS: XRP received in wallet (terminal from user perspective)
  "completed",            // XRP successfully sent to depositor
  "awaiting_liquidity",   // Queued - not enough FXRP in vault
  "failed"                // Redemption failed
]);

// User-facing status for withdrawals (what users see in UI)
export const userStatusEnum = pgEnum("user_status", [
  "processing",           // Withdrawal in progress
  "completed",            // User successfully received XRP
  "failed"                // Withdrawal failed before XRP was sent
]);

// Backend reconciliation status (internal tracking)
export const backendStatusEnum = pgEnum("backend_status", [
  "not_started",          // Backend confirmation not yet needed
  "confirming",           // Actively confirming redemption payment on-chain
  "retry_pending",        // Waiting to retry confirmation
  "retrying",             // Retrying confirmation after failure
  "confirmed",            // Successfully confirmed on FAssets contract
  "manual_review",        // Needs manual intervention
  "abandoned"             // Gave up after max retries (user still has XRP)
]);

// Asset type enum for categorizing vaults
export const assetTypeEnum = pgEnum("asset_type", [
  "crypto",               // Cryptocurrency assets (XRP, FXRP, stablecoins)
  "rwa",                  // Real World Assets (real estate, commodities, bonds)
  "tokenized_security"    // Tokenized securities (stocks, funds, ETFs)
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
  comingSoon: boolean("coming_soon").notNull().default(false),
  
  // Asset categorization for RWA and tokenized products
  assetType: assetTypeEnum("asset_type").notNull().default("crypto"),
  
  // Compliance fields for RWA and tokenized securities
  kycRequired: boolean("kyc_required").notNull().default(false),
  accreditationRequired: boolean("accreditation_required").notNull().default(false),
  jurisdiction: text("jurisdiction"), // e.g., "US", "EU", "UAE", "Global"
  underlyingInstrument: text("underlying_instrument"), // e.g., "US Treasury Bonds", "S&P 500 ETF"
  currencyDenomination: text("currency_denomination"), // e.g., "USD", "EUR" for RWAs
  
  // Documentation and disclosures
  prospectusUrl: text("prospectus_url"), // Link to prospectus/offering document
  riskDisclosure: text("risk_disclosure"), // Specific risk disclosure text
  custodian: text("custodian"), // Name of custodian for RWAs
  valuationFrequency: text("valuation_frequency"), // e.g., "daily", "weekly", "monthly"
  
  // Minimum investment requirements (in USD equivalent)
  minInvestmentUsd: decimal("min_investment_usd", { precision: 18, scale: 2 }),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address").notNull(),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id, { onDelete: "cascade" }),
  amount: varchar("amount").notNull(), // Changed from decimal(18,2) to varchar for precision safety
  rewards: varchar("rewards").notNull().default("0"),
  status: varchar("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueWalletVault: unique().on(table.walletAddress, table.vaultId),
  statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_positions_status ON ${table} (status)`,
}));

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address").notNull(),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  positionId: varchar("position_id").references(() => positions.id),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  rewards: decimal("rewards", { precision: 18, scale: 2 }).default("0"),
  status: text("status").notNull().default("completed"),
  txHash: text("tx_hash"),
  network: text("network").notNull().default("mainnet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_transactions_status ON ${table} (status)`,
}));

export const vaultMetricsDaily = pgTable("vault_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  date: timestamp("date").notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }).notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  stakers: integer("stakers").notNull(),
  rewardsAccrued: decimal("rewards_accrued", { precision: 18, scale: 2 }).notNull(),
}, (table) => ({
  uniqueVaultDate: unique().on(table.vaultId, table.date),
  dateIdx: sql`CREATE INDEX IF NOT EXISTS idx_vault_metrics_daily_date ON ${table} (date DESC)`,
}));

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
  fxrpMintTxHash: text("fxrp_mint_tx_hash").default(sql`NULL`), // FAssets mint transaction (FXRP Transfer event)
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
  paymentConfirmedAt: timestamp("payment_confirmed_at").default(sql`NULL`), // When XRPL payment was validated and FXRP mint triggered
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
  lastError: text("last_error").default(sql`NULL`), // Latest error encountered (for watchdog/retry debugging)
  retryCount: integer("retry_count").notNull().default(0),
}, (table) => ({
  statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_bridges_status ON ${table} (status)`,
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_bridges_created_at ON ${table} (created_at DESC)`,
  walletIdx: sql`CREATE INDEX IF NOT EXISTS idx_bridges_wallet ON ${table} (wallet_address)`,
}));

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
  
  // Status machine (legacy - kept for backward compatibility)
  status: redemptionStatusEnum("status").notNull().default("pending"),
  
  // Dual-status model: separate user-facing vs backend reconciliation
  userStatus: userStatusEnum("user_status").notNull().default("processing"),
  backendStatus: backendStatusEnum("backend_status").notNull().default("not_started"),
  backendError: text("backend_error"), // Backend reconciliation error details
  
  // Transaction hashes
  vaultRedeemTxHash: text("vault_redeem_tx_hash"), // Flare TX: ERC-4626 redeem()
  fassetsRedemptionTxHash: text("fassets_redemption_tx_hash"), // Flare TX: FAssets redemption request
  xrplPayoutTxHash: text("xrpl_payout_tx_hash"), // XRPL TX: Payment to depositor
  
  // FAssets redemption details (mirroring bridge fields)
  redemptionRequestId: varchar("redemption_request_id"),
  agentVaultAddress: varchar("agent_vault_address"), // Agent's Flare contract address
  agentUnderlyingAddress: varchar("agent_underlying_address"), // Agent's XRPL address (payment source)
  expectedXrpDrops: varchar("expected_xrp_drops"), // Expected XRP amount in drops for matching
  confirmationTxHash: varchar("confirmation_tx_hash").default(sql`NULL`), // Flare TX: Confirmation of redemption payment
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
  lastError: text("last_error").default(sql`NULL`), // Latest error encountered (for retry debugging)
  retryCount: integer("retry_count").notNull().default(0),
  lastRetryAt: timestamp("last_retry_at").default(sql`NULL`), // When last retry was attempted
  
  // Auto-prefund tracking (for low balance remediation)
  lastFundingTxHash: varchar("last_funding_tx_hash").default(sql`NULL`), // Operator EOA → Smart Account prefund tx
  fundingAttempts: integer("funding_attempts").notNull().default(0), // Number of times we've auto-prefunded this redemption
}, (table) => ({
  statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_redemptions_status ON ${table} (status)`,
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_redemptions_created_at ON ${table} (created_at DESC)`,
  walletIdx: sql`CREATE INDEX IF NOT EXISTS idx_redemptions_wallet ON ${table} (wallet_address)`,
  userStatusIdx: sql`CREATE INDEX IF NOT EXISTS idx_redemptions_user_status ON ${table} (user_status)`,
}));

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

// Service state table for persistent watchdog/service configuration
export const serviceState = pgTable("service_state", {
  key: text("key").primaryKey(), // e.g., "deposit_watchdog_last_block"
  value: text("value").notNull(), // JSON-stringified value
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// SHIELD Staking positions for APY boost
export const stakingPositions = pgTable("staking_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address").notNull().unique(),
  amount: varchar("amount").notNull(), // wei format (18 decimals)
  stakedAt: varchar("staked_at").notNull(), // timestamp in seconds
  unlockTime: varchar("unlock_time").notNull(), // timestamp in seconds
});

// On-chain events table for OpenZeppelin Monitor-style blockchain monitoring
export const onChainEvents = pgTable("on_chain_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  contractName: text("contract_name").notNull(),
  contractAddress: text("contract_address").notNull(),
  eventName: text("event_name").notNull(),
  severity: text("severity").notNull(), // 'info' | 'warning' | 'critical'
  blockNumber: integer("block_number").notNull(),
  transactionHash: text("transaction_hash").notNull(),
  logIndex: integer("log_index").notNull(),
  args: jsonb("args").notNull(), // Event arguments as JSON
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  notified: boolean("notified").notNull().default(false),
});

// Dashboard portfolio snapshots for historical charts
export const dashboardSnapshots = pgTable("dashboard_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: varchar("wallet_address").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(), // Date of the snapshot (daily granularity)
  
  // Portfolio value breakdown (all in USD)
  totalValueUsd: decimal("total_value_usd", { precision: 18, scale: 2 }).notNull(),
  stakedValueUsd: decimal("staked_value_usd", { precision: 18, scale: 2 }).notNull(),
  shieldStakedValueUsd: decimal("shield_staked_value_usd", { precision: 18, scale: 2 }).notNull(),
  rewardsValueUsd: decimal("rewards_value_usd", { precision: 18, scale: 2 }).notNull(),
  
  // Breakdown by asset (JSON object with asset -> USD value mapping)
  assetBreakdown: jsonb("asset_breakdown").notNull().default({}),
  
  // APY and boost metrics at snapshot time
  effectiveApy: decimal("effective_apy", { precision: 5, scale: 2 }).notNull(),
  baseApy: decimal("base_apy", { precision: 5, scale: 2 }).notNull(),
  boostPercentage: decimal("boost_percentage", { precision: 5, scale: 2 }).notNull().default("0"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  walletDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_wallet_date ON ${table} (wallet_address, snapshot_date DESC)`,
  snapshotDateIdx: sql`CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_date ON ${table} (snapshot_date DESC)`,
}));

// User notifications for persistent notification center
export const userNotifications = pgTable("user_notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  walletAddress: varchar("wallet_address").notNull(),
  
  // Notification content
  type: text("type").notNull(), // 'deposit' | 'withdrawal' | 'reward' | 'boost' | 'system' | 'vault_event'
  title: text("title").notNull(),
  message: text("message").notNull(),
  
  // Related entity (optional)
  relatedTxHash: text("related_tx_hash"),
  relatedVaultId: varchar("related_vault_id"),
  relatedPositionId: varchar("related_position_id"),
  
  // Metadata for rich notifications (JSON with amounts, percentages, etc.)
  metadata: jsonb("metadata").default({}),
  
  // Read/unread state
  read: boolean("read").notNull().default(false),
  readAt: timestamp("read_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  walletIdx: sql`CREATE INDEX IF NOT EXISTS idx_user_notifications_wallet ON ${table} (wallet_address)`,
  walletUnreadIdx: sql`CREATE INDEX IF NOT EXISTS idx_user_notifications_wallet_unread ON ${table} (wallet_address, read)`,
  createdAtIdx: sql`CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON ${table} (created_at DESC)`,
}));

// User settings for preferences and multi-wallet support
export const userSettings = pgTable("user_settings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  theme: text("theme").default("light"),
  defaultNetwork: text("default_network"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User wallets for multi-wallet support (EVM + XRPL)
export const userWallets = pgTable("user_wallets", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userSettingsId: text("user_settings_id").notNull().references(() => userSettings.id, { onDelete: "cascade" }),
  walletType: text("wallet_type").notNull(), // "evm" | "xrpl"
  address: text("address").notNull(),
  label: text("label"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueWalletAddress: unique().on(table.userSettingsId, table.walletType, table.address),
}));

// User-enabled networks for bridge/multi-chain preferences
export const userEnabledNetworks = pgTable("user_enabled_networks", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userSettingsId: text("user_settings_id").notNull().references(() => userSettings.id, { onDelete: "cascade" }),
  networkId: text("network_id").notNull(), // e.g., "flare", "ethereum", "xrpl"
  enabled: boolean("enabled").default(true),
  customRpcUrl: text("custom_rpc_url"),
}, (table) => ({
  uniqueUserNetwork: unique().on(table.userSettingsId, table.networkId),
}));

// User-enabled tokens per network
export const userEnabledTokens = pgTable("user_enabled_tokens", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userSettingsId: text("user_settings_id").notNull().references(() => userSettings.id, { onDelete: "cascade" }),
  networkId: text("network_id").notNull(),
  tokenId: text("token_id").notNull(), // e.g., "FXRP", "USDC"
  enabled: boolean("enabled").default(true),
}, (table) => ({
  uniqueUserNetworkToken: unique().on(table.userSettingsId, table.networkId, table.tokenId),
}));

// =============================================================================
// CROSS-CHAIN BRIDGE TABLES (Multi-leg bridging via LayerZero/Stargate/FAssets)
// =============================================================================

// Status enum for cross-chain bridge jobs
export const crossChainBridgeJobStatusEnum = pgEnum("cross_chain_bridge_job_status", [
  "pending",           // Job created, awaiting quote confirmation
  "quoted",            // Quote received, awaiting user confirmation
  "confirmed",         // User confirmed, bridge in progress
  "executing",         // Legs are being executed
  "awaiting_source",   // Waiting for source chain confirmation
  "awaiting_dest",     // Waiting for destination chain confirmation
  "completed",         // All legs completed successfully
  "partially_failed",  // Some legs failed, refund in progress
  "failed",            // Bridge failed
  "cancelled",         // Cancelled by user
  "refunded"           // Refund completed after failure
]);

// Status enum for individual bridge legs
export const crossChainBridgeLegStatusEnum = pgEnum("cross_chain_bridge_leg_status", [
  "pending",           // Leg not started
  "executing",         // Transaction submitted
  "awaiting_confirm",  // Waiting for source chain confirmation
  "bridging",          // Cross-chain message in transit
  "awaiting_dest",     // Waiting for destination chain confirmation
  "completed",         // Leg completed successfully
  "failed",            // Leg failed
  "refunded"           // Refund completed
]);

// Protocol enum for bridge legs
export const bridgeProtocolEnum = pgEnum("bridge_protocol", [
  "layerzero",         // LayerZero OFT v2
  "stargate",          // Stargate stablecoin pools
  "fassets",           // FAssets XRP ↔ FXRP
  "native",            // Native transfers (no bridge needed)
  "swap"               // DEX swap (same chain)
]);

// Main cross-chain bridge job table
export const crossChainBridgeJobs = pgTable("cross_chain_bridge_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User identification
  walletAddress: text("wallet_address").notNull(),
  
  // Source chain and token
  sourceNetwork: text("source_network").notNull(), // e.g., "ethereum", "xrpl"
  sourceToken: text("source_token").notNull(),     // e.g., "ETH", "XRP"
  sourceAmount: decimal("source_amount", { precision: 36, scale: 18 }).notNull(),
  
  // Destination chain and token
  destNetwork: text("dest_network").notNull(),     // e.g., "flare", "arbitrum"
  destToken: text("dest_token").notNull(),         // e.g., "FXRP", "USDC"
  destAmount: decimal("dest_amount", { precision: 36, scale: 18 }), // Expected output
  destAmountReceived: decimal("dest_amount_received", { precision: 36, scale: 18 }), // Actual received
  
  // Recipient address (may differ from wallet for cross-ecosystem)
  recipientAddress: text("recipient_address").notNull(),
  
  // Route information
  route: jsonb("route"), // Array of leg descriptions: [{from, to, protocol, token}]
  totalLegs: integer("total_legs").notNull().default(1),
  currentLeg: integer("current_leg").notNull().default(0),
  
  // Quote and fee information
  quoteId: varchar("quote_id").references(() => crossChainBridgeQuotes.id),
  totalFeeUsd: decimal("total_fee_usd", { precision: 18, scale: 6 }),
  estimatedTimeMinutes: integer("estimated_time_minutes"),
  slippageToleranceBps: integer("slippage_tolerance_bps").default(50), // 0.5% default
  
  // Status tracking
  status: crossChainBridgeJobStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  quotedAt: timestamp("quoted_at"),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // Quote expiry
  
}, (table) => ({
  walletIdx: sql`CREATE INDEX IF NOT EXISTS idx_ccb_jobs_wallet ON ${table} (wallet_address)`,
  statusIdx: sql`CREATE INDEX IF NOT EXISTS idx_ccb_jobs_status ON ${table} (status)`,
}));

// Individual legs of a cross-chain bridge
export const crossChainBridgeLegs = pgTable("cross_chain_bridge_legs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Parent job reference
  jobId: varchar("job_id").notNull().references(() => crossChainBridgeJobs.id, { onDelete: "cascade" }),
  legIndex: integer("leg_index").notNull(), // 0-indexed order
  
  // Source and destination for this leg
  fromNetwork: text("from_network").notNull(),
  fromToken: text("from_token").notNull(),
  fromAmount: decimal("from_amount", { precision: 36, scale: 18 }).notNull(),
  
  toNetwork: text("to_network").notNull(),
  toToken: text("to_token").notNull(),
  toAmountExpected: decimal("to_amount_expected", { precision: 36, scale: 18 }),
  toAmountReceived: decimal("to_amount_received", { precision: 36, scale: 18 }),
  
  // Protocol and contract details
  protocol: bridgeProtocolEnum("protocol").notNull(),
  routerAddress: text("router_address"),
  
  // Transaction hashes (may have multiple per leg for different chains)
  sourceTxHash: text("source_tx_hash"),
  bridgeTxHash: text("bridge_tx_hash"), // LayerZero/Stargate message hash
  destTxHash: text("dest_tx_hash"),
  
  // FAssets-specific fields (for XRPL legs)
  collateralReservationId: text("collateral_reservation_id"),
  paymentReference: text("payment_reference"),
  agentAddress: text("agent_address"),
  
  // Fee tracking
  gasFeeSourceUsd: decimal("gas_fee_source_usd", { precision: 18, scale: 6 }),
  gasFeeDestUsd: decimal("gas_fee_dest_usd", { precision: 18, scale: 6 }),
  bridgeFeeUsd: decimal("bridge_fee_usd", { precision: 18, scale: 6 }),
  
  // Status
  status: crossChainBridgeLegStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
}, (table) => ({
  jobIdx: sql`CREATE INDEX IF NOT EXISTS idx_ccb_legs_job ON ${table} (job_id)`,
  uniqueLegOrder: unique().on(table.jobId, table.legIndex),
}));

// Bridge quotes cache
export const crossChainBridgeQuotes = pgTable("cross_chain_bridge_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Route specification
  sourceNetwork: text("source_network").notNull(),
  sourceToken: text("source_token").notNull(),
  sourceAmount: decimal("source_amount", { precision: 36, scale: 18 }).notNull(),
  destNetwork: text("dest_network").notNull(),
  destToken: text("dest_token").notNull(),
  
  // Quote results
  destAmountEstimate: decimal("dest_amount_estimate", { precision: 36, scale: 18 }).notNull(),
  route: jsonb("route").notNull(), // Array of legs with protocol info
  
  // Fee breakdown
  totalFeeUsd: decimal("total_fee_usd", { precision: 18, scale: 6 }).notNull(),
  gasFeeUsd: decimal("gas_fee_usd", { precision: 18, scale: 6 }),
  bridgeFeeUsd: decimal("bridge_fee_usd", { precision: 18, scale: 6 }),
  slippageUsd: decimal("slippage_usd", { precision: 18, scale: 6 }),
  
  // Time estimates
  estimatedTimeMinutes: integer("estimated_time_minutes").notNull(),
  
  // Validity
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Usually 5 minutes
  
  // Pricing data snapshot
  priceData: jsonb("price_data"), // Token prices at quote time
});

export const insertVaultSchema = createInsertSchema(vaults).omit({
  id: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
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

export const insertServiceStateSchema = createInsertSchema(serviceState).omit({
  updatedAt: true,
});

export const insertStakingPositionSchema = createInsertSchema(stakingPositions).omit({
  id: true,
});

export const insertDashboardSnapshotSchema = createInsertSchema(dashboardSnapshots).omit({
  createdAt: true,
});

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  createdAt: true,
  readAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserWalletSchema = createInsertSchema(userWallets).omit({
  id: true,
  createdAt: true,
});

export const insertUserEnabledNetworkSchema = createInsertSchema(userEnabledNetworks).omit({
  id: true,
});

export const insertUserEnabledTokenSchema = createInsertSchema(userEnabledTokens).omit({
  id: true,
});

export const insertCrossChainBridgeJobSchema = createInsertSchema(crossChainBridgeJobs).omit({
  id: true,
  createdAt: true,
});

export const insertCrossChainBridgeLegSchema = createInsertSchema(crossChainBridgeLegs).omit({
  id: true,
  createdAt: true,
});

export const insertCrossChainBridgeQuoteSchema = createInsertSchema(crossChainBridgeQuotes).omit({
  id: true,
  createdAt: true,
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
export type InsertServiceState = z.infer<typeof insertServiceStateSchema>;
export type ServiceState = typeof serviceState.$inferSelect;
export type InsertStakingPosition = z.infer<typeof insertStakingPositionSchema>;
export type StakingPosition = typeof stakingPositions.$inferSelect;
export type OnChainEvent = typeof onChainEvents.$inferSelect;
export type InsertDashboardSnapshot = z.infer<typeof insertDashboardSnapshotSchema>;
export type DashboardSnapshot = typeof dashboardSnapshots.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type UserWallet = typeof userWallets.$inferSelect;
export type InsertUserEnabledNetwork = z.infer<typeof insertUserEnabledNetworkSchema>;
export type UserEnabledNetwork = typeof userEnabledNetworks.$inferSelect;
export type InsertUserEnabledToken = z.infer<typeof insertUserEnabledTokenSchema>;
export type UserEnabledToken = typeof userEnabledTokens.$inferSelect;
export type InsertCrossChainBridgeJob = z.infer<typeof insertCrossChainBridgeJobSchema>;
export type CrossChainBridgeJob = typeof crossChainBridgeJobs.$inferSelect;
export type InsertCrossChainBridgeLeg = z.infer<typeof insertCrossChainBridgeLegSchema>;
export type CrossChainBridgeLeg = typeof crossChainBridgeLegs.$inferSelect;
export type InsertCrossChainBridgeQuote = z.infer<typeof insertCrossChainBridgeQuoteSchema>;
export type CrossChainBridgeQuote = typeof crossChainBridgeQuotes.$inferSelect;

// Notification type enum for type safety
export type NotificationType = 'deposit' | 'withdrawal' | 'reward' | 'boost' | 'system' | 'vault_event';

// Dashboard summary response type (for API)
export interface DashboardSummary {
  totalValueUsd: number;
  stakedValueUsd: number;
  shieldStakedValueUsd: number;
  rewardsValueUsd: number;
  effectiveApy: number;
  baseApy: number;
  boostPercentage: number;
  positionCount: number;
  assetBreakdown: Record<string, number>;
}

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
