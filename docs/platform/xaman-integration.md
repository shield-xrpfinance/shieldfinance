# Xaman (XUMM) Integration Technical Details

This document covers the technical implementation of Xaman integration in Shield Yield Vaults, including the native xApp experience.

## Architecture Overview

Shield Finance supports two modes of Xaman integration:

1. **Browser Mode**: Traditional QR code signing flow for desktop/mobile web users
2. **xApp Mode**: Native in-app experience with auto-connect and auto-sign when opened within Xaman wallet

### Components

1. **Backend Routes** (`server/routes.ts`)
   - Xaman payload creation endpoints
   - Payload status checking
   - Transaction hash retrieval

2. **Frontend Modal** (`client/src/components/XamanSigningModal.tsx`)
   - QR code display (browser mode)
   - Polling mechanism
   - Transaction status updates

3. **Wallet Context** (`client/src/lib/walletContext.tsx`)
   - Wallet connection state
   - Balance management
   - Network configuration
   - **xApp context detection**
   - **Auto-connect for xApp users**
   - **Direct sign request opening via `xumm.xapp.openSignRequest()`**

---

## xApp Integration (Native Xaman Experience)

When Shield Finance is opened as an xApp within Xaman wallet, users get a seamless experience:

### Features

| Feature | Browser Mode | xApp Mode |
|---------|-------------|-----------|
| Wallet Connection | QR scan required | **Auto-connect** (instant) |
| Deposit Signing | QR modal | **Auto-sign modal** (native) |
| Claim/Withdraw Signing | QR modal | QR modal (fallback) |
| User Account | Manual entry | **SDK-provided** |
| Session Persistence | LocalStorage | **JWT-based** |

> **Note:** Currently, deposit transactions use native xApp signing via `openSignRequest()`. Claim and withdrawal flows still use the QR modal pending backend endpoint updates.

### xApp Detection

The SDK automatically detects xApp context through multiple methods:

```typescript
// client/src/lib/walletContext.tsx
const restoreConnection = async () => {
  // Check for xApp context indicators
  const urlParams = new URLSearchParams(window.location.search);
  const hasXAppToken = urlParams.has('xAppToken') || urlParams.has('ott') || urlParams.has('xApp');
  const hasReactNativeWebView = typeof (window as any).ReactNativeWebView !== 'undefined';
  
  // Initialize Xumm SDK
  const xummSdk = getXummSdk();
  if (xummSdk) {
    // SDK's environment property indicates xApp context
    const environment = await xummSdk.environment;
    const isXappContext = !!(environment as any)?.jwt || hasXAppToken || hasReactNativeWebView;
    
    if (isXappContext) {
      // Auto-connect: Get user account directly from SDK
      const account = await xummSdk.user.account;
      if (account) {
        setAddress(account);
        setProvider('xaman');
        
        // Notify Xaman that xApp is ready (hides loader)
        await xummSdk.xapp.ready();
      }
    }
  }
};
```

### Auto-Sign (Direct Sign Request)

When in xApp context, signing requests open natively without QR codes:

```typescript
// client/src/lib/walletContext.tsx - requestPayment function
const requestPayment = async (paymentRequest: PaymentRequest) => {
  // ... create payload via backend ...
  const data = await response.json();
  
  // Check for xApp context
  const xummSdk = getXummSdk();
  const environment = await xummSdk.environment;
  const isXappContext = !!(environment as any)?.jwt || 
    typeof (window as any).ReactNativeWebView !== 'undefined';
  
  if (isXappContext && xummSdk.xapp) {
    // Open sign request directly in xApp - no QR modal needed
    await xummSdk.xapp.openSignRequest({ uuid: data.uuid });
    
    return {
      success: true,
      payloadUuid: data.uuid,
      xappHandled: true,  // Signal that xApp handled signing
    };
  }
  
  // Fall back to QR modal for browser mode
  return { success: true, ...data };
};
```

### xApp Flow Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                    xApp Mode - Connection Flow                      │
│                                                                     │
│  User Opens xApp in Xaman                                          │
│         │                                                          │
│         ▼                                                          │
│  SDK Detects xApp Context (JWT/OTT/ReactNativeWebView)             │
│         │                                                          │
│         ▼                                                          │
│  Auto-Connect: xummSdk.user.account → User Address                 │
│         │                                                          │
│         ▼                                                          │
│  xummSdk.xapp.ready() → Hides Xaman Loader                         │
│         │                                                          │
│         ▼                                                          │
│  ✅ User is now connected (no QR scan needed)                      │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    xApp Mode - Deposit Flow                         │
│                                                                     │
│  User Initiates Deposit                                            │
│         │                                                          │
│         ▼                                                          │
│  Backend Creates Payment Payload → Returns UUID                    │
│         │                                                          │
│         ▼                                                          │
│  xummSdk.xapp.openSignRequest({ uuid }) → Native Sign Sheet        │
│         │                                                          │
│         ▼                                                          │
│  User Approves → Transaction Submitted to XRPL                     │
│         │                                                          │
│         ▼                                                          │
│  Frontend Polls Status → Success Callback                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│              xApp Mode - Claim/Withdraw Flow (Fallback)             │
│                                                                     │
│  User Initiates Claim or Withdraw                                  │
│         │                                                          │
│         ▼                                                          │
│  Backend Creates Payload → Returns QR URL                          │
│         │                                                          │
│         ▼                                                          │
│  QR Modal Displayed (fallback to browser mode)                     │
│         │                                                          │
│         ▼                                                          │
│  User Scans QR with Xaman → Approves → XRPL TX                     │
└────────────────────────────────────────────────────────────────────┘
```

> **Future Enhancement:** Claim and withdraw endpoints can be updated to return payload UUIDs, enabling native xApp signing for all transaction types.

---

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
