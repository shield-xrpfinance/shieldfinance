# Flare Smart Accounts Implementation

## Overview

This project now supports **ERC-4337 Account Abstraction** via **Etherspot Prime SDK** on Flare Network. Smart accounts enable:

- ✅ **Gasless Transactions** - Users don't need FLR/CFLR for gas
- ✅ **Transaction Batching** - Execute multiple operations in one UserOp
- ✅ **Paymaster Support** - Platform can sponsor user transactions
- ✅ **Social Login Integration** - Optional Web3Auth integration
- ✅ **Enhanced Security** - Smart contract wallets with custom validation logic

## Architecture

### Dual-Mode Support

The system supports **two signing modes**:

1. **EOA Mode** (Externally Owned Account)
   - Traditional private key signing
   - User pays gas fees in FLR/CFLR
   - Default if no Etherspot API key configured

2. **Smart Account Mode** (ERC-4337)
   - Account abstraction via Etherspot Prime SDK
   - Gasless transactions via paymaster
   - Transaction batching capability
   - Requires Etherspot bundler API key

### Key Components

#### 1. SmartAccountClient (`server/utils/smart-account-client.ts`)

Wrapper around Etherspot Prime SDK providing:
- Smart account initialization
- Single transaction execution
- Batch transaction execution
- UserOp receipt polling
- Provider/signer access

#### 2. FlareClient (`server/utils/flare-client.ts`)

Extended to support both modes:
- `signingMode: 'eoa' | 'smart-account'`
- `initialize()` - Required for smart account setup
- `getSignerAddress()` - Returns smart account or EOA address
- `sendTransaction()` - Works with both modes
- `sendBatchTransactions()` - Batch support for smart accounts

#### 3. FAssetsClient (`server/utils/fassets-client.ts`)

Updated to work seamlessly with both signing modes via `getContractSigner()`

## Configuration

### Environment Variables

Add to your `.env`:

```bash
# Smart Account Configuration
USE_SMART_ACCOUNTS=true                    # Enable smart account mode
ETHERSPOT_BUNDLER_API_KEY=your_api_key    # Get from https://developer.etherspot.io
ENABLE_PAYMASTER=true                     # Enable gasless transactions
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

## Usage

### Automatic Mode Selection

The system automatically selects the appropriate mode:

```typescript
// In server/index.ts
const useSmartAccounts = 
  process.env.USE_SMART_ACCOUNTS === "true" && 
  !!process.env.ETHERSPOT_BUNDLER_API_KEY;

const flareClient = new FlareClient({
  network: "coston2",
  privateKey: process.env.OPERATOR_PRIVATE_KEY,
  signingMode: useSmartAccounts ? 'smart-account' : 'eoa',
  bundlerApiKey: process.env.ETHERSPOT_BUNDLER_API_KEY,
  enablePaymaster: process.env.ENABLE_PAYMASTER === "true",
});

await flareClient.initialize();
```

### Single Transaction

```typescript
const txHash = await flareClient.sendTransaction({
  to: recipientAddress,
  value: ethers.parseEther("1.0"),
  data: "0x...",
});
```

In **EOA mode**: Returns transaction hash directly  
In **Smart Account mode**: Returns transaction hash after UserOp execution

### Batch Transactions

```typescript
const txHash = await flareClient.sendBatchTransactions([
  { to: addr1, value: ethers.parseEther("1.0") },
  { to: addr2, data: contractCallData },
  { to: addr3, value: ethers.parseEther("0.5") },
]);
```

In **EOA mode**: Executes transactions sequentially  
In **Smart Account mode**: Executes all in a single UserOp (more efficient)

## Benefits

### For Users

- **No FLR Required** - Platform sponsors all gas fees
- **Faster Transactions** - Batched operations complete faster
- **Better UX** - No need to acquire and manage FLR tokens
- **Social Login** - Can integrate Web3Auth for Web2-like onboarding

### For Platform

- **Lower Costs** - Batched transactions reduce total gas costs
- **Better Control** - Sponsor specific user operations
- **Enhanced Security** - Smart contract wallets with custom logic
- **Future Features** - Session keys, multisig, recovery mechanisms

## Migration Guide

### Existing EOA Setup

If you're currently using EOA mode, **no migration required**. The system is backward compatible.

### Switching to Smart Accounts

1. Get Etherspot API key from https://developer.etherspot.io
2. Add environment variables:
   ```bash
   USE_SMART_ACCOUNTS=true
   ETHERSPOT_BUNDLER_API_KEY=your_key_here
   ENABLE_PAYMASTER=true
   ```
3. Restart the application
4. System automatically uses smart accounts

### Monitoring

Check server logs for signing mode:
```bash
🔐 Using Smart Account: 0x1234...  # Smart account mode
🔐 Using EOA: 0x5678...           # EOA mode
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

**Cause**: Missing or invalid `ETHERSPOT_BUNDLER_API_KEY`  
**Solution**: 
1. Get API key from https://developer.etherspot.io
2. Add to `.env` file
3. Restart application

### Falls Back to EOA Mode

**Cause**: Smart accounts not properly configured  
**Check**:
- `USE_SMART_ACCOUNTS=true` is set
- `ETHERSPOT_BUNDLER_API_KEY` is set and valid
- No initialization errors in server logs

### Transactions Failing

**EOA Mode**: Check FLR/CFLR balance (need ~3 FLR for collateral reservation)  
**Smart Account Mode**: Check paymaster is enabled and funded

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

## Current Status

- ✅ Dual-mode support (EOA + Smart Account)
- ✅ SmartAccountClient wrapper implemented
- ✅ FlareClient integration complete
- ✅ FAssetsClient compatibility ensured
- ✅ Paymaster support configured
- ⏳ Awaiting Etherspot API key for testing
- ⏳ Production smart account deployment pending

## Next Steps

1. Obtain Etherspot bundler API key
2. Test smart account mode on Coston2
3. Verify gasless transactions work
4. Deploy to mainnet with production paymaster
