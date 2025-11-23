import type { MetricsService } from "./MetricsService";
import type { IStorage } from "../storage";
import { db } from "../db";
import { fxrpToXrpRedemptions, xrpToFxrpBridges, vaults } from "@shared/schema";
import { sql, and, gte, eq, desc } from "drizzle-orm";
import Decimal from "decimal.js";

/**
 * AlertingService Configuration
 * 
 * Webhook Setup Instructions:
 * 
 * Slack Webhook:
 * 1. Go to https://api.slack.com/apps
 * 2. Create a new app or select existing app
 * 3. Navigate to "Incoming Webhooks" and enable them
 * 4. Click "Add New Webhook to Workspace"
 * 5. Select the channel where alerts should be posted
 * 6. Copy the webhook URL and set SLACK_WEBHOOK_URL environment variable
 * 
 * Discord Webhook:
 * 1. Open your Discord server settings
 * 2. Navigate to "Integrations" → "Webhooks"
 * 3. Click "New Webhook" or "Create Webhook"
 * 4. Select the channel for alerts
 * 5. Copy the webhook URL and set DISCORD_WEBHOOK_URL environment variable
 */
export interface AlertingServiceConfig {
  storage: IStorage;
  metricsService: MetricsService;
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  minIntervalMinutes?: number;
  enabled?: boolean;
  dryRun?: boolean; // If true, log alerts instead of sending webhooks
  frontendUrl?: string; // Base URL for dashboard links
}

export type AlertType = 
  | 'redemption_delay' 
  | 'tx_failure' 
  | 'apy_drift' 
  | 'bridge_failure' 
  | 'rpc_issue' 
  | 'health_change';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertCondition {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
}

interface AlertHistory {
  type: AlertType;
  lastSentAt: Date;
  lastSeverity: AlertSeverity;
}

/**
 * AlertingService for testnet monitoring
 * 
 * Monitors critical system metrics and sends webhook notifications to Slack/Discord
 * when alert conditions are detected. Includes intelligent throttling to prevent spam.
 * 
 * Features:
 * - Redemption delay detection (>30 minutes stuck)
 * - Transaction failure tracking (>5 consecutive failures)
 * - APY drift monitoring (>200 basis points in 24h)
 * - Bridge failure rate alerts (>20% failure rate)
 * - System health status changes
 * - RPC connectivity issue detection
 * 
 * Usage:
 * ```typescript
 * const alertingService = new AlertingService({
 *   storage,
 *   metricsService,
 *   slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
 *   discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
 *   enabled: process.env.ALERT_ENABLED === 'true'
 * });
 * 
 * // Start monitoring (runs every 5 minutes)
 * alertingService.startMonitoring();
 * 
 * // Manual check
 * await alertingService.checkAndAlert();
 * ```
 */
export class AlertingService {
  private config: AlertingServiceConfig;
  private alertHistory: Map<AlertType, AlertHistory> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_INTERVAL_MINUTES = 15;
  private readonly MONITORING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private previousApyValues: Map<string, { apy: number; timestamp: Date }> = new Map();

  constructor(config: AlertingServiceConfig) {
    this.config = {
      minIntervalMinutes: config.minIntervalMinutes || this.DEFAULT_INTERVAL_MINUTES,
      enabled: config.enabled !== false, // Default to enabled
      dryRun: config.dryRun || false,
      frontendUrl: config.frontendUrl || 'http://localhost:5000',
      ...config
    };

    // Validate configuration
    if (!this.config.slackWebhookUrl && !this.config.discordWebhookUrl) {
      console.warn('⚠️  AlertingService: No webhook URLs configured. Alerts will only be logged.');
      this.config.dryRun = true;
    }

    if (this.config.enabled) {
      console.log('✅ AlertingService initialized');
      console.log(`   Slack: ${this.config.slackWebhookUrl ? 'Configured' : 'Not configured'}`);
      console.log(`   Discord: ${this.config.discordWebhookUrl ? 'Configured' : 'Not configured'}`);
      console.log(`   Alert interval: ${this.config.minIntervalMinutes} minutes`);
      console.log(`   Dry run: ${this.config.dryRun ? 'Yes' : 'No'}`);
    } else {
      console.log('ℹ️  AlertingService disabled via configuration');
    }
  }

  /**
   * Start automatic monitoring (runs every 5 minutes)
   */
  startMonitoring(): void {
    if (!this.config.enabled) {
      console.log('ℹ️  AlertingService monitoring not started (disabled)');
      return;
    }

    if (this.monitoringInterval) {
      console.warn('⚠️  AlertingService monitoring already running');
      return;
    }

    console.log('🔔 Starting AlertingService monitoring (checking every 5 minutes)');

    // Run initial check after 1 minute to allow services to initialize
    setTimeout(() => {
      this.checkAndAlert().catch(error => {
        console.error('❌ Initial alert check failed:', error);
      });
    }, 60 * 1000);

    // Schedule recurring checks
    this.monitoringInterval = setInterval(() => {
      this.checkAndAlert().catch(error => {
        console.error('❌ Alert check failed:', error);
      });
    }, this.MONITORING_INTERVAL_MS);
  }

  /**
   * Stop automatic monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🔕 AlertingService monitoring stopped');
    }
  }

  /**
   * Main entry point: Check all alert conditions and send notifications
   */
  async checkAndAlert(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log('🔍 Running alert checks...');

    const allConditions: AlertCondition[] = [];

    try {
      // Check all conditions in parallel for efficiency
      const [
        redemptionDelays,
        transactionFailures,
        apyDrifts,
        bridgeFailures,
        rpcIssues,
        systemHealth
      ] = await Promise.allSettled([
        this.checkRedemptionDelays(),
        this.checkTransactionFailures(),
        this.checkApyDrift(),
        this.checkBridgeHealth(),
        this.checkRpcIssues(),
        this.checkSystemHealth()
      ]);

      // Collect all successful results
      if (redemptionDelays.status === 'fulfilled') {
        allConditions.push(...redemptionDelays.value);
      } else {
        console.error('❌ Redemption delay check failed:', redemptionDelays.reason);
      }

      if (transactionFailures.status === 'fulfilled') {
        allConditions.push(...transactionFailures.value);
      } else {
        console.error('❌ Transaction failure check failed:', transactionFailures.reason);
      }

      if (apyDrifts.status === 'fulfilled') {
        allConditions.push(...apyDrifts.value);
      } else {
        console.error('❌ APY drift check failed:', apyDrifts.reason);
      }

      if (bridgeFailures.status === 'fulfilled') {
        allConditions.push(...bridgeFailures.value);
      } else {
        console.error('❌ Bridge failure check failed:', bridgeFailures.reason);
      }

      if (rpcIssues.status === 'fulfilled') {
        allConditions.push(...rpcIssues.value);
      } else {
        console.error('❌ RPC issue check failed:', rpcIssues.reason);
      }

      if (systemHealth.status === 'fulfilled') {
        allConditions.push(...systemHealth.value);
      } else {
        console.error('❌ System health check failed:', systemHealth.reason);
      }

      // Send alerts for all conditions that pass throttling
      for (const condition of allConditions) {
        if (this.shouldSendAlert(condition)) {
          await this.sendAlert(condition);
        }
      }

      if (allConditions.length === 0) {
        console.log('✅ No alerts triggered');
      }

    } catch (error) {
      console.error('❌ Alert check error:', error);
    }
  }

  /**
   * Check for redemptions stuck for >30 minutes
   */
  async checkRedemptionDelays(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Query redemptions stuck in non-terminal states for >30 minutes
    const stuckRedemptions = await db
      .select({
        id: fxrpToXrpRedemptions.id,
        status: fxrpToXrpRedemptions.status,
        requestedAt: fxrpToXrpRedemptions.requestedAt,
        amount: fxrpToXrpRedemptions.amount,
        walletAddress: fxrpToXrpRedemptions.walletAddress,
      })
      .from(fxrpToXrpRedemptions)
      .where(
        and(
          sql`${fxrpToXrpRedemptions.status} NOT IN ('completed', 'failed', 'xrpl_received')`,
          sql`${fxrpToXrpRedemptions.requestedAt} < ${thirtyMinutesAgo}`
        )
      )
      .limit(20);

    if (stuckRedemptions.length > 0) {
      const redemptionIds = stuckRedemptions.map(r => r.id).slice(0, 5);
      const totalAmount = stuckRedemptions.reduce((sum, r) => 
        sum.plus(new Decimal(r.amount || '0')), new Decimal(0)
      );

      conditions.push({
        type: 'redemption_delay',
        severity: stuckRedemptions.length > 10 ? 'critical' : 'warning',
        message: `${stuckRedemptions.length} redemption(s) stuck for >30 minutes`,
        metadata: {
          count: stuckRedemptions.length,
          redemptionIds,
          totalAmount: totalAmount.toString(),
          oldestRequestAt: stuckRedemptions[0].requestedAt,
          statuses: [...new Set(stuckRedemptions.map(r => r.status))]
        }
      });
    }

    return conditions;
  }

  /**
   * Check for consecutive transaction failures (>5 in a row)
   */
  async checkTransactionFailures(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];

    // Get recent failed bridge operations
    const recentBridges = await db
      .select({
        id: xrpToFxrpBridges.id,
        status: xrpToFxrpBridges.status,
        createdAt: xrpToFxrpBridges.createdAt,
        errorMessage: xrpToFxrpBridges.errorMessage,
      })
      .from(xrpToFxrpBridges)
      .orderBy(desc(xrpToFxrpBridges.createdAt))
      .limit(20);

    // Count consecutive failures from the most recent
    let consecutiveFailures = 0;
    const failureMessages: string[] = [];
    
    for (const bridge of recentBridges) {
      if (bridge.status === 'failed' || bridge.status === 'vault_mint_failed') {
        consecutiveFailures++;
        if (bridge.errorMessage) {
          failureMessages.push(bridge.errorMessage);
        }
      } else if (bridge.status === 'completed') {
        break; // Stop counting at first success
      }
    }

    if (consecutiveFailures > 5) {
      // Analyze failure patterns
      const uniqueErrors = [...new Set(failureMessages)];
      
      conditions.push({
        type: 'tx_failure',
        severity: consecutiveFailures > 10 ? 'critical' : 'warning',
        message: `${consecutiveFailures} consecutive transaction failures detected`,
        metadata: {
          consecutiveFailures,
          uniqueErrorTypes: uniqueErrors.length,
          recentErrors: uniqueErrors.slice(0, 3),
          possibleRpcIssue: failureMessages.some(msg => 
            msg.toLowerCase().includes('timeout') || 
            msg.toLowerCase().includes('connection') ||
            msg.toLowerCase().includes('network')
          )
        }
      });
    }

    return conditions;
  }

  /**
   * Check for APY drift >200 basis points (2%) in 24 hours
   */
  async checkApyDrift(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];

    try {
      const vaultMetrics = await this.config.metricsService.getVaultMetrics();
      const currentApy = vaultMetrics.apy;
      const now = new Date();

      // Get vault ID for tracking (assume single vault for now)
      const vaultList = await db.select({ id: vaults.id }).from(vaults).limit(1);
      const vaultId = vaultList[0]?.id || 'default';

      // Check if we have previous APY data
      const previous = this.previousApyValues.get(vaultId);
      
      if (previous) {
        const timeDiffHours = (now.getTime() - previous.timestamp.getTime()) / (1000 * 60 * 60);
        
        // Only check if we have data from at least 12 hours ago
        if (timeDiffHours >= 12) {
          const apyChange = Math.abs(currentApy - previous.apy);
          const basisPointsChange = apyChange * 100; // Convert percentage to basis points

          if (basisPointsChange > 200) {
            const direction = currentApy > previous.apy ? 'increased' : 'decreased';
            
            conditions.push({
              type: 'apy_drift',
              severity: basisPointsChange > 500 ? 'critical' : 'warning',
              message: `APY ${direction} by ${basisPointsChange.toFixed(0)} basis points in ${timeDiffHours.toFixed(1)}h`,
              metadata: {
                previousApy: previous.apy,
                currentApy,
                changeInBasisPoints: basisPointsChange,
                changeInPercentage: apyChange,
                direction,
                timeDiffHours: timeDiffHours.toFixed(1)
              }
            });
          }
        }
      }

      // Update previous APY value
      this.previousApyValues.set(vaultId, { apy: currentApy, timestamp: now });

    } catch (error) {
      console.error('❌ APY drift check error:', error);
    }

    return conditions;
  }

  /**
   * Check for high bridge failure rate (>20%)
   */
  async checkBridgeHealth(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];

    try {
      const bridgeMetrics = await this.config.metricsService.getBridgeMetrics();

      // Alert on high failure rate
      if (bridgeMetrics.failureRate > 20) {
        conditions.push({
          type: 'bridge_failure',
          severity: bridgeMetrics.failureRate > 50 ? 'critical' : 'warning',
          message: `Bridge failure rate at ${bridgeMetrics.failureRate.toFixed(1)}%`,
          metadata: {
            failureRate: bridgeMetrics.failureRate,
            pendingOperations: bridgeMetrics.pendingOperations,
            stuckTransactions: bridgeMetrics.stuckTransactions,
            failuresByType: bridgeMetrics.failuresByType,
            avgRedemptionTime: bridgeMetrics.avgRedemptionTime
          }
        });
      }

      // Alert on stuck transactions
      if (bridgeMetrics.stuckTransactions > 5) {
        conditions.push({
          type: 'bridge_failure',
          severity: bridgeMetrics.stuckTransactions > 15 ? 'critical' : 'warning',
          message: `${bridgeMetrics.stuckTransactions} bridge operations stuck for >30 minutes`,
          metadata: {
            stuckCount: bridgeMetrics.stuckTransactions,
            pendingOperations: bridgeMetrics.pendingOperations,
            avgRedemptionTime: bridgeMetrics.avgRedemptionTime
          }
        });
      }

    } catch (error) {
      console.error('❌ Bridge health check error:', error);
    }

    return conditions;
  }

  /**
   * Check for RPC connectivity and performance issues
   */
  async checkRpcIssues(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];

    try {
      const rpcUrl = process.env.FLARE_RPC_URL;
      if (!rpcUrl) {
        console.warn('⚠️  FLARE_RPC_URL not configured, skipping RPC health check');
        return conditions;
      }

      // Measure RPC latency with getBlockNumber call
      const startTime = Date.now();
      let blockNumber: number | null = null;
      let error: Error | null = null;

      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`RPC returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.error) {
          throw new Error(`RPC error: ${data.error.message}`);
        }

        blockNumber = parseInt(data.result, 16);
      } catch (e) {
        error = e as Error;
      }

      const latencyMs = Date.now() - startTime;

      // Alert on RPC failure
      if (error) {
        conditions.push({
          type: 'rpc_issue',
          severity: 'critical',
          message: `Flare Coston2 RPC is unreachable or returning errors`,
          metadata: {
            rpcUrl,
            errorMessage: error.message,
            latencyMs
          }
        });
      }
      // Alert on high latency (>1.5 seconds)
      else if (latencyMs > 1500) {
        conditions.push({
          type: 'rpc_issue',
          severity: latencyMs > 3000 ? 'critical' : 'warning',
          message: `Flare Coston2 RPC latency is high: ${latencyMs}ms`,
          metadata: {
            rpcUrl,
            latencyMs,
            blockNumber,
            threshold: 1500
          }
        });
      }

    } catch (error) {
      console.error('❌ RPC issue check error:', error);
    }

    return conditions;
  }

  /**
   * Check system health status changes
   */
  async checkSystemHealth(): Promise<AlertCondition[]> {
    const conditions: AlertCondition[] = [];

    try {
      const health = await this.config.metricsService.getHealthStatus();

      // Alert on degraded or critical overall health
      if (health.overall === 'degraded' || health.overall === 'critical') {
        const severity = health.overall === 'critical' ? 'critical' : 'warning';
        
        // Collect failing checks
        const failingChecks = [];
        if (health.checks.bridgeOperations.status !== 'healthy') {
          failingChecks.push(`Bridge: ${health.checks.bridgeOperations.status}`);
        }
        if (health.checks.vaultLiquidity.status !== 'healthy') {
          failingChecks.push(`Liquidity: ${health.checks.vaultLiquidity.status}`);
        }
        if (health.checks.transactionSuccess.status !== 'healthy') {
          failingChecks.push(`Transactions: ${health.checks.transactionSuccess.status}`);
        }

        conditions.push({
          type: 'health_change',
          severity,
          message: `System health is ${health.overall}`,
          metadata: {
            overallHealth: health.overall,
            failingChecks,
            bridgeOperations: health.checks.bridgeOperations,
            vaultLiquidity: health.checks.vaultLiquidity,
            transactionSuccess: health.checks.transactionSuccess
          }
        });
      }

      // Check for possible RPC issues based on transaction success rate
      if (health.checks.transactionSuccess.successRate < 50) {
        conditions.push({
          type: 'rpc_issue',
          severity: 'critical',
          message: `Transaction success rate critically low: ${health.checks.transactionSuccess.successRate.toFixed(1)}%`,
          metadata: {
            successRate: health.checks.transactionSuccess.successRate,
            possibleCause: 'RPC connectivity issues or gas sponsorship problems'
          }
        });
      }

    } catch (error) {
      console.error('❌ System health check error:', error);
    }

    return conditions;
  }

  /**
   * Send alert to configured webhooks
   */
  async sendAlert(condition: AlertCondition): Promise<void> {
    console.log(`🔔 Sending alert: [${condition.severity.toUpperCase()}] ${condition.type} - ${condition.message}`);

    // Update alert history
    this.alertHistory.set(condition.type, {
      type: condition.type,
      lastSentAt: new Date(),
      lastSeverity: condition.severity
    });

    if (this.config.dryRun) {
      console.log('   [DRY RUN] Alert payload:', JSON.stringify(condition, null, 2));
      return;
    }

    // Send to both Slack and Discord in parallel
    const promises: Promise<void>[] = [];

    if (this.config.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(condition));
    }

    if (this.config.discordWebhookUrl) {
      promises.push(this.sendDiscordAlert(condition));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send alert to Slack using blocks format
   */
  private async sendSlackAlert(condition: AlertCondition): Promise<void> {
    const emoji = this.getSeverityEmoji(condition.severity);
    const color = this.getSeverityColor(condition.severity);

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${condition.severity.toUpperCase()}: ${this.getAlertTitle(condition.type)}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${condition.message}*`
        }
      }
    ];

    // Add metadata fields
    if (condition.metadata) {
      const fields: any[] = [];
      
      for (const [key, value] of Object.entries(condition.metadata)) {
        if (typeof value === 'object' && !Array.isArray(value)) continue;
        
        fields.push({
          type: 'mrkdwn',
          text: `*${this.formatFieldName(key)}:*\n${this.formatFieldValue(value)}`
        });
      }

      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields: fields.slice(0, 10) // Max 10 fields
        });
      }
    }

    // Add dashboard link
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${this.config.frontendUrl}/analytics|View Dashboard>`
      }
    });

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Timestamp: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`
        }
      ]
    });

    const payload = {
      blocks,
      attachments: [
        {
          color,
          fallback: `${condition.severity}: ${condition.message}`
        }
      ]
    };

    try {
      const response = await fetch(this.config.slackWebhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`❌ Slack webhook failed: ${response.status} ${response.statusText}`);
      } else {
        console.log('✅ Slack alert sent successfully');
      }
    } catch (error) {
      console.error('❌ Slack webhook error:', error);
    }
  }

  /**
   * Send alert to Discord using embeds format
   */
  private async sendDiscordAlert(condition: AlertCondition): Promise<void> {
    const emoji = this.getSeverityEmoji(condition.severity);
    const color = this.getDiscordColor(condition.severity);

    const fields: any[] = [];

    if (condition.metadata) {
      for (const [key, value] of Object.entries(condition.metadata)) {
        if (typeof value === 'object' && !Array.isArray(value)) continue;
        
        fields.push({
          name: this.formatFieldName(key),
          value: this.formatFieldValue(value),
          inline: true
        });
      }
    }

    const embed = {
      title: `${emoji} ${this.getAlertTitle(condition.type)}`,
      description: `**${condition.message}**`,
      color,
      fields: fields.slice(0, 25), // Discord max 25 fields
      footer: {
        text: `Shield Finance Testnet Monitor`
      },
      timestamp: new Date().toISOString(),
      url: `${this.config.frontendUrl}/analytics`
    };

    const payload = {
      embeds: [embed]
    };

    try {
      const response = await fetch(this.config.discordWebhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`❌ Discord webhook failed: ${response.status} ${response.statusText}`);
      } else {
        console.log('✅ Discord alert sent successfully');
      }
    } catch (error) {
      console.error('❌ Discord webhook error:', error);
    }
  }

  /**
   * Check if alert should be sent based on throttling rules
   */
  private shouldSendAlert(condition: AlertCondition): boolean {
    const history = this.alertHistory.get(condition.type);
    
    if (!history) {
      return true; // Never sent before
    }

    const now = new Date();
    const minutesSinceLastAlert = (now.getTime() - history.lastSentAt.getTime()) / (1000 * 60);

    // Critical alerts can override throttling if severity increased
    if (condition.severity === 'critical' && history.lastSeverity !== 'critical') {
      console.log(`⚡ Bypassing throttle for severity escalation: ${condition.type}`);
      return true;
    }

    // Check throttling interval
    if (minutesSinceLastAlert < this.config.minIntervalMinutes!) {
      console.log(`⏱️  Throttled: ${condition.type} (last sent ${minutesSinceLastAlert.toFixed(0)}m ago)`);
      return false;
    }

    return true;
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return '🟢';
      case 'warning': return '🟡';
      case 'critical': return '🔴';
    }
  }

  /**
   * Get Slack attachment color
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return '#36a64f';
      case 'warning': return '#FFB020';
      case 'critical': return '#FF4444';
    }
  }

  /**
   * Get Discord embed color (decimal format)
   */
  private getDiscordColor(severity: AlertSeverity): number {
    switch (severity) {
      case 'info': return 0x36a64f;
      case 'warning': return 0xFFB020;
      case 'critical': return 0xFF4444;
    }
  }

  /**
   * Get human-readable alert title
   */
  private getAlertTitle(type: AlertType): string {
    switch (type) {
      case 'redemption_delay': return 'Redemption Delay Detected';
      case 'tx_failure': return 'Transaction Failures';
      case 'apy_drift': return 'APY Drift Alert';
      case 'bridge_failure': return 'Bridge Health Issue';
      case 'rpc_issue': return 'RPC Connectivity Issue';
      case 'health_change': return 'System Health Alert';
    }
  }

  /**
   * Format field name for display
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format field value for display
   */
  private formatFieldValue(value: any): string {
    if (Array.isArray(value)) {
      return value.slice(0, 5).join(', ') + (value.length > 5 ? '...' : '');
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (value instanceof Date) {
      return value.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
    return String(value);
  }

  /**
   * Trigger a test alert (for testing webhook configuration)
   */
  async sendTestAlert(type?: AlertType): Promise<void> {
    const testCondition: AlertCondition = {
      type: type || 'health_change',
      severity: 'info',
      message: 'This is a test alert from Shield Finance monitoring system',
      metadata: {
        timestamp: new Date(),
        environment: 'testnet',
        testMode: true
      }
    };

    console.log('🧪 Sending test alert...');
    await this.sendAlert(testCondition);
  }
}
