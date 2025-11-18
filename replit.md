# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market.

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
- **Schema**: Includes `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `xrp_to_fxrp_bridges`, `fxrp_to_xrp_redemptions`, `firelight_positions`, `compounding_runs`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Automated Withdrawal System**: Complete async withdrawal automation with ENS resolution, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking.
- **Production Publishing Optimization**: Fast server startup, asynchronous service initialization, dual health endpoints (`/healthz`, `/readyz`), and API readiness guards.
- **Decimal Mismatch Resolution**: Corrected FXRP decimal handling (6 decimals) in `ShXRPVault` and related services.
- **UX Enhancements**: Multi-step progress modals for deposits and withdrawals with real-time status polling.
- **P0 Vault Controls (Nov 2025)**: Complete backend and frontend integration for deposit limits and pausable emergency controls.
  - Backend: Admin-only API endpoints (`/api/vaults/:id/deposit-limit`, `/api/vaults/:id/pause`) with SHA-256 authentication.
  - Frontend: Vault cards display deposit limit and paused status (read-only); deposit flow blocked when paused.
  - Type Safety: Strict boolean normalization for `paused` field; NaN protection for deposit limit display.
  - Security: Deposit button disabled and `handleDeposit()` guard prevents modal opening when vault is paused.
- **Coming Soon Vaults (Nov 2025)**: Complete backend and frontend integration for placeholder vaults.
  - Database: `comingSoon` boolean field in vaults table (default: false).
  - Backend Enforcement: API validation on POST `/api/deposits` and POST `/api/positions` returns 403 Forbidden with clear error message.
  - Frontend Display: "Coming Soon" badge with clock icon, disabled deposit button, visual dimming (75% opacity).
  - Security: Multi-layer protection - frontend guards + backend validation + audit logging.
  - UX: Tooltip explains vault is under development; placeholder metrics clearly indicate unavailable status.
  - Production Status: 1 active Shield XRP vault, 5 placeholder vaults marked as coming soon.
- **UI/UX Overhaul (Nov 2025)**: Complete redesign of vaults page from grid-based cards to modern list layout.
  - Layout: Replaced 3-column grid with full-width list items for better horizontal space utilization.
  - Information Architecture: Separated "Active Vaults" and "Coming Soon" sections for clear hierarchy.
  - Components: Created `VaultListItem` (horizontal metrics display) and `CollapsibleSection` (accessible accordion).
  - Modern Design: Larger typography (text-3xl headings), gradient APY text, stronger borders (border-2), generous spacing.
  - Coming Soon UX: Collapsible section (collapsed by default) with dashed border, minimizes screen estate for placeholder vaults.
  - Accessibility: Added aria-expanded, aria-controls, and role="region" attributes for screen readers.
  - Responsive: Flexbox layout with wrapping metrics on tablet, vertical stacking on mobile.
  - Empty States: Proper handling when no vaults match search/filter criteria.
- **Dashboard Glassmorphism Redesign (Nov 2025)**: Modernized dashboard to match vaults page aesthetic with cohesive glass theme.
  - Components: Created `GlassStatsCard` with glassmorphism styling (gradient backgrounds, backdrop blur, glowing icon effects).
  - Glass Theme: `bg-gradient-to-br from-primary/10 via-primary/5 to-background`, `backdrop-blur-sm`, glowing icons with `blur-xl`.
  - Layout Consistency: Replaced old `StatsCard` grid with `GlassStatsCard` components, replaced `VaultCard` grid with `VaultListItem` for design consistency.
  - Typography: Updated to text-3xl headings, text-4xl stat values with tabular-nums, generous spacing (space-y-12 between sections, p-8 card padding).
  - Responsive Grid: Stats display in 4-column grid on desktop, 2-column on tablet, single column on mobile.
  - Chart Styling: APY Performance chart wrapped in glass-themed container (rounded-2xl border-2 with gradient background).
  - Design System: Matches sidebar "Need help?" section and vaults page for cohesive glassmorphism aesthetic throughout app.
- **Dual-Status Withdrawal Model (Nov 2025)**: Complete separation of user-facing and backend status tracking for withdrawals.
  - Database: Added `userStatus`, `backendStatus`, and `backendError` fields to `fxrp_to_xrp_redemptions` table.
  - User Status: Terminal "completed" status when user receives XRP in their wallet (never changes to "failed" afterward).
  - Backend Status: Separate tracking for FDC proof confirmation ("confirming", "confirmed", "retry_pending", "manual_review", "abandoned").
  - Error Handling: User never sees "failed" status if they received XRP; backend errors stored separately in `backendError` field.
  - BridgeService: All redemption updates preserve userStatus after XRP is received; automatic retry logic for backend confirmation failures.
  - API: Endpoints expose `userStatus` for UI display; `backendStatus` and `backendError` for admin monitoring.
  - Frontend: Portfolio page uses userStatus to determine completion; contextual error messages replace generic failures.
- **Deposit Flow UX Improvements (Nov 2025)**: Enhanced progress modal for better user guidance.
  - Progress Modal: Stays open after Xaman/WalletConnect signature (doesn't auto-close).
  - Bridge ID Display: Shows bridge ID in monospace font with copy-to-clipboard functionality.
  - Navigation: "View in Bridge Tracking" button navigates to `/bridge-tracking` page for status monitoring.
  - Dismissible Modal: Users can close modal manually or let it persist while they complete other tasks.
  - Info Alert: Clear messaging that users can check bridge status anytime in Bridge Tracking.
  - State Machine: Updates to 'awaiting_payment' step after signature; supports Xaman, WalletConnect, and fallback flows.
  - Automatic Payment Trigger (Nov 18, 2025): ProgressStepsModal now automatically triggers wallet payment modal when bridge status reaches 'awaiting_payment' with paymentRequest data available.
- **Xaman Payment Pre-fill Fix (Nov 18, 2025)**: Fixed Bridge Tracking manual payment QR codes to show pre-filled transaction details.
  - Root Cause: XUMM SDK payload was missing the `Account` field, causing Xaman to show generic signing requests instead of pre-filled transactions.
  - Frontend Fix: walletContext.tsx now passes `account: address` when calling `/api/wallet/xaman/payment` endpoint.
  - Backend Fix: Server extracts `account` from request and includes `Account` field in XUMM payload creation.
  - Validation: Added `account` to required fields alongside destination, amountDrops, and memo.
  - Impact: Bridge Tracking manual payments now display pre-filled amount (including 0.25% FAssets fee), destination address, and payment reference memo.
  - Scope: Only affects `/api/wallet/xaman/payment` endpoint used by Bridge Tracking. Dashboard/Vaults deposit flow using `/api/wallet/xaman/payment/deposit` remains unchanged.
- **Deposit Cancellation Feature (Nov 18, 2025)**: Complete user-controlled cancellation system for in-progress deposits with critical edge case protection.
  - User Interface: Cancel button (X icon) appears in BridgeStatus card header for active deposits.
  - Safety Confirmation: AlertDialog prompts user confirmation before cancelling ("Cancel Deposit?" with amount display).
  - Cancellable States: pending, reserving_collateral, bridging, awaiting_payment (before XRPL transaction confirmation).
  - Protected States: Cannot cancel xrpl_confirmed, generating_proof, proof_generated, fdc_proof_generated, minting, vault_minting (after XRPL confirmation).
  - Terminal States: Cannot cancel completed, vault_minted, failed, vault_mint_failed, or cancelled deposits.
  - Edge Case Protection: Once XRPL transaction is confirmed, cancellation is blocked because XRP has been sent and minting is in progress, preventing inconsistent state.
  - Backend Validation: API validates bridge status before cancellation, returns clear error message if status is past cancellation window.
  - Backend Cleanup: BridgeService.cancelBridge() stops XRPL monitoring, removes agent listeners, updates database status to 'cancelled', sets cancelledAt timestamp.
  - API Endpoint: POST `/api/bridges/:id/user-cancel` with wallet ownership validation and status validation (only deposit owner can cancel, only before XRPL confirmation).
  - Database: Uses existing cancelledAt and cancellationReason fields in xrp_to_fxrp_bridges table.
  - Position Cleanup: Automatically deletes any associated position records to maintain data consistency.
- **Real-Time Portfolio Updates (Nov 2025)**: Complete implementation of coordinated polling and status mapping for withdrawal tracking.
  - Status Mapping: Created `statusMapping.ts` utility covering all 17 enum values (userStatus + redemptionStatus + legacy statuses).
  - DisplayStatus Pattern: Consistent fallback logic `displayStatus = userStatus || status` used across rendering, polling guards, and refetchInterval.
  - usePortfolioPolling Hook: Coordinated real-time refetches of positions, withdrawals, and transactions every 5s when active withdrawals exist.
  - Query Invalidation: All 4 invalidation calls correctly use wallet-scoped keys `['/api/positions', address]`, `['/api/withdrawals/wallet', address]`, `['/api/transactions/wallet', address]`.
  - Triple-Guard Consistency: hasActiveWithdrawals guard, refetchInterval guard, and rendering all check same terminal states: ['completed', 'xrpl_received', 'failed', 'cancelled'].
  - Mutation Triggers: Manual invalidation after withdraw/claim mutations for immediate UI updates.
  - Auto-Deduplication: TanStack Query prevents double-refresh when polling overlaps with manual triggers.
  - FDC Attestation Optimization: Exponential backoff (10s→60s, 1.5x multiplier) with intelligent wait calculation based on voting round position reduces API load and "attestation not found" errors.
  - Enhanced Logging: FDC timing phases logged for diagnostics (round calculation, backoff, attestation retrieval).

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**: `ShXRPVault.sol` (ERC-4626 tokenized vault), `VaultController.sol` (orchestration, access control), `KineticStrategy.sol` (lending strategy stub), `FirelightStrategy.sol` (staking strategy stub), `MockStrategy.sol` (test implementation).

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery.

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
    - **Data Availability API**: `ctn2-data-availability.flare.network` (Coston2), `flr-data-availability.flare.network` (mainnet).
    - **Verifier Service**: `fdc-verifiers-testnet.flare.network`.
    - **FdcHub Integration**: On-chain attestation submission workflow.