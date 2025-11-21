# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market.

**Recent Updates (November 21, 2025):**
- ✅ Complete Shield Finance deployment documentation created (SHIELD_DEPLOYMENT.md - 400+ lines)
- ✅ Comprehensive pre-launch security checklist published (SHIELD_SECURITY_CHECKLIST.md - 100+ items)
- ✅ Production-ready deployment script created and all critical bugs fixed (deploy-shield-finance.ts)
- ✅ All 176 tests passing with 78 adversarial tests for security validation
- ✅ Deprecated outdated deploy-flare.ts script
- ✅ **Swap Feature Launched**: Complete SparkDEX V3 integration enabling instant FLR ↔ SHIELD swaps with real-time quotes, slippage protection, post-swap staking modal, and confetti celebration. Expected to drive 3-5× increase in staking adoption.
- ⏳ Awaiting external audit before mainnet deployment

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
- **Schema**: Includes `vaults`, `positions`, `transactions` (with `wallet_address` column for security), `vault_metrics_daily`, `xrp_to_fxrp_bridges`, `fxrp_to_xrp_redemptions`, `firelight_positions`, `compounding_runs`, `service_state`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Automated Withdrawal System**: Complete async withdrawal automation with ENS resolution, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking.
- **Production Publishing Optimization**: Fast server startup, asynchronous service initialization, dual health endpoints, and API readiness guards.
- **Decimal Mismatch Resolution**: Corrected FXRP decimal handling (6 decimals) in `ShXRPVault` and related services.
- **UX Enhancements**: Multi-step progress modals for deposits and withdrawals with real-time status polling.
- **P0 Vault Controls**: Backend and frontend integration for deposit limits and pausable emergency controls with SHA-256 authentication.
- **Coming Soon Vaults**: Backend and frontend integration for placeholder vaults with database flag, API validation, and "Coming Soon" UI badges.
- **UI/UX Overhaul**: Redesign of vaults page to a modern list layout, featuring `VaultListItem` and `CollapsibleSection` components, larger typography, and improved accessibility.
- **Dashboard Glassmorphism Redesign**: Modernized dashboard with `GlassStatsCard` components, cohesive glass theme, updated typography, and responsive grid layouts.
- **Dual-Status Withdrawal Model**: Separate user-facing and backend status tracking for withdrawals using `userStatus`, `backendStatus`, and `backendError` fields.
- **Deposit Flow UX Improvements**: Enhanced progress modal for deposits with bridge ID display, copy-to-clipboard, navigation to bridge tracking, and automatic payment trigger.
- **Xaman Payment Pre-fill Fix**: Corrected XUMM SDK payload to include `Account` field for pre-filled transaction details in Bridge Tracking manual payments.
- **Deposit Cancellation Feature**: User-controlled cancellation system for in-progress deposits with safety confirmation and protection for confirmed XRPL transactions.
- **Real-Time Portfolio Updates**: Coordinated polling and status mapping for withdrawals using `usePortfolioPolling` hook and query invalidation.
- **ERC-4337 Bundler Retry Logic with Fee Bumping**: Robust retry system for UserOp submission with exponential backoff and 20% fee increase per retry.
- **FDC Timing Optimizations**: Reduced DA indexing buffer from 60s to 30s (20s for late-round submissions >70s into 90s round) based on test evidence showing proofs ready faster than initially expected. Minimum wait reduced from 90s to 60s. Expected improvement: ~163s wait reduced to ~90-120s, improving deposit UX by 30-45 seconds.
- **Withdrawal Position Refresh**: Query invalidation added to withdrawal completion handler to refresh positions, withdrawals, and transactions immediately after successful withdrawal, ensuring UI updates reflect balance changes without requiring manual refresh.
- **Deposit Watchdog Service**: Automatic recovery system for stuck deposits at xrpl_confirmed status. Polls every 60s to query FAssets AssetManager for MintingExecuted events, extracts mint tx hash, and completes vault share minting via completeMint().
- **Withdrawal Retry Service**: Exponential backoff retry system for failed withdrawal confirmations. Polls every 60s, checks Smart Account balance >= 0.1 FLR, retries confirmRedemptionPayment with exponential backoff (wait = 60s * 2^retryCount, max 10 retries). Stores lastRetryAt and retryCount in database for crash recovery.
- **Two-SDK Smart Account Architecture**: Separate PrimeSdk instances for different transaction types:
  - `primeSdkWithPaymaster`: Gasless transactions via Arka paymaster (FdcHub attestations, batch operations)
  - `primeSdkWithoutPaymaster`: Direct gas payment from Smart Account balance (confirmRedemptionPayment not on paymaster allowlist)
  - Smart Account automatically selects appropriate SDK based on usePaymaster flag
- **FDC Proof Structure Fix**: Corrected confirmRedemptionPayment to pass proof.proof instead of entire proof object to encodeProofForContract(), resolving TypeError on merkle proof encoding.
- **Enhanced Schema Tracking**: Added paymentConfirmedAt, fxrpMintTxHash to xrp_to_fxrp_bridges; confirmationTxHash, lastError, lastRetryAt to fxrp_to_xrp_redemptions; service_state table for persistent block tracking; fundingAttempts and lastFundingTxHash for redemption retry diagnostics.
- **FDC Proof Generation Lock**: Implemented sentinel-based locking mechanism using `fdcAttestationTxHash: "PENDING"` to prevent concurrent proof generation attempts from multiple services (startup reconciliation + watchdog), eliminating nonce conflicts and "fee too low" UserOp errors.
- **Reconciliation Recovery Patterns**: Added comprehensive recovery logic for all bridge statuses including vault_minting, ensuring automatic recovery from any intermediate state without manual intervention.
- **Immediate Position Updates on XRP Receipt**: Position balances now update immediately when user receives XRP (when userStatus becomes "completed"), not after backend confirmation completes. This eliminates confusing UX where users see outdated balances while backend processes are still running.
- **Wallet-Scoped Transaction Security**: Complete end-to-end wallet authentication for transaction history access:
  - Database: Added `wallet_address varchar NOT NULL` column to transactions table with backfill migration
  - Storage: Direct filtering by `wallet_address` column (no JOIN-based bypasses)
  - API: Wallet parameter REQUIRED for `/api/transactions` and `/api/transactions/summary` endpoints (returns 400 if missing)
  - Services: All transaction creation (deposits, claims, withdrawals) includes wallet address
  - Frontend: All queries wallet-scoped, eliminating unauthorized access to global transaction data
- **Withdrawal History Consolidation**: Streamlined UI with clear separation of concerns:
  - Portfolio page: Active positions + in-flight withdrawal alert banner (no history list)
  - Transaction History page: Complete wallet-scoped transaction history including withdrawals
  - Bridge Tracking page: Real-time detailed status of all bridge operations
  - Portfolio polling: Restored automatic 5s refresh during active withdrawals via redemptions query
  - In-flight alerts: Count badge with direct navigation to Bridge Tracking for withdrawal details
- **Transaction Type Normalization**: Frontend handles both "withdraw" and "withdrawal" types for backward compatibility with consistent badging and iconography.
- **SparkDEX V3 Swap Integration**: Complete swap feature at `/swap` enabling instant FLR ↔ SHIELD token swaps:
  - Network-aware contract addresses (mainnet/testnet) with validation guards
  - Uniswap V2-compatible router interface (swapExactETHForTokens, swapExactTokensForTokens)
  - Real-time price quotes using getAmountsOut with 0.5% slippage protection
  - Approval flow for token swaps with user-friendly error messages
  - Post-swap confetti animation and success modal with "Stake for +X% APY boost" CTA
  - Glassmorphism UI matching Dashboard design with responsive layout
  - Address validation: Gracefully handles missing SHIELD token address with clear error messaging
  - Built to drive staking adoption by providing frictionless $SHIELD acquisition

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**: `ShXRPVault.sol` (ERC-4626 tokenized vault), `VaultController.sol` (orchestration, access control), `KineticStrategy.sol`, `FiresparkStrategy.sol`, `MockStrategy.sol`.

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery.
- **Transaction Privacy**: Wallet-scoped authentication on all transaction endpoints. Users can only access their own transaction history, with API-level validation requiring wallet parameter (returns 400 error if missing).
- **Data Integrity**: Direct column filtering prevents JOIN-based security bypasses. All transaction creation includes wallet address validation.

## Deployment & Documentation

### Shield Finance Fair Launch Documentation
- **[SHIELD_DEPLOYMENT.md](docs/SHIELD_DEPLOYMENT.md)** - Complete 7-step deployment guide
  - Pre-deployment checklist and security requirements
  - Step-by-step deployment sequence with verification
  - SparkDEX V3 liquidity integration and LP locking
  - Post-deployment verification and emergency procedures
  - Cost estimates and block explorer links
  
- **[SHIELD_SECURITY_CHECKLIST.md](docs/SHIELD_SECURITY_CHECKLIST.md)** - Pre-launch security checklist
  - 8 sections with 100+ security items
  - Smart contract audit requirements (176/176 tests ✅, 78 adversarial tests ✅)
  - Deployment security and operational security guidelines
  - Economic security, legal compliance, and incident response

### Deployment Scripts
- **scripts/deploy-shield-finance.ts** - Production-ready fair launch deployment (ACTIVE)
  - Deploys ShieldToken, RevenueRouter, StakingBoost, MerkleDistributor
  - All critical bugs fixed (variable scope, address retrieval, SparkDEX integration)
  - Network detection (mainnet vs testnet)
  - Comprehensive verification and next steps
  
- **scripts/sparkdex-lp.ts** - SparkDEX V3 liquidity deployment
  - Adds 1M SHIELD + 535,451 wFLR ($10K liquidity)
  - 0.3% fee tier, wide price range for stability
  - LP NFT for Team Finance locking

- **scripts/deploy-flare.ts** - DEPRECATED (uses wrong ShieldToken constructor, do not use)
- **scripts/burn.ts** - Weekly automated SHIELD buyback & burn (security-hardened)

### Fair Launch Parameters
- **Total Supply**: 10,000,000 SHIELD (fixed, immutable)
- **Initial Price**: $0.01 per SHIELD
- **Liquidity**: 1,000,000 SHIELD + 535,451 wFLR = ~$10,000
- **Airdrop**: 2,000,000 SHIELD (20% via MerkleDistributor)
- **LP Lock**: 12 months via Team Finance
- **Revenue Model**: 50% burn + 50% reserves (deflationary)

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
- **Flare Data Connector (FDC)**: Cross-chain data verification protocol for attestation submission and proof generation.
    - **Data Availability API**: `ctn2-data-availability.flare.network`, `flr-data-availability.flare.network`.
    - **Verifier Service**: `fdc-verifiers-testnet.flare.network`.
    - **FdcHub Integration**: On-chain attestation submission workflow.