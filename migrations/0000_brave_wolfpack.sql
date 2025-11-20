CREATE TYPE "public"."backend_status" AS ENUM('not_started', 'confirming', 'retry_pending', 'retrying', 'confirmed', 'manual_review', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."bridge_status" AS ENUM('pending', 'reserving_collateral', 'bridging', 'awaiting_payment', 'xrpl_confirmed', 'generating_proof', 'fdc_timeout', 'proof_generated', 'fdc_proof_generated', 'minting', 'vault_minting', 'vault_minted', 'completed', 'vault_mint_failed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('pending', 'redeeming_shares', 'redeemed_fxrp', 'redeeming_fxrp', 'awaiting_proof', 'xrpl_payout', 'xrpl_received', 'completed', 'awaiting_liquidity', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "compounding_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" varchar NOT NULL,
	"firelight_position_id" varchar,
	"yield_amount" numeric(18, 6) NOT NULL,
	"previous_stxrp_balance" numeric(18, 6) NOT NULL,
	"new_stxrp_balance" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "escrows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" varchar,
	"vault_id" varchar NOT NULL,
	"wallet_address" text NOT NULL,
	"destination_address" text NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"asset" text DEFAULT 'XRP' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"create_tx_hash" text,
	"finish_tx_hash" text,
	"cancel_tx_hash" text,
	"escrow_sequence" integer,
	"finish_after" timestamp,
	"cancel_after" timestamp,
	"condition" text,
	"fulfillment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "firelight_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" varchar NOT NULL,
	"fxrp_deposited" numeric(18, 6) NOT NULL,
	"stxrp_received" numeric(18, 6) NOT NULL,
	"current_stxrp_balance" numeric(18, 6) NOT NULL,
	"yield_accrued" numeric(18, 6) DEFAULT '0' NOT NULL,
	"last_yield_update" timestamp DEFAULT now() NOT NULL,
	"deposited_at" timestamp DEFAULT now() NOT NULL,
	"last_compounded_at" timestamp,
	"deposit_tx_hash" text
);
--> statement-breakpoint
CREATE TABLE "fxrp_to_xrp_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position_id" varchar NOT NULL,
	"wallet_address" text NOT NULL,
	"vault_id" varchar NOT NULL,
	"share_amount" numeric(18, 6) NOT NULL,
	"fxrp_redeemed" numeric(18, 6),
	"xrp_sent" numeric(18, 6),
	"status" "redemption_status" DEFAULT 'pending' NOT NULL,
	"user_status" "user_status" DEFAULT 'processing' NOT NULL,
	"backend_status" "backend_status" DEFAULT 'not_started' NOT NULL,
	"backend_error" text,
	"vault_redeem_tx_hash" text,
	"fassets_redemption_tx_hash" text,
	"xrpl_payout_tx_hash" text,
	"redemption_request_id" varchar,
	"agent_vault_address" varchar,
	"agent_underlying_address" varchar,
	"expected_xrp_drops" varchar,
	"confirmation_tx_hash" varchar DEFAULT NULL,
	"fdc_attestation_tx_hash" varchar,
	"fdc_voting_round_id" varchar,
	"fdc_request_bytes" text,
	"fdc_proof_hash" varchar,
	"fdc_proof_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"shares_redeemed_at" timestamp,
	"fxrp_redeemed_at" timestamp,
	"xrpl_payout_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"last_error" text DEFAULT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp DEFAULT NULL,
	"last_funding_tx_hash" varchar DEFAULT NULL,
	"funding_attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"vault_id" varchar NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"rewards" numeric(18, 2) DEFAULT '0' NOT NULL,
	"deposited_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" varchar NOT NULL,
	"position_id" varchar,
	"type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"rewards" numeric(18, 2) DEFAULT '0',
	"status" text DEFAULT 'completed' NOT NULL,
	"tx_hash" text,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_metrics_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"tvl" numeric(18, 2) NOT NULL,
	"apy" numeric(5, 2) NOT NULL,
	"stakers" integer NOT NULL,
	"rewards_accrued" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"asset" text DEFAULT 'XRP' NOT NULL,
	"apy" numeric(5, 2) NOT NULL,
	"apy_label" text,
	"tvl" numeric(18, 2) NOT NULL,
	"liquidity" numeric(18, 2) NOT NULL,
	"lock_period" integer NOT NULL,
	"risk_level" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"coming_soon" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"position_id" varchar,
	"vault_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"asset" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"tx_hash" text,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "xrp_to_fxrp_bridges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text,
	"wallet_address" text NOT NULL,
	"vault_id" varchar NOT NULL,
	"position_id" varchar,
	"xrp_amount" numeric(18, 6) NOT NULL,
	"requested_xrp_amount" numeric(18, 6),
	"fxrp_expected" numeric(18, 6) NOT NULL,
	"fxrp_received" numeric(18, 6),
	"status" "bridge_status" DEFAULT 'pending' NOT NULL,
	"xrpl_tx_hash" text,
	"flare_tx_hash" text,
	"fxrp_mint_tx_hash" text DEFAULT NULL,
	"vault_mint_tx_hash" text,
	"collateral_reservation_id" varchar,
	"payment_reference" varchar,
	"agent_vault_address" varchar,
	"agent_underlying_address" varchar,
	"minting_fee_bips" varchar,
	"reserved_value_uba" varchar,
	"reserved_fee_uba" varchar,
	"total_amount_uba" varchar,
	"reservation_tx_hash" varchar,
	"collateral_reservation_fee_paid" varchar,
	"reservation_expiry" timestamp,
	"last_underlying_block" varchar,
	"last_underlying_timestamp" timestamp,
	"fdc_attestation_tx_hash" varchar,
	"fdc_proof_hash" varchar,
	"fdc_voting_round_id" varchar,
	"fdc_request_bytes" text,
	"fdc_proof_data" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"xrpl_confirmed_at" timestamp,
	"payment_confirmed_at" timestamp DEFAULT NULL,
	"bridge_started_at" timestamp,
	"fxrp_received_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"failure_code" text,
	"received_amount_drops" varchar,
	"expected_amount_drops" varchar,
	"error_message" text,
	"last_error" text DEFAULT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "xrp_to_fxrp_bridges_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
ALTER TABLE "compounding_runs" ADD CONSTRAINT "compounding_runs_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compounding_runs" ADD CONSTRAINT "compounding_runs_firelight_position_id_firelight_positions_id_fk" FOREIGN KEY ("firelight_position_id") REFERENCES "public"."firelight_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firelight_positions" ADD CONSTRAINT "firelight_positions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fxrp_to_xrp_redemptions" ADD CONSTRAINT "fxrp_to_xrp_redemptions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fxrp_to_xrp_redemptions" ADD CONSTRAINT "fxrp_to_xrp_redemptions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_metrics_daily" ADD CONSTRAINT "vault_metrics_daily_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_to_fxrp_bridges" ADD CONSTRAINT "xrp_to_fxrp_bridges_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xrp_to_fxrp_bridges" ADD CONSTRAINT "xrp_to_fxrp_bridges_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;