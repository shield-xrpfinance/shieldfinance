# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, with FAssets protocol for cross-chain XRP bridging to Flare. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. It features a dual wallet architecture providing tailored experiences for XRPL (Xaman/XUMM) and EVM (Reown AppKit/MetaMask) users, showing XRP or FXRP vaults respectively. The project also has ambitions for future integration of Real World Assets (RWA) and tokenized securities.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## Recent Changes (December 3, 2025)

### Firelight Protocol Integration (Multi-Strategy Yield)
**Backend Infrastructure**
- Created `server/config/network-config.ts` for network-aware configuration (mainnet vs coston2)
  - Automatic detection via FLARE_NETWORK environment variable
  - Feature flags for Firelight enablement (mainnet-only)
  - Centralized contract addresses per network
- Created `server/services/FirelightDataService.ts` for querying OUR vault's Firelight allocation
  - CRITICAL: Displays only our protocol's deployed amount, NOT Firelight's global $35M+ TVL
  - ERC-4626 vault integration for stXRP staking position queries
  - Strategy allocation breakdown: Buffer (10%), Kinetic (40%), Firelight (50%)

**API Endpoints Added (routes.ts)**
- `GET /api/strategies/allocation`: Strategy breakdown with our vault's deployed amounts
- `GET /api/strategies/firelight`: Firelight-specific metrics (mainnet only)
- `GET /api/network/config`: Current network configuration and enabled features

**Frontend Components**
- Created `StrategyAllocationCard.tsx`: Visual breakdown of vault yield strategies
  - Shows Buffer (idle FXRP), Firelight stXRP, Kinetic Lending allocations
  - Progress bars for each strategy's percentage
  - "Powered by Firelight" external link for transparency
- Created `FirelightBadge.tsx`: Reusable badge component for Firelight-powered features
- Updated `Dashboard.tsx`: Integrated StrategyAllocationCard in two-column grid with PortfolioPerformanceChart

**Smart Contract Updates (contracts/FirelightStrategy.sol)**
- Rewrote with real ERC-4626 integration using deposit/redeem methods
- Uses actual Firelight stXRP vault: 0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3 (mainnet)
- TransparentUpgradeableProxy audited by OpenZeppelin + Coinspect

**Key Files Modified**
- shared/flare-contracts.ts: Added mainnet Firelight stXRP vault address
- shared/flare-abis.ts: Contains ERC-4626 vault ABI for stXRP interaction
- server/config/network-config.ts: Network configuration and feature flags
- server/services/FirelightDataService.ts: Strategy allocation data service
- client/src/components/StrategyAllocationCard.tsx: Strategy visualization
- client/src/components/FirelightBadge.tsx: Firelight attribution badge
- client/src/pages/Dashboard.tsx: Dashboard layout with strategy card

---

### Wallet Address Handling Fix
**Critical Bug Fix: SHIELD Staking Data Display**
- Fixed issue where Dashboard, Portfolio, and Vaults pages showed 0 SHIELD staking data despite database having correct records
- Root cause: Components were passing XRPL address (`address`) instead of EVM address (`evmAddress`) for staking-related queries
- SHIELD staking occurs on Flare (EVM), so data is stored with EVM addresses (0x...)

**Frontend Changes**
- Dashboard.tsx: Changed `address` to `evmAddress || address` for PortfolioSummaryCard, BoostImpactBanner, and PortfolioPerformanceChart
- Portfolio.tsx: Changed `address || evmAddress` to `evmAddress || address` for dashboard data queries
- Vaults.tsx: Changed `address || evmAddress` to `evmAddress || address` for boost percentage display

**Database Query Case Sensitivity**
- Fixed Ethereum address comparison to be case-insensitive (addresses are hex, so case doesn't matter)
- Added `lower()` SQL function to these storage.ts methods:
  - `getStakeInfo()`: For SHIELD staking position lookups
  - `recordUnstake()`: For unstaking operations
  - `getDashboardSnapshots()` and `getLatestDashboardSnapshot()`: For portfolio history
  - `getPositions()` and `getPositionByWalletAndVault()`: For vault position lookups
  - `getTransactions()`: For transaction history

**Verification**
- Both mixed-case (0x507D8535bc...) and lowercase (0x507d8535bc...) addresses now return identical results
- Dashboard correctly shows SHIELD staking balance, APY boost percentage, and vault positions

---

## Changes (December 2, 2025)

### Bridge Tracking Enhancements
**Multi-Chain Bridge History Integration**
- Enhanced Bridge Tracking page to display multi-chain bridge operations (FSwap widget transactions) alongside FAssets bridges
- Added unified history view combining both bridge types in a single History tab
- Multi-chain bridges now display with ArrowLeftRight icon in purple, showing source → destination networks
- Each multi-chain bridge displays source and destination token amounts with conversion info
- FAssets bridges continue to display with green (deposit) or blue (withdrawal) icons
- History count badges now include both FAssets and multi-chain bridge totals

**Bridge Tracking Component Updates**
- Updated `BridgeTracking.tsx` to import `CrossChainBridgeJob` type from schema
- Added TanStack Query for fetching cross-chain bridge jobs: `/api/bridge/jobs/${walletAddress}`
- Fixed wallet address detection for EVM users (was only checking XRPL address, now uses combined `walletAddr`)
- Created reusable `HistorySection` component that accepts both history and crossChainJobs
- Renders multi-chain jobs first (purple icon), followed by FAssets bridge history
- Both Accordion (mobile) and Tabs (desktop) layouts properly display unified history

**Frontend Components**
- Added ArrowLeftRight icon import from lucide-react for multi-chain bridge visual distinction
- Multi-chain bridges display with outline variant badge and custom border/text styling
- Maintains consistent card-based layout matching existing FAssets bridge display
- Error messages and transaction details properly formatted for both bridge types

**Bug Fixes**
- Fixed React hooks violation in `Bridge.tsx`: moved `useMutation` hook before conditional returns to comply with Rules of Hooks
- Corrected address prop passed to HistorySection (was `address` for XRPL-only, now uses `walletAddr` for both wallet types)

### Integration Pattern
FSwap widget → Bridge.tsx onSwapComplete callback → `/api/bridge/fswap-complete` endpoint → notification creation + crossChainBridgeJobs table logging → Bridge Tracking history display

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, modern list-based layouts, and Glassmorphism design elements.
- **State Management**: React Context API, TanStack Query, React hooks.
- **Wallet Architecture**: Dual-ecosystem wallet support (`xaman`, `walletconnect` for XRPL, `reown` for EVM) with wallet-type-aware vault filtering.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates, consolidated position display with aggregated rewards, and a Shepherd.js-based guided tour.
- **Dashboard Enhancements**: Real-time vault balances (PortfolioSummaryCard), historical performance charts (PortfolioPerformanceChart), SHIELD boost impact displays (BoostImpactBanner), persistent notification center (NotificationCenter) with triggers for deposits/withdrawals/staking/rewards/bridge operations, and unified bridge tracking with multi-chain support.
- **Security**: UAE Geo-Blocking for VARA compliance.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.
- **Automated Systems**: FAssets bridge reconciliation, automated withdrawal system, deposit watchdog, withdrawal retry services, and multi-chain bridge tracking.
- **Analytics & Monitoring**: Revenue transparency analytics, testnet monitoring with real-time 24-hour sliding window metrics, and alerting system.
- **Production Readiness**: Fast server startup, asynchronous service initialization, health endpoints, API readiness guards, API rate limiting, and RPC failover utility.
- **Self-Healing Infrastructure**: ServiceSupervisor with auto-restart, ResilientRpcAdapter with multi-endpoint failover, XrplConnectionPool with automatic reconnection, CacheFallbackService for graceful degradation, ReconciliationService for state consistency, and FeatureFlagService for dynamic feature control.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema covering vaults, positions, transactions, dashboard snapshots, user notifications, cross-chain bridge jobs, and various system states.

### System Design
- **Separation of Concerns**: Monorepo structure (`/client`, `/server`, `/shared`).
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **Asset Configuration**: Network-aware asset configuration system for automatic token switching between mainnet and testnet, supporting crypto assets and future RWA/tokenized securities.
- **Smart Contracts (Solidity on Flare Network)**: Developed with Hardhat and OpenZeppelin Contracts. Key contracts include `ShXRPVault.sol` (ERC-4626), `VaultController.sol`, `StakingBoost.sol`, `RevenueRouter.sol`, and `ShieldToken.sol`.
- **StakingBoost ↔ ShXRPVault ↔ RevenueRouter Architecture**: A circular dependency solution for deploying and linking these core contracts for yield boosting and fee distribution.
- **Airdrop System**: Faucet API and MerkleDistributor contract for SHIELD token distribution.
- **Multi-Asset Swap**: Full swap feature with SparkDEX V3 router.
- **Multi-Chain Bridge**: Luminite FSwap widget integration for bridging assets across XRPL, Flare, Ethereum, Base, Arbitrum, and other chains.

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
- **Luminite FSwap Widget**: Multi-chain bridge widget for cross-network asset transfers.

### RWA & Tokenized Securities (Future Integration)
- **RWA.xyz Integration**: Planned for real-world asset data feeds.

## Analytics Data Architecture

### Current State
- **TVL**: Live data from VaultDataService.getLiveTVL() which reads totalAssets from blockchain via flareClient
- **APY Tiers**: Calculated from vault data with SHIELD boost multipliers (Stable: base APY, High: 1.25x boost, Maximum: 1.50x boost)
- **On-Chain Events**: Stored in database by OnChainMonitorService, provides real-time event monitoring
- **Bridge Operations**: Real-time tracking of FAssets and multi-chain bridge jobs with status updates

### Historical Data Limitations
The testnet currently has no historical data infrastructure. Analytics endpoints return:
- Current month: Live blockchain data (TVL, APY)
- Historical months: `null` to indicate no verified data exists

### Future Enhancement: Live APY from Snapshots
True live APY calculation requires a vault metrics snapshot system:
1. **Snapshot Pipeline**: OnChainMonitorService should persist periodic pricePerShare readings to a vault_metrics table
2. **APY Calculation**: Use formula `((pps_latest / pps_previous)^(seconds_in_year / delta_seconds) - 1) * 100` 
3. **LiveApyService**: New service to calculate trailing APY from snapshots (24h, 7d windows)
4. This would replace the current storage-seeded APY values with true blockchain-derived metrics

## Files Modified (December 2, 2025)
- `client/src/pages/BridgeTracking.tsx`: Enhanced with multi-chain bridge history display
- `client/src/pages/Bridge.tsx`: Fixed React hooks violation
