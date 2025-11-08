import { type Vault, type InsertVault, type Position, type InsertPosition, vaults, positions } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getVaults(): Promise<Vault[]>;
  getVault(id: string): Promise<Vault | undefined>;
  createVault(vault: InsertVault): Promise<Vault>;
  
  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  deletePosition(id: string): Promise<boolean>;
  
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
        name: "XRP Stable Yield",
        apy: "7.5",
        tvl: "8200000",
        liquidity: "2100000",
        lockPeriod: 30,
        riskLevel: "low",
      },
      {
        name: "RLUSD + USDC Pool",
        apy: "12.8",
        tvl: "5400000",
        liquidity: "1300000",
        lockPeriod: 90,
        riskLevel: "medium",
      },
      {
        name: "XRP Maximum Returns",
        apy: "18.5",
        tvl: "3100000",
        liquidity: "750000",
        lockPeriod: 180,
        riskLevel: "high",
      },
      {
        name: "XRP + RLUSD Balanced",
        apy: "9.2",
        tvl: "12500000",
        liquidity: "4200000",
        lockPeriod: 14,
        riskLevel: "low",
      },
      {
        name: "Triple Asset Pool",
        apy: "15.5",
        tvl: "6800000",
        liquidity: "1800000",
        lockPeriod: 60,
        riskLevel: "medium",
      },
      {
        name: "USDC Conservative",
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

  async getVault(id: string): Promise<Vault | undefined> {
    const [vault] = await db.select().from(vaults).where(eq(vaults.id, id));
    return vault || undefined;
  }

  async createVault(insertVault: InsertVault): Promise<Vault> {
    const [vault] = await db.insert(vaults).values(insertVault).returning();
    return vault;
  }

  async getPositions(): Promise<Position[]> {
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

  async deletePosition(id: string): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
