# XRPL Smart Accounts Technical Specification

**Last Updated:** December 3, 2025  
**Status:** Coming December 2025 (Xaman Integration)

## Overview

**XRPL Smart Accounts** enable XRP Ledger users to trigger smart contract transactions on Flare Network directly from their XRPL wallets using encoded memo instructions. This eliminates the need to manage separate wallets on both chains.

**Key Features:**
- Execute Flare transactions from XRPL addresses
- No need for FLR wallet or gas fees
- Powered by Flare Data Connector (FDC) for verification
- Proxy accounts handle Flare-side execution
- Coming to Xaman wallet in December 2025

---

## How Smart Accounts Work

### Architecture

```
┌─────────────────┐
│  XRPL Wallet    │
│  (User)         │
└────────┬────────┘
         │
         │ 1. Send XRP with encoded memo
         ▼
┌─────────────────┐
│  XRPL Network   │
│  (Transaction)  │
└────────┬────────┘
         │
         │ 2. FDC verifies transaction
         ▼
┌─────────────────┐
│ Flare Data      │
│ Connector (FDC) │
└────────┬────────┘
         │
         │ 3. Attestation proof
         ▼
┌─────────────────┐
│  Proxy Account  │
│  (Flare)        │
└────────┬────────┘
         │
         │ 4. Execute on Flare
         ▼
┌─────────────────┐
│  FAssets/DeFi   │
│  (Flare Smart   │
│   Contracts)    │
└─────────────────┘
```

### Key Components

1. **XRPL Memo:** Encodes Flare transaction instructions (action, destination, parameters)
2. **Flare Data Connector (FDC):** Verifies XRPL transaction and extracts memo data
3. **Proxy Account:** Flare-side account that executes transactions on behalf of XRPL user
4. **Smart Account Registry:** Maps XRPL addresses to Flare proxy accounts

---

## XRPL Memo Format

### Standard Memo Structure

XRPL transactions support a `Memos` field for arbitrary data.

**JSON Structure:**
```json
{
  "Memos": [
    {
      "Memo": {
        "MemoData": "hex_encoded_payload",
        "MemoType": "hex_encoded_type",
        "MemoFormat": "hex_encoded_format"
      }
    }
  ]
}
```

**Constraints:**
- Total memo size: ≤ 1 KB (serialized binary format)
- All fields must be hex-encoded
- At least one of MemoData, MemoType, or MemoFormat must be present

### FAssets Bridging Memo Format

**For Smart Account FAssets minting:**

```javascript
// Payload structure (JSON)
const memoPayload = {
  action: 'fassets_mint',
  destination: '0xFlareAddressToReceiveFXRP',
  protocol: 'fassets',
  version: '1.0'
};

// Convert to hex-encoded memo
const memoJson = JSON.stringify(memoPayload);
const memoHex = Buffer.from(memoJson, 'utf8').toString('hex');

// Build XRPL memo
const memo = {
  Memo: {
    MemoData: memoHex,
    MemoType: Buffer.from('smart-account', 'utf8').toString('hex'),
    MemoFormat: Buffer.from('application/json', 'utf8').toString('hex')
  }
};
```

**Current FAssets Minting Memo (Non-Smart Account):**

For existing FAssets minting, the memo contains a **32-byte payment reference**:

```javascript
// From CollateralReserved event
const paymentReference = event.args.paymentReference; // 32-byte hex

// XRPL memo (simplified)
const memo = {
  Memo: {
    MemoData: paymentReference  // Already in hex format
  }
};
```

**Note:** Smart Account memo format will be announced by Flare when feature launches in December 2025.

---

## Encoding & Decoding Memos

### Encoding (JavaScript/TypeScript)

```typescript
import { Buffer } from 'buffer';

// Create structured payload
interface SmartAccountPayload {
  action: string;
  destination: string;
  protocol: string;
  version: string;
  parameters?: Record<string, any>;
}

function createSmartAccountMemo(payload: SmartAccountPayload) {
  // Convert payload to JSON
  const jsonPayload = JSON.stringify(payload);
  
  // Encode to hex
  const memoData = Buffer.from(jsonPayload, 'utf8').toString('hex');
  const memoType = Buffer.from('smart-account', 'utf8').toString('hex');
  const memoFormat = Buffer.from('application/json', 'utf8').toString('hex');
  
  // Build memo object
  return {
    Memo: {
      MemoData: memoData,
      MemoType: memoType,
      MemoFormat: memoFormat
    }
  };
}

// Example usage
const memo = createSmartAccountMemo({
  action: 'fassets_mint',
  destination: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  protocol: 'fassets',
  version: '1.0'
});
```

### Decoding (JavaScript/TypeScript)

```typescript
function decodeSmartAccountMemo(memo: any) {
  if (!memo || !memo.MemoData) {
    return null;
  }
  
  // Decode hex to UTF-8
  const jsonString = Buffer.from(memo.MemoData, 'hex').toString('utf8');
  
  // Parse JSON
  const payload = JSON.parse(jsonString);
  
  return {
    data: payload,
    type: memo.MemoType ? Buffer.from(memo.MemoType, 'hex').toString('utf8') : null,
    format: memo.MemoFormat ? Buffer.from(memo.MemoFormat, 'hex').toString('utf8') : null
  };
}

// Example usage
const decodedMemo = decodeSmartAccountMemo(transaction.Memos[0].Memo);
console.log(decodedMemo.data); // { action: 'fassets_mint', ... }
```

---

## Smart Account Security Model

### Key Management

**XRPL Side:**
- User controls XRPL private key (via Xaman, Ledger, etc.)
- No additional keys required for Smart Account features
- Standard XRPL transaction signing

**Flare Side:**
- Proxy account managed by Flare protocol
- User does NOT need to manage Flare private keys
- Transactions executed via FDC attestation proofs

### Trust Model

**Trustless Components:**
- FDC cryptographically proves XRPL transactions
- Proxy accounts cannot act without valid FDC proof
- Smart contracts enforce memo instruction validation

**Trust Assumptions:**
- Flare network consensus (same as any Flare transaction)
- FDC attestation provider honesty (decentralized set)
- Smart Account contract code correctness (audited)

### Permissions & Authorization

**Default Permissions:**
- XRPL address → Proxy account mapping is 1:1 and permanent
- User can authorize specific actions via memo instructions
- Contracts can whitelist allowed actions per user

**Example Authorization:**
```json
{
  "action": "fassets_mint",
  "destination": "0xUserFlareAddress",
  "maxAmount": "1000000000",  // Max 1000 XRP
  "expiry": 1701388800        // Unix timestamp
}
```

---

## Transaction Signing Flow

### Smart Account Minting Flow (XRPL → FXRP)

**Step 1: User Initiates Transaction (XRPL)**

```typescript
import { Client, Payment } from 'xrpl';

const client = new Client('wss://xrplcluster.com');
await client.connect();

// Build payment with Smart Account memo
const payment: Payment = {
  TransactionType: 'Payment',
  Account: userXrplAddress,
  Destination: 'rSmartAccountBridge...',  // Flare bridge address
  Amount: '1000000000',  // 1000 XRP (in drops)
  Memos: [{
    Memo: {
      MemoData: Buffer.from(JSON.stringify({
        action: 'fassets_mint',
        destination: userFlareAddress,
        protocol: 'fassets',
        version: '1.0'
      }), 'utf8').toString('hex'),
      MemoType: Buffer.from('smart-account', 'utf8').toString('hex'),
      MemoFormat: Buffer.from('application/json', 'utf8').toString('hex')
    }
  }]
};

// Sign and submit
const prepared = await client.autofill(payment);
const signed = wallet.sign(prepared);
const result = await client.submitAndWait(signed.tx_blob);

console.log('XRPL Transaction Hash:', result.result.hash);
```

**Step 2: FDC Verification**

```typescript
// Wait for XRPL finality (7 blocks)
await waitForFinality(result.result.hash, 7);

// FDC automatically monitors XRPL transactions
// Attestation providers verify:
// 1. Transaction is finalized on XRPL
// 2. Memo contains valid Smart Account instruction
// 3. User signature is valid
```

**Step 3: Proxy Account Execution (Flare)**

```typescript
// Proxy account receives FDC attestation
// Decodes memo and executes Flare-side transaction

// Pseudo-code (handled by Flare protocol):
const attestation = await fdc.getAttestation(xrplTxHash);
const memo = decodeMemo(attestation.transaction.Memos[0]);

if (memo.action === 'fassets_mint') {
  // Execute minting on AssetManager contract
  await assetManager.executeMintingViaSmartAccount(
    attestation.proof,
    memo.destination,
    attestation.transaction.Amount
  );
}
```

**Step 4: User Receives FXRP**

```typescript
// FXRP minted to user's Flare address (from memo.destination)
// No additional user action required
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| **Invalid Memo Format** | Memo not properly hex-encoded | Re-encode payload as hex |
| **Memo Size Exceeded** | Payload > 1 KB | Reduce payload size |
| **Unsupported Action** | Action not recognized by Smart Account | Check supported actions |
| **Destination Invalid** | Flare address format incorrect | Validate address before encoding |
| **Insufficient XRP** | Payment amount too low | Increase XRP amount |
| **FDC Proof Timeout** | Transaction not finalized on XRPL | Wait for 7+ confirmations |

### Handling Failed Transactions

**Scenario 1: XRPL Transaction Fails**
- XRP is not sent
- No Smart Account action triggered
- User retries transaction

**Scenario 2: FDC Verification Fails**
- XRP may be sent to bridge address
- Smart Account action is NOT executed
- **Recovery:** Contact Flare support or bridge operator

**Scenario 3: Proxy Execution Fails**
- XRP sent successfully
- FDC proof valid
- Flare-side transaction fails (e.g., contract revert)
- **Recovery:** Depends on failure reason; may require manual intervention

### Fallback Mechanisms

**If Smart Account Unavailable:**
- Fallback to standard FAssets minting flow
- User mints FXRP via FAssets dApp
- Use traditional two-step process (reserve collateral + send XRP)

**If FDC Offline:**
- Wait for FDC to resume (decentralized, high availability)
- Worst case: Use manual bridging with agent support

---

## Integration Best Practices

### 1. Validate Memo Before Sending

```typescript
function validateSmartAccountMemo(payload: SmartAccountPayload): boolean {
  // Check required fields
  if (!payload.action || !payload.destination || !payload.protocol) {
    return false;
  }
  
  // Validate destination address (Flare)
  if (!ethers.isAddress(payload.destination)) {
    return false;
  }
  
  // Check payload size
  const memoHex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
  if (memoHex.length > 2048) {  // 1 KB = 2048 hex chars
    return false;
  }
  
  return true;
}
```

### 2. Wait for XRPL Finality

```typescript
async function waitForXrplFinality(client: Client, txHash: string, confirmations: number = 7) {
  let confirmedBlocks = 0;
  let txLedger: number | null = null;
  
  while (confirmedBlocks < confirmations) {
    const txInfo = await client.request({
      command: 'tx',
      transaction: txHash
    });
    
    if (!txLedger) {
      txLedger = txInfo.result.ledger_index;
    }
    
    const currentLedger = await client.getLedgerIndex();
    confirmedBlocks = currentLedger - txLedger;
    
    if (confirmedBlocks < confirmations) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }
  }
  
  return true;
}
```

### 3. Monitor Flare-Side Execution

```typescript
// Listen for Smart Account execution events on Flare
const smartAccountContract = new ethers.Contract(
  SMART_ACCOUNT_REGISTRY,
  SMART_ACCOUNT_ABI,
  provider
);

smartAccountContract.on("TransactionExecuted", (xrplAddress, flareAddress, action, success) => {
  if (xrplAddress.toLowerCase() === userXrplAddress.toLowerCase()) {
    if (success) {
      console.log(`Smart Account action "${action}" executed successfully`);
    } else {
      console.error(`Smart Account action "${action}" failed`);
    }
  }
});
```

### 4. Provide Clear User Feedback

```typescript
// Example UI flow
async function executeFAssetsMintViaSmartAccount(amount: string) {
  try {
    // Step 1: Validate
    updateUI('Validating transaction...');
    const payload = buildMintPayload(amount, userFlareAddress);
    if (!validateSmartAccountMemo(payload)) {
      throw new Error('Invalid memo payload');
    }
    
    // Step 2: Send XRPL transaction
    updateUI('Sending XRP transaction...');
    const xrplTx = await sendXrplPayment(amount, payload);
    updateUI(`XRPL transaction sent: ${xrplTx.hash}`);
    
    // Step 3: Wait for finality
    updateUI('Waiting for XRPL confirmation (7 blocks)...');
    await waitForXrplFinality(client, xrplTx.hash, 7);
    updateUI('XRPL transaction finalized');
    
    // Step 4: FDC processing
    updateUI('Flare Data Connector processing...');
    // Monitor for Flare-side execution
    
    // Step 5: Complete
    updateUI('FXRP minted successfully!');
  } catch (error) {
    updateUI(`Error: ${error.message}`);
  }
}
```

---

## Supported Actions (December 2025 Launch)

**Expected Smart Account Actions:**

| Action | Description | Parameters |
|--------|-------------|------------|
| `fassets_mint` | Mint FXRP on Flare | `destination`: Flare address |
| `firelight_deposit` | Deposit FXRP into Firelight | `destination`: Flare address, `vault`: Vault address |
| `transfer_fxrp` | Transfer FXRP to another address | `recipient`: Flare address, `amount`: Amount |

**Note:** Exact action names and parameters will be published by Flare/Xaman when feature launches.

---

## Future Enhancements

### Phase 1 (December 2025)
- Basic Smart Account memo support
- FAssets minting via XRPL
- Xaman wallet integration

### Phase 2 (Q1 2026)
- Multi-action memos (batch operations)
- DeFi protocol integrations (Firelight, DEXs)
- Conditional execution (if/then logic)

### Phase 3 (Q2 2026+)
- Cross-chain swaps via memo
- Automated yield strategies
- Programmable smart account logic

---

## Official Resources

### Documentation

- **Flare Developer Hub:** https://dev.flare.network/fassets/overview
- **XRPL Memo Spec:** https://xrpl.org/docs/references/protocol/transactions/common-fields
- **FDC Documentation:** https://dev.flare.network/fdc/overview

### Community Resources

- **XRPL Standards Discussion:** https://github.com/XRPLF/XRPL-Standards/discussions/103
- **Xaman Wallet:** https://xaman.app
- **Flare Discord:** https://discord.com/invite/flarenetwork

---

## Testing Checklist

### Before December 2025 Launch

Since Smart Accounts are not yet live, prepare by:

1. ✅ Implement standard XRPL memo encoding/decoding
2. ✅ Test with existing FAssets minting (32-byte payment reference)
3. ✅ Build UI for Smart Account memo creation (ready for launch)
4. ✅ Set up FDC monitoring infrastructure
5. ✅ Create fallback to standard minting flow

### After Launch

1. ✅ Test on Coston2 testnet first (if available)
2. ✅ Test with small amounts on mainnet
3. ✅ Verify Flare-side execution events
4. ✅ Test error scenarios (invalid memo, insufficient XRP)
5. ✅ Monitor gas costs and optimize

---

## Security Considerations

### User Safety

- **Never share XRPL private keys** (Smart Accounts do not require this)
- **Verify destination addresses** before encoding in memo
- **Start with small test amounts** when using new features
- **Use reputable wallets** (Xaman, Bifrost, Ledger)

### Smart Contract Risks

- **Smart Account contracts are audited** but not risk-free
- **FDC assumes honest attestation providers** (decentralized set mitigates risk)
- **Proxy accounts have limited permissions** (cannot drain user funds)

### Phishing Protection

**Beware of fake Smart Account prompts:**
- Only use official Xaman/Flare integrations
- Verify XRPL destination addresses
- Check memo payloads before signing
- Never send XRP to unknown addresses with encoded memos

---

## Risk Disclosure

⚠️ **Important Notice:**

Smart Accounts are a **new feature launching in December 2025**. Consider the following:

1. **Unproven Technology:** Limited production history
2. **FDC Dependency:** Relies on Flare Data Connector attestations
3. **Irreversible Transactions:** XRPL transactions cannot be reversed once finalized
4. **Smart Contract Risk:** Proxy execution may fail or have bugs
5. **Memo Encoding Errors:** Invalid memos may result in lost XRP

**Only use with funds you can afford to lose during early testing.**

---

## Next Steps

### For Developers

1. ✅ Study XRPL memo encoding standards
2. ✅ Implement memo creation/validation functions
3. ✅ Build UI for Smart Account transactions
4. ✅ Prepare FDC monitoring infrastructure
5. ✅ Wait for official Smart Account spec from Flare (December 2025)

### For Users

1. ✅ Keep Xaman wallet updated
2. ✅ Follow Flare announcements for launch date
3. ✅ Practice with standard FAssets minting first
4. ✅ Join community channels for support

**Monitor:** 
- **Flare Twitter:** https://twitter.com/FlareNetworks
- **Xaman Twitter:** https://twitter.com/XamanWallet
- **Flare Developer Hub:** https://dev.flare.network

---

## Conclusion

XRPL Smart Accounts represent a major UX improvement for bridging XRP to Flare's DeFi ecosystem. By eliminating the need for users to manage multiple wallets, Smart Accounts will significantly lower the barrier to entry for XRP holders.

**Key Takeaways:**
- Smart Accounts use XRPL memos to encode Flare transaction instructions
- FDC verifies XRPL transactions and triggers Flare-side execution
- Users only need their XRPL wallet (e.g., Xaman)
- Launching in December 2025 with Xaman integration

**Stay tuned for official specification updates from Flare and Xaman.**
