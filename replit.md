# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. Key capabilities include multi-asset swaps, automated withdrawal systems, and advanced FAssets bridge reconciliation.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming.
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Includes `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `xrp_to_fxrp_bridges`, `fxrp_to_xrp_redemptions`, `firelight_positions`, `compounding_runs`, `service_state`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Automated Withdrawal System**: Complete async withdrawal automation with ENS resolution, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking.
- **Production Publishing Optimization**: Fast server startup, asynchronous service initialization, dual health endpoints, and API readiness guards.
- **UX Enhancements**: Multi-step progress modals for deposits and withdrawals with real-time status polling.
- **P0 Vault Controls**: Backend and frontend integration for deposit limits and pausable emergency controls with SHA-256 authentication.
- **Coming Soon Vaults**: Backend and frontend integration for placeholder vaults with database flag, API validation, and "Coming Soon" UI badges.
- **UI/UX Overhaul**: Redesign of vaults page to a modern list layout and a Dashboard Glassmorphism Redesign.
- **Dual-Status Withdrawal Model**: Separate user-facing and backend status tracking for withdrawals.
- **Deposit Flow UX Improvements**: Enhanced progress modal for deposits with bridge ID display, copy-to-clipboard, navigation to bridge tracking, and automatic payment trigger.
- **Deposit Cancellation Feature**: User-controlled cancellation system for in-progress deposits.
- **Real-Time Portfolio Updates**: Coordinated polling and status mapping for withdrawals using `usePortfolioPolling` hook and query invalidation.
- **ERC-4337 Bundler Retry Logic with Fee Bumping**: Robust retry system for UserOp submission with exponential backoff.
- **FDC Timing Optimizations**: Reduced DA indexing buffer and minimum wait times for improved deposit UX.
- **Deposit Watchdog Service**: Automatic recovery system for stuck deposits at `xrpl_confirmed` status.
- **Withdrawal Retry Service**: Exponential backoff retry system for failed withdrawal confirmations.
- **Two-SDK Smart Account Architecture**: Separate PrimeSdk instances for gasless and direct gas payment transactions.
- **Enhanced Schema Tracking**: Added payment confirmation and transaction hash fields to bridge records; `service_state` table for persistent block tracking.
- **FDC Proof Generation Lock**: Sentinel-based locking to prevent concurrent proof generation.
- **Reconciliation Recovery Patterns**: Comprehensive recovery logic for all bridge statuses.
- **Immediate Position Updates on XRP Receipt**: Position balances update immediately upon XRP receipt.
- **Wallet-Scoped Transaction Security**: End-to-end wallet authentication for transaction history access with database and API-level validation.
- **Withdrawal History Consolidation**: Streamlined UI for withdrawal history across Portfolio, Transaction History, and Bridge Tracking pages.
- **Multi-Asset Swap Integration**: Complete swap feature at `/swap` enabling bidirectional multi-asset trading with SparkDEX V3 router, real-time price quotes, approval flows, and post-swap UX.
- **Revenue Transparency Analytics**: Convex-style hero section on Analytics page displaying total platform revenue, $SHIELD tokens burned, and extra yield distributed to stakers. Interactive InfoIcon next to "Total Platform Revenue Generated" opens detailed modal explaining revenue flywheel: platform fees (0.2%), 50/50 buyback-burn split, protocol reserves, and staking boost mechanism. Structured to integrate with FeeTransferred (ShXRPVault), RevenueDistributed (RevenueRouter), and StakingBoost contract events post-deployment.
- **Framer Template Color Rebrand (November 2025)**: Complete visual rebrand from Shield Finance cyan (#00E0FF) to Framer template electric blue (#0066FF) aesthetic. Updated all color variables in tailwind.config.ts and index.css for both light/dark modes. New palette features modern gray backgrounds (#0F0F12 dark, #F8F9FA light) with blue accent system. WCAG AA compliance verified: blue buttons 6.2:1, dark mode text 19.4:1, muted text 8.0:1, light mode text 18.9:1. Theme toggle works bidirectionally across all components.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**: `ShXRPVault.sol` (ERC-4626 tokenized vault), `VaultController.sol` (orchestration, access control), `KineticStrategy.sol`, `FiresparkStrategy.sol`, `MockStrategy.sol`.

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery.
- **Transaction Privacy**: Wallet-scoped authentication on all transaction endpoints, requiring wallet address for access.
- **Data Integrity**: Direct column filtering prevents JOIN-based security bypasses.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration (`xumm-sdk`).
- **WalletConnect**: XRPL-compatible wallet connection (`@walletconnect/universal-provider`).
- **Web3Auth**: Social login for XRP wallet creation (`@web3auth/modal`).
- **XRP Ledger (XRPL)**: Real-time balance fetching (`xrpl` library).

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
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, dynamic AssetManager address resolution, FDC Attestation for payment proof generation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification protocol for attestation submission and proof generation (Data Availability API, Verifier Service, FdcHub Integration).
- **SparkDEX V3**: Uniswap V2-compatible decentralized exchange on Flare Network for token swaps (Router Integration, Liquidity Pools, Price Oracle, Network Support).