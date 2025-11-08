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
