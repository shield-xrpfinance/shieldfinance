# FAssets Integration Guide

This document explains the FAssets bridge integration, including service architecture, wallet-scoped security, and production deployment details.

## Deployed Contracts (Coston2 Testnet)

Current production deployment addresses:

| Contract | Address | Purpose |
|----------|---------|---------|
| **VaultController** | `0x96985bf09eDcD4C2Bf21137d8f97947B96c4eb2c` | Vault management and governance |
| **ShXRPVault** | `0xeBb4a977492241B06A2423710c03BB63B2c5990e` | ERC-4626 vault for FXRP deposits |
| **FXRP Token** | `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3` | FAssets-wrapped XRP on Flare |

**Deployment Date**: November 11, 2025  
**Network**: Coston2 Testnet (Chain ID: 114)  
**Deployment File**: `deployments/coston2-latest.json`

## Service Architecture

The FAssets integration uses a multi-service architecture for reliability and automatic recovery:

### 1. BridgeService (`server/services/BridgeService.ts`)

**Responsibility**: Orchestrates XRP → FXRP conversion via FAssets protocol

**Key Features**:
- Collateral reservation with FAssets agents
- XRPL payment tracking via listener integration
- FDC proof generation and submission
- FXRP minting execution
- Automatic bridge expiration (30 minutes)
- Background cleanup scheduler (runs every 5 minutes)
- Demo mode support for testing

**Critical Operations**:
```typescript
// Reserve collateral with agent
async initiateBridge(walletAddress, vaultId, xrpAmount)
  → Returns: { bridgeId, agentAddress, paymentReference }

// Complete bridge after XRPL payment
async completeBridge(bridgeId, xrplTxHash)
  → Generates FDC proof → Mints FXRP → Triggers vault deposit
```

**Wallet-Scoped Security**: All bridge records include `wallet_address` for user isolation

### 2. VaultService (`server/services/VaultService.ts`)

**Responsibility**: Manages shXRP vault deposits and share minting

**Key Features**:
- ERC-4626 compliant vault interactions
- FXRP approval and deposit execution
- Position tracking with wallet address mapping
- Automatic position accumulation for repeat depositors
- Smart account custodial model

**Critical Operations**:
```typescript
// Mint shXRP shares from FXRP
async mintShares(vaultId, userAddress, fxrpAmount)
  → Approves FXRP → Deposits to vault → Updates position
  → Returns: { vaultMintTxHash, positionId }
```

**Custodial Model**:
- shXRP shares minted to Smart Account (not user's XRP wallet)
- Ownership tracked in `positions` table via `walletAddress` column
- Users can only query their own positions (wallet-scoped)

### 3. DepositWatchdogService (`server/services/DepositWatchdogService.ts`)

**Responsibility**: Automatic recovery for stuck deposits

**Problem Solved**:
- Deposits stuck at `xrpl_confirmed` status
- FXRP mint completed but not indexed before initial check
- Race conditions during FAssets minting

**How It Works**:
1. Polls every 60 seconds for deposits with `status='xrpl_confirmed'`
2. Queries AssetManager contract for `MintingExecuted` events
3. Parses FXRP `Transfer` event to get minted amount and tx hash
4. Updates bridge record with mint details
5. Triggers `VaultService.mintShares()` to complete deposit

**Benefits**: Zero manual intervention for stuck deposits

### 4. WithdrawalRetryService (`server/services/WithdrawalRetryService.ts`)

**Responsibility**: Automatic retry for failed withdrawal confirmations

**Problem Solved**:
- Withdrawals stuck in `manual_review` when Smart Account lacks FLR for gas
- `confirmRedemptionPayment` requires direct gas payment (not on paymaster allowlist)
- User successfully received XRP but backend reconciliation incomplete

**How It Works**:
1. Polls every 60 seconds for redemptions with `backendStatus='manual_review'` or `'retry_pending'`
2. Checks Smart Account native FLR balance (requires minimum 0.1 FLR)
3. Retries `confirmRedemptionPayment` transaction
4. Uses exponential backoff: wait = 60s * 2^retryCount
5. Maximum 10 retry attempts before abandoning
6. Auto-prefunding: Sends 0.5 FLR to Smart Account if balance too low (max 3 attempts)

**Benefits**: Automatic reconciliation without manual intervention

**Dual-Status Model**:
- `userStatus`: User-facing status (`processing`, `completed`, `failed`)
- `backendStatus`: Backend reconciliation status (`not_started`, `confirming`, `confirmed`, `manual_review`)
- User sees `completed` immediately when XRP received
- Backend continues reconciliation in background

## Demo Mode (Default)

By default, the bridge service runs in **demo mode** which simulates the entire FAssets bridging process without requiring real FAssets SDK integration. This is perfect for:
- Testing the UI/UX flow
- Development and debugging
- Demonstrations

### Demo Mode Behavior
- Automatically progresses through all 4 bridge steps with realistic delays
- Generates mock agent addresses and transaction hashes
- Marks all transactions with `DEMO-` prefix
- Completes bridges in 6-10 seconds

## Production Mode Setup

To enable real FAssets integration for production use:

### 1. Environment Variables

Add the following to your `.env` file or Replit Secrets:

```bash
# Required: Disable demo mode
DEMO_MODE=false

# Required: Operator private key (for executing minting transactions)
OPERATOR_PRIVATE_KEY=0x...  # Your operator wallet private key
```

**That's it!** AssetManager addresses are now automatically retrieved from the **Flare Contract Registry** at runtime, so you don't need to configure them manually.

### 2. Verify Contract Registry Lookup (Optional)

Run the helper script to verify that AssetManager addresses can be retrieved correctly:

```bash
npx tsx scripts/get-assetmanager-address.ts
```

This will show you:
- AssetManager address on Flare Mainnet
- AssetManager address on Coston2 Testnet  
- FXRP token addresses for both networks

The script verifies that the Contract Registry is accessible and returns valid addresses.

### 3. FAssets SDK Integration

The current implementation uses placeholder code for FAssets SDK integration. To integrate properly:

1. **Install FAssets SDK** (when available):
```bash
npm install @flarenetwork/fassets-sdk
```

2. **Update `server/utils/fassets-client.ts`**:
   - Replace placeholder code with actual FAssets SDK calls
   - Implement proper collateral reservation
   - Implement FDC proof generation
   - Implement minting execution

3. **Key Methods to Implement**:

```typescript
// Reserve collateral with an agent
async reserveCollateral(lots: number): Promise<ReservationResult> {
  // Use FAssets SDK to:
  // 1. Find available agent
  // 2. Reserve collateral for specified lots
  // 3. Return agent details and reservation ID
}

// Execute minting after payment received
async executeMinting(
  reservationId: string,
  xrplTxHash: string,
  fdcProof: string
): Promise<string> {
  // Use FAssets SDK to:
  // 1. Submit FDC proof
  // 2. Execute minting transaction
  // 3. Return Flare transaction hash
}
```

### XRP → FXRP → shXRP Flow (Production)

Complete end-to-end flow when `DEMO_MODE=false`:

#### Step 1: Reserve Collateral
- **Service**: BridgeService
- **Action**: Call FAssets SDK to reserve collateral with agent
- **Storage**: Create bridge record with `wallet_address`, `paymentReference`, `agentUnderlyingAddress`
- **Status**: `pending` → `awaiting_payment`
- **User sees**: Agent address and payment reference to send XRP

#### Step 2: XRPL Payment
- **Service**: XRPL Listener
- **Action**: User sends XRP to agent's underlying address with payment reference
- **Detection**: XRPL listener monitors for incoming payments matching payment reference
- **Validation**: Verify amount matches expected XRP (accounting for lot rounding)
- **Storage**: Update bridge with `xrplTxHash`, `receivedAmountDrops`
- **Status**: `awaiting_payment` → `xrpl_confirmed`

#### Step 3: FDC Proof Generation
- **Service**: BridgeService
- **Action**: Generate Flare Data Connector attestation proof
- **Timing**: Wait for DA indexing (30-60s buffer, 20s for late-round submissions)
- **FDC Request**: Submit Payment Reference, Amount, Destination Tag to FDC Hub
- **Proof**: Receive merkle proof verifying XRPL payment on Flare
- **Storage**: Update bridge with `fdcProofData`, `fdcVotingRoundId`
- **Status**: `xrpl_confirmed` → `fdc_proof_generated`

#### Step 4: FXRP Minting
- **Service**: BridgeService → FAssetsClient
- **Action**: Submit FDC proof to AssetManager contract
- **Smart Account**: Execute via ERC-4337 with gasless transaction (paymaster)
- **Event**: AssetManager emits `MintingExecuted` event
- **Transfer**: FXRP tokens transferred to Smart Account
- **Storage**: Update bridge with `fxrpMintTxHash`, `fxrpReceived`
- **Status**: `fdc_proof_generated` → `vault_minting`
- **Fallback**: If stuck, DepositWatchdogService auto-recovers

#### Step 5: Vault Share Minting
- **Service**: VaultService
- **Action**: Deposit FXRP into ShXRPVault (ERC-4626 `deposit()`)
- **Approval**: Approve FXRP token for vault (6 decimals, not 18)
- **Minting**: Vault mints shXRP shares to Smart Account
- **Position**: Create/update position record with `walletAddress` mapping
- **Storage**: Update bridge with `vaultMintTxHash`
- **Transaction**: Create transaction record with `wallet_address` for history
- **Status**: `vault_minting` → `completed`
- **User sees**: shXRP balance updated in portfolio

## Testing Production Mode

### On Coston2 Testnet

1. Set environment variables:
```bash
DEMO_MODE=false
OPERATOR_PRIVATE_KEY=0x[your-test-key]
```

2. (Optional) Verify Contract Registry lookup:
```bash
npx tsx scripts/get-assetmanager-address.ts
```

3. Restart the application

4. Check that FAssetsClient initialized successfully:
```bash
# Server logs should show:
✅ Retrieved AssetManager from Contract Registry
   Network: coston2
   AssetManager: 0x...
✅ BridgeService initialized (PRODUCTION MODE)
```

5. Initiate a small test bridge (1-10 XRP)

6. Monitor logs for each step:
```bash
⏳ Executing FAssets collateral reservation...
✅ Collateral reserved with agent: 0x...
⏳ Waiting for XRP payment to agent address...
```

7. Send XRP to the provided agent address

8. Watch the bridge progress through all 4 steps

### Common Issues

#### Bridge Stuck at "Awaiting Payment"
- Verify you sent the exact amount to the correct agent address
- Check XRPL transaction was confirmed
- Ensure XRPL listener is running

#### "Failed to retrieve AssetManager address from Contract Registry"
- Check your internet connection and RPC endpoint accessibility
- Run `npx tsx scripts/get-assetmanager-address.ts` to diagnose the issue
- Verify you're connected to the correct Flare network (Mainnet vs Coston2)
- Check Flare Contract Registry status at https://dev.flare.network/

#### "FAssetsClient not initialized"
- Ensure `DEMO_MODE=false` is set
- Check `OPERATOR_PRIVATE_KEY` is configured
- Verify the operator wallet has sufficient FLR for transaction fees

## Wallet-Scoped Security

The FAssets integration implements comprehensive wallet-scoped security:

### Transaction Privacy
- **Bridge Records**: All `xrp_to_fxrp_bridges` include `wallet_address varchar NOT NULL`
- **Position Tracking**: All `positions` include `walletAddress` linked to user's XRP wallet
- **Transaction History**: All `transactions` include `wallet_address` for filtering
- **API Endpoints**: Require `walletAddress` parameter, return 400 if missing
- **Database Filtering**: Direct column filtering prevents JOIN-based security bypasses

### Custodial Model
- **Smart Account Ownership**: shXRP shares minted to platform's Smart Account
- **User Tracking**: Ownership mapped via `walletAddress` in positions table
- **Query Isolation**: Users can only access their own positions/transactions
- **Security Enforcement**: Database-level filtering, not application-level

Example Security Flow:
```typescript
// User initiates deposit from XRP wallet rABC...
const bridge = await storage.createBridge({
  walletAddress: "rABC...",  // Required field
  xrpAmount: "100",
  vaultId: "vault-1"
});

// Later: User queries their positions
const positions = await storage.getPositionsByWallet("rABC...");
// ✅ Only returns positions for rABC...

// Attempting to query another wallet's positions
const otherPositions = await storage.getPositionsByWallet("rXYZ...");
// ✅ Returns empty array (no access to other wallets)
```

## Security Considerations

⚠️ **IMPORTANT**: 
- Never commit private keys to version control
- Use Replit Secrets for all sensitive values
- Test thoroughly on Coston2 before mainnet deployment
- Monitor Smart Account balance for transaction fees (requires minimum 0.1 FLR for withdrawals)
- Implement rate limiting for bridge requests
- All bridge operations include wallet address validation
- Users can only access their own transaction history

## Monitoring and Maintenance

### Recommended Monitoring
1. **Bridge Operations**:
   - Success/failure rates
   - Average completion time per step
   - Stuck deposits (caught by DepositWatchdogService)
   - Failed FDC proofs (timeout errors)

2. **Withdrawal Operations**:
   - Redemption success rate
   - Backend reconciliation completion rate
   - Withdrawals in `manual_review` status
   - Smart Account FLR balance (min 0.1 FLR required)

3. **Smart Account Health**:
   - Native FLR balance (for non-paymaster transactions)
   - Pending UserOps in bundler
   - Failed bundler submissions
   - Paymaster sponsorship limits

4. **Service Health**:
   - DepositWatchdogService uptime
   - WithdrawalRetryService uptime
   - XRPL listener connection status
   - Database connection pool status

### Automated Recovery Services

**DepositWatchdogService**:
- Polls every 60 seconds
- Auto-recovers stuck deposits at `xrpl_confirmed`
- Queries AssetManager for mint events
- No manual intervention required

**WithdrawalRetryService**:
- Polls every 60 seconds
- Auto-retries failed withdrawal confirmations
- Exponential backoff (max 10 retries)
- Auto-prefunding if Smart Account balance too low
- Moves to `abandoned` after max retries (user still has XRP)

### Maintenance Tasks
- Monitor Smart Account FLR balance (top up if < 0.5 FLR)
- Track agent collateral availability
- Update FAssets SDK to latest version when available
- Review and optimize gas costs via Etherspot dashboard
- Monitor paymaster sponsorship usage
- Check for stuck bridges older than 30 minutes (auto-expired)
- Verify database indexes on `wallet_address` columns for performance

## Support

For FAssets SDK documentation and support:
- [Flare Network Documentation](https://docs.flare.network/)
- [FAssets GitHub](https://github.com/flare-foundation/fassets)
- [Flare Discord](https://discord.com/invite/flarenetwork)
