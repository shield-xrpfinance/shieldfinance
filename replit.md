# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market.

## User Preferences
Preferred communication style: Simple, everyday language.

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
- **Deprecated Tables**: `withdrawal_requests`, `escrows` (legacy manual approval system, no longer used).

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Fee Disclosure**: Transparent fee system implemented for all deposits.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**:
    - `ShXRPVault.sol`: ERC-4626 tokenized vault for shXRP.
    - `VaultController.sol`: Orchestrates vault operations, role-based access control.

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration (`xumm-sdk`).
- **WalletConnect**: XRPL-compatible wallet connection (`@walletconnect/universal-provider`).
- **Web3Auth**: Social login for XRP wallet creation (`@web3auth/modal`).
- **XRP Ledger (XRPL)**: Real-time balance fetching (`xrpl` library).
- **QR Code Display**: `qrcode.react`.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Drizzle Kit**: For database migrations.
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
    - **Voting Round Calculation**: Uses Flare's official hardcoded constants (firstRoundStartTime=1658430000, roundDuration=90s) per official documentation at dev.flare.network/fdc/guides/fdc-by-hand/.

## Recent Changes

### ✅ FULLY AUTOMATED WITHDRAWAL SYSTEM - ALL PHASES COMPLETE (November 14, 2025)

**Overview**: Complete async withdrawal automation with ENS resolution fix, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking. Withdrawals now complete automatically from user initiation to XRP payout without manual intervention.

**Phase 1 Implementation (Complete):**

1. **ENS Resolution Fix**:
   - Fixed "network does not support ENS" error when calling AssetManager.redeem()
   - Solution: Use populateTransaction() to manually encode redemption call
   - File: server/utils/fassets-client.ts

2. **Async Architecture**:
   - POST /api/withdrawals returns < 1 second with redemption ID
   - Background worker processes redemption asynchronously (35+ seconds)
   - Atomic claim mechanism: Conditional UPDATE WHERE status='pending' prevents race conditions
   - Files: server/routes.ts, server/storage.ts

3. **Database Schema**:
   - Created `fxrpToXrpRedemptions` table with status state machine
   - Status states: pending → redeeming_shares → redeemed_fxrp → redeeming_fxrp → awaiting_proof → xrpl_payout → completed
   - Tracks complete redemption lifecycle with idempotent operations
   - File: shared/schema.ts

4. **Backend Services**:
   - VaultService.redeemShares(): Burns shXRP tokens via ERC-4626 redeem() → receives FXRP
   - BridgeService.redeemFxrpToXrp(): Requests FAssets redemption for FXRP amount
   - FAssetsClient: Implements redemption request workflow
   - POST /api/withdrawals: Async endpoint with background processing
   - GET /api/withdrawals/wallet/:address: Status polling endpoint

5. **Frontend Updates**:
   - Portfolio: Withdrawal button triggers async flow, returns immediately
   - WithdrawModal: Loading states, toast with redemption ID
   - Real-time status display: Polling every 5 seconds for active redemptions
   - Status labels for all 9 states with color-coded badges
   - Cache invalidation using correct query key: ["/api/withdrawals/wallet", address]
   - Files: client/src/pages/Portfolio.tsx, client/src/components/WithdrawModal.tsx

6. **Data Integrity**:
   - Position balance updates deferred until Phase 3 completion
   - Transaction records deferred until Phase 3 completion
   - Prevents user balance loss if redemption fails mid-process
   - Idempotent background processing with retry safety

**Current Withdrawal Flow:**
1. User clicks "Withdraw" → WithdrawModal opens
2. User enters shXRP amount → clicks Confirm
3. Frontend calls POST /api/withdrawals → Returns redemption ID immediately
4. Background worker (Phase 1) processes asynchronously:
   - Validates position and share amount
   - Burns shXRP tokens via vault.redeem() → receives FXRP
   - Requests FAssets redemption for FXRP amount
   - Updates status through: pending → redeeming_shares → redeemed_fxrp → redeeming_fxrp
   - Transitions to "awaiting_proof" and subscribes XRPL listener
5. Frontend polls status every 5 seconds and displays real-time progress
6. XRPL listener (Phase 2) automatically detects agent payment
7. Auto-completion (Phase 3) generates FDC proof, confirms on-chain, updates balance
8. User receives XRP in original wallet, withdrawal marked complete

**Phase 2 - XRPL Payment Detection (COMPLETE):**
- ✅ XRPLDepositListener monitors user XRPL addresses for incoming payments
- ✅ Startup recovery: loadPendingRedemptions() loads all "awaiting_proof" redemptions on server start
- ✅ Real-time monitoring: subscribeUserForRedemption() registers user addresses after redemption request
- ✅ Payment matching: getRedemptionByMatch() matches payments by userAddress + agentAddress + amount
- ✅ Event handler: handleRedemptionPayment() triggers completion flow when payment detected
- ✅ Files: server/listeners/XRPLDepositListener.ts, server/services/BridgeService.ts:1334-1343

**Phase 3 - FDC Proof & Auto-Completion (COMPLETE):**
- ✅ processRedemptionConfirmation() orchestrates complete finalization workflow
- ✅ Generates FDC attestation proof via generateFDCProofForRedemption()
- ✅ Confirms redemption payment on FAssets contract via confirmRedemptionPayment()
- ✅ Updates position balance (deducts withdrawn shXRP)
- ✅ Creates withdrawal transaction record for user history
- ✅ Marks redemption status as "completed"
- ✅ Unsubscribes user address from listener (cleanup)
- ✅ Files: server/services/BridgeService.ts:1656-1764

**Complete Automated Withdrawal Flow:**
1. User clicks "Withdraw" → POST /api/withdrawals creates redemption (status: pending)
2. processRedemptionBackground() burns shXRP → receives FXRP (status: redeeming_shares → redeemed_fxrp)
3. redeemFxrpToXrp() requests FAssets redemption, populates agent address, subscribes XRPL listener (status: redeeming_fxrp → awaiting_proof)
4. XRPLDepositListener detects agent→user XRP payment automatically
5. processRedemptionConfirmation() generates FDC proof, confirms on-chain, updates position, creates transaction (status: xrpl_payout → completed)
6. User receives XRP in original XRPL wallet, position balance updated automatically

**Security & Production Notes:**
- ✅ Custodial model: Smart account holds assets, positions table tracks user ownership
- ✅ Only position owner can withdraw (validated by userAddress in positions table)
- ✅ ERC-4626 standard ensures correct share-to-asset conversion
- ✅ Atomic claim prevents duplicate processing and race conditions
- ✅ Idempotent operations with retry logic for crash recovery
- ✅ Full automation: withdrawals complete without manual intervention
- ✅ Startup recovery: pending redemptions automatically loaded and monitored on server restart

**Deployment Status:**
- ✅ ALL PHASES (1/2/3) PRODUCTION-READY
- ✅ Withdrawal automation fully operational
- ✅ Architect approved for production deployment (November 14, 2025)

### Recent Changes (November 12, 2025)

### Fixed FXRP Integration Issues
1. **Dynamic FXRP Address Resolution**: Services now fetch correct FXRP token address (0x0b6A3645c240605887a5532109323A3E12273dc7) dynamically from AssetManager instead of using hardcoded wrong address (0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3).
2. **Optimistic Balance Tracking**: BridgeService now reads actual minted FXRP from Transfer event logs instead of assuming fxrpReceived = fxrpExpected.
3. **Decimal Formatting Updates**: Updated VaultService, YieldService, BridgeService, and all diagnostic scripts to use formatUnits/parseUnits with proper decimal precision.
4. **Vault Contract Fixes**: Fixed minDeposit parameter and redeployed ShXRPVault with dynamically-fetched FXRP address.

### Current Deployment Status
- **Smart Account**: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd (Etherspot Prime SDK ERC-4337)
- **ShXRPVault (NEW)**: 0x8fe09217445e90DA692D29F30859dafA4eb281d1 (with correct decimals override)
- **ShXRPVault (OLD)**: 0x1CE23bAEC4bb9709F827082d24a83d8Bc8865249 (deprecated - wrong decimals)
- **FXRP Token**: 0x0b6A3645c240605887a5532109323A3E12273dc7
- **Smart Account Balance**: 145 FXRP, 70.67 CFLR

### ✅ DECIMAL MISMATCH RESOLVED (November 12, 2025)
**Problem**: FXRP uses 6 decimals, but ShXRPVault inherited ERC4626's default 18 decimals, causing "Below minimum deposit" errors.

**Solution Applied**:
1. **Overrode decimals() in ShXRPVault**: Added `function decimals() public view override returns (uint8) { return IERC20Metadata(address(asset())).decimals(); }` to match FXRP's 6 decimals
2. **Redeployed Vault**: New vault at 0x8fe09217445e90DA692D29F30859dafA4eb281d1 with correct decimal handling
3. **Fixed minDeposit**: Corrected from 10^16 to 10000 (0.01 FXRP with 6 decimals)
4. **Updated VaultService**: Now reads vault address from timestamped deployment files instead of environment variables

**Verification**:
- ✅ Vault.decimals() = 6 (matches FXRP)
- ✅ MinDeposit = 10000 (0.01 FXRP)
- ✅ End-to-end deposit successful: Transaction 0x92c1c5f834bb3e15d09996df4f10c9467a05a8afc20d55a528fcf0508e1acc32
- ✅ Position created: 0bb1e2b9-a63a-405f-92c5-8e2a61bfbc8c
- ✅ Full flow working: XRP → FXRP → shXRP

**Decimal Handling Documentation**:
- Database stores FXRP amounts as numeric (e.g., 20.000000)
- BridgeService passes decimal strings to VaultService.mintShares()
- VaultService uses parseUnits(amount, 6) to convert to raw units
- All conversions now properly aligned with FXRP's 6-decimal standard