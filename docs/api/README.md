# API Reference

Shield Yield Vaults provides a RESTful API for managing vaults, positions, and transactions.

## Base URL

```
Development: http://localhost:5000/api
Production: https://shyield.finance/api
```

## Authentication

The API uses session-based authentication with wallet addresses. No API keys required for public endpoints.

## Endpoints Overview

### Vaults
- `GET /api/vaults` - List all vaults
- `GET /api/vaults/:id` - Get vault details
- `GET /api/vaults/:id/metrics` - Get vault metrics

### Positions
- `GET /api/positions` - List user positions
- `POST /api/positions/deposit` - Create deposit
- `POST /api/positions/withdraw` - Create withdrawal
- `POST /api/positions/:id/claim` - Claim rewards

### Transactions
- `GET /api/transactions` - List all transactions
- `GET /api/transactions/user/:address` - Get user transactions

### Wallet
- `POST /api/wallet/xaman/payload` - Create Xaman sign-in payload
- `POST /api/wallet/xaman/deposit` - Create deposit payload
- `POST /api/wallet/xaman/withdraw` - Create withdrawal payload
- `POST /api/wallet/xaman/claim` - Create claim payload
- `GET /api/wallet/xaman/status/:uuid` - Check payload status
- `POST /api/wallet/balances` - Get XRPL balances

## Detailed Documentation

See individual endpoint documentation:

- [Vaults API](vaults.md)
- [Positions API](positions.md)
- [Transactions API](transactions.md)
- [Wallet API](wallet.md)

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Currently no rate limiting in development. Production deployment includes:
- 100 requests per minute per IP
- 1000 requests per hour per IP

## Network Support

All endpoints support network parameter:
- `mainnet` - Production XRPL mainnet
- `testnet` - XRPL testnet for development

Pass as query parameter: `?network=testnet`
