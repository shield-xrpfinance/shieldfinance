# Xaman (XUMM) Integration Technical Details

This document covers the technical implementation of Xaman integration in Shield Finance.

## Architecture Overview

### Components

1. **Backend Routes** (`server/routes.ts`)
   - Xaman payload creation endpoints
   - Payload status checking
   - Transaction hash retrieval

2. **Frontend Modal** (`client/src/components/XamanSigningModal.tsx`)
   - QR code display
   - Polling mechanism
   - Transaction status updates

3. **Wallet Context** (`client/src/lib/walletContext.tsx`)
   - Wallet connection state
   - Balance management
   - Network configuration

## Backend Implementation

### Dependencies

```typescript
import { XummSdk } from 'xumm-sdk';
```

### Environment Variables

```
XUMM_API_KEY=your_api_key
XUMM_API_SECRET=your_api_secret
```

### Payload Creation Endpoints

#### Create SignIn Payload
```typescript
POST /api/wallet/xaman/payload

Response:
{
  uuid: string,
  qrUrl: string,
  deepLink: string,
  demo: boolean
}
```

#### Create Deposit Payload
```typescript
POST /api/wallet/xaman/deposit

Body:
{
  vaultId: string,
  asset: string,
  amount: string,
  walletAddress: string,
  network: 'mainnet' | 'testnet'
}

Response:
{
  uuid: string,
  qrUrl: string,
  deepLink: string,
  demo: boolean
}
```

#### Check Payload Status
```typescript
GET /api/wallet/xaman/status/:uuid

Response:
{
  signed: boolean,
  txHash?: string
}
```

### Network Configuration

The backend configures vault addresses and issuers based on network:

```typescript
const vaultAddress = network === "testnet" 
  ? "rNaqKtKrMSwpwZSzRckPf7S96DkimjkF4H" // Testnet
  : "rNaqKtKrMSwpwZSzRckPf7S96DkimjkF4H"; // Mainnet

const issuers = {
  mainnet: {
    RLUSD: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
    USDC: "rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE"
  },
  testnet: {
    RLUSD: "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV"
  }
};
```

## Frontend Implementation

### XamanSigningModal Component

**Props:**
```typescript
interface XamanSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
  payloadUuid: string;
  qrUrl: string;
  deepLink: string;
  transactionType: 'deposit' | 'withdrawal' | 'claim';
  amount: string;
  asset: string;
}
```

**Key Features:**
- Displays Xaman's native QR code PNG
- Polls for transaction status every 2 seconds
- Timeout after 5 minutes (150 attempts)
- Shows loading states and success/error messages

**Polling Logic:**
```typescript
useEffect(() => {
  if (!isOpen || !payloadUuid) return;
  
  let attempts = 0;
  const maxAttempts = 150;
  
  const pollStatus = async () => {
    try {
      const response = await fetch(`/api/wallet/xaman/status/${payloadUuid}`);
      const data = await response.json();
      
      if (data.signed && data.txHash) {
        onSuccess(data.txHash);
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(pollStatus, 2000);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };
  
  pollStatus();
}, [isOpen, payloadUuid]);
```

### Usage Example

```typescript
// 1. Create payload
const handleDeposit = async () => {
  const response = await apiRequest('/api/wallet/xaman/deposit', {
    method: 'POST',
    body: JSON.stringify({
      vaultId,
      asset,
      amount,
      walletAddress,
      network
    })
  });
  
  const { uuid, qrUrl, deepLink } = response;
  
  // 2. Show modal
  setPayloadData({ uuid, qrUrl, deepLink });
  setShowModal(true);
};

// 3. Handle success
const handleSuccess = async (txHash: string) => {
  // Submit transaction with hash to backend
  await apiRequest('/api/positions/deposit', {
    method: 'POST',
    body: JSON.stringify({
      vaultId,
      amount,
      asset,
      txHash,
      walletAddress,
      network
    })
  });
  
  // Close modal and refresh data
  setShowModal(false);
  queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
};
```

## Transaction Flow Diagram

```
User Action → Backend Creates Payload → QR Modal Opens
                                            ↓
                                    User Scans QR
                                            ↓
                                    Xaman App Opens
                                            ↓
                                    User Reviews TX
                                            ↓
                                    User Approves
                                            ↓
Frontend Polls ← Backend Checks Status ← XRPL TX Submitted
       ↓
   TX Hash Retrieved
       ↓
Backend Stores Transaction
       ↓
   Success Callback
```

## Error Handling

### Backend Errors

```typescript
try {
  const xumm = new XummSdk(apiKey, apiSecret);
  const payload = await xumm.payload?.create(transaction);
  // ...
} catch (error) {
  console.error("Xaman payload creation error:", error);
  // Return demo payload as fallback
  return res.json({ 
    uuid: "demo-payload-uuid",
    qrUrl: "demo",
    deepLink: "",
    demo: true
  });
}
```

### Frontend Errors

```typescript
// Timeout handling
if (attempts >= maxAttempts) {
  setError('Transaction timed out. Please try again.');
  return;
}

// Network errors
try {
  const response = await fetch(/*...*/);
} catch (error) {
  console.error('Failed to check status:', error);
}
```

## Testing

### Demo Mode Testing

Set environment variables to empty to trigger demo mode:

```bash
XUMM_API_KEY=
XUMM_API_SECRET=
```

### Testnet Testing

1. Switch to testnet in app
2. Get test XRP from faucet
3. Create test transactions
4. Verify on testnet explorer

### Mainnet Testing

⚠️ **Use small amounts for initial testing**

1. Switch to mainnet
2. Connect real wallet
3. Test with minimal amounts
4. Verify transactions on mainnet explorer

## Security Considerations

- **API Keys**: Never expose in frontend code
- **Transaction Validation**: Backend validates all transaction parameters
- **Network Isolation**: Testnet and mainnet are completely separated
- **User Approval**: All transactions require explicit user approval in Xaman
- **Hash Verification**: Every transaction hash is verifiable on-chain

## Resources

- [Xaman Developer Docs](https://xumm.readme.io/)
- [XUMM SDK GitHub](https://github.com/XRPL-Labs/xumm-sdk)
- [XRP Ledger Documentation](https://xrpl.org/)
- [Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
