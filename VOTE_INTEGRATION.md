# Vote.shyield.finance Integration Guide

This document describes how to integrate with the Shield Finance Wallet Balance API, designed for consumption by vote.shyield.finance and other authorized integrations.

## Wallet Balance API

### Endpoint

```
GET /api/wallet/balances?address={walletAddress}
```

### Address Format

The API auto-detects the address type:

| Type | Format | Example |
|------|--------|---------|
| **EVM** | `0x` + 40 hex characters | `0x8fe09217445e90DA692D29F30859dafA4eb281d1` |
| **XRPL** | `r` + 24-34 alphanumeric | `rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe` |

### Response Format

```json
{
  "walletAddress": "0x...",
  "network": "testnet",
  "tokens": [
    {
      "symbol": "FLR",
      "name": "Flare",
      "address": null,
      "chain": "flare",
      "balance": "100.5",
      "balanceRaw": "100500000000000000000",
      "balanceUsd": "1.50",
      "decimals": 18,
      "source": "on-chain"
    },
    {
      "symbol": "SHIELD",
      "name": "Shield",
      "address": "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616",
      "chain": "flare",
      "balance": "1000",
      "balanceRaw": "1000000000000000000000",
      "balanceUsd": "50.00",
      "decimals": 18,
      "source": "on-chain"
    }
  ],
  "totals": {
    "nativeUsd": "1.50",
    "stakingUsd": "50.00",
    "totalUsd": "51.50"
  },
  "refreshedAt": "2025-11-30T05:09:10.462Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `walletAddress` | string | The queried wallet address |
| `network` | string | `"mainnet"` or `"testnet"` |
| `tokens` | array | Array of token balances |
| `totals.nativeUsd` | string | USD value of native tokens (FLR, WFLR) |
| `totals.stakingUsd` | string | USD value of staking tokens (SHIELD, shXRP) |
| `totals.totalUsd` | string | Total USD value of all tokens |
| `refreshedAt` | string | ISO 8601 timestamp of when data was fetched |

### Token Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Token ticker symbol |
| `name` | string | Full token name |
| `address` | string \| null | Contract address (null for native tokens) |
| `chain` | string | `"flare"` or `"xrpl"` |
| `balance` | string | Human-readable balance |
| `balanceRaw` | string | Raw balance in smallest units |
| `balanceUsd` | string | USD value of balance |
| `decimals` | number | Token decimal places |
| `source` | string | Always `"on-chain"` |

## Supported Tokens

### EVM (Flare Network)

| Token | Symbol (Testnet) | Symbol (Mainnet) | Description |
|-------|------------------|------------------|-------------|
| Native Flare | C2FLR | FLR | Native gas token |
| Wrapped Flare | WC2FLR | WFLR | Wrapped native token |
| Bridged XRP | FTestXRP | FXRP | XRP bridged via FAssets |
| Shield Token | SHIELD | SHIELD | Governance token |
| Liquid Staked XRP | shXRP | shXRP | Staked XRP receipt token |

### XRPL

| Token | Symbol | Description |
|-------|--------|-------------|
| XRP | XRP | Native XRP balance |

## CORS Policy

The API enforces CORS restrictions. Allowed origins:

| Origin | Environment |
|--------|-------------|
| `https://vote.shyield.finance` | Production |
| `https://shyield.finance` | Production |
| `https://faucet.shyield.finance` | Production |
| `http://localhost:5000` | Development |
| `http://localhost:3000` | Development |

## Rate Limiting

Strict rate limiting is applied to prevent abuse. Requests exceeding the limit will receive a `429 Too Many Requests` response.

## Error Responses

### Missing Address (400)
```json
{
  "error": "Missing required parameter: address",
  "example": "/api/wallet/balances?address=0x... or /api/wallet/balances?address=rXXX..."
}
```

### Invalid Address Format (400)
```json
{
  "error": "Invalid address format",
  "expected": "EVM address (0x followed by 40 hex characters) or XRPL address (r followed by 24-34 alphanumeric characters)"
}
```

### Server Error (500)
```json
{
  "error": "Failed to fetch wallet balances",
  "details": "Error message"
}
```

## Example Usage

### JavaScript/TypeScript

```typescript
interface TokenBalance {
  symbol: string;
  name: string;
  address: string | null;
  chain: "flare" | "xrpl";
  balance: string;
  balanceRaw: string;
  balanceUsd: string;
  decimals: number;
  source: "on-chain";
}

interface WalletBalanceResponse {
  walletAddress: string;
  network: "mainnet" | "testnet";
  tokens: TokenBalance[];
  totals: {
    nativeUsd: string;
    stakingUsd: string;
    totalUsd: string;
  };
  refreshedAt: string;
}

// Fetch EVM wallet balances
async function getEvmBalances(address: string): Promise<WalletBalanceResponse> {
  const response = await fetch(
    `https://api.shyield.finance/api/wallet/balances?address=${address}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// Fetch XRPL wallet balances
async function getXrplBalances(address: string): Promise<WalletBalanceResponse> {
  const response = await fetch(
    `https://api.shyield.finance/api/wallet/balances?address=${address}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// Usage
const evmData = await getEvmBalances("0x8fe09217445e90DA692D29F30859dafA4eb281d1");
console.log(`Total USD: $${evmData.totals.totalUsd}`);

const xrplData = await getXrplBalances("rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe");
console.log(`XRP Balance: ${xrplData.tokens[0]?.balance} XRP`);
```

### cURL

```bash
# EVM address
curl "https://api.shyield.finance/api/wallet/balances?address=0x8fe09217445e90DA692D29F30859dafA4eb281d1"

# XRPL address
curl "https://api.shyield.finance/api/wallet/balances?address=rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
```

## Voting Weight Calculation

For vote.shyield.finance, the voting weight can be calculated from the returned balances:

```typescript
function calculateVotingWeight(balances: WalletBalanceResponse): number {
  let weight = 0;
  
  for (const token of balances.tokens) {
    if (token.symbol === "SHIELD") {
      // SHIELD tokens provide direct voting weight
      weight += parseFloat(token.balance);
    } else if (token.symbol === "shXRP") {
      // shXRP may provide boosted voting weight
      weight += parseFloat(token.balance) * 0.5; // Example: 50% weight
    }
  }
  
  return weight;
}
```

## Network Configuration

The API automatically detects the network based on the `FLARE_NETWORK` environment variable:

| Environment Variable | Network | RPC Endpoint |
|---------------------|---------|--------------|
| `FLARE_NETWORK=mainnet` | Mainnet | Flare mainnet RPC |
| `FLARE_NETWORK=coston2` (default) | Testnet | Coston2 testnet RPC |

## Support

For integration support or to request additional origins be added to the CORS whitelist, contact the Shield Finance team.
