import { ethers } from "ethers";
import { FlareClient } from "../utils/flare-client";
import type { IStorage } from "../storage";
import type { SelectFirelightPosition } from "../../shared/schema";

export interface CompoundingServiceConfig {
  storage: IStorage;
  flareClient: FlareClient;
  vaultControllerAddress: string;
  minCompoundAmount: string; // Minimum yield before compounding
}

export class CompoundingService {
  private config: CompoundingServiceConfig;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: CompoundingServiceConfig) {
    this.config = config;
  }

  /**
   * Start automatic compounding (run every hour)
   */
  start(intervalMinutes: number = 60) {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`🔄 Compounding service started (every ${intervalMinutes} minutes)`);

    // Run immediately
    this.runCompounding();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runCompounding();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log("Compounding service stopped");
  }

  private async runCompounding() {
    console.log("🔄 Running compounding check...");

    try {
      // Get all vaults from database
      const vaults = await this.getAllVaults();
      
      for (const vault of vaults) {
        await this.checkAndCompoundVault(vault.id);
      }
    } catch (error) {
      console.error("Compounding error:", error);
    }
  }

  private async getAllVaults() {
    // Get all vaults from storage
    return await this.config.storage.getAllVaults();
  }

  private async checkAndCompoundVault(vaultId: string) {
    console.log(`Checking vault ${vaultId} for compounding...`);
    
    // Check if Firelight position exists
    const firelightPosition = await this.config.storage.getFirelightPositionByVault(vaultId);
    if (!firelightPosition) {
      console.log(`  No Firelight position for vault ${vaultId}`);
      return;
    }

    // Calculate current yield
    const currentYield = await this.calculateYield(firelightPosition);
    const yieldAmount = parseFloat(currentYield);

    if (yieldAmount < parseFloat(this.config.minCompoundAmount)) {
      console.log(`  Yield ${yieldAmount} below minimum ${this.config.minCompoundAmount}`);
      return;
    }

    console.log(`  Yield ${yieldAmount} exceeds minimum, executing compound...`);
    
    // Create compounding run
    const run = await this.config.storage.createCompoundingRun({
      vaultId,
      firelightPositionId: firelightPosition.id,
      yieldAmount: currentYield,
      previousStxrpBalance: firelightPosition.currentStxrpBalance,
      newStxrpBalance: firelightPosition.currentStxrpBalance, // Updated below
      status: "pending",
    });

    try {
      // Execute compound via VaultController
      const vaultController = this.config.flareClient.getVaultController(
        this.config.vaultControllerAddress
      ) as any;
      
      const compoundTx = await vaultController.executeCompound(vaultId);
      const receipt = await compoundTx.wait();

      // Update Firelight position with new balance
      const newBalance = (
        parseFloat(firelightPosition.currentStxrpBalance) + yieldAmount
      ).toString();

      await this.config.storage.updateFirelightYield(
        firelightPosition.id,
        currentYield,
        newBalance
      );

      // Complete compounding run
      await this.config.storage.completeCompoundingRun(
        run.id,
        receipt.hash,
        newBalance
      );

      console.log(`  ✅ Compounding completed for vault ${vaultId}`);
    } catch (error) {
      console.error(`  ❌ Compounding failed for vault ${vaultId}:`, error);
      // Update run status to failed
      // TODO: Add updateCompoundingRunStatus to storage interface
    }
  }

  private async calculateYield(position: SelectFirelightPosition): Promise<string> {
    // Calculate time-based yield
    const timeDiff = Date.now() - new Date(position.depositedAt).getTime();
    const daysPassed = timeDiff / (1000 * 60 * 60 * 24);
    const annualRate = 0.05; // 5% APY (placeholder)
    
    const yieldAmount = 
      parseFloat(position.fxrpDeposited) * (annualRate / 365) * daysPassed;

    return yieldAmount.toFixed(6);
  }

  /**
   * Execute compound for a specific vault
   */
  async executeCompound(vaultId: string): Promise<void> {
    console.log(`🔄 Executing compound for vault ${vaultId}`);

    const run = await this.config.storage.createCompoundingRun({
      vaultId,
      firelightPositionId: null,
      yieldAmount: "0",
      previousStxrpBalance: "0",
      newStxrpBalance: "0",
      status: "pending",
    });

    try {
      // TODO: Implement actual compounding
      // 1. Claim rewards from Firelight
      // 2. Reinvest rewards
      // 3. Update stXRP balance

      await this.config.storage.completeCompoundingRun(
        run.id,
        `0x${Date.now().toString(16)}`,
        "0"
      );

      console.log(`✅ Compound completed for vault ${vaultId}`);
    } catch (error) {
      console.error("Compound execution error:", error);
      throw error;
    }
  }
}
