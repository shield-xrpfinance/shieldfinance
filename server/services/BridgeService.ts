import { ethers } from "ethers";
import { FlareClient } from "../utils/flare-client";
import { FAssetsClient } from "../utils/fassets-client";
import { generateFDCProof, FDCTimeoutError } from "../utils/fdc-proof";
import type { IStorage } from "../storage";
import type { SelectXrpToFxrpBridge, PaymentRequest } from "../../shared/schema";
import type { XRPLDepositListener, RedemptionPayment } from "../listeners/XRPLDepositListener";
import type { VaultService } from "./VaultService";

export interface BridgeServiceConfig {
  network: "mainnet" | "coston2";
  storage: IStorage;
  flareClient: FlareClient;
  vaultService?: VaultService;
  operatorPrivateKey: string;
  demoMode?: boolean;
}

// Bridge expiration constant - 30 minutes default
const EXPIRATION_MINUTES = 30;

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
  private cleanupInterval: NodeJS.Timeout | null = null;

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

    // Start cleanup scheduler
    this.startCleanupScheduler();
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
   * Start background cleanup scheduler to auto-expire bridges.
   * Runs on startup and every 5 minutes.
   */
  private startCleanupScheduler(): void {
    // Run cleanup immediately on startup
    this.cleanupExpiredBridges().catch(error => {
      console.error("❌ Initial cleanup error:", error);
    });

    // Schedule cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredBridges();
      } catch (error) {
        console.error("❌ Cleanup scheduler error:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log("✅ Bridge cleanup scheduler started (runs every 5 minutes)");
  }

  /**
   * Cleanup expired bridges by marking them as cancelled.
   * Runs every 5 minutes via cleanup scheduler.
   */
  private async cleanupExpiredBridges(): Promise<void> {
    try {
      // Get bridges in active statuses that could expire
      const activeBridges = await this.config.storage.getBridgesByStatus([
        'pending',
        'bridging',
        'awaiting_payment',
        'xrpl_confirmed',
        'generating_proof',
        'proof_generated',
        'fdc_proof_generated'
      ]);

      if (activeBridges.length === 0) {
        console.log("🧹 Cleanup: No active bridges to check");
        return;
      }

      const now = new Date();
      let expiredCount = 0;

      for (const bridge of activeBridges) {
        // Skip if no expiry set
        if (!bridge.expiresAt) continue;

        // Check if expired
        if (now > bridge.expiresAt) {
          // Use idempotent update - only update if still in non-terminal state
          const currentBridge = await this.config.storage.getBridgeById(bridge.id);
          if (!currentBridge) continue;

          // Double-check status hasn't changed to terminal
          if (['completed', 'cancelled', 'failed'].includes(currentBridge.status)) {
            continue;
          }

          // Mark as cancelled with expiration reason
          await this.config.storage.updateBridge(bridge.id, {
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: 'expired'
          });

          // Unsubscribe from XRPL listener if agent address exists
          if (bridge.agentUnderlyingAddress && this.xrplListener) {
            await this.xrplListener.removeAgentAddress(bridge.agentUnderlyingAddress);
          }

          expiredCount++;
          console.log(`🧹 Marked bridge ${bridge.id} as expired (expiresAt: ${bridge.expiresAt.toISOString()})`);
        }
      }

      if (expiredCount > 0) {
        console.log(`🧹 Cleanup: Marked ${expiredCount} bridge(s) as expired`);
      } else {
        console.log(`🧹 Cleanup: Checked ${activeBridges.length} active bridge(s), none expired`);
      }
    } catch (error) {
      console.error("❌ Error during bridge cleanup:", error);
      throw error;
    }
  }

  /**
   * Check if a bridge is expired.
   * @param bridge - Bridge to check
   * @returns true if bridge is expired, false otherwise
   */
  private isBridgeExpired(bridge: SelectXrpToFxrpBridge): boolean {
    if (!bridge.expiresAt) return false;
    return new Date() > bridge.expiresAt;
  }

  /**
   * Check if a bridge is in a terminal state.
   * @param bridge - Bridge to check
   * @returns true if bridge is in terminal state, false otherwise
   */
  private isBridgeTerminal(bridge: SelectXrpToFxrpBridge): boolean {
    return ['completed', 'cancelled', 'failed', 'vault_mint_failed'].includes(bridge.status);
  }

  /**
   * Check if a bridge is active and can accept payments.
   * A bridge is active if it is NOT in a terminal state AND NOT expired.
   * 
   * @param bridge - Bridge to check
   * @returns true if bridge is active, false otherwise
   */
  public isBridgeActive(bridge: SelectXrpToFxrpBridge): boolean {
    // Bridge is NOT active if it's in a terminal state
    if (this.isBridgeTerminal(bridge)) {
      return false;
    }
    
    // Bridge is NOT active if it's expired
    if (this.isBridgeExpired(bridge)) {
      return false;
    }
    
    return true;
  }

  /**
   * Stop the cleanup scheduler (for graceful shutdown).
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("✅ Bridge cleanup scheduler stopped");
    }
  }

  /**
   * Parse actual minted FXRP amount from transaction receipt by analyzing Transfer events.
   * 
   * FXRP uses 6 decimals (not 18 like typical ERC20s), so we need to use formatUnits(value, 6).
   * This extracts the actual amount minted from the Transfer event instead of using expected amount.
   * 
   * @param txHash - Transaction hash of the minting transaction
   * @returns Actual FXRP amount minted (human-readable string with 6 decimals)
   */
  private async parseActualMintedAmount(txHash: string): Promise<string> {
    const provider = this.config.flareClient.provider;
    const smartAccountAddress = this.config.flareClient.getSignerAddress();
    
    // Get FXRP token address dynamically
    const fxrpAddress = await this.config.flareClient.getFAssetTokenAddress();
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error(`Transaction receipt not found for ${txHash}`);
    }
    
    // ERC20 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 value)
    const transferEventSignature = ethers.id("Transfer(address,address,uint256)");
    const zeroAddress = ethers.ZeroAddress;
    
    // Find Transfer event from FXRP contract where:
    // - from = 0x0000...0000 (minting)
    // - to = smartAccountAddress (minted to our smart account)
    for (const log of receipt.logs) {
      // Check if this is a Transfer event
      if (log.topics[0] !== transferEventSignature) continue;
      
      // Check if this is the FXRP token
      if (log.address.toLowerCase() !== fxrpAddress.toLowerCase()) continue;
      
      // Decode from and to addresses from topics
      const from = ethers.getAddress("0x" + log.topics[1].slice(26));
      const to = ethers.getAddress("0x" + log.topics[2].slice(26));
      
      // Check if this is a mint (from zero address) to smart account
      if (from.toLowerCase() === zeroAddress.toLowerCase() && 
          to.toLowerCase() === smartAccountAddress.toLowerCase()) {
        
        // Extract amount from log data
        const rawAmount = BigInt(log.data);
        
        // Format with 6 decimals (FXRP uses 6 decimals, not 18)
        const formattedAmount = ethers.formatUnits(rawAmount, 6);
        
        console.log(`✅ Parsed actual minted amount from Transfer event:`);
        console.log(`   Raw amount: ${rawAmount.toString()}`);
        console.log(`   Formatted (6 decimals): ${formattedAmount} FXRP`);
        
        return formattedAmount;
      }
    }
    
    // If no matching Transfer event found, throw error
    throw new Error(
      `No FXRP Transfer event found in transaction ${txHash}. ` +
      `Expected Transfer from ${zeroAddress} to ${smartAccountAddress} on token ${fxrpAddress}`
    );
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
      
      // Calculate total amount to pay (value + fee) with precision-safe formatting
      const assetDecimals = await this.fassetsClient.getAssetDecimals();
      const totalUBA = BigInt(reservation.valueUBA) + BigInt(reservation.feeUBA);
      
      // Use ethers.formatUnits for precision-safe conversion (no overflow/precision loss)
      const totalXRP = ethers.formatUnits(totalUBA, assetDecimals);
      
      // lastUnderlyingTimestamp is the payment deadline (from FAssets protocol)
      // This is the actual expiry time by which the minter must pay
      const reservationExpiry = new Date(Number(reservation.lastUnderlyingTimestamp) * 1000);
      
      console.log('\n💰 Payment Instructions:');
      console.log(`   Send exactly: ${totalXRP} XRP`);
      console.log(`   To address: ${reservation.agentUnderlyingAddress}`);
      console.log(`   With memo: ${reservation.paymentReference}`);
      console.log(`   Before: ${reservationExpiry.toISOString()}`);
      
      await this.config.storage.updateBridgeStatus(bridge.id, "awaiting_payment", {
        collateralReservationId: reservation.reservationId.toString(),
        paymentReference: reservation.paymentReference.toUpperCase(),
        agentVaultAddress: reservation.agentVault,
        agentUnderlyingAddress: reservation.agentUnderlyingAddress,
        mintingFeeBIPS: reservation.feeBIPS.toString(),
        reservedValueUBA: reservation.valueUBA.toString(),
        reservedFeeUBA: reservation.feeUBA.toString(),
        totalAmountUBA: totalUBA.toString(),
        reservationTxHash: reservation.reservationTxHash,
        collateralReservationFeePaid: "0",
        reservationExpiry,
        lastUnderlyingBlock: reservation.lastUnderlyingBlock.toString(),
        lastUnderlyingTimestamp: new Date(Number(reservation.lastUnderlyingTimestamp) * 1000),
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

  /**
   * Reserve collateral quickly for deposit initiation.
   * This is called by POST /api/deposits after creating the bridge record.
   * 
   * Production mode: Calls executeFAssetsMinting() to reserve collateral with FAssets agent
   * Demo mode: Generates synthetic reservation data without delays
   * 
   * Must complete in <5 seconds to provide quick API response to user
   */
  async reserveCollateralQuick(bridgeId: string): Promise<void> {
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    console.log(`🚀 Quick collateral reservation for bridge ${bridgeId}`);

    try {
      if (this._demoMode) {
        // Demo mode: Generate synthetic reservation data without delays
        const demoAgentAddress = `rDEMOAgent${Date.now().toString(36)}`;
        
        // Generate 64-character hex payment reference (32 bytes)
        const timestamp = Date.now().toString(16).padStart(16, '0'); // 16 hex chars
        const demoPaymentReference = timestamp + '0'.repeat(48); // Total 64 hex chars
        
        // Calculate synthetic amounts (1:1 ratio, 0.25% fee)
        const valueUBA = BigInt(Math.floor(Number(bridge.xrpAmount) * 1_000_000));
        const feeUBA = valueUBA / BigInt(400); // 0.25% fee
        const totalUBA = valueUBA + feeUBA;
        const expiryMinutes = 30;
        const reservationExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
        
        await this.config.storage.updateBridgeStatus(bridge.id, "awaiting_payment", {
          agentVaultAddress: "0xDEMO" + Date.now().toString(16).slice(-8),
          agentUnderlyingAddress: demoAgentAddress,
          collateralReservationId: `demo-res-${Date.now()}`,
          paymentReference: demoPaymentReference.toUpperCase(),
          reservedValueUBA: valueUBA.toString(),
          reservedFeeUBA: feeUBA.toString(),
          totalAmountUBA: totalUBA.toString(),
          reservationTxHash: `DEMO-RES-${Date.now().toString(16)}`,
          reservationExpiry,
          mintingFeeBIPS: "25", // 0.25% fee
        });
        
        // Optionally register with listener in demo mode
        if (this.xrplListener) {
          await this.xrplListener.addAgentAddress(demoAgentAddress);
          console.log(`🔔 [DEMO] XRPL listener now monitoring agent: ${demoAgentAddress}`);
        }
        
        console.log(`✅ [DEMO] Quick reservation complete`);
        console.log(`   Agent: ${demoAgentAddress}`);
        console.log(`   Memo: ${demoPaymentReference}`);
        console.log(`   Amount: ${ethers.formatUnits(valueUBA + feeUBA, 6)} XRP`);
        console.log(`   Expires: ${reservationExpiry.toISOString()}`);
      } else {
        // Production mode: Call executeFAssetsMinting() which already handles:
        // - Collateral reservation
        // - Storage updates
        // - XRPL listener registration
        await this.executeFAssetsMinting(bridge);
        console.log(`✅ Production reservation complete for bridge ${bridgeId}`);
      }
    } catch (error) {
      console.error(`❌ Collateral reservation failed for bridge ${bridgeId}:`, error);
      await this.config.storage.updateBridgeStatus(bridgeId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Collateral reservation failed",
      });
      throw error;
    }
  }

  /**
   * Build payment request from bridge data for API response.
   * Validates all required fields and returns payment instructions.
   * 
   * @param bridge - Bridge record with reservation details
   * @returns PaymentRequest with payment instructions
   * @throws Error if bridge data is incomplete or reservation expired
   */
  buildPaymentRequest(bridge: SelectXrpToFxrpBridge): PaymentRequest {
    // Validate required fields
    if (!bridge.agentUnderlyingAddress) {
      throw new Error("Bridge missing agent underlying address. Collateral reservation may not have completed.");
    }
    if (!bridge.paymentReference) {
      throw new Error("Bridge missing payment reference. Collateral reservation may not have completed.");
    }
    if (!bridge.totalAmountUBA) {
      throw new Error("Bridge missing total amount. Collateral reservation may not have completed.");
    }
    
    // Check expiry
    if (bridge.reservationExpiry) {
      const now = new Date();
      if (now > bridge.reservationExpiry) {
        throw new Error(
          `Collateral reservation has expired (expired at ${bridge.reservationExpiry.toISOString()}). ` +
          `Please create a new deposit.`
        );
      }
    }
    
    // Use total amount directly (UBA = drops for XRP)
    // totalAmountUBA already includes both base amount and fee
    const amountDrops = bridge.totalAmountUBA;
    
    // Map network
    const network: "mainnet" | "testnet" = this.config.network === "mainnet" ? "mainnet" : "testnet";
    
    return {
      bridgeId: bridge.id,
      destination: bridge.agentUnderlyingAddress,
      amountDrops,
      memo: bridge.paymentReference,
      network,
    };
  }

  async executeMintingWithProof(bridgeId: string, xrplTxHash: string): Promise<void> {
    console.log(`⏳ Executing minting with FDC proof for bridge ${bridgeId}`);
    
    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized. This should never happen in production mode.");
    }
    
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) throw new Error("Bridge not found");
    
    // Check if bridge is expired
    if (this.isBridgeExpired(bridge)) {
      const errorMsg = `Bridge ${bridgeId} has expired (expiresAt: ${bridge.expiresAt?.toISOString()})`;
      console.warn(`⚠️ ${errorMsg}`);
      await this.config.storage.updateBridge(bridgeId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: 'expired'
      });
      throw new Error(errorMsg);
    }

    // Check if bridge is in terminal state
    if (this.isBridgeTerminal(bridge)) {
      throw new Error(`Bridge ${bridgeId} is in terminal state: ${bridge.status}. Cannot process minting.`);
    }
    
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
      
      const fdcResult = await generateFDCProof(
        xrplTxHash, 
        this.config.network, 
        this.config.flareClient,
        unixTimestamp
      );
      console.log(`✅ FDC proof generated for tx: ${xrplTxHash}`);
      console.log(`   Attestation Tx Hash: ${fdcResult.attestationTxHash}`);
      console.log(`   Voting Round ID: ${fdcResult.votingRoundId}`);
      
      const mintingTxHash = await this.fassetsClient.executeMinting(
        fdcResult.proof,
        BigInt(bridge.collateralReservationId)
      );
      
      // Parse actual minted amount from Transfer events (FXRP uses 6 decimals, not 18)
      const actualFxrpMinted = await this.parseActualMintedAmount(mintingTxHash);
      
      console.log(`✅ Minting executed on Flare: ${mintingTxHash}`);
      console.log(`   Expected: ${bridge.fxrpExpected} FXRP`);
      console.log(`   Actual minted: ${actualFxrpMinted} FXRP`);
      
      // Update bridge status with actual minting transaction hash and attestation details
      await this.config.storage.updateBridgeStatus(bridgeId, "completed", {
        xrplTxHash: xrplTxHash,
        flareTxHash: mintingTxHash,
        fdcAttestationTxHash: fdcResult.attestationTxHash,
        fdcVotingRoundId: fdcResult.votingRoundId.toString(),
        fdcProofHash: JSON.stringify(fdcResult.proof),
        fxrpReceived: actualFxrpMinted, // Use actual minted amount from Transfer event
        fxrpReceivedAt: new Date(),
        completedAt: new Date(),
      });
      
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
      
      // Parse actual minted amount from Transfer events (FXRP uses 6 decimals, not 18)
      const actualFxrpMinted = await this.parseActualMintedAmount(mintingTxHash);
      
      console.log(`✅ Retry successful! Minting executed on Flare: ${mintingTxHash}`);
      console.log(`   Expected: ${bridge.fxrpExpected} FXRP`);
      console.log(`   Actual minted: ${actualFxrpMinted} FXRP`);
      
      // Update bridge status to completed
      await this.config.storage.updateBridgeStatus(bridgeId, "completed", {
        xrplTxHash: bridge.xrplTxHash,
        flareTxHash: mintingTxHash,
        fdcProofHash: JSON.stringify(proof),
        fxrpReceived: actualFxrpMinted, // Use actual minted amount from Transfer event
        fxrpReceivedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null, // Clear error message
      });
      
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
   * Attempt to reconcile a failed or stuck bridge
   * Returns true if reconciliation was successful or in progress
   */
  async reconcileBridge(bridgeId: string): Promise<{ success: boolean; message: string; action?: string }> {
    console.log(`🔍 Attempting to reconcile bridge ${bridgeId}...`);
    
    const bridge = await this.config.storage.getBridgeById(bridgeId);
    if (!bridge) {
      return { success: false, message: "Bridge not found" };
    }

    console.log(`   Current status: ${bridge.status}`);
    console.log(`   Error message: ${bridge.errorMessage || 'none'}`);

    try {
      // FDC timeout - can retry proof generation
      if (bridge.status === "fdc_timeout") {
        console.log(`   ✅ Recoverable: FDC timeout - retrying proof generation`);
        await this.retryProofGeneration(bridgeId);
        return { 
          success: true, 
          message: "Retrying FDC proof generation",
          action: "retry_proof" 
        };
      }

      // Vault mint failed - can retry vault minting
      if (bridge.status === "vault_mint_failed") {
        console.log(`   ✅ Recoverable: Vault mint failed - retrying vault minting`);
        await this.completeBridgeWithVaultMinting(bridgeId);
        return { 
          success: true, 
          message: "Retrying vault share minting",
          action: "retry_vault_mint" 
        };
      }

      // Failed status with recoverable errors
      if (bridge.status === "failed" && bridge.errorMessage) {
        const errorMsg = bridge.errorMessage.toLowerCase();

        // "Already known" error - the transaction might have been mined
        if (errorMsg.includes("already known")) {
          console.log(`   ✅ Recoverable: "Already known" error - attempting to resume from XRPL payment`);
          if (bridge.xrplTxHash) {
            await this.executeMintingWithProof(bridgeId, bridge.xrplTxHash);
            return { 
              success: true, 
              message: "Resuming from XRPL payment confirmation",
              action: "resume_from_xrpl" 
            };
          } else {
            return { 
              success: false, 
              message: "Cannot resume: Missing XRPL transaction hash" 
            };
          }
        }

        // "Attestation request not found" - proof might be available now
        if (errorMsg.includes("attestation request not found")) {
          console.log(`   ✅ Recoverable: Attestation not found - retrying proof generation`);
          if (bridge.xrplTxHash) {
            await this.executeMintingWithProof(bridgeId, bridge.xrplTxHash);
            return { 
              success: true, 
              message: "Retrying FDC proof generation",
              action: "retry_proof_generation" 
            };
          } else {
            return { 
              success: false, 
              message: "Cannot retry: Missing XRPL transaction hash" 
            };
          }
        }

        // FDC-related errors
        if (errorMsg.includes("fdc") || errorMsg.includes("timeout")) {
          console.log(`   ✅ Recoverable: FDC-related error - retrying`);
          if (bridge.xrplTxHash) {
            await this.executeMintingWithProof(bridgeId, bridge.xrplTxHash);
            return { 
              success: true, 
              message: "Retrying FDC proof generation",
              action: "retry_fdc" 
            };
          } else {
            return { 
              success: false, 
              message: "Cannot retry: Missing XRPL transaction hash" 
            };
          }
        }
      }

      // Stuck at xrpl_confirmed without proof
      if (bridge.status === "xrpl_confirmed" && !bridge.fdcProofData) {
        console.log(`   ✅ Recoverable: Stuck at XRPL confirmed - generating proof`);
        if (!bridge.xrplTxHash) {
          return { 
            success: false, 
            message: "Cannot resume: Missing XRPL transaction hash" 
          };
        }
        await this.executeMintingWithProof(bridgeId, bridge.xrplTxHash);
        return { 
          success: true, 
          message: "Resuming proof generation",
          action: "resume_proof" 
        };
      }

      // Stuck at fdc_proof_generated without minting
      if (bridge.status === "fdc_proof_generated" && !bridge.flareTxHash) {
        console.log(`   ✅ Recoverable: Stuck at FDC proof generated - executing minting`);
        if (!bridge.fdcProofData) {
          return { 
            success: false, 
            message: "Cannot mint: Missing FDC proof data" 
          };
        }
        if (!bridge.collateralReservationId) {
          return { 
            success: false, 
            message: "Cannot mint: Missing collateral reservation ID" 
          };
        }
        // Resume minting process
        await this.completeBridgeWithVaultMinting(bridgeId);
        return { 
          success: true, 
          message: "Resuming minting process",
          action: "resume_minting" 
        };
      }

      // Not recoverable
      console.log(`   ❌ Not recoverable: Status=${bridge.status}, no matching recovery pattern`);
      return { 
        success: false, 
        message: `Bridge status '${bridge.status}' is not automatically recoverable` 
      };

    } catch (error) {
      console.error(`❌ Reconciliation failed for bridge ${bridgeId}:`, error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown reconciliation error" 
      };
    }
  }

  /**
   * Reconcile all recoverable bridges
   * Returns summary of reconciliation attempts
   */
  async reconcileAll(): Promise<{ 
    total: number; 
    successful: number; 
    failed: number; 
    results: Array<{ bridgeId: string; success: boolean; message: string }> 
  }> {
    console.log(`🔄 Starting bulk reconciliation...`);
    
    const recoverableBridges = await this.config.storage.getRecoverableBridges();
    console.log(`   Found ${recoverableBridges.length} recoverable bridge(s)`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const bridge of recoverableBridges) {
      const result = await this.reconcileBridge(bridge.id);
      results.push({
        bridgeId: bridge.id,
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    console.log(`✅ Bulk reconciliation complete: ${successful} successful, ${failed} failed`);

    return {
      total: recoverableBridges.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Reconcile all recoverable bridges on startup
   * This is a specialized version of reconcileAll() for server initialization
   * Returns detailed stats for logging and monitoring
   */
  async reconcileRecoverableBridgesOnStartup(): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    failures: Array<{ bridgeId: string; error: string; status: string }>;
  }> {
    const stats = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      failures: [] as Array<{ bridgeId: string; error: string; status: string }>,
    };

    try {
      console.log(`\n🔄 [STARTUP RECONCILIATION] Starting automatic recovery of stuck bridges...`);
      
      const recoverableBridges = await this.config.storage.getRecoverableBridges();
      stats.attempted = recoverableBridges.length;
      
      if (recoverableBridges.length === 0) {
        console.log(`   ✅ No recoverable bridges found`);
        return stats;
      }

      console.log(`   Found ${recoverableBridges.length} recoverable bridge(s)`);

      // Process bridges sequentially to avoid overwhelming services
      for (const bridge of recoverableBridges) {
        try {
          console.log(`   Processing bridge ${bridge.id} (status: ${bridge.status})`);
          const result = await this.reconcileBridge(bridge.id);
          
          if (result.success) {
            stats.succeeded++;
            console.log(`   ✅ Successfully reconciled bridge ${bridge.id}`);
          } else {
            stats.failed++;
            stats.failures.push({
              bridgeId: bridge.id,
              error: result.message,
              status: bridge.status,
            });
            console.warn(`   ⚠️  Failed to reconcile bridge ${bridge.id}: ${result.message}`);
          }
        } catch (error) {
          stats.failed++;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          stats.failures.push({
            bridgeId: bridge.id,
            error: errorMsg,
            status: bridge.status,
          });
          console.error(`   ❌ Error reconciling bridge ${bridge.id}:`, error);
        }
      }

      console.log(
        `\n✅ [STARTUP RECONCILIATION] Complete: ${stats.succeeded}/${stats.attempted} succeeded, ${stats.failed} failed`
      );

      // Log failed bridges at warn level for monitoring
      if (stats.failures.length > 0) {
        console.warn(`\n⚠️  [STARTUP RECONCILIATION] Failed bridges:`, 
          stats.failures.map(f => `${f.bridgeId} (${f.status}): ${f.error}`).join('\n   ')
        );
      }

    } catch (error) {
      console.error(`\n❌ [STARTUP RECONCILIATION] Unexpected error:`, error);
      // Don't throw - let server continue even if reconciliation fails
    }

    return stats;
  }

  /**
   * Redeem FXRP to XRP via FAssets protocol (reverse of minting flow)
   * 
   * @param redemptionId - Redemption record ID
   * @param fxrpAmount - Amount of FXRP to redeem (decimal string, e.g., "20.000000")
   * @param receiverXrplAddress - XRPL wallet address to receive XRP
   * @returns Transaction hash of FAssets redemption request
   * 
   * Flow:
   * 1. Request redemption from AssetManager (burns FXRP, creates redemption request)
   * 2. FAssets agent sends XRP to receiverXrplAddress
   * 3. Generate FDC attestation proof for agent's payment
   * 4. Confirm redemption payment to release agent's collateral
   */
  async redeemFxrpToXrp(
    redemptionId: string,
    fxrpAmount: string,
    receiverXrplAddress: string
  ): Promise<string> {
    console.log(`\n🔄 Starting FXRP → XRP redemption`);
    console.log(`   Redemption ID: ${redemptionId}`);
    console.log(`   FXRP Amount: ${fxrpAmount}`);
    console.log(`   Receiver XRPL Address: ${receiverXrplAddress}`);

    if (this._demoMode) {
      return await this.executeFAssetsRedemptionDemo(redemptionId, fxrpAmount, receiverXrplAddress);
    }

    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized. This should never happen in production mode.");
    }

    try {
      // Step 1: Request redemption from AssetManager
      console.log("⏳ Step 1: Requesting FXRP redemption from AssetManager...");
      
      const redemptionRequest = await this.fassetsClient.requestRedemption(
        fxrpAmount,
        receiverXrplAddress
      );

      // Step 2: Query redemption details to get assigned agent
      console.log("⏳ Step 2: Querying redemption request for agent details...");
      
      const redemptionDetails = await this.fassetsClient.getRedemptionRequest(redemptionRequest.requestId);
      
      console.log(`✅ Agent assigned to redemption:`);
      console.log(`   Agent Vault (Flare): ${redemptionDetails.agentVault}`);
      console.log(`   Agent XRPL Address: ${redemptionDetails.paymentAddress}`);
      
      // Calculate expected XRP amount in drops for matching (FXRP and XRP both use 6 decimals)
      const expectedXrpDrops = ethers.parseUnits(fxrpAmount, 6).toString();
      
      // Update redemption status with redemption details AND agent info
      await this.config.storage.updateRedemptionStatus(redemptionId, "redeeming_fxrp", {
        fassetsRedemptionTxHash: redemptionRequest.txHash,
        redemptionRequestId: redemptionRequest.requestId.toString(),
        agentVaultAddress: redemptionDetails.agentVault,
        agentUnderlyingAddress: redemptionDetails.paymentAddress,
        expectedXrpDrops: expectedXrpDrops,
      });

      // Subscribe XRPL listener to monitor for redemption payment from agent to user
      if (this.xrplListener) {
        await this.xrplListener.subscribeUserForRedemption(receiverXrplAddress);
        console.log(`🔔 XRPL listener now monitoring user ${receiverXrplAddress} for redemption payment`);
        console.log(`   Expecting payment from agent: ${redemptionDetails.paymentAddress}`);
      }

      console.log(`✅ Redemption requested from FAssets`);
      console.log(`   Request ID: ${redemptionRequest.requestId}`);
      console.log(`   TX Hash: ${redemptionRequest.txHash}`);
      console.log(`   Agent XRPL Address: ${redemptionDetails.paymentAddress}`);
      console.log(`   Agent will send XRP to: ${receiverXrplAddress}`);
      console.log("");
      console.log("   ⏳ Waiting for FAssets agent to send XRP...");
      console.log("   After agent payment, executeFassetsRedemptionPayment() will be called");

      return redemptionRequest.txHash;
    } catch (error) {
      console.error("Error requesting FAssets redemption:", error);
      await this.config.storage.updateRedemptionStatus(redemptionId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error during redemption request",
      });
      throw error;
    }
  }

  /**
   * Execute FAssets redemption payment confirmation with FDC proof
   * This is called after the FAssets agent sends XRP to the user
   * 
   * @param redemptionId - Redemption record ID
   * @param xrplTxHash - XRPL transaction hash of agent's payment
   * @returns Transaction hash of redemption payment confirmation
   */
  async executeFassetsRedemptionPayment(
    redemptionId: string,
    xrplTxHash: string
  ): Promise<string> {
    console.log(`\n🔐 Confirming FAssets redemption payment`);
    console.log(`   Redemption ID: ${redemptionId}`);
    console.log(`   XRPL TX Hash: ${xrplTxHash}`);

    const redemption = await this.config.storage.getRedemptionById(redemptionId);
    if (!redemption) {
      throw new Error(`Redemption ${redemptionId} not found`);
    }

    if (!redemption.redemptionRequestId) {
      throw new Error(`Redemption ${redemptionId} does not have a request ID`);
    }

    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized");
    }

    try {
      // Update status to indicate we're awaiting proof
      await this.config.storage.updateRedemptionStatus(redemptionId, "awaiting_proof", {
        xrplPayoutTxHash: xrplTxHash,
        xrplPayoutAt: new Date(),
      });

      // Generate FDC attestation proof for the XRP payment
      console.log("⏳ Generating FDC attestation proof for XRP payment...");
      const proof = await generateFDCProof(xrplTxHash, this.config.network, this.config.flareClient);

      console.log(`✅ FDC proof generated`);
      console.log(`   Voting Round: ${proof.votingRoundId}`);

      // Update redemption with proof data
      await this.config.storage.updateRedemption(redemptionId, {
        fdcProofHash: proof.attestationTxHash,
        fdcProofData: JSON.stringify(proof),
      });

      // Confirm redemption payment to AssetManager
      console.log("⏳ Confirming redemption payment to AssetManager...");
      const confirmTxHash = await this.fassetsClient.confirmRedemptionPayment(
        proof,
        BigInt(redemption.redemptionRequestId)
      );

      console.log(`✅ Redemption payment confirmed: ${confirmTxHash}`);

      // Update redemption to completed
      await this.config.storage.updateRedemptionStatus(redemptionId, "completed", {
        fdcAttestationTxHash: confirmTxHash,
      });

      return confirmTxHash;
    } catch (error) {
      console.error("Error confirming redemption payment:", error);
      await this.config.storage.updateRedemptionStatus(redemptionId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error during redemption confirmation",
      });
      throw error;
    }
  }

  /**
   * Demo mode: Simulate FXRP redemption without actual FAssets interaction
   */
  private async executeFAssetsRedemptionDemo(
    redemptionId: string,
    fxrpAmount: string,
    receiverXrplAddress: string
  ): Promise<string> {
    console.log("\n⚠️  DEMO MODE: Simulating FXRP → XRP redemption");
    console.log("   (No actual FAssets protocol interaction)");
    console.log("");

    // Simulate redemption request
    const demoRedemptionRequestId = `demo-redemption-${Date.now()}`;
    const demoTxHash = `0xDEMOREDEMPTION${Date.now().toString(16)}`;
    const demoAgentAddress = `rDEMOAgent${Date.now().toString(36)}`;
    
    // Calculate expected XRP amount in drops for matching (FXRP and XRP both use 6 decimals)
    const expectedXrpDrops = ethers.parseUnits(fxrpAmount, 6).toString();

    await this.config.storage.updateRedemptionStatus(redemptionId, "redeeming_fxrp", {
      fassetsRedemptionTxHash: demoTxHash,
      redemptionRequestId: demoRedemptionRequestId,
      agentVaultAddress: "0xDEMO" + Date.now().toString(16).slice(-8),
      agentUnderlyingAddress: demoAgentAddress,
      expectedXrpDrops: expectedXrpDrops,
    });

    // Subscribe XRPL listener to monitor for redemption payment (demo mode)
    if (this.xrplListener) {
      await this.xrplListener.subscribeUserForRedemption(receiverXrplAddress);
      console.log(`🔔 [DEMO] XRPL listener now monitoring user ${receiverXrplAddress} for redemption payment`);
      console.log(`   Expecting payment from demo agent: ${demoAgentAddress}`);
    }

    console.log("   [1/3] Redemption requested from AssetManager...");
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate agent sending XRP
    console.log("   [2/3] Agent sending XRP to depositor...");
    const demoXrplTxHash = `DEMO-XRPL-PAYOUT-${Date.now().toString(16)}`;
    await this.config.storage.updateRedemptionStatus(redemptionId, "xrpl_payout", {
      xrplPayoutTxHash: demoXrplTxHash,
      xrplPayoutAt: new Date(),
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate redemption confirmation
    console.log("   [3/3] Confirming redemption payment...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Demo mode: Skip blockchain calls but still update user's position and create transaction
    console.log("📝 Demo mode: Updating position and creating transaction...");
    
    // Get redemption to access positionId, vaultId, shareAmount
    const redemption = await this.config.storage.getRedemptionById(redemptionId);
    if (!redemption) {
      throw new Error("Redemption not found");
    }
    
    // Update position balance (deduct shXRP)
    const position = await this.config.storage.getPosition(redemption.positionId);
    if (!position) {
      throw new Error("Position not found");
    }
    
    const newBalance = parseFloat(position.amount) - parseFloat(redemption.shareAmount);
    await this.config.storage.updatePosition(redemption.positionId, {
      amount: newBalance.toFixed(6),
    });
    
    // Create withdrawal transaction record
    await this.config.storage.createTransaction({
      vaultId: redemption.vaultId,
      positionId: redemption.positionId,
      type: "withdrawal",
      amount: redemption.shareAmount,
      rewards: "0",
      status: "completed",
      txHash: `demo-redemption-${redemptionId}`,
      network: this.config.network === "mainnet" ? "mainnet" : "testnet",
    });
    
    console.log("✅ Demo mode: Position and transaction updated");
    
    // Now mark as completed
    await this.config.storage.updateRedemptionStatus(redemptionId, "completed", {
      fdcProofHash: `0xDEMOPROOF${Date.now().toString(16)}`,
      fdcAttestationTxHash: `0xDEMOCONFIRM${Date.now().toString(16)}`,
      completedAt: new Date(),
      fxrpRedeemed: redemption.shareAmount,
      xrpSent: redemption.shareAmount,
    });

    console.log("   ✅ Demo redemption completed successfully");
    console.log("");
    console.log("   To enable real FAssets:");
    console.log("   - Set DEMO_MODE=false environment variable");

    return demoTxHash;
  }

  /**
   * Check bridge status and retry if needed
   */
  async processPendingBridges(): Promise<void> {
    // TODO: Query pending bridges and retry failed ones
    console.log("Checking for pending bridges...");
  }

  /**
   * Phase 3: Generate FDC proof for redemption payment (agent→user)
   * This is called after the XRPL listener detects the agent sending XRP to the user
   */
  async generateFDCProofForRedemption(
    xrplTxHash: string,
    redemptionId: string
  ): Promise<{ proof: any; attestationTxHash: string; votingRoundId: number }> {
    console.log(`\n🔄 Generating FDC proof for redemption ${redemptionId}`);
    
    // Fetch XRPL transaction for timestamp
    const { Client } = await import("xrpl");
    const network = this.config.network === "mainnet" 
      ? "wss://xrplcluster.com" 
      : "wss://s.altnet.rippletest.net:51233";
    
    const client = new Client(network);
    await client.connect();
    
    const txResponse = await client.request({
      command: "tx",
      transaction: xrplTxHash,
    });
    await client.disconnect();
    
    if (!txResponse.result?.validated) {
      throw new Error("XRPL transaction not validated yet");
    }
    
    // Calculate Unix timestamp from Ripple epoch (matching existing pattern)
    const rippleEpochOffset = 946684800;
    const result = txResponse.result as any;
    let rippleTimestamp: number | null = null;
    
    if (result.date !== undefined) {
      rippleTimestamp = Number(result.date);
    } else if (result.tx?.date !== undefined) {
      rippleTimestamp = Number(result.tx.date);
    } else if (result.tx_json?.date !== undefined) {
      rippleTimestamp = Number(result.tx_json.date);
    }
    
    if (rippleTimestamp === null || !isFinite(rippleTimestamp)) {
      throw new Error("Could not extract valid timestamp from XRPL transaction");
    }
    
    const unixTimestamp = rippleTimestamp + rippleEpochOffset;
    
    // Generate FDC proof (reuse existing generateFDCProof function)
    const fdcResult = await generateFDCProof(
      xrplTxHash,
      this.config.network,
      this.config.flareClient,
      unixTimestamp
    );
    
    console.log(`✅ FDC proof generated`);
    console.log(`   Attestation TX: ${fdcResult.attestationTxHash}`);
    console.log(`   Voting Round: ${fdcResult.votingRoundId}`);
    
    return fdcResult;
  }

  /**
   * Confirm redemption payment on FAssets contract
   * This submits the FDC proof to complete the redemption
   */
  async confirmRedemptionPayment(
    proof: any,
    requestId: bigint
  ): Promise<string> {
    if (!this.fassetsClient) {
      throw new Error("FAssetsClient not initialized");
    }
    
    console.log(`\n✅ Confirming redemption payment on FAssets contract`);
    const txHash = await this.fassetsClient.confirmRedemptionPayment(proof, requestId);
    console.log(`✅ Redemption payment confirmed: ${txHash}`);
    
    return txHash;
  }

  /**
   * Handler called by XRPL listener when agent→user payment is detected
   * Triggers Phase 3 background worker in non-blocking mode
   */
  async handleRedemptionPayment(payment: RedemptionPayment): Promise<void> {
    console.log(`\n💰 Redemption payment detected!`);
    console.log(`   Redemption ID: ${payment.redemptionId}`);
    console.log(`   User: ${payment.userAddress}`);
    console.log(`   Agent: ${payment.agentAddress}`);
    console.log(`   Amount: ${payment.amount} XRP`);
    console.log(`   TX Hash: ${payment.txHash}`);
    
    // Trigger Phase 3 in background (don't await)
    this.processRedemptionConfirmation(payment.redemptionId, payment.txHash).catch(error => {
      console.error(`Phase 3 failed for redemption ${payment.redemptionId}:`, error);
    });
  }

  /**
   * Phase 3 Background Worker: Process redemption confirmation
   * This orchestrates the complete redemption confirmation flow:
   * 1. Generate FDC proof of agent→user payment
   * 2. Confirm redemption payment on FAssets contract
   * 3. Update position balance (deduct shXRP)
   * 4. Create withdrawal transaction record
   * 5. Mark redemption as completed
   */
  async processRedemptionConfirmation(
    redemptionId: string,
    xrplTxHash: string
  ): Promise<void> {
    try {
      console.log(`\n🔄 Starting redemption confirmation (Phase 3)`);
      console.log(`   Redemption ID: ${redemptionId}`);
      console.log(`   XRPL TX Hash: ${xrplTxHash}`);
      
      const redemption = await this.config.storage.getRedemptionById(redemptionId);
      if (!redemption) throw new Error("Redemption not found");
      
      // Update status to xrpl_payout
      await this.config.storage.updateRedemptionStatus(redemptionId, "xrpl_payout", {
        xrplPayoutTxHash: xrplTxHash,
        xrplPayoutAt: new Date(),
      });
      
      // Step 1: Generate FDC proof of agent→user payment
      console.log("⏳ Step 1: Generating FDC proof...");
      const fdcResult = await this.generateFDCProofForRedemption(
        xrplTxHash,
        redemptionId
      );
      
      // Step 2: Confirm redemption payment on FAssets contract
      console.log("⏳ Step 2: Confirming redemption payment...");
      const confirmationTxHash = await this.confirmRedemptionPayment(
        fdcResult.proof,
        BigInt(redemption.redemptionRequestId!)
      );
      
      // Step 3: Update position balance (deduct shXRP)
      console.log("⏳ Step 3: Updating position balance...");
      const position = await this.config.storage.getPosition(redemption.positionId);
      if (!position) throw new Error("Position not found");
      
      const newBalance = parseFloat(position.amount) - parseFloat(redemption.shareAmount);
      await this.config.storage.updatePosition(redemption.positionId, {
        amount: newBalance.toFixed(6)
      });
      
      // Step 4: Create withdrawal transaction record
      console.log("⏳ Step 4: Creating transaction record...");
      await this.config.storage.createTransaction({
        vaultId: redemption.vaultId,
        positionId: redemption.positionId,
        type: "withdrawal",
        amount: redemption.fxrpRedeemed || "0",
        rewards: "0",
        status: "completed",
        txHash: xrplTxHash,
        network: this.config.network === "mainnet" ? "mainnet" : "testnet",
      });
      
      // Step 5: Mark redemption as completed
      await this.config.storage.updateRedemptionStatus(redemptionId, "completed", {
        fdcAttestationTxHash: fdcResult.attestationTxHash,
        fdcVotingRoundId: fdcResult.votingRoundId.toString(),
        fdcProofHash: JSON.stringify(fdcResult.proof),
        confirmationTxHash: confirmationTxHash,
        completedAt: new Date(),
      });
      
      // Unsubscribe user address from listener (cleanup)
      if (this.xrplListener) {
        await this.xrplListener.unsubscribeUserAddress(redemption.walletAddress);
      }
      
      console.log(`✅ Redemption ${redemptionId} completed successfully`);
      console.log(`   XRP sent to: ${redemption.walletAddress}`);
      console.log(`   Amount: ${redemption.fxrpRedeemed} FXRP → ${redemption.xrpSent} XRP`);
      
    } catch (error) {
      // Handle FDC timeout separately
      if (error instanceof FDCTimeoutError) {
        console.warn(`⏰ FDC timeout for redemption ${redemptionId}`);
        await this.config.storage.updateRedemptionStatus(redemptionId, "awaiting_proof", {
          errorMessage: `FDC proof timeout. Will retry.`,
          fdcVotingRoundId: error.votingRoundId.toString(),
          fdcRequestBytes: error.requestBytes,
        });
        return; // Don't throw - timeout is recoverable
      }
      
      // Other errors are terminal
      console.error(`❌ Redemption confirmation failed:`, error);
      await this.config.storage.updateRedemptionStatus(redemptionId, "failed", {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
