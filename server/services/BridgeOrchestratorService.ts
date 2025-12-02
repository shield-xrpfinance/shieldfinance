/**
 * Bridge Orchestrator Service
 * 
 * Coordinates multi-leg cross-chain bridges with state machine for reliable execution.
 * Handles quote creation, job initiation, leg execution, and status tracking.
 * 
 * State Machine:
 * pending → quoted → confirmed → executing → (awaiting_source → awaiting_dest) per leg → completed
 *                                          ↓ on failure
 *                                     partially_failed → refunded
 */

import { db } from "../db";
import { 
  crossChainBridgeJobs, 
  crossChainBridgeLegs, 
  crossChainBridgeQuotes,
  CrossChainBridgeJob,
  CrossChainBridgeLeg,
  CrossChainBridgeQuote,
  InsertCrossChainBridgeJob,
  InsertCrossChainBridgeLeg,
  InsertCrossChainBridgeQuote,
} from "@shared/schema";
import { RouteRegistry, RouteQuote, RouteLeg } from "./RouteRegistry";
import { NetworkId, BridgeTokenId } from "@shared/bridgeConfig";
import { eq, and, desc } from "drizzle-orm";

export interface QuoteRequest {
  sourceNetwork: NetworkId;
  sourceToken: BridgeTokenId;
  destNetwork: NetworkId;
  destToken: BridgeTokenId;
  amount: string;
  slippageToleranceBps?: number;
}

export interface InitiateBridgeRequest {
  quoteId: string;
  walletAddress: string;
  recipientAddress: string;
}

export interface BridgeJobWithLegs extends CrossChainBridgeJob {
  legs: CrossChainBridgeLeg[];
}

class BridgeOrchestratorServiceClass {
  private readonly QUOTE_EXPIRY_MINUTES = 5;

  /**
   * Get a quote for a cross-chain bridge
   */
  async getQuote(request: QuoteRequest): Promise<RouteQuote | null> {
    const quote = await RouteRegistry.getQuote(
      request.sourceNetwork,
      request.sourceToken,
      request.destNetwork,
      request.destToken,
      request.amount,
      { slippageToleranceBps: request.slippageToleranceBps }
    );

    if (!quote) {
      return null;
    }

    // Store quote in database
    try {
      const quoteData: InsertCrossChainBridgeQuote = {
        sourceNetwork: quote.sourceNetwork,
        sourceToken: quote.sourceToken,
        sourceAmount: quote.sourceAmount,
        destNetwork: quote.destNetwork,
        destToken: quote.destToken,
        destAmountEstimate: quote.destAmountEstimate,
        route: quote.legs,
        totalFeeUsd: quote.totalFeeUsd.toString(),
        gasFeeUsd: quote.gasFeeUsd.toString(),
        bridgeFeeUsd: quote.bridgeFeeUsd.toString(),
        slippageUsd: quote.slippageUsd.toString(),
        estimatedTimeMinutes: quote.estimatedTimeMinutes,
        expiresAt: quote.expiresAt,
        priceData: quote.priceData,
      };

      const [insertedQuote] = await db.insert(crossChainBridgeQuotes)
        .values(quoteData)
        .returning();

      // Update quote ID with database ID
      quote.id = insertedQuote.id;

      console.log(`[BridgeOrchestrator] Quote stored: ${quote.id}`);
    } catch (error) {
      console.error("[BridgeOrchestrator] Failed to store quote:", error);
      // Continue with in-memory quote
    }

    return quote;
  }

  /**
   * Initiate a bridge job from a confirmed quote
   */
  async initiateBridge(request: InitiateBridgeRequest): Promise<BridgeJobWithLegs | null> {
    // Fetch and validate quote
    const [quote] = await db.select()
      .from(crossChainBridgeQuotes)
      .where(eq(crossChainBridgeQuotes.id, request.quoteId))
      .limit(1);

    if (!quote) {
      console.error(`[BridgeOrchestrator] Quote not found: ${request.quoteId}`);
      return null;
    }

    if (new Date() > quote.expiresAt) {
      console.error(`[BridgeOrchestrator] Quote expired: ${request.quoteId}`);
      return null;
    }

    const route = quote.route as RouteLeg[];

    // Create bridge job
    const jobData: InsertCrossChainBridgeJob = {
      walletAddress: request.walletAddress,
      sourceNetwork: quote.sourceNetwork,
      sourceToken: quote.sourceToken,
      sourceAmount: quote.sourceAmount,
      destNetwork: quote.destNetwork,
      destToken: quote.destToken,
      destAmount: quote.destAmountEstimate,
      recipientAddress: request.recipientAddress,
      route: route,
      totalLegs: route.length,
      currentLeg: 0,
      quoteId: quote.id,
      totalFeeUsd: quote.totalFeeUsd,
      estimatedTimeMinutes: quote.estimatedTimeMinutes,
      slippageToleranceBps: 50, // Default
      status: "confirmed",
      quotedAt: quote.createdAt,
      confirmedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour to complete
    };

    let job: CrossChainBridgeJob;
    try {
      const [insertedJob] = await db.insert(crossChainBridgeJobs)
        .values(jobData)
        .returning();
      job = insertedJob;
    } catch (error) {
      console.error("[BridgeOrchestrator] Failed to create job:", error);
      return null;
    }

    // Create legs
    const legs: CrossChainBridgeLeg[] = [];
    for (const leg of route) {
      const legData: InsertCrossChainBridgeLeg = {
        jobId: job.id,
        legIndex: leg.legIndex,
        fromNetwork: leg.fromNetwork,
        fromToken: leg.fromToken,
        fromAmount: leg.legIndex === 0 ? quote.sourceAmount : "0", // Will be updated
        toNetwork: leg.toNetwork,
        toToken: leg.toToken,
        toAmountExpected: leg.legIndex === route.length - 1 ? quote.destAmountEstimate : null,
        protocol: leg.protocol as "layerzero" | "stargate" | "fassets" | "native" | "swap",
        gasFeeSourceUsd: leg.gasFeeUsd.toString(),
        bridgeFeeUsd: leg.bridgeFeeUsd.toString(),
        status: leg.legIndex === 0 ? "pending" : "pending",
      };

      const [insertedLeg] = await db.insert(crossChainBridgeLegs)
        .values(legData)
        .returning();
      legs.push(insertedLeg);
    }

    console.log(`[BridgeOrchestrator] Bridge initiated: ${job.id} with ${legs.length} legs`);

    return { ...job, legs };
  }

  /**
   * Get a bridge job with its legs
   */
  async getJob(jobId: string): Promise<BridgeJobWithLegs | null> {
    const [job] = await db.select()
      .from(crossChainBridgeJobs)
      .where(eq(crossChainBridgeJobs.id, jobId))
      .limit(1);

    if (!job) {
      return null;
    }

    const legs = await db.select()
      .from(crossChainBridgeLegs)
      .where(eq(crossChainBridgeLegs.jobId, jobId))
      .orderBy(crossChainBridgeLegs.legIndex);

    return { ...job, legs };
  }

  /**
   * Get all bridge jobs for a wallet
   */
  async getJobsForWallet(walletAddress: string, limit = 20): Promise<BridgeJobWithLegs[]> {
    const jobs = await db.select()
      .from(crossChainBridgeJobs)
      .where(eq(crossChainBridgeJobs.walletAddress, walletAddress))
      .orderBy(desc(crossChainBridgeJobs.createdAt))
      .limit(limit);

    const result: BridgeJobWithLegs[] = [];
    for (const job of jobs) {
      const legs = await db.select()
        .from(crossChainBridgeLegs)
        .where(eq(crossChainBridgeLegs.jobId, job.id))
        .orderBy(crossChainBridgeLegs.legIndex);
      result.push({ ...job, legs });
    }

    return result;
  }

  /**
   * Update leg status (called by protocol-specific handlers)
   */
  async updateLegStatus(
    legId: string,
    status: "pending" | "executing" | "awaiting_confirm" | "bridging" | "awaiting_dest" | "completed" | "failed" | "refunded",
    updates: Partial<{
      sourceTxHash: string;
      bridgeTxHash: string;
      destTxHash: string;
      toAmountReceived: string;
      errorMessage: string;
    }> = {}
  ): Promise<CrossChainBridgeLeg | null> {
    const updateData: Record<string, any> = { status, ...updates };
    
    if (status === "executing") {
      updateData.startedAt = new Date();
    } else if (status === "completed" || status === "failed" || status === "refunded") {
      updateData.completedAt = new Date();
    }

    const [updatedLeg] = await db.update(crossChainBridgeLegs)
      .set(updateData)
      .where(eq(crossChainBridgeLegs.id, legId))
      .returning();

    if (!updatedLeg) {
      return null;
    }

    // Update parent job
    await this.syncJobStatus(updatedLeg.jobId);

    return updatedLeg;
  }

  /**
   * Sync job status based on leg statuses
   */
  private async syncJobStatus(jobId: string): Promise<void> {
    const [job] = await db.select()
      .from(crossChainBridgeJobs)
      .where(eq(crossChainBridgeJobs.id, jobId))
      .limit(1);

    if (!job) return;

    const legs = await db.select()
      .from(crossChainBridgeLegs)
      .where(eq(crossChainBridgeLegs.jobId, jobId))
      .orderBy(crossChainBridgeLegs.legIndex);

    // Determine job status from legs
    const allCompleted = legs.every((l: CrossChainBridgeLeg) => l.status === "completed");
    const anyFailed = legs.some((l: CrossChainBridgeLeg) => l.status === "failed");
    const anyExecuting = legs.some((l: CrossChainBridgeLeg) => 
      ["executing", "awaiting_confirm", "bridging", "awaiting_dest"].includes(l.status)
    );
    const currentLegIndex = legs.findIndex((l: CrossChainBridgeLeg) => l.status !== "completed");

    let newStatus = job.status;
    const updates: Record<string, unknown> = { currentLeg: currentLegIndex === -1 ? legs.length : currentLegIndex };

    if (allCompleted) {
      newStatus = "completed";
      updates.completedAt = new Date();
      updates.destAmountReceived = legs[legs.length - 1]?.toAmountReceived;
    } else if (anyFailed) {
      newStatus = legs.some((l: CrossChainBridgeLeg) => l.status === "completed") ? "partially_failed" : "failed";
      updates.errorMessage = legs.find((l: CrossChainBridgeLeg) => l.status === "failed")?.errorMessage;
    } else if (anyExecuting) {
      newStatus = "executing";
    }

    if (newStatus !== job.status) {
      await db.update(crossChainBridgeJobs)
        .set({ ...updates, status: newStatus })
        .where(eq(crossChainBridgeJobs.id, jobId));

      console.log(`[BridgeOrchestrator] Job ${jobId} status: ${job.status} → ${newStatus}`);
    }
  }

  /**
   * Cancel a pending or quoted job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const [job] = await db.select()
      .from(crossChainBridgeJobs)
      .where(eq(crossChainBridgeJobs.id, jobId))
      .limit(1);

    if (!job) return false;

    if (!["pending", "quoted", "confirmed"].includes(job.status)) {
      console.warn(`[BridgeOrchestrator] Cannot cancel job in status: ${job.status}`);
      return false;
    }

    await db.update(crossChainBridgeJobs)
      .set({ status: "cancelled" })
      .where(eq(crossChainBridgeJobs.id, jobId));

    console.log(`[BridgeOrchestrator] Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Get available destination networks from a source
   */
  getAvailableDestinations(sourceNetwork: NetworkId): NetworkId[] {
    return RouteRegistry.getAvailableDestinations(sourceNetwork);
  }

  /**
   * Get available tokens for a network pair
   */
  getAvailableTokens(sourceNetwork: NetworkId, destNetwork: NetworkId) {
    return RouteRegistry.getAvailableTokens(sourceNetwork, destNetwork);
  }

  /**
   * Get pending jobs that need execution (for worker)
   */
  async getPendingJobs(): Promise<BridgeJobWithLegs[]> {
    const jobs = await db.select()
      .from(crossChainBridgeJobs)
      .where(eq(crossChainBridgeJobs.status, "confirmed"))
      .limit(10);

    const result: BridgeJobWithLegs[] = [];
    for (const job of jobs) {
      const legs = await db.select()
        .from(crossChainBridgeLegs)
        .where(eq(crossChainBridgeLegs.jobId, job.id))
        .orderBy(crossChainBridgeLegs.legIndex);
      result.push({ ...job, legs });
    }

    return result;
  }
}

export const BridgeOrchestratorService = new BridgeOrchestratorServiceClass();
