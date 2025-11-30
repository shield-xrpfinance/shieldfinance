# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, with FAssets protocol for cross-chain XRP bridging to Flare. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. It features a dual wallet architecture providing tailored experiences for XRPL (Xaman/XUMM) and EVM (Reown AppKit/MetaMask) users, showing XRP or FXRP vaults respectively. The project also has ambitions for future integration of Real World Assets (RWA) and tokenized securities.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, modern list-based layouts, and Glassmorphism design elements.
- **State Management**: React Context API, TanStack Query, React hooks.
- **Wallet Architecture**: Dual-ecosystem wallet support (`xaman`, `walletconnect` for XRPL, `reown` for EVM) with wallet-type-aware vault filtering.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates, consolidated position display with aggregated rewards, and a Shepherd.js-based guided tour.
- **Security**: UAE Geo-Blocking for VARA compliance.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.
- **Automated Systems**: FAssets bridge reconciliation, automated withdrawal system, deposit watchdog, and withdrawal retry services.
- **Analytics & Monitoring**: Revenue transparency analytics, testnet monitoring with real-time 24-hour sliding window metrics, and alerting system.
- **Production Readiness**: Fast server startup, asynchronous service initialization, health endpoints, API readiness guards, API rate limiting, and RPC failover utility.
- **Self-Healing Infrastructure**: ServiceSupervisor with auto-restart, ResilientRpcAdapter with multi-endpoint failover, XrplConnectionPool with automatic reconnection, CacheFallbackService for graceful degradation, ReconciliationService for state consistency, and FeatureFlagService for dynamic feature control.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema covering vaults, positions, transactions, and various system states.

### System Design
- **Separation of Concerns**: Monorepo structure (`/client`, `/server`, `/shared`).
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **Asset Configuration**: Network-aware asset configuration system for automatic token switching between mainnet and testnet, supporting crypto assets and future RWA/tokenized securities.
- **Smart Contracts (Solidity on Flare Network)**: Developed with Hardhat and OpenZeppelin Contracts. Key contracts include `ShXRPVault.sol` (ERC-4626), `VaultController.sol`, `StakingBoost.sol`, `RevenueRouter.sol`, and `ShieldToken.sol`.
- **StakingBoost ↔ ShXRPVault ↔ RevenueRouter Architecture**: A circular dependency solution for deploying and linking these core contracts for yield boosting and fee distribution.
- **Airdrop System**: Faucet API and MerkleDistributor contract for SHIELD token distribution.
- **Multi-Asset Swap**: Full swap feature with SparkDEX V3 router.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRPL wallet integration.
- **Reown AppKit v2+**: EVM wallet connection (MetaMask, Trust Wallet, Rabby).
- **WalletConnect (XRPL)**: For other XRPL wallets.
- **XRP Ledger (XRPL)**: For real-time balance fetching.
- **Wagmi**: React hooks for Ethereum with Flare mainnet and Coston2 testnet support.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.
- **Shepherd.js**: Interactive guided tour library.

### Development & Deployment
- **Drizzle ORM**: Database schema management.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification.
- **SparkDEX V3**: Uniswap V2-compatible DEX on Flare Network for token swaps.

### RWA & Tokenized Securities (Future Integration)
- **RWA.xyz Integration**: Planned for real-world asset data feeds.