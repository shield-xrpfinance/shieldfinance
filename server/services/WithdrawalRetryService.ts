import type { IStorage } from "../storage";
import type { FlareClient } from "../utils/flare-client";
import type { BridgeService } from "./BridgeService";
import { Client } from "xrpl";

export interface WithdrawalRetryConfig {
  storage: IStorage;
  flareClient: FlareClient;
  bridgeService: BridgeService;
  pollIntervalMs?: number; // Default: 60000 (60 seconds)
  minBalanceFLR?: string; // Minimum FLR balance required (default: "0.1")
  maxRetries?: number; // Maximum retry attempts (default: 10)
  retryBackoffMs?: number; // Exponential backoff base (default: 60000 = 1 min)
  prefundAmountFLR?: string; // Auto-prefund amount (default: "0.5")
  maxFundingAttempts?: number; // Max auto-prefunds per redemption (default: 3)
}

/**
 * WithdrawalRetryService - Auto-remediation for failed withdrawal confirmations
 * 
 * Problem Solved: Withdrawals stuck in `manual_review` when Smart Account lacks FLR for gas
 * - Backend needs FLR to submit confirmRedemptionPayment transaction
 * - When balance < 0.1 FLR, confirmation fails and marks manual_review
 * - User has XRP successfully but backend can't complete reconciliation
 * 
 * Solution:
 * 1. Poll for redemptions with backendStatus='manual_review' or 'retry_pending'
 * 2. Check Smart Account balance
 * 3. If balance >= 0.1 FLR, retry confirmation
 * 4. Update backendStatus back to "confirming" during retry
 * 5. Use exponential backoff to avoid hammering the network
 * 
 * This service ensures withdrawals complete backend reconciliation automatically!
 */
export class WithdrawalRetryService {
  private config: WithdrawalRetryConfig;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private pollIntervalMs: number;
  private minBalanceWei: bigint;
  private maxRetries: number;
  private retryBackoffMs: number;
  private prefundAmountFLR: string;
  private maxFundingAttempts: number;

  constructor(config: WithdrawalRetryConfig) {
    this.config = config;
    this.pollIntervalMs = config.pollIntervalMs || 60000; // 60 seconds default
    
    // Convert minimum balance to wei (default 0.1 FLR)
    const minBalanceFLR = config.minBalanceFLR || "0.1";
    this.minBalanceWei = BigInt(Math.floor(parseFloat(minBalanceFLR) * 1e18));
    
    this.maxRetries = config.maxRetries || 10;
    this.retryBackoffMs = config.retryBackoffMs || 60000; // 1 minute base
    this.prefundAmountFLR = config.prefundAmountFLR || "0.5"; // 0.5 FLR default
    this.maxFundingAttempts = config.maxFundingAttempts || 3; // Max 3 auto-prefunds
  }

  /**
   * Start the retry service
   */
  start(): void {
    if (this.intervalHandle) {
      console.warn("⚠️  WithdrawalRetryService already running");
      return;
    }

    console.log(`🔄 Starting WithdrawalRetryService (poll interval: ${this.pollIntervalMs}ms)`);
    console.log(`   Min balance required: ${Number(this.minBalanceWei) / 1e18} FLR`);
    console.log(`   Max retries: ${this.maxRetries}`);

    // Run immediately on startup
    this.processRetryQueue().catch(error => {
      console.error("❌ Retry service initial run failed:", error);
    });

    // Then poll on interval
    this.intervalHandle = setInterval(async () => {
      await this.processRetryQueue();
    }, this.pollIntervalMs);

    console.log(`✅ WithdrawalRetryService started`);
  }

  /**
   * Stop the retry service (for graceful shutdown)
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("✅ WithdrawalRetryService stopped");
    }
  }

  /**
   * Main processing loop: Find and retry failed withdrawal confirmations
   */
  private async processRetryQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log("⏭️  Retry service already processing, skipping this cycle");
      return;
    }

    this.isProcessing = true;

    try {
      console.log("\n🔍 [RETRY] Checking for failed withdrawal confirmations...");

      // First: Check for withdrawals with XRPL payouts that need userStatus update
      await this.confirmPendingPayouts();

      // Query for redemptions needing retry
      // Use a custom storage method that gets redemptions with:
      // - backendStatus IN ('manual_review', 'retry_pending')
      // - userStatus = 'completed' (user has XRP successfully)
      // - status = 'awaiting_proof' or 'xrpl_received'
      const failedRedemptions = await this.config.storage.getRedemptionsNeedingRetry();

      if (failedRedemptions.length === 0) {
        console.log("   ✅ No failed redemptions to retry");
        return;
      }

      console.log(`   📋 Found ${failedRedemptions.length} redemption(s) needing retry`);

      // Check Smart Account balance once (shared for all retries)
      const smartAccountBalance = await this.config.flareClient.getSmartAccountBalance();
      const balanceFLR = Number(smartAccountBalance) / 1e18;
      
      console.log(`   💰 Smart Account Balance: ${balanceFLR.toFixed(4)} FLR`);

      // If balance is low, attempt remediation
      if (smartAccountBalance < this.minBalanceWei) {
        console.warn(`   ⚠️  Smart Account balance too low for gas (${balanceFLR.toFixed(4)} FLR < ${Number(this.minBalanceWei) / 1e18} FLR)`);
        console.log(`   🔧 Attempting balance remediation...`);

        try {
          await this.remediateSmartAccountBalance();
          
          // Re-check balance after remediation
          const newBalance = await this.config.flareClient.getSmartAccountBalance();
          const newBalanceFLR = Number(newBalance) / 1e18;
          console.log(`   💰 New Smart Account Balance: ${newBalanceFLR.toFixed(4)} FLR`);
          
          if (newBalance < this.minBalanceWei) {
            console.error(`   ❌ Remediation failed - balance still too low (${newBalanceFLR.toFixed(4)} FLR < ${Number(this.minBalanceWei) / 1e18} FLR)`);
            console.warn(`      All ${failedRedemptions.length} redemption(s) will remain in retry queue`);
            return;
          }
          
          console.log(`   ✅ Remediation successful! Balance is now sufficient.`);
        } catch (error) {
          console.error(`   ❌ Failed to remediate balance:`, error);
          console.warn(`      All ${failedRedemptions.length} redemption(s) will remain in retry queue`);
          return;
        }
      } else {
        console.log(`   ✅ Smart Account has sufficient balance (${balanceFLR.toFixed(4)} FLR >= ${Number(this.minBalanceWei) / 1e18} FLR)`);
      }

      console.log(`   🚀 Proceeding with retries...`);

      // Process each failed redemption
      let successCount = 0;
      let failCount = 0;

      for (const redemption of failedRedemptions) {
        const result = await this.retryRedemptionConfirmation(redemption.id);
        if (result) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`✅ [RETRY] Cycle complete: ${successCount} succeeded, ${failCount} failed\n`);
    } catch (error) {
      console.error("❌ [RETRY] Error during processing:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check for XRPL payouts and update userStatus if transaction is confirmed
   * This resolves the issue where userStatus stays "processing" even after XRP arrives
   */
  private async confirmPendingPayouts(): Promise<void> {
    try {
      console.log("   📬 Checking for confirmed XRPL payouts...");

      // Get redemptions with XRPL payout transactions but userStatus not complete
      const pendingPayouts = await this.config.storage.getRedemptionsWithPendingPayouts();

      if (pendingPayouts.length === 0) {
        console.log("   ✅ No pending payouts to check");
        return;
      }

      console.log(`   📋 Found ${pendingPayouts.length} redemption(s) with pending payouts`);

      // Connect to XRPL to verify transactions
      const client = new Client("wss://s.altnet.rippletest.net:51233");
      await client.connect();

      try {
        for (const redemption of pendingPayouts) {
          if (!redemption.xrplPayoutTxHash) continue;

          try {
            // Check if transaction exists and is validated
            const txResponse = await client.request({
              command: "tx",
              transaction: redemption.xrplPayoutTxHash,
            });

            // If we got here, transaction exists
            if (txResponse.result && typeof txResponse.result === 'object') {
              const validated = (txResponse.result as any).validated;
              const resultCode = (txResponse.result as any).meta?.TransactionResult;

              if (validated && resultCode === "tesSUCCESS") {
                console.log(`   ✅ XRPL payout confirmed for ${redemption.id}`);
                console.log(`      TX: ${redemption.xrplPayoutTxHash}`);

                // Update userStatus to completed
                await this.config.storage.updateRedemption(redemption.id, {
                  userStatus: "completed",
                  completedAt: new Date(),
                });

                console.log(`      ✅ Updated userStatus to 'completed'`);

                // Award withdrawal points (25 pts) and create notification
                try {
                  const { pointsService } = await import("./PointsService");
                  const walletAddress = redemption.walletAddress;
                  
                  const pointsResult = await pointsService.awardWithdrawalPoints({
                    walletAddress,
                    txHash: redemption.xrplPayoutTxHash,
                    redemptionId: redemption.id,
                    amount: redemption.shareAmount,
                  });
                  
                  if (pointsResult) {
                    console.log(`      🎯 Awarded ${pointsResult.pointsAwarded} withdrawal points to ${walletAddress.slice(0, 10)}...`);
                    
                    // Create notification for withdrawal points
                    await this.config.storage.createUserNotification({
                      walletAddress: walletAddress.toLowerCase(),
                      type: "reward",
                      title: "Withdrawal Points Earned!",
                      message: `You earned ${pointsResult.pointsAwarded} points for completing a withdrawal.`,
                      metadata: { 
                        activityType: "withdrawal",
                        pointsEarned: pointsResult.pointsAwarded,
                        redemptionId: redemption.id,
                      },
                      read: false,
                    });
                  }
                } catch (pointsError) {
                  // Don't fail the withdrawal confirmation if points fail
                  console.error("      ⚠️  Failed to award withdrawal points:", pointsError);
                }
              }
            }
          } catch (error: any) {
            // Transaction might not exist yet or error occurred
            // This is expected for recent transactions, so don't log as error
            if (error.message && error.message.includes("txnNotFound")) {
              console.log(`   ⏳ XRPL payout ${redemption.xrplPayoutTxHash.slice(0, 10)}... not yet validated`);
            }
          }
        }
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error("❌ Error checking pending payouts:", error);
      // Don't throw - let the retry service continue
    }
  }

  /**
   * Retry a single redemption confirmation
   * 
   * @param redemptionId - Redemption ID to retry
   * @returns true if retry succeeded, false if failed or skipped
   */
  private async retryRedemptionConfirmation(redemptionId: string): Promise<boolean> {
    // Fetch redemption first to track retry count for error handling
    const redemption = await this.config.storage.getRedemptionById(redemptionId);
    if (!redemption) {
      console.warn(`   ⚠️  Redemption ${redemptionId} not found, skipping`);
      return false;
    }

    try {
      console.log(`\n   🔧 Retrying redemption confirmation: ${redemptionId}`);

      console.log(`      Current Status: ${redemption.status}`);
      console.log(`      Backend Status: ${redemption.backendStatus}`);
      console.log(`      User Status: ${redemption.userStatus}`);
      console.log(`      Retry Count: ${redemption.retryCount}`);
      console.log(`      Last Error: ${redemption.lastError || '(none)'}`);

      // Safety check: Don't retry if max retries exceeded
      if (redemption.retryCount && redemption.retryCount >= this.maxRetries) {
        console.error(`❌ Max retries exceeded for redemption ${redemptionId} - requires manual intervention`);
        
        await this.config.storage.updateRedemption(redemptionId, {
          backendStatus: "abandoned",
          userStatus: "failed",
          lastError: `Maximum retry attempts exceeded (${this.maxRetries}). Manual intervention required.`,
        });
        
        return false;
      }

      // Check if enough time has passed since last retry (exponential backoff)
      if (redemption.lastRetryAt) {
        const timeSinceLastRetry = Date.now() - redemption.lastRetryAt.getTime();
        const minWaitTime = this.retryBackoffMs * Math.pow(2, redemption.retryCount || 0); // Exponential backoff
        
        if (timeSinceLastRetry < minWaitTime) {
          const waitSecondsRemaining = Math.ceil((minWaitTime - timeSinceLastRetry) / 1000);
          console.log(`   ⏰ Too soon to retry (wait ${waitSecondsRemaining}s more)`);
          return false;
        }
      } else {
        // First retry attempt - no previous retry timestamp
        console.log(`   🆕 First retry attempt for redemption ${redemptionId}`);
      }

      // Required fields check
      if (!redemption.xrplPayoutTxHash) {
        console.warn(`   ⚠️  Redemption ${redemptionId} missing XRPL payout TX hash`);
        return false;
      }

      if (!redemption.redemptionRequestId) {
        console.warn(`   ⚠️  Redemption ${redemptionId} missing redemption request ID`);
        return false;
      }

      console.log(`      ⏳ Attempting confirmation retry...`);

      // Update status to retrying (preserves userStatus as completed)
      // NOTE: Do NOT update lastRetryAt or retryCount here - only after failure
      await this.config.storage.updateRedemption(redemptionId, {
        backendStatus: "retrying",
      });

      // Call BridgeService to execute the confirmation
      // This will:
      // 1. Generate FDC proof (if not already generated)
      // 2. Submit confirmRedemptionPayment transaction
      // 3. Update status to completed on success
      await this.config.bridgeService.executeFassetsRedemptionPayment(
        redemptionId,
        redemption.xrplPayoutTxHash
      );

      console.log(`   ✅ Retry succeeded for redemption ${redemptionId}!`);
      return true;
    } catch (error) {
      console.error(`   ❌ Retry failed for redemption ${redemptionId}:`, error);
      
      // CRITICAL: Update lastRetryAt and retryCount AFTER failed attempt (not before)
      // This ensures exponential backoff is calculated correctly on next cycle
      await this.config.storage.updateRedemption(redemptionId, {
        backendStatus: "retry_pending",
        lastRetryAt: new Date(), // Set AFTER failure, not before
        retryCount: redemption.retryCount + 1, // Increment AFTER failure, not before
        lastError: error instanceof Error ? error.message : "Unknown retry error",
      }).catch(updateError => {
        console.error(`   ❌ Failed to store error for redemption ${redemptionId}:`, updateError);
      });
      
      return false;
    }
  }

  /**
   * Remediate Smart Account balance using paymaster or auto-prefund
   * 
   * Strategy:
   * 1. If paymaster enabled → Skip prefunding (will use gasless transactions)
   * 2. Else → Auto-prefund from operator EOA
   */
  private async remediateSmartAccountBalance(): Promise<void> {
    // Option A: Check if paymaster is enabled
    if (this.config.flareClient.isPaymasterEnabled()) {
      console.log(`   💳 Paymaster is enabled - will use gasless transactions`);
      console.log(`      No prefunding needed - proceeding with paymaster-backed retries`);
      return;
    }

    // Option B: Auto-prefund from operator EOA
    console.log(`   💰 Paymaster not enabled - attempting auto-prefund from operator EOA`);
    
    try {
      // Prefund Smart Account
      const fundingTxHash = await this.config.flareClient.prefundSmartAccount(this.prefundAmountFLR);
      console.log(`   ✅ Auto-prefund successful: ${fundingTxHash}`);
    } catch (error) {
      console.error(`   ❌ Auto-prefund failed:`, error);
      throw error;
    }
  }

  /**
   * Remediate balance for a specific redemption (with guard rails)
   * 
   * This method checks funding attempts and respects max funding limits.
   */
  private async remediateRedemptionBalance(redemptionId: string): Promise<void> {
    const redemption = await this.config.storage.getRedemptionById(redemptionId);
    if (!redemption) {
      throw new Error(`Redemption ${redemptionId} not found`);
    }

    // Guard rail: Check funding attempts
    const fundingAttempts = redemption.fundingAttempts || 0;
    if (fundingAttempts >= this.maxFundingAttempts) {
      console.warn(`   ⚠️  Max funding attempts (${this.maxFundingAttempts}) exceeded for redemption ${redemptionId}`);
      throw new Error(`Max funding attempts exceeded - manual intervention required`);
    }

    console.log(`   📊 Funding attempt ${fundingAttempts + 1}/${this.maxFundingAttempts} for redemption ${redemptionId}`);

    // Remediate balance
    await this.remediateSmartAccountBalance();

    // Track funding attempt
    await this.config.storage.updateRedemption(redemptionId, {
      fundingAttempts: fundingAttempts + 1,
    });
  }

  /**
   * Manually trigger a retry for a specific redemption (for API endpoint)
   */
  async retryRedemption(redemptionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const redemption = await this.config.storage.getRedemptionById(redemptionId);
      if (!redemption) {
        return { success: false, message: "Redemption not found" };
      }

      // Check Smart Account balance
      const smartAccountBalance = await this.config.flareClient.getSmartAccountBalance();
      if (smartAccountBalance < this.minBalanceWei) {
        const balanceFLR = Number(smartAccountBalance) / 1e18;
        console.log(`   ⚠️  Low balance (${balanceFLR.toFixed(4)} FLR) - attempting remediation`);
        
        try {
          await this.remediateRedemptionBalance(redemptionId);
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : "Balance remediation failed",
          };
        }
      }

      const success = await this.retryRedemptionConfirmation(redemptionId);
      
      if (success) {
        return { success: true, message: "Redemption confirmation retry succeeded" };
      } else {
        return { success: false, message: "Redemption confirmation retry failed - see logs" };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error during manual retry",
      };
    }
  }
}
