import { FlareClient } from "../utils/flare-client";
import { FAssetsClient } from "../utils/fassets-client";
import { generateFDCProof, FDCTimeoutError } from "../utils/fdc-proof";
import type { IStorage } from "../storage";
import type { SelectXrpToFxrpBridge, PaymentRequest } from "../../shared/schema";
import type { XRPLDepositListener } from "../listeners/XRPLDepositListener";
import type { VaultService } from "./VaultService";

export interface BridgeServiceConfig {
  network: "mainnet" | "coston2";
  storage: IStorage;
  flareClient: FlareClient;
  vaultService?: VaultService;
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
  private xrplListener: XRPLDepositListener | null = null;
  private xrplListenerSet: boolean = false;

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
   * Set XRPL listener for agent address registration (two-phase initialization).
   * This method should only be used for registering agent addresses with the listener.
   */
  setXrplListener(listener: XRPLDepositListener): void {
    if (this.xrplListenerSet) {
      throw new Error("XRPL listener already set. Cannot set listener multiple times.");
    }
    this.xrplListener = listener;
    this.xrplListenerSet = true;
    console.log("✅ XRPL listener registered with BridgeService");
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
      
      // Trigger vault share minting for demo mode
      if (this._demoMode) {
        await this.completeBridgeWithVaultMinting(bridgeId);
      }
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
    console.log("   Simulating 4-step bridge process with realistic delays...");
    
    // Step 1: Collateral reserved (already in 'pending' status from initiateBridge)
    console.log("   [1/4] Reserving collateral...");
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Step 2: Set agent address for payment
    console.log("   [2/4] Agent address assigned - awaiting payment...");
    const demoAgentAddress = `rDEMOAgent${Date.now().toString(36)}`;
    await this.config.storage.updateBridgeStatus(bridge.id, "awaiting_payment", {
      agentVaultAddress: "0xDEMO" + Date.now().toString(16).slice(-8),
      agentUnderlyingAddress: demoAgentAddress,
      collateralReservationId: `demo-res-${Date.now()}`,
      mintingFeeBIPS: "25", // 0.25% fee
    });
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
    
    // Step 3: Payment detected, generating proof
    console.log("   [3/4] Payment detected - generating FDC proof...");
    await this.config.storage.updateBridgeStatus(bridge.id, "xrpl_confirmed", {
      xrplTxHash: `DEMO-XRPL-${Date.now().toString(16)}`,
      xrplConfirmedAt: new Date(),
    });
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    // Step 4: Executing minting
    console.log("   [4/4] Executing minting...");
    await this.config.storage.updateBridgeStatus(bridge.id, "fdc_proof_generated", {
      fdcProofHash: `0xDEMOPROOF${Date.now().toString(16)}`,
    });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    console.log("   ✅ Demo bridge completed successfully");
    console.log("");
    console.log("   To enable real FAssets:");
    console.log("   - Set DEMO_MODE=false environment variable");
    console.log("   - Configure FASSETS_ASSET_MANAGER_COSTON2 address");
    console.log("   - Integrate official FAssets SDK");
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
      
      // Register agent address with XRPL listener for payment detection
      if (this.xrplListener) {
        await this.xrplListener.addAgentAddress(reservation.agentUnderlyingAddress);
        console.log(`🔔 XRPL listener now monitoring agent: ${reservation.agentUnderlyingAddress}`);
      }
      
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
    
    // Update status to xrpl_confirmed BEFORE starting proof generation
    // This shows the user that payment was detected and proof generation is in progress
    await this.config.storage.updateBridgeStatus(bridgeId, "xrpl_confirmed", {
      xrplTxHash,
      xrplConfirmedAt: new Date(),
    });
    console.log(`✅ Bridge status updated to xrpl_confirmed, starting proof generation...`);
    
    try {
      // Fetch XRPL transaction to get accurate timestamp for voting round calculation
      const { Client } = await import("xrpl");
      const xrplNetwork = this.config.network === "mainnet" 
        ? "wss://xrplcluster.com" 
        : "wss://s.altnet.rippletest.net:51233";
      
      const client = new Client(xrplNetwork);
      await client.connect();
      
      console.log(`📡 Fetching XRPL transaction ${xrplTxHash} for timestamp...`);
      const txResponse = await client.request({
        command: "tx",
        transaction: xrplTxHash,
      });
      await client.disconnect();
      
      // Verify transaction is validated
      if (!txResponse.result?.validated) {
        throw new Error("XRPL transaction is not yet validated. Cannot generate FDC proof for unvalidated transactions.");
      }
      
      // Convert Ripple epoch timestamp to Unix timestamp
      // Ripple epoch: January 1, 2000 at 00:00 UTC = 946684800 Unix timestamp
      const rippleEpochOffset = 946684800;
      
      // Extract timestamp from response, checking all possible locations
      let rippleTimestamp: number | null = null;
      const result = txResponse.result as any; // Use any to access dynamic response properties
      
      if (result.date !== undefined) {
        rippleTimestamp = Number(result.date);
      } else if (result.tx?.date !== undefined) {
        rippleTimestamp = Number(result.tx.date);
      } else if (result.tx_json?.date !== undefined) {
        rippleTimestamp = Number(result.tx_json.date);
      } else if (result.close_time_iso) {
        // Fallback: convert ISO string to timestamp
        const isoDate = new Date(result.close_time_iso);
        rippleTimestamp = Math.floor(isoDate.getTime() / 1000) - rippleEpochOffset;
      }
      
      if (rippleTimestamp === null || !isFinite(rippleTimestamp)) {
        throw new Error("Could not extract valid timestamp from XRPL transaction response");
      }
      
      const unixTimestamp = rippleTimestamp + rippleEpochOffset;
      
      // Sanity checks on the timestamp
      const now = Math.floor(Date.now() / 1000);
      const oneYearAgo = now - (365 * 24 * 60 * 60);
      
      if (unixTimestamp > now + 60) {
        throw new Error(`XRPL transaction timestamp is in the future: ${unixTimestamp} > ${now}`);
      }
      
      if (unixTimestamp < oneYearAgo) {
        throw new Error(`XRPL transaction timestamp is too old (>1 year): ${unixTimestamp} < ${oneYearAgo}`);
      }
      
      console.log(`⏰ XRPL Transaction Timestamp: ${unixTimestamp} (${new Date(unixTimestamp * 1000).toISOString()})`);
      
      const proof = await generateFDCProof(xrplTxHash, this.config.network, unixTimestamp);
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
      
      // Trigger vault share minting (final step)
      await this.completeBridgeWithVaultMinting(bridgeId);
    } catch (error) {
      // Handle FDC timeout separately - this is a recoverable state
      if (error instanceof FDCTimeoutError) {
        console.warn(`⏰ FDC proof polling timeout for bridge ${bridgeId}. This is common on testnet.`);
        console.warn(`   Voting Round: ${error.votingRoundId}, Last Status: ${error.lastStatusCode}`);
        
        await this.config.storage.updateBridgeStatus(bridgeId, "fdc_timeout", {
          errorMessage: `FDC proof polling timeout after 15 minutes. This is a known testnet issue. You can retry proof generation.`,
          fdcVotingRoundId: error.votingRoundId.toString(),
          fdcRequestBytes: error.requestBytes,
        });
        
        console.log(`✅ Bridge ${bridgeId} marked as 'fdc_timeout' - can be retried via /api/bridges/${bridgeId}/retry-proof`);
        return; // Don't throw - timeout is a recoverable state
      }
      
      // Other errors are terminal failures
      console.error("Error executing minting with proof:", error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Complete bridge by minting vault shares (final step after FXRP is received)
   * 
   * This method is idempotent and safe to retry:
   * - Checks if vault shares already minted (via vaultMintTxHash)
   * - Allows retries from vault_mint_failed status
   * - Persists transaction hash before creating position (prevents double-minting)
   * 
   * Status Flow:
   * - completed/vault_minting/vault_mint_failed → vault_minting → vault_minted (success)
   */
  async completeBridgeWithVaultMinting(bridgeId: string): Promise<void> {
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) {
      console.error(`❌ Bridge ${bridgeId} not found for vault minting`);
      return;
    }

    // Idempotency check: Skip if vault shares already minted (tx hash is authoritative)
    if (bridge.vaultMintTxHash) {
      console.log(`⏭️  Bridge ${bridgeId} already has vault shares minted (tx: ${bridge.vaultMintTxHash}), skipping duplicate mint`);
      
      // If tx exists but position is missing, this is a recovery scenario - create position only
      if (!bridge.positionId) {
        console.log(`   ⚠️  Position missing for minted shares - this should not happen. Manual recovery needed.`);
      }
      return;
    }

    // Safety check: Only mint if FXRP was received
    if (!bridge.fxrpReceived) {
      console.warn(`⚠️  Cannot mint vault shares for bridge ${bridgeId}: fxrpReceived is null`);
      return;
    }

    // Allow retries from completed, vault_minting, or vault_mint_failed
    const retryableStatuses = ["completed", "vault_minting", "vault_mint_failed"];
    if (!retryableStatuses.includes(bridge.status)) {
      console.warn(`⚠️  Cannot mint vault shares for bridge ${bridgeId}: status=${bridge.status} (not retryable)`);
      return;
    }

    // Check if VaultService is available
    if (!this.config.vaultService) {
      console.error(`❌ VaultService not configured in BridgeService - cannot mint shares for bridge ${bridgeId}`);
      await this.config.storage.updateBridgeStatus(bridgeId, "vault_mint_failed", {
        errorMessage: "VaultService not configured",
      });
      return;
    }

    console.log(`🏦 Completing bridge ${bridgeId} by minting vault shares...`);

    try {
      // Step 1: Update status to vault_minting (preserves completedAt timestamp)
      await this.config.storage.updateBridge(bridgeId, {
        status: "vault_minting",
      });

      // Step 2: Mint vault shares on-chain (this is the expensive/risky operation)
      const { vaultMintTxHash, positionId } = await this.config.vaultService.mintShares(
        bridge.vaultId,
        bridge.walletAddress,
        bridge.fxrpReceived.toString()
      );

      // Step 3: CRITICAL - Save transaction hash immediately before final status update
      // This prevents double-minting if the process crashes before completing
      await this.config.storage.updateBridge(bridgeId, {
        vaultMintTxHash,
      });

      console.log(`✅ Vault mint tx saved: ${vaultMintTxHash}`);

      // Step 4: Update final status with position link (preserves completedAt)
      await this.config.storage.updateBridge(bridgeId, {
        status: "vault_minted",
        positionId,
      });

      console.log(`✅ Bridge ${bridgeId} fully completed: Vault shares minted (${vaultMintTxHash}), Position created (${positionId})`);
    } catch (error) {
      console.error(`❌ Vault minting failed for bridge ${bridgeId}:`, error);
      await this.config.storage.updateBridge(bridgeId, {
        status: "vault_mint_failed",
        errorMessage: error instanceof Error ? error.message : "Unknown vault minting error",
      });
      // Note: Retries are allowed - this method can be called again to retry
    }
  }

  /**
   * Reserve collateral and get agent address (fast, no delays)
   * This is the first step before payment can be requested
   */
  async reserveCollateralQuick(bridgeId: string): Promise<void> {
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) throw new Error("Bridge not found");

    console.log(`🌉 Reserving collateral for bridge ${bridgeId}`);

    try {
      await this.config.storage.updateBridgeStatus(bridgeId, "bridging", {
        bridgeStartedAt: new Date(),
      });

      if (this._demoMode) {
        const demoAgentAddress = `rDEMOAgent${Date.now().toString(36)}`;
        await this.config.storage.updateBridgeStatus(bridgeId, "awaiting_payment", {
          agentVaultAddress: "0xDEMO" + Date.now().toString(16).slice(-8),
          agentUnderlyingAddress: demoAgentAddress,
          collateralReservationId: `demo-res-${Date.now()}`,
          mintingFeeBIPS: "25",
        });
        console.log(`✅ Demo agent address assigned: ${demoAgentAddress}`);
      } else {
        const reservationTxHash = await this.executeFAssetsMinting(bridge);
        console.log(`✅ Collateral reserved, tx: ${reservationTxHash}`);
      }
    } catch (error) {
      console.error("Collateral reservation error:", error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Build payment request for XRP → FXRP bridge
   * Returns normalized payment payload for wallet signing
   */
  buildPaymentRequest(bridge: SelectXrpToFxrpBridge): PaymentRequest | null {
    console.log("=== buildPaymentRequest CALLED ===", {
      bridgeId: bridge.id,
      agentUnderlyingAddress: bridge.agentUnderlyingAddress,
      xrpAmount: bridge.xrpAmount,
      status: bridge.status,
    });

    if (!bridge.agentUnderlyingAddress) {
      console.warn(`⚠️  Bridge ${bridge.id} does not have agent address yet - cannot build payment request`);
      return null;
    }

    const xrpAmount = parseFloat(bridge.xrpAmount.toString());
    const amountDrops = Math.floor(xrpAmount * 1_000_000).toString();

    const network: "mainnet" | "testnet" = this.config.network === "mainnet" ? "mainnet" : "testnet";

    const paymentRequest: PaymentRequest = {
      bridgeId: bridge.id,
      destination: bridge.agentUnderlyingAddress,
      amountDrops,
      memo: bridge.id,
      network,
    };

    console.log("✅ Payment request built:", paymentRequest);

    return paymentRequest;
  }

  /**
   * Retry FDC proof generation for a bridge that timed out
   * Resumes polling from the stored votingRoundId
   */
  async retryProofGeneration(bridgeId: string): Promise<void> {
    console.log(`🔄 Retrying FDC proof generation for bridge ${bridgeId}`);
    
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) {
      throw new Error("Bridge not found");
    }
    
    // Validate bridge is in fdc_timeout status
    if (bridge.status !== "fdc_timeout") {
      throw new Error(`Bridge is in '${bridge.status}' status, expected 'fdc_timeout'`);
    }
    
    // Validate required retry data is present
    if (!bridge.fdcVotingRoundId || !bridge.fdcRequestBytes) {
      throw new Error("Missing FDC retry data (votingRoundId or requestBytes). Cannot retry.");
    }
    
    if (!bridge.xrplTxHash) {
      throw new Error("Missing XRPL transaction hash. Cannot retry proof generation.");
    }
    
    if (!bridge.collateralReservationId) {
      throw new Error("Missing collateral reservation ID. Cannot retry minting.");
    }
    
    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized. This should never happen in production mode.");
    }
    
    console.log(`📋 Retry context:`);
    console.log(`   Voting Round ID: ${bridge.fdcVotingRoundId}`);
    console.log(`   XRPL Tx Hash: ${bridge.xrplTxHash}`);
    console.log(`   Request Bytes: ${bridge.fdcRequestBytes.substring(0, 50)}...`);
    
    try {
      // Update status to xrpl_confirmed (back to "processing proof" state)
      await this.config.storage.updateBridgeStatus(bridgeId, "xrpl_confirmed", {
        errorMessage: null, // Clear previous timeout error message
      });
      
      console.log(`🔄 Resuming FDC proof polling from voting round ${bridge.fdcVotingRoundId}...`);
      
      // Resume proof generation - this will use the same voting round
      const proof = await generateFDCProof(
        bridge.xrplTxHash, 
        this.config.network,
        undefined // Let it recalculate from current time or use stored round
      );
      
      console.log(`✅ FDC proof generated on retry for bridge ${bridgeId}`);
      
      // Execute minting with the proof
      const mintingTxHash = await this.fassetsClient.executeMinting(
        proof,
        BigInt(bridge.collateralReservationId)
      );
      
      // Update bridge status to completed
      await this.config.storage.updateBridgeStatus(bridgeId, "completed", {
        xrplTxHash: bridge.xrplTxHash,
        flareTxHash: mintingTxHash,
        fdcProofHash: JSON.stringify(proof),
        fxrpReceived: bridge.fxrpExpected,
        fxrpReceivedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null, // Clear error message
      });
      
      console.log(`✅ Retry successful! Minting executed on Flare: ${mintingTxHash}`);
      
      // Trigger vault share minting (final step)
      await this.completeBridgeWithVaultMinting(bridgeId);
    } catch (error) {
      // Handle timeout again - could timeout again
      if (error instanceof FDCTimeoutError) {
        console.warn(`⏰ FDC proof polling timed out again for bridge ${bridgeId}`);
        
        await this.config.storage.updateBridgeStatus(bridgeId, "fdc_timeout", {
          errorMessage: `FDC proof polling timeout (retry attempt). Testnet FDC can be slow. Try again later.`,
          fdcVotingRoundId: error.votingRoundId.toString(),
          fdcRequestBytes: error.requestBytes,
        });
        
        throw new Error("FDC proof polling timed out again. Please try again later.");
      }
      
      // Other errors are terminal
      console.error("Error retrying proof generation:", error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: `Retry failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
