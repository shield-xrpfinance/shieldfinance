# Transaction Signing in Shield Yield Vaults

The platform uses a hybrid transaction signing approach optimized for security and user experience.

## Overview

### XRP Deposits (XRPL Side)
Users sign XRP payment transactions using **Xaman** wallet to transfer funds to the monitored deposit address. These transactions trigger the automated FAssets bridge.

### FXRP Withdrawals (Flare Side)
Withdrawals are executed via **ERC-4626 standard contracts** using Etherspot smart accounts, enabling **gasless transactions** with no user signing required.

## Deposit Flow

### 1. User Initiates Deposit

User selects vault and amount in the dashboard.

### 2. Xaman Payment Request

Backend creates XRPL payment transaction:

```typescript
{
  TransactionType: "Payment",
  Destination: "r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY",
  Amount: xrpAmount // in drops
}
```

### 3. QR Code Display

Modal shows Xaman's official QR code:
- **Source**: Xaman API (`payload.refs.qr_png`)
- **Scannable**: Works with Xaman mobile app
- **Deep Link**: Alternative for desktop users

### 4. User Signs Transaction

User scans QR code with Xaman app and approves the payment.

### 5. Automated Bridge Execution

Once XRPL payment is confirmed:
1. **XRPL Listener** detects incoming payment
2. **FAssets Bridge** initiates XRP → FXRP conversion
3. **FDC Attestation** generates proof of XRPL payment
4. **Minting** executes on Flare Network
5. **Vault Deposit** FXRP deposited into ERC-4626 vault
6. **shXRP Issued** User receives liquid staking tokens

### 6. Position Created

Backend records position in database with transaction hash.

## Withdrawal Flow

### 1. User Initiates Withdrawal

User selects amount to withdraw from their position.

### 2. Smart Account Execution

**No user signing required!** The Etherspot smart account:
1. Calls vault's ERC-4626 `redeem()` function
2. Burns user's shXRP tokens
3. Returns FXRP to user's Flare wallet

### 3. Gasless Transaction

- **Paymaster Sponsorship**: Transaction fees covered by platform
- **ERC-4337 Standard**: Smart account abstraction
- **Instant Execution**: No waiting for user approval

### 4. FXRP Returned

User receives FXRP in their connected Flare wallet immediately.

## Transaction Types Comparison

| Action | Chain | Signing Method | User Approval | Gas Fees |
|--------|-------|----------------|---------------|----------|
| **Deposit** | XRPL | Xaman QR Code | Required | Paid by user (~0.00001 XRP) |
| **Withdraw** | Flare | Smart Account | Not required | Paid by platform (gasless) |

## Xaman Integration Details

### Payload Creation

For XRP deposits, the backend generates Xaman payloads:

```typescript
const payload = await xummSdk.payload.create({
  txjson: {
    TransactionType: "Payment",
    Destination: vaultAddress,
    Amount: amountInDrops.toString()
  }
});
```

### Polling Mechanism

Frontend polls for signature confirmation:

```typescript
// Poll every 2 seconds for up to 5 minutes
const pollInterval = 2000;
const maxAttempts = 150;

const checkStatus = async (uuid: string) => {
  const response = await fetch(`/api/wallet/xaman/status/${uuid}`);
  const data = await response.json();
  
  if (data.signed) {
    return data.txHash; // XRPL transaction hash
  }
  
  return null;
};
```

### Transaction Hash Persistence

Every XRP deposit stores its XRPL transaction hash:
- **Verifiable**: Hash can be checked on XRPL explorer
- **Bridge Tracking**: Links to FAssets bridge record
- **Audit Trail**: Complete deposit history

## Smart Account Details

### ERC-4337 Implementation

- **Provider**: Etherspot Prime SDK
- **Smart Account**: `0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd`
- **Features**: 
  - Gasless transactions via paymaster
  - Batch operations support
  - Social recovery capabilities

### Vault Interaction

Smart account interacts with ERC-4626 vault:

```solidity
// Withdraw example (simplified)
function withdraw(uint256 shares) external {
  vault.redeem(shares, msg.sender, msg.sender);
  // User receives FXRP, shXRP burned automatically
}
```

## Error Handling

### XRP Deposits
- **User Rejects**: Modal closes, no transaction recorded
- **Timeout**: After 5 minutes, polling stops
- **Network Errors**: Graceful fallback with error messages
- **Invalid Amount**: Xaman validates before signing

### FXRP Withdrawals
- **Insufficient Balance**: Frontend validation prevents submission
- **Contract Error**: Smart account reverts, user notified
- **Network Issues**: Retry mechanism with user notification

## Demo Mode Behavior

When `DEMO_MODE=true`:
- Mock QR codes displayed for deposits
- Simulated bridge progression
- Demo transaction hashes generated
- No actual blockchain transactions

## Security Features

✅ **Xaman Security**:
- User approval required for every deposit
- Transaction details shown before signing
- No private key exposure (signing in Xaman app)
- Network validation (mainnet/testnet)

✅ **Smart Account Security**:
- ERC-4337 standard compliance
- Paymaster whitelisting
- ReentrancyGuard on vault contracts
- Minimum withdrawal limits

✅ **Bridge Security**:
- FDC attestation proofs verify XRPL payments
- Idempotent operations prevent double-minting
- Automatic reconciliation for stuck bridges

## Best Practices

### For Users
1. **Verify Amounts**: Double-check deposit amounts in Xaman before signing
2. **Save Transaction Hashes**: Keep XRPL transaction hashes for reference
3. **Check Balances**: Monitor shXRP balance after deposits complete
4. **Test Small First**: Try small deposits on testnet before large amounts

### For Developers
1. **Polling Cleanup**: Always clear polling intervals on unmount
2. **Error Feedback**: Provide clear error messages for failed transactions
3. **Transaction Tracking**: Store all transaction hashes in database
4. **Network Switching**: Ensure correct XRPL network (mainnet/testnet)

## Related Documentation

- [Wallet Integration](./wallet-integration.md) - Connecting Xaman wallet
- [FAssets Integration](../../FASSETS_INTEGRATION.md) - Bridge configuration
- [Smart Accounts](../../SMART_ACCOUNTS.md) - ERC-4337 implementation details
