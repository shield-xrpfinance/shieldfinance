import { type Vault, type InsertVault, type Position, type InsertPosition } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getVaults(): Promise<Vault[]>;
  getVault(id: string): Promise<Vault | undefined>;
  createVault(vault: InsertVault): Promise<Vault>;
  
  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  deletePosition(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private vaults: Map<string, Vault>;
  private positions: Map<string, Position>;

  constructor() {
    this.vaults = new Map();
    this.positions = new Map();
    this.initializeVaults();
  }

  private initializeVaults() {
    const vaultData = [
      {
        name: "XRP Stable Yield",
        apy: "7.5",
        tvl: "8200000",
        liquidity: "2100000",
        lockPeriod: 30,
        riskLevel: "low",
        status: "active",
      },
      {
        name: "RLUSD + USDC Pool",
        apy: "12.8",
        tvl: "5400000",
        liquidity: "1300000",
        lockPeriod: 90,
        riskLevel: "medium",
        status: "active",
      },
      {
        name: "XRP Maximum Returns",
        apy: "18.5",
        tvl: "3100000",
        liquidity: "750000",
        lockPeriod: 180,
        riskLevel: "high",
        status: "active",
      },
      {
        name: "XRP + RLUSD Balanced",
        apy: "9.2",
        tvl: "12500000",
        liquidity: "4200000",
        lockPeriod: 14,
        riskLevel: "low",
        status: "active",
      },
      {
        name: "Triple Asset Pool",
        apy: "15.5",
        tvl: "6800000",
        liquidity: "1800000",
        lockPeriod: 60,
        riskLevel: "medium",
        status: "active",
      },
      {
        name: "USDC Conservative",
        apy: "6.3",
        tvl: "2400000",
        liquidity: "520000",
        lockPeriod: 7,
        riskLevel: "low",
        status: "active",
      },
    ];

    vaultData.forEach((data) => {
      const id = randomUUID();
      this.vaults.set(id, { ...data, id, status: data.status });
    });
  }

  async getVaults(): Promise<Vault[]> {
    return Array.from(this.vaults.values());
  }

  async getVault(id: string): Promise<Vault | undefined> {
    return this.vaults.get(id);
  }

  async createVault(insertVault: InsertVault): Promise<Vault> {
    const id = randomUUID();
    const vault: Vault = { ...insertVault, id };
    this.vaults.set(id, vault);
    return vault;
  }

  async getPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async getPosition(id: string): Promise<Position | undefined> {
    return this.positions.get(id);
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const id = randomUUID();
    const position: Position = { 
      ...insertPosition,
      rewards: insertPosition.rewards || "0",
      id,
      depositedAt: new Date(),
    };
    this.positions.set(id, position);
    return position;
  }

  async deletePosition(id: string): Promise<boolean> {
    return this.positions.delete(id);
  }
}

export const storage = new MemStorage();
