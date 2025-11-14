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
    - `ShXRPVault.sol`: ERC-4626 tokenized vault for shXRP with multi-strategy support, buffer-aware withdrawals.
    - `VaultController.sol`: Orchestrates vault operations, role-based access control.
    - `KineticStrategy.sol`: IStrategy implementation stub for Kinetic FXRP lending (5-6% APY).
    - `FirelightStrategy.sol`: IStrategy implementation stub for Firelight stXRP staking (disabled, Q1 2026 launch).
    - `MockStrategy.sol`: Test implementation for multi-strategy unit tests.

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

## Recent Progress (November 14, 2025)

### Phase 1.8: Multi-Strategy Unit Tests ✅ COMPLETE
- **23 comprehensive tests passing** covering all buffer-aware withdrawal edge cases
- Test framework: Hardhat 3.0 with TypeScript/Mocha integration (fixed HHE1200 error)
- MockStrategy contract: Full IStrategy implementation with 6-decimal FXRP math
- Edge cases tested: ODD amounts, over-delivery, capped requests, strategy failures, proportional allocation
- Files: `test/ShXRPVault.MultiStrategy.test.ts`, `contracts/test/MockStrategy.sol`

### Phase 2.1: KineticStrategy Implementation ✅ COMPLETE (Stub)
- **IStrategy compliant stub** for Kinetic FXRP lending integration
- Accounting: `totalDeployedAmount` (principal) + `accumulatedYield` (yield) + `reportInitialized` flag
- Pull-based deploy() pattern, yield-aware withdraw(), incremental report()
- Events: DeployedToStrategy, WithdrawnFromStrategy, StrategyReport (interface compliant)
- Configuration: setKineticConfig(cToken, comptroller) - needs actual Kinetic contract addresses
- Testing: simulateYield(amount) function for unit tests
- Status: Ready for Kinetic protocol integration when addresses available
- File: `contracts/KineticStrategy.sol` (269 lines)

### Phase 2.2: FirelightStrategy Implementation ✅ COMPLETE (Stub)
- **Same accounting pattern** as KineticStrategy with added unstaking delay handling
- Configured for Firelight stXRP staking (Q1 2026 launch)
- Additional features: getStXRPToFXRPRate(), claimUnstaking(), UnstakingInitiated event
- Status: Disabled by default until Firelight launches
- File: `contracts/FirelightStrategy.sol` (324 lines)

### Strategy Accounting Model (Finalized)
```solidity
// State Variables
uint256 private totalDeployedAmount;  // Principal deposited
uint256 private accumulatedYield;     // Yield earned
uint256 private lastReportedAssets;   // Baseline for incremental reporting
bool private reportInitialized;       // First-report flag

// Operations
deploy() → increment principal
withdraw() → decrement yield first, then principal
report() → if !initialized: seed baseline, return (0,0,assets)
         → else: calculate incremental profit/loss, update baseline
totalAssets() → return principal + yield
```

### Outstanding Work
- **Task 11**: Deploy strategies to Coston2 testnet for integration testing
- **Task 12**: Update VaultController with strategy coordination logic
- **Configuration Needed**:
  - Kinetic: cFXRP contract address, Comptroller address
  - Firelight: Staking contract, stXRP token, oracle (Q1 2026)
- **Legacy Tests**: 7 failing tests due to deprecated setFirelightVault() function (cleanup deferred)