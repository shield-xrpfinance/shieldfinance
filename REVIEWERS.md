# Shield Finance - Research Team Review Guide

Welcome to the Shield Finance codebase. This document provides a structured navigation for external reviewers and research teams evaluating our XRP liquid staking protocol on Flare Network.

---

## Quick Navigation

| Area | Primary Document | Description |
|------|------------------|-------------|
| **Tokenomics** | [docs/protocol/SHIELD_TOKENOMICS.md](docs/protocol/SHIELD_TOKENOMICS.md) | $SHIELD token economics, distribution, and buyback mechanism |
| **Smart Contracts** | [docs/protocol/SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md) | Contract addresses, deployment steps, and verification |
| **Security** | [docs/protocol/SHIELD_SECURITY_CHECKLIST.md](docs/protocol/SHIELD_SECURITY_CHECKLIST.md) | Pre-deployment security checklist and audit requirements |
| **FAssets Bridge** | [docs/integration/FASSETS_INTEGRATION_GUIDE.md](docs/integration/FASSETS_INTEGRATION_GUIDE.md) | XRP → FXRP bridging via Flare FAssets protocol |
| **Yield Strategy** | [docs/integration/FIRELIGHT_INTEGRATION.md](docs/integration/FIRELIGHT_INTEGRATION.md) | Firelight.finance yield generation integration |
| **Platform Architecture** | [docs/platform/SMART_ACCOUNTS_SPEC.md](docs/platform/SMART_ACCOUNTS_SPEC.md) | ERC-4337 account abstraction and wallet integration |

---

## Executive Summary

**Shield Finance** is a DeFi protocol enabling XRP liquid staking on Flare Network. Users deposit XRP, which is bridged to FXRP via FAssets, deposited into yield-generating vaults (Firelight), and receive shXRP liquid staking tokens representing their position.

### Key Value Propositions

1. **Liquid Staking** - Stake XRP while maintaining liquidity via shXRP tokens
2. **Yield Generation** - FXRP deposits earn yield through Firelight.finance strategies
3. **Gasless Experience** - ERC-4337 smart accounts with paymaster sponsorship
4. **Cross-Chain Integration** - Seamless XRP ↔ Flare bridging via FAssets

### Protocol Economics

- **Token**: $SHIELD (10M total supply)
- **Revenue Model**: 0.2% platform fee on deposits/withdrawals
- **Buyback & Burn**: 50% of revenue used to buy and burn SHIELD
- **Staking Boost**: Lock SHIELD for enhanced APY (1% per 100 SHIELD staked)

---

## Repository Structure

```
shield-finance/
├── contracts/           # Solidity smart contracts (Hardhat)
│   ├── ShXRPVault.sol      # ERC-4626 tokenized vault
│   ├── VaultController.sol # Vault orchestration
│   ├── ShieldToken.sol     # ERC-20 governance token
│   ├── RevenueRouter.sol   # Fee distribution & burns
│   └── StakingBoost.sol    # SHIELD staking for APY boost
│
├── client/              # React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/     # UI components (shadcn/ui)
│       ├── pages/          # Route pages
│       └── lib/            # Context, hooks, utilities
│
├── server/              # Express.js backend
│   ├── routes.ts           # API endpoints
│   ├── services/           # Business logic
│   │   ├── BridgeService.ts    # FAssets bridge orchestration
│   │   ├── VaultService.ts     # Vault deposit/withdrawal
│   │   └── XRPLListener.ts     # XRPL payment monitoring
│   └── utils/              # Smart account client, helpers
│
├── shared/              # Shared TypeScript types
│   └── schema.ts           # Database schema (Drizzle ORM)
│
└── docs/                # Documentation
    ├── protocol/           # Token & contract docs
    ├── integration/        # External service integrations
    ├── platform/           # App architecture docs
    └── api/                # API reference
```

---

## Smart Contract Overview

### Deployed Contracts (Coston2 Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **ShieldToken** | `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616` | ERC-20 governance token |
| **RevenueRouter** | `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB` | Fee distribution & SHIELD burns |
| **StakingBoost** | `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4` | SHIELD staking for APY boost |
| **ShXRPVault** | `0xeBb4a977492241B06A2423710c03BB63B2c5990e` | ERC-4626 liquid staking vault |
| **VaultController** | `0x96985bf09eDcD4C2Bf21137d8f97947B96c4eb2c` | Vault management & access control |

### Security Model

- OpenZeppelin AccessControl for role-based permissions
- ReentrancyGuard on all state-changing functions
- ERC-4626 standard compliance for vault operations
- Pausable emergency controls on vault deposits

---

## Key Technical Decisions

### 1. ERC-4337 Account Abstraction

We use Etherspot Prime SDK for smart accounts, enabling:
- Gasless transactions via Arka paymaster
- Transaction batching for complex operations
- Deterministic account addresses from XRPL public keys

### 2. FAssets Bridge Integration

XRP bridging uses Flare's FAssets protocol:
- Collateral reservation with FAssets agents
- Flare Data Connector (FDC) for payment verification
- Automatic FXRP minting upon proof submission

### 3. Dual Wallet Support

- **XRPL Wallets** (Xaman): Native XRP deposits via FAssets bridge
- **EVM Wallets** (WalletConnect/MetaMask): Direct FXRP deposits

---

## Legacy Naming Notes

The database includes a table named `escrows` (in `shared/schema.ts`) which tracks deposit/withdrawal states (pending, finished, cancelled, failed). **This is legacy naming** - the platform does NOT use XRPL EscrowCreate/EscrowFinish transactions.

The actual architecture uses **FAssets bridge** for XRP → FXRP conversion:
- User sends XRP payment to FAssets agent address
- FDC (Flare Data Connector) verifies the payment
- FXRP is minted and deposited to the vault

The "escrows" table functions as a **deposit tracking system**, recording state transitions throughout the bridge process. Renaming was deferred to avoid breaking changes during active development.

---

## For Auditors

### Contract Audit Scope

Priority files for security review:
1. `contracts/ShXRPVault.sol` - Core vault logic
2. `contracts/ShieldToken.sol` - Token with burn mechanics
3. `contracts/RevenueRouter.sol` - Fee handling and swaps
4. `contracts/StakingBoost.sol` - Staking lock mechanisms

### Known Considerations

- FXRP has 6 decimals (not 18) - all math accounts for this
- Smart Account funding requires minimum 0.1 FLR for withdrawal confirmations
- FDC proof generation has timing constraints (DA indexing + confirmation rounds)

### Security Model

- **Admin Endpoints**: Protected by dedicated `ADMIN_API_KEY` environment variable (separate from session management)
- **Timing-Safe Comparison**: All secret comparisons use `crypto.timingSafeEqual()` to prevent timing attacks
- **Minimum Key Length**: Admin keys must be at least 32 characters

---

## Questions?

For technical questions about the codebase, review the linked documentation or examine the relevant source files. Contract verification links are available on Flare Coston2 Explorer.
