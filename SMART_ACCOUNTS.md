# Flare Smart Accounts Implementation

## Overview

This project uses **ERC-4337 Account Abstraction** exclusively via **Etherspot Prime SDK** on Flare Network. Smart accounts enable:

- ✅ **Gasless Transactions** - Users don't need FLR/CFLR for gas
- ✅ **Transaction Batching** - Execute multiple operations in one UserOp
- ✅ **Paymaster Support** - Platform sponsors all user transactions
- ✅ **Dual Wallet Support** - Works with both XRPL (Xaman) and EVM (WalletConnect) wallets
- ✅ **Enhanced Security** - Smart contract wallets with ERC-4337 validation

## Architecture

### Smart Account Only

The system operates **exclusively in smart account mode**:

- All transactions are routed through ERC-4337 account abstraction
- No EOA fallback - smart accounts required for all operations
- Platform handles gas sponsorship via Etherspot Arka paymaster
- Etherspot bundler API key required for operation

### Two-SDK Architecture

**Production Optimization**: The system uses **two separate PrimeSdk instances** to handle different transaction types:

1. **primeSdkWithPaymaster** - Gasless transactions via Arka paymaster
   - Used for: FDC attestations, batch operations, most user actions
   - Arka paymaster sponsors gas fees
   - Requires transaction to be on paymaster allowlist

2. **primeSdkWithoutPaymaster** - Direct gas payment from Smart Account balance
   - Used for: `confirmRedemptionPayment` (not on paymaster allowlist)
   - Smart Account pays gas directly from its FLR balance
   - Requires minimum 0.1 FLR balance for withdrawal confirmations

**Automatic SDK Selection**: `sendTransaction()` accepts `usePaymaster` flag to automatically select the appropriate SDK instance.

### Key Components

#### 1. SmartAccountClient (`server/utils/smart-account-client.ts`)

Wrapper around Etherspot Prime SDK providing:
- Smart account initialization with proper wallet provider formatting
- **Two-SDK architecture** for paymaster vs. direct gas payment
- Single transaction execution via `sendTransaction()` with automatic retry
- Batch transaction execution via `sendBatchTransactions()`
- UserOp receipt polling with retry logic
- **Fee bumping retry system** (5 attempts, 20% increase per retry, exponential backoff)
- Native balance checking for gas prefunding
- Provider access for read operations

#### 2. SmartAccountSigner (`server/utils/smart-account-signer.ts`)

Implements `ethers.Signer` interface to route all contract calls through ERC-4337:
- All `sendTransaction()` calls go through smart account bundler
- Message signing uses EOA wallet for compatibility
- Implements full ethers.Signer interface for contract compatibility
- Enables gasless execution of all contract interactions

#### 3. FlareClient (`server/utils/flare-client.ts`)

Smart account exclusive client:
- `initialize()` - Sets up smart account connection
- `getSignerAddress()` - Returns smart account address
- `getContractSigner()` - Returns SmartAccountSigner for contract calls
- `sendTransaction()` - Routes through ERC-4337 bundler
- `sendBatchTransactions()` - Batches multiple operations in one UserOp

#### 4. FAssetsClient (`server/utils/fassets-client.ts`)

Works exclusively with smart accounts via `getContractSigner()`

## Configuration

### Required Environment Variables

Add to your `.env`:

```bash
# Smart Account Configuration (REQUIRED)
ETHERSPOT_BUNDLER_API_KEY=your_api_key_here    # Get from https://dashboard.etherspot.io
ENABLE_PAYMASTER=true                          # Enable gasless transactions (recommended)
OPERATOR_PRIVATE_KEY=your_private_key          # Platform operator private key (without 0x prefix)
```

### Getting Etherspot API Key

1. Visit https://developer.etherspot.io
2. Sign up for a free account
3. Create a new project
4. Copy the API key to `ETHERSPOT_BUNDLER_API_KEY`

### Supported Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| **Flare Mainnet** | 14 | https://flare-api.flare.network/ext/C/rpc |
| **Coston2 Testnet** | 114 | https://coston2-api.flare.network/ext/C/rpc |

## Deployed Contracts (Coston2 Testnet)

Current production deployment addresses:

| Contract | Address | Explorer |
|----------|---------|----------|
| **VaultController** | `0x96985bf09eDcD4C2Bf21137d8f97947B96c4eb2c` | [View](https://coston2-explorer.flare.network/address/0x96985bf09eDcD4C2Bf21137d8f97947B96c4eb2c) |
| **ShXRPVault** | `0xeBb4a977492241B06A2423710c03BB63B2c5990e` | [View](https://coston2-explorer.flare.network/address/0xeBb4a977492241B06A2423710c03BB63B2c5990e) |
| **FXRP Token** | `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3` | [View](https://coston2-explorer.flare.network/address/0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3) |

**Deployment Date**: November 11, 2025  
**Network**: Coston2 Testnet (Chain ID: 114)

## Usage

### Initialization

The system requires smart accounts for all operations:

```typescript
// In server/index.ts
const flareClient = new FlareClient({
  network: "coston2",
  privateKey: process.env.OPERATOR_PRIVATE_KEY!,
  bundlerApiKey: process.env.ETHERSPOT_BUNDLER_API_KEY!,
  enablePaymaster: process.env.ENABLE_PAYMASTER === "true",
});

await flareClient.initialize();
// Logs: "🔐 Using Smart Account: 0x..."
```

### Single Transaction (Gasless)

```typescript
// Default: Uses paymaster for gasless transaction
const txHash = await flareClient.sendTransaction({
  to: recipientAddress,
  value: ethers.parseEther("1.0"),
  data: "0x...",
});
```

Returns transaction hash after UserOp execution through ERC-4337 bundler

### Single Transaction (Direct Gas Payment)

```typescript
// Bypass paymaster: Smart Account pays gas directly
const txHash = await flareClient.sendTransaction(
  {
    to: contractAddress,
    data: contractCallData,
  },
  false // usePaymaster = false
);
```

Used for operations not on paymaster allowlist (e.g., `confirmRedemptionPayment`)

### Batch Transactions

```typescript
const txHash = await flareClient.sendBatchTransactions([
  { to: addr1, value: ethers.parseEther("1.0") },
  { to: addr2, data: contractCallData },
  { to: addr3, value: ethers.parseEther("0.5") },
]);
```

Executes all in a single UserOp (gas efficient and atomic)

### Automatic Retry with Fee Bumping

All transactions automatically retry on failure with:
- **5 retry attempts** maximum
- **20% fee increase** per retry
- **Exponential backoff**: 1s, 2s, 4s, 8s, 16s
- Retries on bundler rejections (fee too low, nonce conflicts, etc.)

```typescript
// Automatic retry example (internal to SmartAccountClient)
// Attempt 1: Standard fees
// Attempt 2: Fees * 1.2 (wait 1s)
// Attempt 3: Fees * 1.44 (wait 2s)
// Attempt 4: Fees * 1.73 (wait 4s)
// Attempt 5: Fees * 2.07 (wait 8s)
```

## Benefits

### For Users

- **No FLR Required** - Platform sponsors all gas fees
- **Faster Transactions** - Batched operations complete faster
- **Better UX** - No need to acquire and manage FLR tokens
- **Dual Wallet Support** - Seamless experience for both XRPL and EVM users

### For Platform

- **Lower Costs** - Batched transactions reduce total gas costs
- **Better Control** - Sponsor specific user operations
- **Enhanced Security** - Smart contract wallets with custom logic
- **Future Features** - Session keys, multisig, recovery mechanisms

## Monitoring

Check server logs for smart account initialization:
```bash
🔐 Initializing Flare Smart Account...
   Chain ID: 114
✅ Smart Account initialized
   Address: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
🔐 Using Smart Account: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
```

## Gas Sponsorship

### Paymaster Configuration

When `ENABLE_PAYMASTER=true`, the Arka paymaster sponsors transactions:

```typescript
paymaster: {
  url: `https://arka.etherspot.io?apiKey=${apiKey}&chainId=${chainId}`,
}
```

### Cost Considerations

- **Free Tier**: Etherspot provides free testnet sponsorship
- **Mainnet**: Configure paymaster budget and policies
- **Monitoring**: Track sponsored gas via Etherspot dashboard

## Troubleshooting

### "Invalid wallet provider" Error

**Cause**: Missing or invalid `ETHERSPOT_BUNDLER_API_KEY`, or private key format issue  
**Solution**: 
1. Get API key from https://dashboard.etherspot.io
2. Ensure private key is hex format (with or without `0x` prefix)
3. Add to `.env` file
4. Restart application

### Server Won't Start

**Cause**: Missing required environment variables  
**Check**:
- `ETHERSPOT_BUNDLER_API_KEY` is set
- `OPERATOR_PRIVATE_KEY` is set
- Check server logs for specific error message

### Transactions Failing

Check paymaster is enabled (`ENABLE_PAYMASTER=true`) and Etherspot API key is valid

## Advanced Features

### Session Keys (Future)

Smart accounts can delegate transaction signing to session keys:
- Limited permissions
- Time-based expiration
- Revocable access

### Social Recovery (Future)

Smart accounts can implement guardian-based recovery:
- Trusted contacts can recover account
- No seed phrase required
- Enhanced security

### Multisig (Future)

Smart accounts can require multiple signatures:
- Threshold-based approval
- Multi-owner management
- Enhanced security for high-value operations

## Resources

- **Etherspot Docs**: https://etherspot.fyi/
- **Flare Dev Hub**: https://dev.flare.network/
- **ERC-4337 Spec**: https://eips.ethereum.org/EIPS/eip-4337
- **Etherspot Dashboard**: https://dashboard.etherspot.io

## Wallet-Scoped Security

Smart accounts integrate with the platform's wallet-scoped security model:

- **Transaction Privacy**: All bridge operations and vault deposits track `wallet_address`
- **Position Isolation**: Users can only access their own positions and transaction history
- **Custodial Model**: shXRP shares minted to Smart Account, ownership tracked by `walletAddress` in database
- **Direct Column Filtering**: Security enforced at database level, no JOIN-based vulnerabilities

Example flow:
1. User initiates deposit from XRP wallet `rXXX...`
2. Bridge operation stores `wallet_address = rXXX...` in database
3. FXRP minted to Smart Account via ERC-4337
4. shXRP shares minted to Smart Account
5. Position record links Smart Account shares to user's `walletAddress`
6. User can only query transactions/positions for their `walletAddress`

## Current Status

- ✅ Smart account exclusive mode implemented
- ✅ Two-SDK architecture for paymaster vs. direct gas payment
- ✅ SmartAccountClient wrapper with retry logic and fee bumping
- ✅ SmartAccountSigner implements full ethers.Signer interface
- ✅ FlareClient smart account integration complete
- ✅ FAssetsClient works with smart accounts
- ✅ Paymaster support configured and tested
- ✅ Successfully deployed on Coston2 testnet with production contracts
- ✅ Wallet-scoped security integration complete
- ✅ Automatic retry system with exponential backoff
- ✅ Production-ready smart account system

## Next Steps

1. ✅ Complete XRP → FXRP bridge flow with gasless transactions
2. ✅ Verify FAssets minting works through smart accounts
3. ✅ Implement automatic recovery services (DepositWatchdog, WithdrawalRetry)
4. ⏳ Monitor gas sponsorship costs via Etherspot dashboard
5. ⏳ Consider deploying to Flare mainnet (Chain ID 14)
