import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vaults = pgTable("vaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }).notNull(),
  liquidity: decimal("liquidity", { precision: 18, scale: 2 }).notNull(),
  lockPeriod: integer("lock_period").notNull(),
  riskLevel: text("risk_level").notNull(),
  status: text("status").notNull().default("active"),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vaultId: varchar("vault_id").notNull().references(() => vaults.id),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  rewards: decimal("rewards", { precision: 18, scale: 2 }).notNull().default("0"),
  depositedAt: timestamp("deposited_at").notNull().defaultNow(),
});

export const insertVaultSchema = createInsertSchema(vaults).omit({
  id: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  depositedAt: true,
});

export type InsertVault = z.infer<typeof insertVaultSchema>;
export type Vault = typeof vaults.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;
