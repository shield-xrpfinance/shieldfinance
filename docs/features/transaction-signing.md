# Transaction Signing with Xaman

All blockchain transactions (deposits, withdrawals, reward claims) use Xaman for secure signing.

## How It Works

### Transaction Flow

1. **User initiates action** (deposit, withdraw, claim)
2. **Backend creates Xaman payload** with transaction details
3. **QR code modal displays** with Xaman's native QR PNG
4. **User scans QR code** with Xaman mobile app
5. **User reviews transaction** in Xaman app
6. **User approves** or rejects transaction
7. **Frontend polls** for signature confirmation
8. **Transaction hash** retrieved and stored
9. **Backend records** transaction in database

### Xaman Payload Creation

For each transaction type, the backend creates a specific XRPL transaction:

**Deposit:**
```typescript
{
  TransactionType: "Payment",
  Destination: vaultAddress,
  Amount: {
    currency: assetSymbol,
    value: amount,
    issuer: issuerAddress
  }
}
```

**Withdrawal:**
```typescript
{
  TransactionType: "Payment",
  Destination: userAddress,
  Amount: {
    currency: assetSymbol,
    value: amount,
    issuer: issuerAddress
  }
}
```

### QR Code Display

The modal shows Xaman's actual QR code PNG image:

- **NOT regenerated**: Uses Xaman's official QR URL
- **Direct from Xaman API**: `payload.refs.qr_png`
- **Scannable**: Works with Xaman mobile app
- **Deep linking**: Alternative deep link for desktop users

## Transaction Types

### Deposits

**Purpose**: Transfer assets from user wallet to vault

**Process:**
1. User selects vault and amount
2. Backend generates deposit payment payload
3. User signs with Xaman
4. Transaction submitted to XRPL
5. Position created in database
6. Transaction recorded with hash

### Withdrawals

**Purpose**: Return assets from vault to user wallet

**Process:**
1. User initiates withdrawal from position
2. Backend generates withdrawal payment payload
3. User signs with Xaman
4. Assets returned to user wallet
5. Position updated in database
6. Transaction recorded with hash

### Reward Claims

**Purpose**: Claim accrued staking rewards

**Process:**
1. User claims rewards from position
2. Backend generates claim payment payload
3. User signs with Xaman
4. Rewards sent to user wallet
5. Position rewards reset
6. Transaction recorded with hash

## Polling Mechanism

After QR code is displayed, frontend polls for transaction status:

```typescript
// Poll every 2 seconds for up to 5 minutes
const pollInterval = 2000;
const maxAttempts = 150;

// Check Xaman payload status
const checkStatus = async (uuid: string) => {
  const response = await fetch(`/api/wallet/xaman/status/${uuid}`);
  const data = await response.json();
  
  if (data.signed) {
    return data.txHash;
  }
  
  return null;
};
```

## Transaction Hash Persistence

Every transaction stores its blockchain hash:

- **Verifiable**: Hash can be checked on XRPL explorer
- **Auditable**: Complete transaction history
- **Traceable**: Links frontend actions to blockchain events

## Error Handling

The system handles various error scenarios:

- **User rejects**: Modal closes, no transaction recorded
- **Timeout**: After 5 minutes, polling stops
- **Network errors**: Graceful fallback with error messages
- **Invalid transactions**: Xaman validates before signing

## Demo Mode Behavior

When API keys are not configured:

- Mock QR codes displayed
- Simulated signing process
- Demo transaction hashes generated
- No actual blockchain transactions

## Security Features

✅ **User approval required**: Every transaction must be approved  
✅ **Transaction details shown**: Users see exact amounts before signing  
✅ **Network validation**: Ensures correct network (mainnet/testnet)  
✅ **No private key exposure**: Signing happens in Xaman app  
✅ **Hash verification**: Every transaction has verifiable hash
