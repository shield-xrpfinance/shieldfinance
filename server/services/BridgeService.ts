import { FlareClient } from "../utils/flare-client";
import { FAssetsClient } from "../utils/fassets-client";
import { generateFDCProof } from "../utils/fdc-proof";
import type { IStorage } from "../storage";
import type { SelectXrpToFxrpBridge } from "../../shared/schema";

export interface BridgeServiceConfig {
  network: "mainnet" | "coston2";
  storage: IStorage;
  flareClient: FlareClient;
  operatorPrivateKey: string;
  demoMode?: boolean;
}

/**
 * BridgeService handles XRP → FXRP conversion via FAssets protocol.
 * 
 * Demo Mode (default for Coston2):
 * - Simulates successful bridge operations for testing
 * - Clearly marks transactions as DEMO
 * - Allows full deposit flow testing without FAssets SDK
 * 
 * Production Mode (required for mainnet):
 * - Requires FAssets SDK integration
 * - Executes real on-chain bridge operations
 * - Set demoMode: false in configuration
 */
export class BridgeService {
  private config: BridgeServiceConfig;
  private _demoMode: boolean;
  private fassetsClient: FAssetsClient | null;

  constructor(config: BridgeServiceConfig) {
    this.config = config;
    this._demoMode = config.demoMode ?? (config.network === "coston2");
    
    // Only initialize FAssetsClient when in production mode
    if (!this._demoMode) {
      this.fassetsClient = new FAssetsClient({
        network: config.network,
        flareClient: config.flareClient,
      });
      console.log("✅ BridgeService initialized with FAssets integration");
    } else {
      this.fassetsClient = null;
      console.log("⚠️  BridgeService running in DEMO MODE - FAssets integration not active");
    }
  }

  get demoMode(): boolean {
    return this._demoMode;
  }

  /**
   * Initiate XRP → FXRP bridge using FAssets protocol
   * For now, this is a placeholder - actual FAssets integration requires:
   * 1. Reserve collateral with agent
   * 2. Execute minting with proof
   * 3. Wait for FDC verification
   * 
   * In production, use official FAssets SDK or direct contract calls
   */
  async initiateBridge(bridgeId: string): Promise<void> {
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) throw new Error("Bridge not found");

    console.log(`🌉 Initiating bridge for ${bridge.xrpAmount} XRP → FXRP`);

    try {
      // Update status to bridging
      await this.config.storage.updateBridgeStatus(bridgeId, "bridging", {
        bridgeStartedAt: new Date(),
      });

      let flareTxHash: string;

      if (this._demoMode) {
        // Demo mode: Simulate successful bridge
        await this.demoFAssetsMinting(bridge);
        flareTxHash = `DEMO-0x${Date.now().toString(16)}`;
      } else {
        // Production mode: Execute real FAssets minting
        // This reserves collateral and saves agent details
        const reservationTxHash = await this.executeFAssetsMinting(bridge);
        // At this point, we've reserved collateral but not yet minted FXRP
        // The actual minting happens in executeMintingWithProof() after payment
        flareTxHash = reservationTxHash;
      }

      // Update status (completed for demo, awaiting_payment for production)
      const status = this._demoMode ? "completed" : "awaiting_payment";
      await this.config.storage.updateBridgeStatus(bridgeId, status, {
        fxrpReceived: this._demoMode ? bridge.fxrpExpected : undefined,
        fxrpReceivedAt: this._demoMode ? new Date() : undefined,
        flareTxHash,
        completedAt: this._demoMode ? new Date() : undefined,
      });

      console.log(`✅ Bridge ${this._demoMode ? 'completed' : 'initiated'}: ${bridge.xrpAmount} XRP → ${bridge.fxrpExpected} FXRP ${this._demoMode ? '(DEMO)' : ''}`);
    } catch (error) {
      console.error("Bridge error:", error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  private async demoFAssetsMinting(bridge: SelectXrpToFxrpBridge): Promise<void> {
    console.log("⚠️  DEMO MODE: Simulating FAssets bridge (not using real FAssets protocol)");
    console.log("   In production, this would:");
    console.log("   1. Reserve collateral with FAssets agent");
    console.log("   2. Execute minting with XRPL proof");
    console.log("   3. Wait for Flare Data Connector verification");
    console.log("   4. Receive FXRP tokens on Flare Network");
    
    // Simulate bridge delay (2-5 seconds for demo)
    const delay = 2000 + Math.random() * 3000;
    console.log(`   Simulating bridge delay: ${(delay / 1000).toFixed(1)}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log("   ✅ Demo bridge completed successfully");
    console.log("");
    console.log("   To enable real FAssets:");
    console.log("   - Set demoMode: false in BridgeService config");
    console.log("   - Integrate official FAssets SDK");
    console.log("   - Update executeFAssetsMinting() implementation");
  }

  private async executeFAssetsMinting(bridge: SelectXrpToFxrpBridge): Promise<string> {
    console.log("⏳ Executing FAssets collateral reservation...");
    
    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized. This should never happen in production mode.");
    }
    
    try {
      const lotsToMint = await this.fassetsClient.calculateLots(bridge.xrpAmount.toString());
      console.log(`Calculated lots needed: ${lotsToMint}`);
      
      const reservation = await this.fassetsClient.reserveCollateral(lotsToMint);
      
      await this.config.storage.updateBridgeStatus(bridge.id, "awaiting_payment", {
        collateralReservationId: reservation.reservationId.toString(),
        agentVaultAddress: reservation.agentVault,
        agentUnderlyingAddress: reservation.agentUnderlyingAddress,
        mintingFeeBIPS: reservation.feeBIPS.toString(),  // Store actual BIPS value
        collateralReservationFeePaid: "0",
        lastUnderlyingBlock: reservation.lastUnderlyingBlock.toString(),
      });
      
      console.log(`✅ Collateral reserved with agent: ${reservation.agentVault}`);
      console.log(`   Payment address: ${reservation.agentUnderlyingAddress}`);
      console.log(`   Amount to pay: ${reservation.valueUBA} + ${reservation.feeUBA} fee`);
      console.log("");
      console.log("   ⏳ Waiting for XRP payment to agent address...");
      console.log("   After payment is detected, executeMintingWithProof() will be called");
      
      // Return the reservation transaction hash
      return reservation.reservationTxHash;
    } catch (error) {
      console.error("Error executing FAssets minting:", error);
      throw error;
    }
  }

  async executeMintingWithProof(bridgeId: string, xrplTxHash: string): Promise<void> {
    console.log(`⏳ Executing minting with FDC proof for bridge ${bridgeId}`);
    
    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized. This should never happen in production mode.");
    }
    
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) throw new Error("Bridge not found");
    
    if (!bridge.collateralReservationId) {
      throw new Error("No collateral reservation found for this bridge");
    }
    
    try {
      const proof = await generateFDCProof(xrplTxHash, this.config.network);
      console.log(`✅ FDC proof generated for tx: ${xrplTxHash}`);
      
      const mintingTxHash = await this.fassetsClient.executeMinting(
        proof,
        BigInt(bridge.collateralReservationId)
      );
      
      // Update bridge status with actual minting transaction hash
      await this.config.storage.updateBridgeStatus(bridgeId, "completed", {
        xrplTxHash: xrplTxHash,
        flareTxHash: mintingTxHash,
        fdcProofHash: JSON.stringify(proof),
        fxrpReceived: bridge.fxrpExpected,
        fxrpReceivedAt: new Date(),
        completedAt: new Date(),
      });
      
      console.log(`✅ Minting executed on Flare: ${mintingTxHash}`);
    } catch (error) {
      console.error("Error executing minting with proof:", error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check bridge status and retry if needed
   */
  async processPendingBridges(): Promise<void> {
    // TODO: Query pending bridges and retry failed ones
    console.log("Checking for pending bridges...");
  }
}
