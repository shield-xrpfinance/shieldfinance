# XRP Liquid Staking Testnet Monitoring Guide

## Overview

The monitoring system provides real-time visibility into testnet health via four components:

1. **MetricsService** - Collects vault, bridge, and transaction metrics with 1-minute caching
2. **AlertingService** - Detects issues and sends webhook notifications to Slack/Discord
3. **OnChainMonitorService** - OpenZeppelin Monitor-style blockchain event watcher for critical contract events
4. **Analytics Dashboard** - Real-time UI displays on Analytics page with 30-second polling

## System Architecture

### MetricsService (server/services/MetricsService.ts)

Aggregates three categories of metrics:

#### Vault Metrics
- **TVL (Total Value Locked)**: Sum of all active position amounts
- **Average APY**: Weighted average across active vaults
- **Active Users**: Count of users with active positions
- **Staking Adoption**: Total stakers, average boost %, total SHIELD staked
- **Volume**: All-time deposits/withdrawals

**Cache**: 1 minute TTL, refreshes on access beyond cache window

#### Bridge Metrics
- **Pending Operations**: Count of in-progress deposits and withdrawals
- **Average Redemption Time**: Mean duration for completed redemptions (seconds)
- **Stuck Transactions**: Operations stuck >30 minutes at same status
- **Failure Rate**: Percentage of failed vs. attempted bridge operations
- **Successful Bridges (24h)**: Count of completed bridges in last 24 hours
- **Failures by Type**: Breakdown of failure reasons (FDC proof, XRPL payment, confirmation, other)

**Detection**: 30-minute threshold based on `createdAt` timestamp (see Known Limitations)

#### Transaction Metrics
- **Etherspot Success Rate**: Percentage of successful UserOps
- **Gas Sponsored Count**: Estimated transactions using gas sponsorship
- **Direct Payment Count**: Estimated direct payment transactions
- **Failed UserOps**: Count of failed transactions
- **Total Transactions**: All-time transaction count

**Estimation**: 70/30 split for sponsored/direct (see Known Limitations)

### AlertingService (server/services/AlertingService.ts)

Monitors metrics every 5 minutes and sends alerts when conditions trigger. Includes intelligent throttling (15-minute minimum between identical alerts).

#### Alert Conditions

### OnChainMonitorService (server/services/OnChainMonitorService.ts)

Inspired by [OpenZeppelin Monitor](https://github.com/OpenZeppelin/openzeppelin-monitor), this service provides real-time blockchain event monitoring for Shield Finance smart contracts.

#### Monitored Contracts

| Contract | Events Monitored | Severity Mapping |
|----------|------------------|------------------|
| ShXRPVault | OwnershipTransferred, Paused, Unpaused, OperatorAdded/Removed, StrategyAdded/Removed, Deposit, Withdraw | CRITICAL for ownership/pause, WARNING for operator/strategy, INFO for deposits |
| ShieldToken | OwnershipTransferred, Transfer | CRITICAL for ownership, INFO for transfers |
| RevenueRouter | OwnershipTransferred, RevenueDistributed | CRITICAL for ownership, INFO for distributions |
| StakingBoost | OwnershipTransferred, Staked, Unstaked | CRITICAL for ownership, INFO for staking |

#### Critical Event Examples

**Ownership Transfer (CRITICAL)**
- Triggered when contract ownership changes
- Immediate alert via Slack/Discord
- Template: "CRITICAL: Ownership of {contractName} transferred from {previousOwner} to {newOwner}"

**Contract Pause (CRITICAL)**
- Triggered when contract is paused (emergency stop)
- Template: "CRITICAL: {contractName} has been PAUSED by {account}"

**Large Deposits/Withdrawals (INFO)**
- Logged for all deposit/withdraw events
- Tracked in database for analytics

#### Configuration

```bash
# Enable/disable on-chain monitoring (default: enabled)
export ON_CHAIN_MONITOR_ENABLED=true

# Polling interval in milliseconds (default: 15000ms = 15 seconds)
export ON_CHAIN_MONITOR_POLL_MS=15000

# RPC URL for Flare/Coston2 (default: Coston2 public RPC)
export FLARE_RPC_URL="https://coston2-api.flare.network/ext/C/rpc"
```

#### Contract Addresses

Contract addresses are loaded from:
1. Environment variables (highest priority):
   - `VITE_SHXRP_VAULT_ADDRESS`
   - `VITE_SHIELD_TOKEN_ADDRESS`
   - `VITE_REVENUE_ROUTER_ADDRESS`
   - `VITE_STAKING_BOOST_ADDRESS`

2. Deployment files (fallback): `deployments/coston2-*.json`

#### Event Storage

All monitored events are stored in the `on_chain_events` PostgreSQL table:

```sql
CREATE TABLE on_chain_events (
  id SERIAL PRIMARY KEY,
  contract_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  event_name TEXT NOT NULL,
  severity TEXT NOT NULL,  -- 'info' | 'warning' | 'critical'
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  args JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  notified BOOLEAN NOT NULL DEFAULT FALSE
);
```

#### Alert Conditions

| Condition | Threshold | Severity |
|-----------|-----------|----------|
| Redemption Delay | >30 min stuck | WARNING |
| Transaction Failures | >5 consecutive | WARNING |
| APY Drift | >200 bps in 24h | WARNING |
| Bridge Failure Rate | >20% | WARNING |
| RPC Issues | Latency spike | INFO |
| System Health Change | Any transition | INFO |

#### Webhook Configuration

**Slack:**
```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**Discord:**
```bash
export DISCORD_WEBHOOK_URL="https://discordapp.com/api/webhooks/YOUR/WEBHOOK/ID"
```

**Enable Alerts:**
```bash
export ALERT_ENABLED=true
export ALERT_DRY_RUN=false  # Set to false to send real webhooks
export ALERT_MIN_INTERVAL_MINUTES=15
```

### Analytics API Endpoints

#### GET /api/analytics/vault-metrics
Real-time vault performance metrics.

**Response:**
```json
{
  "tvl": "39600000",
  "apy": 10.9,
  "totalDeposits": "45000000",
  "totalWithdrawals": "5400000",
  "activeUsers": 42,
  "shieldBurned": "0",
  "stakingAdoption": {
    "totalStakers": 28,
    "avgBoostPercentage": 15.5,
    "totalShieldStaked": "840000"
  }
}
```

#### GET /api/analytics/bridge-status
Bridge operation health and statistics.

**Response:**
```json
{
  "pendingOperations": 1,
  "avgRedemptionTime": 0,
  "stuckTransactions": 4,
  "failureRate": 47.6,
  "successfulBridges24h": 11,
  "failuresByType": {
    "fdcProof": 0,
    "xrplPayment": 0,
    "confirmation": 0,
    "other": 20
  }
}
```

#### GET /api/analytics/revenue-stats
Revenue transparency metrics (fees, SHIELD burned, yield distributed).

#### GET /api/analytics/on-chain-events
Recent on-chain events from monitored contracts with filtering and pagination.

**Query Parameters:**
- `contract`: Filter by contract name (ShXRPVault, ShieldToken, RevenueRouter, StakingBoost)
- `severity`: Filter by severity level (info, warning, critical)
- `limit`: Number of events to return (default 50, max 200)
- `offset`: Pagination offset (default 0)

**Response:**
```json
{
  "events": [
    {
      "id": 1,
      "contractName": "ShXRPVault",
      "contractAddress": "0x...",
      "eventName": "Deposit",
      "severity": "info",
      "blockNumber": 12345678,
      "transactionHash": "0x...",
      "logIndex": 0,
      "args": { "sender": "0x...", "assets": "1000000" },
      "timestamp": "2025-11-29T10:30:00.000Z",
      "notified": true
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "returned": 1
  }
}
```

#### GET /api/analytics/on-chain-events/summary
Summary statistics of on-chain events for dashboard overview.

**Response:**
```json
{
  "last24Hours": {
    "bySeverity": {
      "info": 45,
      "warning": 3,
      "critical": 0
    },
    "byContract": {
      "ShXRPVault": 38,
      "StakingBoost": 10
    },
    "total": 48
  },
  "recentCriticalEvents": []
}
```

#### GET /api/analytics/monitor-status
Current status of the on-chain monitoring service.

**Response:**
```json
{
  "status": "active",
  "isRunning": true,
  "lastProcessedBlock": 12345678,
  "contractsMonitored": ["ShXRPVault", "ShieldToken", "RevenueRouter", "StakingBoost"],
  "eventsConfigured": 15
}
```

#### GET /metrics (Prometheus Format)
Exportable metrics in Prometheus text format for external monitoring tools.

**Sample Output:**
```
# HELP xrp_liquid_staking_tvl_usd Total value locked in USD
# TYPE xrp_liquid_staking_tvl_usd gauge
xrp_liquid_staking_tvl_usd 39600000

# HELP xrp_liquid_staking_apy_percent Average APY percentage
# TYPE xrp_liquid_staking_apy_percent gauge
xrp_liquid_staking_apy_percent 10.9

# HELP xrp_liquid_staking_active_users Number of active users
# TYPE xrp_liquid_staking_active_users gauge
xrp_liquid_staking_active_users 42

# HELP xrp_liquid_staking_bridge_pending_operations Pending bridge operations
# TYPE xrp_liquid_staking_bridge_pending_operations gauge
xrp_liquid_staking_bridge_pending_operations 1

# HELP xrp_liquid_staking_bridge_failure_rate_percent Bridge failure rate percentage
# TYPE xrp_liquid_staking_bridge_failure_rate_percent gauge
xrp_liquid_staking_bridge_failure_rate_percent 47.6

# HELP xrp_liquid_staking_bridge_stuck_transactions Stuck bridge transactions
# TYPE xrp_liquid_staking_bridge_stuck_transactions gauge
xrp_liquid_staking_bridge_stuck_transactions 4

# HELP xrp_liquid_staking_bridge_success_rate_percent Bridge success rate percentage
# TYPE xrp_liquid_staking_bridge_success_rate_percent gauge
xrp_liquid_staking_bridge_success_rate_percent 52.4

# HELP xrp_liquid_staking_etherspot_success_rate_percent Etherspot transaction success rate
# TYPE xrp_liquid_staking_etherspot_success_rate_percent gauge
xrp_liquid_staking_etherspot_success_rate_percent 100

# HELP xrp_liquid_staking_gas_sponsored_count Number of gas-sponsored transactions
# TYPE xrp_liquid_staking_gas_sponsored_count gauge
xrp_liquid_staking_gas_sponsored_count 42

# HELP xrp_liquid_staking_direct_payment_count Number of direct payment transactions
# TYPE xrp_liquid_staking_direct_payment_count gauge
xrp_liquid_staking_direct_payment_count 18
```

**Integration Examples:**

*Prometheus scrape config (prometheus.yml):*
```yaml
scrape_configs:
  - job_name: 'xrp_liquid_staking_testnet'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 60s
```

*Grafana dashboard:* Import queries for metrics like:
```
xrp_liquid_staking_tvl_usd
xrp_liquid_staking_bridge_failure_rate_percent
xrp_liquid_staking_etherspot_success_rate_percent
```

### Analytics Page Dashboard

Located at `/analytics`, displays real-time metrics in four card sections:

1. **Revenue Transparency Card**: Total fees collected, SHIELD burned, extra yield distributed
2. **System Monitoring Dashboard**: Overall system health with vault, bridge, and transaction metrics
3. **On-Chain Events Panel**: Real-time contract activity with event list, severity badges, and block tracking
4. **Vault Distribution & Performance**: TVL, APY, active users, top vaults

**On-Chain Events Panel Features:**
- **Live Indicator**: Green pulsing dot when monitoring service is active
- **Event Summary Cards**: Total events (24h), critical count, warnings count, last processed block
- **Recent Events List**: Last 10 events with severity badges, contract names, block numbers, and explorer links
- **Auto-Refresh**: Data updates every 30 seconds

**Update Frequency**: 30-second polling with TanStack Query

**Status Indicators:**
- 🟢 Healthy: All metrics in acceptable ranges
- 🟡 Degraded: Failure rate 10-20% OR 1-10 stuck transactions
- 🔴 Critical: Failure rate >20% OR >10 stuck transactions

## Known Limitations

### 1. SHIELD Burn Tracking (Returns "0")
**Issue**: Contract events not yet ingested; RevenueDistributed events from ShXRPVault not being listened to.

**Current Status**: Placeholder "0" value returned from `/api/analytics/revenue-stats`

**Fix**: Implement event listener for ShXRPVault.RevenueDistributed events once contracts deployed on mainnet.

**Future Work**:
- Add burn_events table to track RevenueDistributed events
- Create event listener in FlareClient
- Query aggregated burn data via storage methods

### 2. UserOp Gas Sponsorship Metrics (Estimation-Based)
**Issue**: Backend doesn't track actual UserOp types; metrics use 70/30 split estimation.

**Current Status**: GasSponsoredCount/DirectPaymentCount based on heuristic, not actual data.

**Fix**: Track actual UserOp types from Etherspot callbacks.

**Future Work**:
- Add `type` field to transactions table ('userop_sponsored' | 'userop_direct' | 'direct')
- Implement Etherspot callback handling to record UserOp lifecycle
- Replace estimation with real data

### 3. Stuck Transaction Detection (CreatedAt-Based)
**Issue**: Uses `createdAt` timestamp only; lacks `updatedAt` tracking for precise duration calculation.

**Current Status**: Transactions older than 30 minutes are flagged as stuck (may include completed-but-not-cleared txs).

**Fix**: Add `updatedAt` column to bridge/redemption tables.

**Future Work**:
- Add `updatedAt` column to xrpToFxrpBridges and fxrpToXrpRedemptions tables
- Update services to set `updatedAt` on every status change
- Use `updatedAt` for stuck detection instead of `createdAt`
- More accurate stuck detection with status-aware timeouts

### 4. Inactive Vault APY Excluded
**Issue**: APY calculation only includes active vaults with deposits; inactive vaults with non-zero APY not represented.

**Current Status**: Weighted average APY calculated from vaults with active positions only.

**Fix**: Include all vault APY values in averaging, weighted by potential contribution.

**Future Work**: Consider vault capacity or target allocation when calculating protocol-wide APY.

## Monitoring Best Practices

### Daily Checks
1. **Morning**: Review overnight bridge operations - check for stuck transactions
2. **Afternoon**: Monitor APY trends - alert if drift >200 bps
3. **End of day**: Verify all redemptions completed within 24 hours

### Weekly Reviews
1. **TVL Growth**: Compare to previous week's average
2. **User Acquisition**: Track new users joining protocol
3. **Bridge Success Rate**: Ensure >80% success rate
4. **Gas Sponsorship Adoption**: Monitor if users prefer gasless

### Alert Response Procedures

**Redemption Delay Alert:**
1. Check redemption status on bridge tracking page
2. Verify XRPL payment was received (search XRPL explorer)
3. If payment missing, check FAssets agent status
4. If stuck >60min, trigger manual recovery endpoint

**Bridge Failure Alert:**
1. Navigate to bridge operations analytics
2. Identify failure reason (FDC proof, payment, confirmation)
3. Check RPC health and FDC service status
4. If system degraded, alert devs; if transient, monitor

**APY Drift Alert:**
1. Check which vaults changed APY
2. Review yield strategy updates
3. Verify staking boost mechanism functioning
4. If significant drop, investigate vault status

**RPC Issue Alert:**
1. Check RPC endpoint availability
2. Monitor latency vs. baseline
3. If persistent, switch to backup RPC or notify provider

## Development Testing

### Manual Metric Verification
```bash
# Fetch vault metrics
curl http://localhost:5000/api/analytics/vault-metrics | jq

# Fetch bridge status
curl http://localhost:5000/api/analytics/bridge-status | jq

# Fetch Prometheus metrics
curl http://localhost:5000/metrics
```

### Alert Testing (Dry Run)
```bash
# Dry run mode (logs only, no webhooks)
export ALERT_DRY_RUN=true
export ALERT_ENABLED=true

# Check alert logs in console output
tail -f server.log | grep "ALERT"
```

### On-Chain Events Testing
```bash
# Fetch recent on-chain events
curl http://localhost:5000/api/analytics/on-chain-events | jq

# Fetch events filtered by contract
curl "http://localhost:5000/api/analytics/on-chain-events?contract=ShXRPVault&limit=10" | jq

# Fetch critical events only
curl "http://localhost:5000/api/analytics/on-chain-events?severity=critical" | jq

# Fetch event summary for last 24 hours
curl http://localhost:5000/api/analytics/on-chain-events/summary | jq

# Check monitor service status
curl http://localhost:5000/api/analytics/monitor-status | jq
```

### Metrics Cache Testing
```bash
# Fetch metrics twice within 1 minute - should return cached data
time curl http://localhost:5000/api/analytics/vault-metrics > /dev/null
# Wait 30 seconds
sleep 30
time curl http://localhost:5000/api/analytics/vault-metrics > /dev/null
# Should be faster on second call (cached)
```

## Future Improvements

### Phase 2: Enhanced Observability
- [x] Implement on-chain event monitoring (OnChainMonitorService)
- [x] Add on-chain events API endpoints
- [x] Add on-chain events panel to Analytics dashboard
- [ ] Add actual UserOp tracking from Etherspot webhooks
- [ ] Add `updatedAt` tracking for precise stuck detection
- [ ] Track per-vault APY changes separately
- [ ] Add transaction detailed breakdown by type

### Phase 3: Advanced Monitoring
- [ ] Multi-chain monitoring (Flare mainnet, XRPL mainnet)
- [ ] Custom alert thresholds per vault
- [ ] Alert escalation (SMS, PagerDuty) for critical issues
- [ ] Historical analytics retention (1 year archive)
- [ ] Custom metric aggregation for dashboards

### Phase 4: ML-Driven Insights
- [ ] Anomaly detection on metric baselines
- [ ] Predictive alerts for failure patterns
- [ ] Automated incident correlation
- [ ] Root cause analysis suggestions

## Support & Troubleshooting

### Metrics Endpoint Returns 503
**Cause**: MetricsService not yet ready (checking readiness)

**Solution**: Wait for service initialization (10-15 seconds), then retry

**Command**: `curl http://localhost:5000/readyz`

### Alerts Not Sending
**Cause**: Webhook URLs not configured or `ALERT_ENABLED` not set

**Solution**: Set both `SLACK_WEBHOOK_URL`/`DISCORD_WEBHOOK_URL` and `ALERT_ENABLED=true`

**Verify**: Check console logs for "AlertingService initialized" message

### High Bridge Failure Rate
**Common Causes**:
1. FDC service down or slow
2. XRPL payment confirmation delays
3. Gas price too low for Flare network
4. Asset pairing not supported

**Debug**: Check individual failed bridges in bridge tracking, review RPC latency

### Incomplete Redemptions
**Common Causes**:
1. FAssetsRouter service timeout
2. Proof generation delayed
3. XRPL payment not received

**Resolution**: Use redemption retry service or manual recovery endpoint

### On-Chain Monitor Not Running
**Common Causes**:
1. Contract addresses not configured (environment variables or deployment files missing)
2. RPC URL unreachable or rate-limited
3. `ON_CHAIN_MONITOR_ENABLED=false` set in environment

**Verification**:
```bash
# Check monitor status
curl http://localhost:5000/api/analytics/monitor-status | jq

# Should return:
# { "status": "active", "isRunning": true, ... }
```

**Resolution**:
1. Verify deployment files exist in `deployments/` directory
2. Set contract addresses via environment variables
3. Check RPC endpoint connectivity

### No Events Being Detected
**Common Causes**:
1. Monitor started after relevant blocks were processed
2. Contracts have had no activity
3. Event listener filters not matching emitted events

**Debug**:
```bash
# Check last processed block vs current block
curl http://localhost:5000/api/analytics/monitor-status | jq '.lastProcessedBlock'

# Compare with current block on explorer
# https://coston2-explorer.flare.network
```

**Resolution**: The monitor will catch up on historical events; allow 1-2 minutes for sync

---

**Last Updated**: November 2025 (Testnet Phase)
**Status**: Production-ready for testnet monitoring
**Next Review**: Post-mainnet deployment
