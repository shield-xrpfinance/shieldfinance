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

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Fee Disclosure**: Transparent fee system implemented for all deposits.
- **Automated Withdrawal System**: Complete async withdrawal automation with ENS resolution, background processing, XRPL payment detection, FDC proof generation, and real-time status tracking.
- **Production Publishing Optimization**: Fast server startup, asynchronous service initialization, dual health endpoints (`/healthz`, `/readyz`), and API readiness guards to resolve Replit publishing health check timeout issues.
- **Decimal Mismatch Resolution**: Corrected FXRP decimal handling (6 decimals) in `ShXRPVault` and related services.

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
- **Drizzle ORM**: Database schema defined in `shared/schema.ts`. Replit automatically syncs schema changes to production using `drizzle-kit push` during publishing.
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

## Publishing & Deployment

### Production-Ready Publishing (November 14, 2025)

**Database Schema Management**:
- Replit automatically handles database migrations using `drizzle-kit push`
- Schema is defined in `shared/schema.ts` and auto-synced during publishing
- No manual migration files needed - Replit's publishing system reads schema directly
- Changes are safely applied to production database on deployment

**Schema Sync Troubleshooting**:
If publishing fails with `"Failed to validate database migrations"` showing `ALTER TABLE ADD COLUMN` for a column that already exists:
- **Root Cause**: Schema tracking desync between Drizzle's metadata and actual database state
- **Solution**: Run `npm run db:push --force` to forcefully sync schema tracking
- **What it does**: Updates Drizzle's internal migration tracking without altering table structure
- **When safe**: When the column exists in both dev/production databases but tracking is out of sync
- **Effect**: Eliminates phantom migrations and allows publishing to proceed

**Fast Server Startup (<1 second)**:
- HTTP server starts immediately after storage initialization (port 5000)
- Blockchain services (FlareClient, XRPL, FAssets) initialize asynchronously in background
- Health endpoints respond instantly while services finish initialization
- Files: `server/index.ts`, `server/services/ReadinessRegistry.ts`

**Dual Health Endpoints**:
- `/healthz` - Liveness probe: Returns 200 OK instantly if HTTP server running
- `/readyz` - Readiness probe: Returns 200 when all critical services ready (~5s)
- API routes protected by readiness guards during initialization window

**Key Files**:
- `server/index.ts`: Async startup orchestration with retry/backoff
- `server/routes.ts`: Health endpoints + API readiness middleware
- `server/services/ReadinessRegistry.ts`: Per-service status tracking
- `shared/schema.ts`: Database schema (automatically synced by Replit)