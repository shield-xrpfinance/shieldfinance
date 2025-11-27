# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, with FAssets protocol for cross-chain XRP bridging to Flare. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. It features a dual wallet architecture providing tailored experiences for XRPL and EVM users.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming with a Framer template color rebrand (electric blue and modern gray).
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema covering `vaults`, `positions`, `transactions`, `vault_metrics_daily`, bridge records, `firelight_positions`, and `service_state`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Automated Withdrawal System**: Async withdrawal automation with ENS resolution, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking.
- **Production Publishing Optimization**: Fast server startup, asynchronous service initialization, dual health endpoints, and API readiness guards.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates, and streamlined withdrawal history.
- **Vault Controls**: Backend and frontend integration for deposit limits, pausable emergency controls, and "Coming Soon" placeholder vaults with authentication.
- **Multi-Asset Swap Integration**: Complete swap feature at `/swap` enabling bidirectional multi-asset trading with SparkDEX V3 router.
- **Revenue Transparency Analytics**: Convex-style hero section displaying total platform revenue, $SHIELD tokens burned, and extra yield distributed to stakers.
- **Testnet Monitoring & Alerting System**: Comprehensive observability stack including a MetricsService, AlertingService (Slack/Discord), Analytics API endpoints, and a real-time monitoring dashboard with Prometheus integration.
- **Wallet-Type Vault Filtering**: Intelligent vault and position filtering based on connected wallet type (XRPL vs. EVM) to show compatible assets.
- **Network-Aware Asset Configuration System**: Centralized `assetConfig.ts` for dynamic token metadata switching between mainnet and testnet, including critical decimal corrections.
- **Ecosystem-Based Network Switcher**: Production-ready system allowing users to toggle between XRPL and Flare ecosystems, with auto-correction and manual override capabilities for vault filtering and deposit routing.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**: `ShXRPVault.sol` (ERC-4626 tokenized vault), `VaultController.sol` (orchestration, access control), and various strategy contracts.

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery, wallet-scoped transaction privacy, and direct column filtering for data integrity.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration for XRPL natives (`xumm-sdk`).
- **WalletConnect**: EVM wallet connection for Flare users (`@walletconnect/universal-provider`).
- **XRP Ledger (XRPL)**: Real-time balance fetching (`xrpl` library).

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, including FDC Attestation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification for attestation submission and proof generation.
- **SparkDEX V3**: Uniswap V2-compatible decentralized exchange on Flare Network for token swaps.

### Standalone Applications
- **Testnet Faucet**: A separate Next.js 14 application for distributing test SHIELD and wFLR tokens on Flare Coston2 testnet, featuring rate limiting, reCAPTCHA, and ConnectKit integration.