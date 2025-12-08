# Faucet Integration Guide

This document provides instructions for integrating the Shield Finance faucet (https://faucet.shyield.finance/) with the main Shield Finance app's points system.

## Overview

When users claim tokens from the faucet, the faucet should call the Shield Finance API to award points. This integration enables:
- **15 points** awarded per faucet claim
- Points contribute to tier progression (Bronze → Silver → Gold → Diamond)
- Higher tiers earn larger share of the 2M SHIELD mainnet airdrop

## API Endpoint

### POST /api/points/activity/external

**Base URL (Production):** `https://shyield.finance`  
**Base URL (Testnet):** `https://testnet.shyield.finance` (or your deployed URL)

### Request Headers

```
Content-Type: application/json
```

### Request Body

```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "activityType": "faucet_claim",
  "metadata": {
    "tokenType": "SHIELD",
    "amount": "1000"
  },
  "apiKey": "your-api-key-here"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletAddress` | string | Yes | Ethereum address (0x + 40 hex chars) |
| `activityType` | string | Yes | One of: `faucet_claim`, `shield_faucet`, `flr_faucet` |
| `metadata` | object | No | Additional data (tokenType, amount, txHash, etc.) |
| `apiKey` | string | No | API key for authentication (optional for now) |

### Activity Types

| Activity Type | Points | Description |
|--------------|--------|-------------|
| `faucet_claim` | 15 | Generic faucet claim |
| `shield_faucet` | 15 | SHIELD token faucet claim |
| `flr_faucet` | 15 | C2FLR token faucet claim |

### Success Response (200)

```json
{
  "success": true,
  "pointsAwarded": 15,
  "totalPoints": 150,
  "tier": "bronze"
}
```

### Error Responses

**400 Bad Request** - Invalid input
```json
{
  "error": "Invalid wallet address format. Expected 0x followed by 40 hex characters."
}
```

```json
{
  "error": "Invalid activityType. Must be one of: faucet_claim, shield_faucet, flr_faucet"
}
```

**401 Unauthorized** - Invalid API key (when API key is required)
```json
{
  "error": "Invalid API key"
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded for wallet 0x1234... Please wait before making another request.",
  "retryAfter": 3456
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to log activity"
}
```

## Rate Limiting

- **Limit:** 2 requests per wallet address per hour
- **Response:** 429 with `retryAfter` (seconds until limit resets)
- Rate limiting is per-wallet, not per-IP

## Implementation Examples

### Node.js / Express

```javascript
const axios = require('axios');

async function logFaucetClaim(walletAddress, tokenType, amount) {
  try {
    const response = await axios.post(
      'https://shyield.finance/api/points/activity/external',
      {
        walletAddress,
        activityType: tokenType === 'SHIELD' ? 'shield_faucet' : 'flr_faucet',
        metadata: {
          tokenType,
          amount: amount.toString(),
          claimedAt: new Date().toISOString()
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log(`Points awarded: ${response.data.pointsAwarded}`);
    console.log(`User tier: ${response.data.tier}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(`Rate limited. Retry after ${error.response.data.retryAfter} seconds`);
    } else {
      console.error('Failed to log faucet claim:', error.message);
    }
    return null;
  }
}

// Usage in faucet claim handler
app.post('/api/claim', async (req, res) => {
  const { walletAddress, tokenType } = req.body;
  
  // ... perform token transfer ...
  
  // Log activity to Shield Finance (fire and forget - don't block claim)
  logFaucetClaim(walletAddress, tokenType, 1000).catch(console.error);
  
  res.json({ success: true });
});
```

### React Frontend (for confirmation display)

```typescript
import { useMutation } from '@tanstack/react-query';

const useLogFaucetClaim = () => {
  return useMutation({
    mutationFn: async ({ walletAddress, tokenType, amount }: {
      walletAddress: string;
      tokenType: 'SHIELD' | 'C2FLR';
      amount: string;
    }) => {
      const response = await fetch(
        'https://shyield.finance/api/points/activity/external',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            activityType: tokenType === 'SHIELD' ? 'shield_faucet' : 'flr_faucet',
            metadata: { tokenType, amount }
          })
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to log faucet claim');
      }
      
      return response.json();
    }
  });
};

// Usage
function ClaimButton({ walletAddress }) {
  const logClaim = useLogFaucetClaim();
  
  const handleClaim = async () => {
    // ... perform claim ...
    
    // Log to points system
    const result = await logClaim.mutateAsync({
      walletAddress,
      tokenType: 'SHIELD',
      amount: '1000'
    });
    
    // Show confirmation
    toast.success(`+${result.pointsAwarded} points! You're now ${result.tier} tier.`);
  };
  
  return <button onClick={handleClaim}>Claim</button>;
}
```

### Python

```python
import requests

def log_faucet_claim(wallet_address: str, token_type: str, amount: str) -> dict | None:
    try:
        response = requests.post(
            'https://shyield.finance/api/points/activity/external',
            json={
                'walletAddress': wallet_address,
                'activityType': 'shield_faucet' if token_type == 'SHIELD' else 'flr_faucet',
                'metadata': {
                    'tokenType': token_type,
                    'amount': amount
                }
            },
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print(f"Rate limited. Retry after {e.response.json()['retryAfter']} seconds")
        else:
            print(f"Failed: {e}")
        return None
```

## CORS Configuration

The API endpoint has CORS enabled for the following origins:
- `https://faucet.shyield.finance`
- `https://shyield.finance`
- `http://localhost:*` (development)

If you need additional origins whitelisted, please contact the Shield Finance team.

## Testing

### Test with cURL

```bash
# Successful claim
curl -X POST https://shyield.finance/api/points/activity/external \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "activityType": "shield_faucet",
    "metadata": {"tokenType": "SHIELD", "amount": "1000"}
  }'

# Expected response:
# {"success":true,"pointsAwarded":15,"totalPoints":15,"tier":"none"}
```

### Verify Points

After logging a faucet claim, users can verify their points at:
- **Points Dashboard:** https://shyield.finance/app/points
- **Leaderboard:** https://shyield.finance/app/leaderboard

## API Key Authentication (Future)

Currently, the API accepts requests without authentication for easy integration. 

In the future, we may require API key authentication:

1. Set `FAUCET_API_KEY` environment variable on the Shield Finance server
2. Include `apiKey` in all requests from the faucet

```json
{
  "walletAddress": "0x...",
  "activityType": "faucet_claim",
  "apiKey": "your-secret-api-key"
}
```

## Points System Overview

| Tier | Points Required | Multiplier | Share of Airdrop |
|------|-----------------|------------|------------------|
| None | 0 | 1x | Base allocation |
| Bronze | 100+ | 1x | Base allocation |
| Silver | 500+ | 1.5x | 1.5x base |
| Gold | 2,000+ | 2x | 2x base |
| Diamond | 5,000+ | 3x | 3x base |

**Total Airdrop Pool:** 2,000,000 SHIELD tokens

## Support

For integration questions or issues:
- Discord: [Shield Finance Discord]
- Email: support@shyield.finance
- GitHub: [Shield Finance GitHub]
