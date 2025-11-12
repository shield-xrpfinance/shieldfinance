# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 12, 2025 - CRITICAL FIX: Payment Reference Validation & Double-Encoding Bugs
- **🐛 Fixed Critical Bridging Bug**: Resolved payment reference mismatch causing 100% bridge failure rate for 2+ days
- **Root Cause #1**: XRPL listener was decoding hex payment references to UTF-8, causing memo comparison failures
  - Before: Memo received as `FBPRf�` (garbled UTF-8) vs expected `46425052664100010000...` (hex) → always failed
  - After: Memo returned as uppercase hex `46425052664100010000...` → matches stored reference
- **Root Cause #2**: Frontend sending wrong parameter name to payment API
  - Before: `amount` parameter sent to `/api/wallet/xaman/payment` → 400 error
  - After: `amountDrops` parameter → payment requests work correctly
- **Root Cause #3**: Xaman payment API was double-encoding hex memos
  - Before: `Buffer.from(memo).toString("hex")` converted `46425052...` → `34363432...` (hex of ASCII text) → comparison failed
  - After: `memo.toUpperCase()` passes hex directly → `46425052...` → comparison succeeds
- **Changes**:
  - Modified `XRPLDepositListener.extractMemo()` to return canonical uppercase hex (no UTF-8 decoding)
  - Fixed `walletContext.requestPayment()` to send `amountDrops` instead of `amount`
  - Fixed `server/routes.ts` Xaman payment endpoint to pass hex memo directly (no double-encoding)
  - Updated `BridgeService` to store all payment references in uppercase (production + demo mode)
  - Backfilled 2 existing pending bridges to uppercase format
- **Impact**: Bridges can now progress through complete flow: awaiting_payment → xrpl_confirmed → fdc_proof_generated → fxrp_minted → completed
- **Files Modified**: `server/listeners/XRPLDepositListener.ts`, `client/src/lib/walletContext.tsx`, `server/services/BridgeService.ts`, `server/routes.ts`

### November 12, 2025 - Bridge Tracking Payment Restart Feature
- **Bridge Tracking Enhancement**: Added "Send Payment" button to bridge tracking page for bridges in `awaiting_payment` status
- **User Flow**: Users can now reopen BridgeStatusModal after closing it to complete payment without losing progress
- **Implementation Details**:
  - Vault name lookup with memoized Map for O(1) performance
  - Loading state on button while vaults data is being fetched
  - Toast notifications for vault loading and error states
  - Full integration with existing Xaman/WalletConnect payment flow
- **Files Modified**: `client/src/pages/BridgeTracking.tsx`, `client/src/components/BridgeStatus.tsx`

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, Inter and JetBrains Mono fonts.
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API for vault and user position management.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Includes `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `withdrawal_requests`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Environment Variables**: Validated for critical configurations.
- **CORS and Session Handling**: Managed via Express middleware.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts for ERC-20 and access control.
- **Contracts**:
    - `ShXRPVault.sol`: ERC-4626 tokenized vault for shXRP, uses FXRP, integrates Firelight for yield, reentrancy guard.
    - `VaultController.sol`: Orchestrates vault operations, role-based access control, vault registration, bridge request tracking, compounding execution.

### Backend Services
- **Core Services**: DepositService, BridgeService, VaultService, YieldService, CompoundingService.
- **Utilities**: FlareClient (ethers.js wrapper), XRPLDepositListener (WebSocket).
- **Database Schema Extensions**: `xrp_to_fxrp_bridges`, `firelight_positions`, `compounding_runs`.
- **Production Mode**: FAssets SDK integration for real on-chain FXRP minting.
- **Automatic Reconciliation**: Built-in recovery system for stuck/failed bridges
  - **Startup Reconciliation**: Automatically attempts to recover failed bridges on server startup (configurable via `AUTO_RECONCILE_ON_START`, default: enabled)
  - **Periodic Reconciliation**: Optional scheduled recovery via `AUTO_RECONCILE_INTERVAL_MINUTES` environment variable (opt-in, in-flight guard prevents overlapping runs)
  - **Recovery Categories**: FDC timeouts, vault mint failures, "already known" errors, attestation not found, bridges stuck at `xrpl_confirmed` or `fdc_proof_generated`
  - **Manual Recovery**: API endpoints for individual (`POST /api/bridges/:id/reconcile`) and bulk (`POST /api/bridges/reconcile-all`) reconciliation
  - **UI Integration**: Retry buttons on failed bridges in Bridge Tracking page with success/error notifications

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits to prevent dust attacks, transparent accounting through event emission.
- **Financial Integrity**: Double-mint prevention, idempotency, crash recovery, audit trail, retry capability, manual recovery paths for critical operations.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration for transaction signing (`xumm-sdk`).
- **WalletConnect**: XRPL-compatible wallet connection (`@walletconnect/universal-provider`) supporting XRPL mainnet/testnet, dynamic chain switching, and session restoration.
- **Web3Auth**: Social login for XRP wallet creation (`@web3auth/modal`).
- **XRP Ledger (XRPL)**: Real-time balance fetching for XRP, RLUSD, USDC (`xrpl` library).
- **QR Code Display**: `qrcode.react` for Xaman interactions.

### UI & Data Visualization
- **Recharts**: For displaying APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Drizzle Kit**: For database migrations.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Fonts
- Google Fonts CDN: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, dynamic AssetManager address resolution via `@flarenetwork/flare-periphery-contract-artifacts`, FDC Attestation for payment proof generation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification protocol
  - **Data Availability API**: `ctn2-data-availability.flare.network` (Coston2 testnet), `flr-data-availability.flare.network` (mainnet)
  - **Verifier Service**: `fdc-verifiers-testnet.flare.network` for request preparation
  - **FdcHub Integration**: Complete on-chain attestation submission workflow
    - FdcHubClient (`server/utils/fdchub-client.ts`) submits attestation requests to FdcHub contract
    - Voting round ID calculated from XRPL transaction timestamp using dynamic round parameters from prepareRequest
    - Network-agnostic implementation works on both mainnet and Coston2 without code changes
    - Attestation tx hash persisted in database (`fdcAttestationTxHash` field) for audit trail and retry support
  - **FDC Proof Generation Flow**:
    1. Prepare attestation request via FDC verifier service (`prepareRequest`)
    2. Extract dynamic round parameters (`roundOffsetSec`, `roundDurationSec`) from prepareRequest
    3. Calculate voting round ID from XRPL transaction timestamp (ensures correct round even if FdcHub submission is delayed)
    4. Submit attestation on-chain to FdcHub contract via `requestAttestation()`
    5. Poll Data Availability Layer for finalized proof using calculated voting round ID
    6. Return proof for FXRP minting on Flare Network