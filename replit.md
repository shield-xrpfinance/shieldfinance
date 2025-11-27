# XRP Liquid Staking Protocol Dashboard

## Whitepaper
[Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf) — Complete technical documentation with formal mathematical notation and architecture diagrams.

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, with FAssets protocol for cross-chain XRP bridging to Flare. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. It features a dual wallet architecture providing tailored experiences for XRPL (Xaman/XUMM) and EVM (WalletConnect/MetaMask) users, showing XRP or FXRP vaults respectively.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, modern list-based layouts, and Glassmorphism design elements.
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema including `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `xrp_to_fxrp_bridges`, `fxrp_to_xrp_redemptions`, `firelight_positions`, `compounding_runs`, `service_state`.

### System Design
- **Separation of Concerns**: Monorepo structure (`/client`, `/server`, `/shared`).
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **Automated Systems**: FAssets bridge reconciliation (automated and manual recovery), automated withdrawal system (async processing, ENS resolution, XRPL payment detection, FDC proof generation), deposit watchdog, and withdrawal retry services.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates with on-chain balance verification for FXRP vaults, wallet-type-aware vault filtering, ecosystem-based network switching, and consolidated position display with aggregated rewards.
- **Security & Controls**: P0 vault controls (deposit limits, pausable emergency controls), minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery, wallet-scoped transaction security, and FDC proof generation lock.
- **Multi-Asset Swap**: Full swap feature with SparkDEX V3 router, real-time quotes, and approval flows.
- **Analytics & Monitoring**: Revenue transparency analytics, testnet monitoring & alerting system (metrics collection, alerts for delays/failures, API endpoints, real-time dashboard, Prometheus endpoint).
- **Asset Configuration**: Network-aware asset configuration system for automatic token switching between mainnet and testnet.
- **Production Readiness**: Fast server startup, asynchronous service initialization, dual health endpoints, API readiness guards, API rate limiting, and RPC failover utility.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control, ReentrancyGuard).
- **Contracts**: `ShXRPVault.sol` (ERC-4626), `VaultController.sol`, `StakingBoost.sol` (Synthetix accumulator), `RevenueRouter.sol` (fee distribution), `ShieldToken.sol`.

### StakingBoost ↔ ShXRPVault ↔ RevenueRouter Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Stake SHIELD → Boost shXRP Yield                    │
│                                                                          │
│  ┌──────────────┐     fees      ┌───────────────────┐                   │
│  │ ShXRPVault   │ ────────────► │  RevenueRouter    │                   │
│  │ (ERC-4626)   │               │  distribute()     │                   │
│  └──────┬───────┘               └─────────┬─────────┘                   │
│         │                                 │                              │
│         │ donateOnBehalf()                │ 50% burn / 40% boost / 10%  │
│         │ (mints shXRP)                   │ reserves                     │
│         │                                 ▼                              │
│         │                       ┌─────────────────────┐                  │
│         │                       │  StakingBoost       │                  │
│         │◄──────────────────────│  distributeBoost()  │                  │
│         │      claim()          │  rewardPerToken     │                  │
│         │                       │  (Synthetix style)  │                  │
│         │                       └─────────────────────┘                  │
│                                                                          │
│  Formula: Boost = Revenue × (User SHIELD ÷ Total SHIELD)                │
│  Lock: 30 days | Revenue: 40% to boost | Cap: 25% max                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Deployment Flow (Circular Dependency Solution):**
1. Deploy ShXRPVault with `stakingBoost = address(0)`
2. Deploy StakingBoost with real vault address  
3. Call `vault.setStakingBoost()` (one-time setter)

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration.
- **WalletConnect**: EVM wallet connection.
- **XRP Ledger (XRPL)**: Real-time balance fetching.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Drizzle ORM**: Database schema management.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, dynamic AssetManager, FDC Attestation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification for attestations.
- **SparkDEX V3**: Uniswap V2-compatible DEX on Flare Network for token swaps.