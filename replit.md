# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application for XRP liquid staking with integrated blockchain infrastructure. It provides a dashboard for users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform utilizes smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for secure cross-chain asset locking. The business vision aims to make DeFi on XRP accessible and efficient, leveraging the growing market for liquid staking solutions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design patterns, responsive layout, custom theming, Inter and JetBrains Mono fonts.
- **State Management**: React Context API (wallet persistence), TanStack Query (server state), React hooks (local component state).

### Backend Architecture
- **Server**: Express.js (Node.js, TypeScript), RESTful API for vault/user position management (CRUD, deposits, withdrawals, claims).
- **Data Validation**: Zod schemas, drizzle-zod.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `withdrawal_requests`.
- **Key Features**: UUID primary keys, decimal precision, seed data, request-based withdrawal/claim approval by vault operators.

### System Design Choices
- **Separation of Concerns**: `/client` (frontend), `/server` (backend), `/shared` (shared types/schemas).
- **Environment Variables**: Validated `DATABASE_URL`, `SESSION_SECRET`.
- **CORS and Session Handling**: Express middleware.

### Smart Contract Development
- **Hardhat**: Ethereum development environment for Solidity contracts.
- **OpenZeppelin Contracts**: Secure ERC-20 and access control implementations.
- **Solidity**: Version 0.8.20.
- **Flare Network Integration**: Coston2 testnet (Chain ID: 114) and Flare mainnet (Chain ID: 14).

### Blockchain Infrastructure

#### Smart Contracts (Flare Network)
- **ShXRPVault.sol**: ERC-4626 tokenized vault for liquid staking (shXRP), uses FXRP as asset, integrates Firelight for yield generation, reentrancy guard. Deployed on Flare Coston2/mainnet.
- **VaultController.sol**: Orchestration contract with role-based access control (OPERATOR_ROLE, COMPOUNDER_ROLE), vault registration, bridge request tracking, compounding execution. Deployed on Flare Coston2/mainnet.

### Backend Services Architecture
- **Core Services**: DepositService, BridgeService, VaultService, YieldService, CompoundingService.
- **Utilities & Listeners**: FlareClient (ethers.js wrapper), XRPLDepositListener (WebSocket).
- **Database Schema (Extended)**: `xrp_to_fxrp_bridges`, `firelight_positions`, `compounding_runs`.
- **Production Mode**: ACTIVE (Nov 2024) - BridgeService configured with DEMO_MODE=false, using real FAssets SDK integration with automatic Contract Registry address resolution. Transactions execute real on-chain FAssets minting operations.

### Security Features (Blockchain)
- **ERC-4626 Standard**: Industry-standard vault interface.
- **Role-Based Access Control**: OpenZeppelin AccessControl.
- **ReentrancyGuard**: Protection against reentrancy attacks.
- **Minimum Deposits**: Prevents dust attacks.
- **Transparent Accounting**: Event emission for all operations.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration (`xumm-sdk`) for transaction signing, payload management, requires `XUMM_API_KEY`, `XUMM_API_SECRET`.
- **WalletConnect**: XRPL-compatible wallet connection using `@walletconnect/universal-provider` for `xrpl` namespace, supports XRPL mainnet/testnet, dynamic chain switching, requires `VITE_WALLETCONNECT_PROJECT_ID`.
  - **Session Restoration**: Lazy-loaded SDK with type-only imports, 5-second timeout guard, automatic IndexedDB session restoration with address validation.
  - **Bundle Optimization**: Type-only import prevents bundling, dynamic import enables code splitting, finally block ensures timeout cleanup.
- **Web3Auth (Social Login)**: Enables social login (`@web3auth/modal`) for XRP wallet creation, uses `@noble/secp256k1` for key derivation, polyfills for Buffer/process, requires `VITE_WEB3AUTH_CLIENT_ID`.
- **Transaction Signing Routing**: Automatically routes to Xaman or WalletConnect based on connection method.
- **XRP Ledger Balance Fetching**: Real-time balance retrieval for XRP, RLUSD, USDC using `xrpl` library.
- **QR Code Display**: `qrcode.react` for Xaman interactions.
- **Demo Mode**: Fallback for unconfigured API keys.

### UI & Data Visualization
- **Recharts**: For displaying APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Replit-specific plugins**: Runtime error overlay, cartographer, dev banner.
- **Drizzle Kit**: For database migrations.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Development tools for smart contracts.

### Fonts
- Google Fonts CDN: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network.
  - **Dynamic Address Resolution**: AssetManager addresses retrieved dynamically from Flare Contract Registry using `@flarenetwork/flare-periphery-contract-artifacts` package.
  - **Registry Key**: "AssetManagerFXRP" (same for all networks).
  - **AssetManager Addresses** (as of Nov 2024):
    - Flare Mainnet: 0x2a3Fe068cD92178554cabcf7c95ADf49B4B0B6A8
    - Coston2 Testnet: 0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA
  - **FXRP Token Addresses**:
    - Flare Mainnet: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
    - Coston2 Testnet: 0x0b6A3645c240605887a5532109323A3E12273dc7
  - **Helper Script**: `scripts/get-assetmanager-address.ts` - Verifies Contract Registry lookups and displays current addresses.
  - **Zero-Address Validation**: FAssetsClient validates registry responses to prevent initialization with invalid addresses.
  - **FDC Attestation**: Payment proof generation using Flare Data Connector with public test API key (00000000-0000-0000-0000-000000000000) for development/testing.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.

## Recent Updates (November 2024)

### Payment Detection & Processing Improvements
- **Historical Transaction Detection**: Extended XRPL listener lookback window from 5 to 15 minutes to catch payments made before listener subscription.
- **Manual Reconciliation**: Added `POST /api/bridges/:id/reconcile-payment` endpoint for manual payment verification when automatic detection fails.
- **FDC Authentication**: Fixed 401 Unauthorized errors by adding X-API-KEY header to FDC proof generation requests.
- **WalletConnect Auto-Payment**: Implemented proper session restoration with lazy SDK loading, timeout guards, and bundle optimization for seamless cross-page UX.
- **WalletConnect Provider Guard**: Fixed auto-payment triggering by adding guard condition to verify WalletConnect provider instance is initialized before calling requestPayment. Prevents silent failures when provider state is incomplete.
- **Manual Payment UX**: Added destination address and MEMO display to both BridgeStatusModal (post-deposit) and BridgeStatus component (Bridge Tracking page) for "awaiting_payment" state. Users can now see exact payment details for manual testing and fallback workflows.
  - **Hex-Encoded MEMO Fix**: Fixed "Invalid payment reference" wallet errors by displaying MEMO in hex-encoded format (required by XRPL). Uses browser-safe TextEncoder API to match server-side Buffer encoding. Includes copy-to-clipboard buttons for easy manual payment submission.
  - **BridgeStatusModal Enhancement**: Modal now displays destination address, hex-encoded MEMO, and destination tag instructions immediately after deposit creation, with copy buttons for seamless manual payment flow.
- **Enhanced Error Messaging**: Added detailed logging and user-facing toast notifications when auto-payment skips due to incomplete wallet connection state.
- **Comprehensive Deposit Flow Logging**: Added detailed console logging throughout deposit flow to track provider state, walletConnectProvider status, and auto-payment trigger conditions for easier debugging.

### FDC Proof Flow Implementation (November 12, 2024)
- **Complete FDC Verifier Integration**: Implemented end-to-end FDC proof generation using FDC Verifier API (`/api/proof/get-specific-proof`) instead of self-hosted DA Layer infrastructure.
- **Transaction Indexing Retry Logic**: Added retry/polling logic to prepareRequest endpoint (10 attempts, 3-second intervals, 30s max) to wait for XRPL transactions to be indexed by FDC Verifier before proof generation.
- **Production-Ready Timestamp Handling**: 
  - Validates transaction is finalized (`validated: true`)
  - Extracts timestamp from multiple possible locations in XRPL response
  - Normalizes using `Number()` to prevent string concatenation errors
  - Implements sanity checks (not future-dated, not >1 year old)
  - Comprehensive error messages for debugging
- **Voting Round Calculation**: Uses XRPL transaction timestamp (not current time) with correct formula: `roundId = floor((timestamp - roundOffset) / roundDuration)` and Coston2 parameters (90s duration, 0s offset).
- **Database Schema Extensions**: Added FDC tracking fields: `votingRoundId`, `abiEncodedRequest`, `fdcProofData` to `xrp_to_fxrp_bridges` table.
- **Attestation Format Fix**: Corrected attestationType and sourceId to proper hex-encoded values (0x5061796d656e74... and 0x7465737458525000...) per Flare documentation.
- **Enhanced Error Logging**: Added detailed stack traces and structured logging for all FDC proof generation steps.
- **FDC Verifier API Workflow**: prepareRequest (with retry) → extract voting round from XRPL tx timestamp → poll FDC Verifier for finalized proof (15-second intervals).

### Bridge Tracking UI Consolidation (November 12, 2024)
- **Tabbed Interface**: Redesigned Bridge Tracking page (`client/src/pages/BridgeTracking.tsx`) with three tabs: Active, Completed, Failed.
- **Mutually Exclusive Filtering**: Implemented priority-based filtering logic to ensure each bridge appears in exactly one tab:
  - **Failed (highest priority)**: Bridges with `status === "failed"` OR `errorMessage !== null` (any bridge with an error)
  - **Completed**: Bridges with `status === "completed"` AND no error message (successfully finished operations)
  - **Active**: In-progress bridges (`awaiting_payment`, `xrpl_confirmed`, `proof_generated`, `minting`) without errors
- **Navigation Consistency**: Renamed sidebar label from "Bridge History" to "Bridge Tracking" to match page route and purpose.
- **Improved UX**: Page title and tabs now visible even when wallet is disconnected, with helpful "Connect wallet" messaging in each tab content.
- **Badge Counts**: Each tab shows real-time count of bridges in that category (e.g., "Active (2)").
- **Empty States**: Contextual messages for each tab when no bridges exist, guiding users on what to expect.