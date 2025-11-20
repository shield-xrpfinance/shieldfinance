import { ethers } from "ethers";
import type { IStorage } from "../storage";
import type { FlareClient } from "../utils/flare-client";
import type { FAssetsClient } from "../utils/fassets-client";
import type { BridgeService } from "./BridgeService";

// Service state key for persistent block tracking
const LAST_CHECKED_BLOCK_KEY = "deposit_watchdog_last_block";

// Maximum block range to query in a single scan (for safety and RPC limits)
// Flare RPC only allows max 30 blocks per getLogs query
// Block range is INCLUSIVE, so max 30 blocks means toBlock - fromBlock = 29
const MAX_BLOCK_RANGE = 29;

// Default starting block offset (if no persisted state)
const DEFAULT_BLOCK_LOOKBACK = 29;

export interface DepositWatchdogConfig {
  storage: IStorage;
  flareClient: FlareClient;
  fassetsClient: FAssetsClient;
  bridgeService: BridgeService;
  pollIntervalMs?: number; // Default: 60000 (60 seconds)
}

/**
 * DepositWatchdogService - Persistent background service to complete stuck deposits
 * 
 * Problem Solved: Deposits stuck at `xrpl_confirmed` status
 * - XRPL payment confirmed but FXRP mint transaction not yet indexed
 * - Race conditions where mint completes before status updates
 * - Network delays causing mint to complete after initial check
 * 
 * Solution:
 * 1. Poll for deposits with status='xrpl_confirmed' every 60 seconds
 * 2. Query FAssets AssetManager for mint events using payment reference
 * 3. Parse FXRP Transfer event to get actual minted amount and tx hash
 * 4. Update bridge record with mint details
 * 5. Trigger vault share minting to complete deposit flow
 * 
 * This watchdog ensures NO deposits get stuck permanently!
 */
export class DepositWatchdogService {
  private config: DepositWatchdogConfig;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private pollIntervalMs: number;

  constructor(config: DepositWatchdogConfig) {
    this.config = config;
    this.pollIntervalMs = config.pollIntervalMs || 60000; // 60 seconds default
  }

  /**
   * Start the watchdog service
   */
  start(): void {
    if (this.intervalHandle) {
      console.warn("⚠️  DepositWatchdogService already running");
      return;
    }

    console.log(`🐕 Starting DepositWatchdogService (poll interval: ${this.pollIntervalMs}ms)`);

    // Run immediately on startup
    this.processStuckDeposits().catch(error => {
      console.error("❌ Watchdog initial run failed:", error);
    });

    // Then poll on interval
    this.intervalHandle = setInterval(async () => {
      await this.processStuckDeposits();
    }, this.pollIntervalMs);

    console.log(`✅ DepositWatchdogService started`);
  }

  /**
   * Stop the watchdog service (for graceful shutdown)
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("✅ DepositWatchdogService stopped");
    }
  }

  /**
   * Main processing loop: Find and complete stuck deposits
   */
  private async processStuckDeposits(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log("⏭️  Watchdog already processing, skipping this cycle");
      return;
    }

    this.isProcessing = true;

    try {
      console.log("\n🔍 [WATCHDOG] Checking for stuck deposits...");

      // Query for deposits stuck at xrpl_confirmed
      const stuckDeposits = await this.config.storage.getBridgesByStatus(["xrpl_confirmed"]);

      if (stuckDeposits.length === 0) {
        console.log("   ✅ No stuck deposits found");
        return;
      }

      console.log(`   📋 Found ${stuckDeposits.length} deposit(s) stuck at xrpl_confirmed`);

      // Process each stuck deposit
      for (const bridge of stuckDeposits) {
        await this.processStuckDeposit(bridge.id);
      }

      console.log(`✅ [WATCHDOG] Cycle complete: Processed ${stuckDeposits.length} deposit(s)\n`);
    } catch (error) {
      console.error("❌ [WATCHDOG] Error during processing:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single stuck deposit
   * 
   * Algorithm:
   * 1. Query FAssets AssetManager for mint events matching payment reference
   * 2. Find FXRP Transfer event (from 0x0 to Smart Account)
   * 3. Parse actual minted amount and transaction hash
   * 4. Update bridge with mint completion details
   * 5. Trigger vault share minting
   */
  private async processStuckDeposit(bridgeId: string): Promise<void> {
    try {
      console.log(`\n   🔧 Processing stuck deposit: ${bridgeId}`);

      const bridge = await this.config.storage.getBridgeById(bridgeId);
      if (!bridge) {
        console.warn(`   ⚠️  Bridge ${bridgeId} not found, skipping`);
        return;
      }

      console.log(`      Status: ${bridge.status}`);
      console.log(`      Payment Reference: ${bridge.paymentReference || '(none)'}`);
      console.log(`      XRPL Confirmed At: ${bridge.xrplConfirmedAt?.toISOString() || '(none)'}`);

      // Safety check: Only process if still at xrpl_confirmed
      if (bridge.status !== "xrpl_confirmed") {
        console.log(`   ⏭️  Bridge ${bridgeId} no longer at xrpl_confirmed (now ${bridge.status}), skipping`);
        return;
      }

      // Check if we already have fxrpMintTxHash (idempotency)
      if (bridge.fxrpMintTxHash) {
        console.log(`   ⏭️  Bridge ${bridgeId} already has fxrpMintTxHash, completing vault minting...`);
        await this.config.bridgeService.completeBridgeWithVaultMinting(bridgeId);
        return;
      }

      // Required fields check
      if (!bridge.paymentReference) {
        console.warn(`   ⚠️  Bridge ${bridgeId} missing payment reference, cannot query mint`);
        await this.config.storage.updateBridge(bridgeId, {
          lastError: "Missing payment reference - cannot query FAssets mint",
        });
        return;
      }

      if (!bridge.collateralReservationId) {
        console.warn(`   ⚠️  Bridge ${bridgeId} missing collateral reservation ID`);
        await this.config.storage.updateBridge(bridgeId, {
          lastError: "Missing collateral reservation ID",
        });
        return;
      }

      console.log(`      ⏳ Querying FAssets contract for mint transaction...`);

      // Query FAssets AssetManager for mint event using payment reference
      const mintResult = await this.queryFAssetsMint(
        bridge.paymentReference,
        BigInt(bridge.collateralReservationId)
      );

      if (!mintResult) {
        console.log(`      ⏰ No mint transaction found yet for bridge ${bridgeId}`);
        console.log(`         Payment may still be processing on FAssets side`);
        console.log(`         Will retry in next cycle...`);
        return;
      }

      console.log(`      ✅ Found mint transaction!`);
      console.log(`         TX Hash: ${mintResult.txHash}`);
      console.log(`         FXRP Minted: ${mintResult.fxrpAmount}`);

      // Update bridge with flareTxHash BEFORE calling completeMint()
      console.log(`      📝 Updating bridge with flareTxHash...`);
      await this.config.storage.updateBridge(bridgeId, {
        flareTxHash: mintResult.txHash, // completeMint() requires this
        fxrpMintTxHash: mintResult.txHash, // Same tx contains both mint and transfer
        fxrpReceived: mintResult.fxrpAmount, // Store parsed amount for reference
        lastError: null, // Clear any previous errors
      });

      console.log(`      ✅ Bridge updated with flareTxHash: ${mintResult.txHash}`);

      // Call completeMint() which will handle status updates and vault minting
      console.log(`      ⏳ Calling completeMint() to finish deposit flow...`);
      await this.config.bridgeService.completeMint(bridgeId, bridge.xrplTxHash!);

      console.log(`   ✅ Stuck deposit ${bridgeId} fully recovered!`);
    } catch (error) {
      console.error(`   ❌ Error processing stuck deposit ${bridgeId}:`, error);
      
      // Store error for debugging but don't fail the entire watchdog
      await this.config.storage.updateBridge(bridgeId, {
        lastError: error instanceof Error ? error.message : "Unknown watchdog error",
      }).catch(updateError => {
        console.error(`   ❌ Failed to store error for bridge ${bridgeId}:`, updateError);
      });
    }
  }

  /**
   * Query FAssets AssetManager contract for mint transaction
   * 
   * Approach:
   * 1. Get last-checked block from persistent storage
   * 2. Query MintingExecuted events filtered by reservationId from last-checked block
   * 3. Find the transaction that contains FXRP Transfer event
   * 4. Parse the Transfer event to get actual minted amount
   * 5. Persist new last-checked block for next poll
   * 
   * @param paymentReference - Payment reference (hex string)
   * @param reservationId - Collateral reservation ID
   * @returns Mint result with tx hash and amount, or null if not found
   */
  private async queryFAssetsMint(
    paymentReference: string,
    reservationId: bigint
  ): Promise<{ txHash: string; fxrpAmount: string } | null> {
    try {
      // Get AssetManager contract instance from FAssetsClient
      const assetManagerContract = await this.config.fassetsClient.getAssetManagerContract();
      
      // Get current block number
      const currentBlock = await this.config.flareClient.provider.getBlockNumber();
      
      // Get last-checked block from persistent storage
      let fromBlock: number;
      const lastCheckedState = await this.config.storage.getServiceState(LAST_CHECKED_BLOCK_KEY);
      
      if (lastCheckedState) {
        // Resume from last-checked block + 1
        const lastCheckedBlock = parseInt(lastCheckedState.value, 10);
        fromBlock = lastCheckedBlock + 1;
        console.log(`         Resuming from last-checked block: ${lastCheckedBlock}`);
      } else {
        // First run - start from default lookback
        fromBlock = Math.max(0, currentBlock - DEFAULT_BLOCK_LOOKBACK);
        console.log(`         First run - starting from ${DEFAULT_BLOCK_LOOKBACK} blocks ago`);
      }
      
      // Cap the range to MAX_BLOCK_RANGE for safety
      if (currentBlock - fromBlock > MAX_BLOCK_RANGE) {
        fromBlock = currentBlock - MAX_BLOCK_RANGE;
        console.log(`         Capping range to ${MAX_BLOCK_RANGE} blocks (from block ${fromBlock})`);
      }
      
      console.log(`         Querying blocks ${fromBlock} to ${currentBlock}...`);
      
      // Query ALL MintingExecuted events and filter in code
      // Event: MintingExecuted(uint64 indexed collateralReservationId, address indexed agentVault, address indexed pool, uint256 mintedAmountUBA, uint256 feeUBA)
      const mintingExecutedFilter = assetManagerContract.filters.MintingExecuted();
      const allEvents = await assetManagerContract.queryFilter(mintingExecutedFilter, fromBlock, currentBlock);
      
      // Filter events by reservationId in code (safer than ethers filter)
      // Type guard: only EventLog has args property, Log does not
      const events = allEvents.filter((event): event is ethers.EventLog => {
        if (!('args' in event)) return false;
        const eventReservationId = event.args[0];
        return eventReservationId === reservationId;
      });
      
      if (events.length === 0) {
        console.log(`         No MintingExecuted events found for reservation ${reservationId}`);
        
        // Persist current block as last-checked even if no events found
        await this.config.storage.setServiceState(LAST_CHECKED_BLOCK_KEY, currentBlock.toString());
        
        return null;
      }

      console.log(`         Found ${events.length} MintingExecuted event(s) for reservation ${reservationId}`);
      
      // Take the first (and should be only) event
      const mintEvent = events[0];
      const txHash = mintEvent.transactionHash;
      
      console.log(`         Mint TX: ${txHash}`);
      console.log(`         Parsing FXRP Transfer event...`);
      
      // Parse actual minted amount from Transfer event in the same transaction
      const actualFxrpMinted = await this.parseActualMintedAmount(txHash);
      
      // Persist current block as last-checked after successful query
      await this.config.storage.setServiceState(LAST_CHECKED_BLOCK_KEY, currentBlock.toString());
      console.log(`         ✅ Persisted last-checked block: ${currentBlock}`);
      
      return {
        txHash,
        fxrpAmount: actualFxrpMinted,
      };
    } catch (error) {
      console.error(`         ❌ Error querying FAssets mint:`, error);
      throw error;
    }
  }

  /**
   * Parse actual minted FXRP amount from transaction receipt
   * (Copied from BridgeService for consistency)
   * 
   * FXRP uses 6 decimals (not 18 like typical ERC20s)
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
        
        console.log(`         ✅ Parsed FXRP amount: ${formattedAmount}`);
        
        return formattedAmount;
      }
    }
    
    // If no matching Transfer event found, throw error
    throw new Error(
      `No FXRP Transfer event found in transaction ${txHash}. ` +
      `Expected Transfer from ${zeroAddress} to ${smartAccountAddress} on token ${fxrpAddress}`
    );
  }
}
