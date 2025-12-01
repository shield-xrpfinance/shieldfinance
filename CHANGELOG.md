# Changelog

All notable changes to the XRP Liquid Staking Protocol Dashboard will be documented in this file.

## [2.2.0] - 2025-12-01

### Dashboard Enhancements - Real-Time Portfolio Analytics & Notifications

Comprehensive dashboard upgrade providing users with real-time portfolio insights, SHIELD boost visibility, and automated notifications across their entire DeFi journey.

#### New Components

**PortfolioSummaryCard** (`client/src/components/dashboard/PortfolioSummaryCard.tsx`)
- Real-time display of total assets, staked amounts, pending rewards, and SHIELD boost contribution
- USD value calculations using live price feeds
- Skeleton loading states during data fetching
- Responsive card layout with data-testid attributes

**PortfolioPerformanceChart** (`client/src/components/dashboard/PortfolioPerformanceChart.tsx`)
- Historical performance visualization using Recharts
- Time range selectors: 7D, 30D, 90D views
- Trend indicators showing portfolio growth
- Responsive chart with proper dark mode support

**BoostImpactBanner** (`client/src/components/dashboard/BoostImpactBanner.tsx`)
- Side-by-side comparison of base APY vs boosted APY
- Visual delta indicator showing boost benefit
- SHIELD staking call-to-action for non-stakers
- Boost calculation: +1% APY per 100 SHIELD staked (max 50%)

**NotificationCenter** (`client/src/components/dashboard/NotificationCenter.tsx`)
- Persistent bell icon in header with unread count badge
- Popover panel displaying recent notifications
- Mark as read functionality (individual and batch)
- Categorized notifications: deposits, withdrawals, rewards, staking

#### Backend Infrastructure

**API Endpoints**
- `GET /api/user/dashboard-summary` - Aggregated portfolio data with boost calculations
- `GET /api/user/portfolio-history` - Historical snapshots for charts
- `GET /api/user/notifications` - Paginated notification retrieval
- `PATCH /api/user/notifications/:id/read` - Mark notification as read
- `POST /api/user/notifications/mark-all-read` - Batch mark as read

**Database Schema Updates** (`shared/schema.ts`)
- Added `dashboardSnapshots` table for historical data
- Added `userNotifications` table with types: deposit, withdrawal, reward, staking, system
- Insert/select schemas with Zod validation

**Notification Triggers** (`server/routes.ts`, `server/storage.ts`)
- Deposit completion: Triggered when bridge status reaches `vault_minted`
- Withdrawal completion: Triggered when redemption `userStatus` becomes `completed`
- Staking operations: Triggered on stake/unstake SHIELD actions
- Reward claims: Triggered when user claims vault rewards

#### Frontend Hooks

- `useUserDashboard` - Dashboard summary with health-aware polling
- `usePortfolioHistory` - Historical data with time range state
- `useNotifications` - Notification management with mutations

#### Page Integrations

**Dashboard Page**
- Integrated PortfolioSummaryCard, PortfolioPerformanceChart, BoostImpactBanner
- Grid layout optimized for dashboard overview

**Vaults Page**
- Added SHIELD boost indicators per vault
- APY displays showing base vs boosted rates
- Interactive tooltips explaining vault mechanics

**Portfolio Page**
- SHIELD boost delta per position
- Reward explanations with tooltips
- Fee breakdowns with educational content

**Staking Page**
- Boost effect preview showing impact on vault yields
- Before/after APY comparison table
- SHIELD boost calculation visualization

#### Interactive Tooltips

Expanded `client/src/lib/tooltipCopy.ts` with comprehensive explanations for:
- Fee structures (deposit, withdrawal, performance)
- Reward mechanics (base yield, boost rewards, compounding)
- SHIELD boost formula and maximum values
- Risk tier explanations
- Lock period details

#### Technical Details

| Feature | Implementation |
|---------|---------------|
| Polling Interval | 30 seconds for dashboard, 10 seconds for notifications |
| Boost Formula | +1% APY per 100 SHIELD staked, max 50% boost |
| Notification Types | deposit, withdrawal, reward, staking, system |
| Time Ranges | 7D, 30D, 90D for performance charts |
| Price Feeds | XRP, FXRP, SHIELD, FLR via PriceService |

#### Bug Fixes

- Fixed withdrawal notification NaN issue by prioritizing `updates.xrpSent` over stale record values
- Added guards against zero/NaN amounts in notification messages
- Prevented duplicate notifications with status-change checks

---

## [2.1.0] - 2025-11-27

### Stake SHIELD → Boost shXRP Yield Feature Complete

Production-ready implementation of differentiated yield for SHIELD stakers. Users lock SHIELD tokens for 30 days to receive proportional FXRP rewards that mint additional shXRP shares, creating enhanced yield for stakers vs non-stakers.

#### Smart Contract Updates

**StakingBoost.sol - Synthetix-Style Reward Accumulator**
- Implemented O(1) gas-efficient `rewardPerTokenStored` accumulator pattern
- `distributeBoost(uint256 fxrpAmount)`: Called by RevenueRouter to add FXRP rewards
- `earned(address account)`: View function returning pending FXRP rewards
- `claim()`: Claims pending rewards → calls `vault.donateOnBehalf()` to mint shXRP
- `claimAndWithdraw(uint256 amount)`: Convenience function for claim + withdraw in one tx
- Admin functions: `setGlobalBoostCap()`, `setRevenueRouter()`, `recoverTokens()`
- Events: `Staked`, `Withdrawn`, `RewardDistributed`, `RewardClaimed`
- Lock period: 30 days (2,592,000 seconds)
- Security: ReentrancyGuard, onlyOwner access controls, CEI pattern

**ShXRPVault.sol - Circular Dependency Solution**
- Changed `stakingBoost` from immutable to one-time settable
- Added `setStakingBoost(address)`: Owner-only, one-time setter (solves circular dependency)
- Added `donateOnBehalf(address user, uint256 fxrpAmount)`: 
  - Access-controlled to StakingBoost only
  - Transfers FXRP from caller, mints shXRP shares to specified user
  - Enables differentiated yield for stakers
- Events: `StakingBoostUpdated`, `DonatedOnBehalf`

**RevenueRouter.sol - Revenue Allocation Update**
- Updated revenue split: 50% burn / 40% boost / 10% reserves
- `boostAllocationBps`: Configurable (default 4000 = 40%)
- `_swapAndDistributeBoost()`: Swaps wFLR → FXRP → StakingBoost.distributeBoost()
- `setBoostAllocation(uint256 bps)`: Admin function with validation

#### Deployment Flow (Solving Circular Dependency)

Three-step deployment sequence required:
1. Deploy ShXRPVault with `stakingBoost = address(0)`
2. Deploy StakingBoost with real vault address
3. Call `vault.setStakingBoost(stakingBoostAddress)`

#### Boost Formula (Matches PDF Specification)

```
Boost APY = Base APY + (Annual Protocol Revenue → FXRP) × (Your Locked SHIELD ÷ Total Locked SHIELD)
```

- 100% of boost allocation distributed pro-rata to SHIELD lockers
- No minting, no inflation - pure revenue-share
- Synthetix accumulator ensures fair late-joiner calculations

#### Test Coverage

**test/boost-flow.ts** - 16 comprehensive tests:
- Tests 1-4: Reward accumulator math validation
- Tests 5-8: claim() → donateOnBehalf() integration
- Tests 9-12: End-to-end flow with differentiated yield
- Security tests: Reentrancy protection, access control, edge cases

#### Technical Specifications

| Parameter | Value |
|-----------|-------|
| Lock Period | 30 days |
| Revenue to Boost | 40% |
| Revenue to Burn | 50% |
| Revenue to Reserves | 10% |
| Global Boost Cap | 25% (2500 bps) |
| Gas Complexity | O(1) per claim |

#### Documentation Updates
- `docs/protocol/STAKING_BOOST_SPEC.md`: Complete technical specification
- `DEPLOYMENT_GUIDE.md`: Three-step deployment flow with code examples
- `docs/protocol/SHIELD_TOKENOMICS.md`: Updated revenue allocation diagrams
- `REVIEWERS.md`: Added staking boost section for auditors
- `README.md`: Updated "Stake $SHIELD" section with new formula

---

## [2.0.0] - 2025-11-23

### ✅ Testnet Launch Complete - 10M SHIELD Deployment Corrected & All Contracts Live

#### Critical Fix
- **SHIELD Token Supply Correction**: Previous deployments used incorrect 100M supply
  - ❌ Deprecated: 3 contracts with 100M supply each (ownership renounced)
  - ✅ Active: New SHIELD token with correct 10M supply
  - **New Address**: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`

#### Successful Deployments (All 5/5 Complete)
1. **SHIELD Token** (10M supply): `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616` ✅
2. **ShXRPVault** (ERC-4626): `0x3219232a45880b79736Ee899Cb3b2f95D527C631` ✅
3. **RevenueRouter**: `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB` ✅
4. **StakingBoost**: `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4` ✅
5. **MerkleDistributor**: `0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490` ✅

#### Airdrop Configuration
- **Total Allocation**: 2,000,000 SHIELD (20% of 10M supply)
- **Eligible Addresses**: 20 wallets
- **Amount Per Address**: 100,000 SHIELD
- **Status**: ✅ MerkleDistributor funded and ready for claims
- **Merkle Root**: `0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4`

#### Deprecated Contracts (Renounced)
- `0xD6D4768Ffac6cA26d5a34b36555bDB3ad85B8308` - First 100M deployment (renounced)
- `0x59fF3b46f0Fa0cF1aa3ca48E5FC0a6f93e2B8209` - Second 100M deployment (renounced)
- `0x07F943F173a6bE5EC63a8475597d28aAA6B24992` - Third 100M deployment (renounced)

#### Documentation Updates
- **DEPLOYMENT_GUIDE.md**: Updated with new 10M addresses and deprecation warnings
- **.env.example**: All contract addresses corrected
- **README.md**: Environment variables section updated with new addresses
- **deployments/**: Complete deployment records with explorer links
- **ENV_UPDATES_10M.md**: Migration guide for all environment variables

#### Next Steps
- Update Replit Secrets with new contract addresses
- Users can claim airdrop from MerkleDistributor
- Monitor contract events for deposits/withdrawals
- All infrastructure ready for testnet operations

#### Transaction Records
- **SHIELD Token**: Deployed November 23, 2025
- **ShXRPVault**: Deployed November 23, 2025
- **RevenueRouter**: Deployed November 23, 2025
- **StakingBoost**: Deployed November 23, 2025
- **MerkleDistributor Funding**: `0x74905c13c3359294545ee2ac111b3b2214b4f0a9bee787f36d105bcb7b446e1f`
- **Old SHIELD Renouncement**: `0x271b89ff5ba9cf3a9a2a43e3a65ab71bd3b419558edeecaaf7c3cd2b9c2da66a`

---

## [1.4.0] - 2025-11-21

### 🔄 Multi-Asset Swap Feature - Complete SparkDEX V3 Integration

#### New Features
- **Bidirectional Token Swaps**: Buy and sell SHIELD with FLR, wFLR, or USDT
  - Buy direction: FLR/wFLR/USDT → SHIELD
  - Sell direction: SHIELD → FLR/wFLR/USDT
  - Dynamic asset selection with balance-aware UI
  - Buy/Sell toggle for seamless direction switching

- **SparkDEX V3 Integration**: Uniswap V2-compatible DEX integration on Flare Network
  - Real-time price quotes via getAmountsOut
  - Optimal swap path construction (direct and multi-hop routing)
  - 0.5% slippage tolerance with price impact warnings
  - Three swap methods: swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens

- **ERC-20 Approval Flow**: Smart token approval system
  - Pre-flight allowance checking before swap attempts
  - Unlimited approval option (MaxUint256) to reduce repeat approvals
  - Exact amount approval for security-conscious users
  - Clear UI feedback during approval process
  - Approval state tracking with "Needs Approval" alerts

- **AssetSelector Component**: Reusable multi-asset selection dropdown
  - Token icons with AssetIcon integration (FLR, wFLR, USDT, SHIELD)
  - Real-time balance display with safe formatting
  - Crash-proof balance guards (formatBalance helper)
  - Disabled state during swap/approval operations

#### Safety Features
- **Swap Path Validation**: Pre-execution route checking
  - Detects missing liquidity pools before transaction
  - Validates multi-hop routes (e.g., USDT → wFLR → SHIELD)
  - Clear error messaging for unsupported pairs
  - Swap button disabled when validation fails

- **Liquidity Detection**: Real-time pool availability checks
  - Catches "INSUFFICIENT_LIQUIDITY" errors from router
  - User-friendly warnings with suggested alternatives
  - Prevents failed transactions and wasted gas

- **Balance Guards**: Comprehensive null/undefined protection
  - formatBalance() helper with NaN checks
  - Loading state handling ("..." display)
  - Prevents crashes from missing balance data

#### UX Improvements
- **Post-Swap Celebration**: Confetti animation on successful swaps
- **Success Modal**: Transaction confirmation with staking call-to-action
- **Real-Time Stats**: Dynamic balance display in sidebar (updates with selected asset)
- **Exchange Rate Display**: Live price quotes with price impact percentage
- **Responsive Feedback**: Loading states for quotes, approvals, and swaps

#### Technical Implementation
- **New Components**:
  - `client/src/components/AssetSelector.tsx` - Multi-asset selection dropdown
  - `client/src/lib/sparkdex.ts` - SparkDEX V3 router integration

- **Updated Pages**:
  - `client/src/pages/Swap.tsx` - Complete bidirectional swap implementation
  - Removed hardcoded FLR-only swaps
  - Added dynamic asset lists and routing logic
  - Integrated approval flow with unlimited option

#### Contract Addresses (Flare Mainnet)
- **WFLR**: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
- **USDT**: 0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f
- **SparkDEX V3 Router**: 0x4DaE0a4ec7e360Af1a4705F558bfBd79c8c005a8

#### Documentation
- **New**: docs/features/swap.md - Complete swap feature documentation
- **Updated**: replit.md - Multi-Asset Swap Integration section
- **Updated**: README.md - Features and Tech Stack
- **Updated**: docs/DOCUMENTATION_INDEX.md - Swap use case paths

#### Expected Impact
- 3-5× increase in staking adoption via instant SHIELD acquisition
- Reduced friction for new users (no external DEX required)
- Enhanced liquidity for SHIELD token ecosystem

---

## [1.3.0] - 2025-11-21

### 🚀 Shield Finance Fair Launch - Complete Documentation & Production-Ready Deployment

#### New Documentation (400+ Lines)
- **SHIELD_DEPLOYMENT.md**: Comprehensive 7-step deployment guide with verification commands
  - Pre-deployment checklist (environment setup, security requirements, testnet validation)
  - Step-by-step deployment sequence (ShieldToken → RevenueRouter → StakingBoost → MerkleDistributor)
  - SparkDEX V3 liquidity integration (1M SHIELD + 535,451 wFLR = $10K)
  - LP NFT locking for 12 months
  - Post-deployment verification and automated checks
  - Emergency procedures for critical issues
  - Deployment cost estimates (~5 FLR recommended)

- **SHIELD_SECURITY_CHECKLIST.md**: Comprehensive pre-launch security checklist
  - 8 major sections with 100+ items
  - Smart contract security (audit, test coverage, verification) - 176/176 tests ✅
  - Deployment security (private key management, sequence verification)
  - Operational security (burn automation, monitoring)
  - Economic security (fair launch economics, liquidity lock)
  - Communication & transparency guidelines
  - Legal compliance requirements
  - Emergency procedures and incident response
  - Sign-off section for deployment approval

#### Production-Ready Deployment Script
- **scripts/deploy-shield-finance.ts**: Complete Shield Finance deployment script
  - ✅ All critical bugs fixed (MerkleDistributor variable scope, address retrieval, SparkDEX integration)
  - Deploys all 4 contracts: ShieldToken, RevenueRouter, StakingBoost, MerkleDistributor
  - Network detection (Flare mainnet vs Coston2 testnet)
  - Comprehensive verification after each deployment
  - Safety checks (balance, supply, constructor parameters, lock periods)
  - Deployment info saved to JSON with block explorer links
  - Helpful next steps and verification commands
  - ⚠️ Deprecates outdated deploy-flare.ts (uses wrong ShieldToken constructor)

#### Bug Fixes
- Fixed MerkleDistributor variable scope bug (prevented variable access outside if block)
- Fixed address retrieval bug (was getting MerkleDistributor address from ShieldToken)
- Added SparkDEX V3 liquidity deployment integration with clear instructions
- Added MerkleDistributor funding step with cast command for 2M SHIELD transfer
- Added deprecation warning for deploy-flare.ts
- All deployment verification commands now use correct contract addresses

#### Test Coverage Status
- ✅ **176/176 tests passing** (100% coverage)
- ✅ **78 adversarial/security tests** for attack scenarios
- ✅ All critical bugs verified as fixed
- ✅ Production-ready for testnet and mainnet deployment

#### Next Steps Before Mainnet
1. Generate merkle tree for airdrop (2M SHIELD with 2M addresses max)
2. Deploy to Coston2 testnet and verify all contracts
3. External audit recommended (CertiK, Trail of Bits, OpenZeppelin)
4. Community testing period (1-2 weeks)
5. Mainnet deployment with verified contracts and audit report

---

## [1.2.0] - 2025-11-20

### 🔒 Security - Wallet-Scoped Transaction History

#### Critical Security Fix
- **Transaction Privacy**: Implemented complete end-to-end wallet authentication for transaction history access
  - Added `wallet_address varchar NOT NULL` column to transactions table
  - API endpoints now REQUIRE wallet parameter (returns 400 error if missing)
  - Direct column filtering prevents JOIN-based security bypasses
  - All transaction creation (deposits, claims, withdrawals) includes wallet address
  - Users can only access their own transaction data

#### Database Changes
- **Schema Update**: Added `wallet_address` column to transactions table with backfill migration
- **Storage Layer**: Updated `getTransactions()` and `getTransactionSummary()` to filter directly by `wallet_address` column
- **Service Layer**: Updated BridgeService and VaultService transaction creation to include wallet address

### 🎨 UX - Withdrawal History Consolidation

#### UI/UX Improvements
- **Portfolio Page**: Streamlined to show only active positions + in-flight withdrawal alert banner
- **Transaction History Page**: Now displays complete wallet-scoped transaction history including withdrawals
- **Bridge Tracking Page**: Real-time detailed status of all bridge operations
- **Portfolio Polling**: Restored automatic 5-second refresh during active withdrawals
- **In-Flight Alerts**: Count badge with direct navigation to Bridge Tracking for withdrawal details
- **Transaction Type Normalization**: Frontend handles both "withdraw" and "withdrawal" types for backward compatibility

#### Separation of Concerns
- Portfolio: Active positions + alerts (no history list)
- Transactions: Complete transaction history (deposits, claims, withdrawals)
- Bridge Tracking: Real-time status with detailed progress information

### Changed - API Security
- `/api/transactions` endpoint now requires `walletAddress` parameter
- `/api/transactions/summary` endpoint now requires `walletAddress` parameter
- Both endpoints return 400 error if wallet parameter is missing

### Security Enhancements
- Wallet-scoped authentication prevents unauthorized access to global transaction data
- Direct column filtering eliminates JOIN-based security vulnerabilities
- All transaction creation includes wallet address validation
- No fallback path for unauthenticated access

---

## [1.1.0] - 2025-11-09

### 🎉 Deployed - Smart Contracts Live on Flare Coston2 Testnet

#### Successful Deployment
- **ShieldToken ($SHIELD)** deployed to: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD sent to treasury
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)

- **Shield XRP Vault (shXRP)** deployed to: `0xd8d78DA41473D28eB013e161232192ead2cc745A`
  - Initial Exchange Rate: 1.0 shXRP per XRP
  - Ready for operator configuration
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xd8d78DA41473D28eB013e161232192ead2cc745A)

#### Deployment Details
- **Network**: Flare Coston2 Testnet (Chain ID: 114)
- **Deployer**: `0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D`
- **Deployment Time**: November 9, 2025
- **Deployment Artifacts**: Saved to `deployments/coston2-deployment.json`

### Changed - Infrastructure Upgrades

#### Node.js & Hardhat
- **Upgraded Node.js**: 20.19.3 → 22.17.0 (required for Hardhat 3)
- **Fixed Hardhat 3 Compatibility**:
  - Installed correct toolbox: `@nomicfoundation/hardhat-toolbox-mocha-ethers@3.0.1`
  - Updated network configuration with explicit `type` fields
  - Added `@nomicfoundation/hardhat-ethers@4.0.3`
- **Successfully Compiled**: 2 Solidity files with solc 0.8.20

#### New Deployment Script
- Created `scripts/deploy-direct.ts`:
  - Uses ethers.js v6 directly (bypasses Hardhat 3 plugin complexities)
  - More reliable deployment for Hardhat 3 projects
  - Comprehensive deployment logging and artifact saving
  - Automatic balance validation
  - Block explorer link generation

### Updated - Documentation
- **DEPLOYMENT_GUIDE.md**: Updated with actual deployed contract addresses and commands
- **README.md**: Updated environment variables with deployed addresses
- **replit.md**: Added deployed contract section with explorer links
- **CHANGELOG.md**: This file with complete deployment history

### Dependencies Updated
```diff
- @nomicfoundation/hardhat-toolbox: ^6.1.0 (incompatible with Hardhat 3)
+ @nomicfoundation/hardhat-toolbox-mocha-ethers: ^3.0.1
+ @nomicfoundation/hardhat-ethers: ^4.0.3
+ ethers: ^6.x (standalone for direct deployment)
```

### Next Steps
1. ✅ Verify contracts on Flare Coston2 block explorer
2. ✅ Update frontend environment variables with contract addresses
3. ⏳ Configure vault operator for minting/burning shXRP
4. ⏳ Test deposit/withdrawal flows on testnet
5. ⏳ Deploy XRPL Hooks for cross-chain functionality

---

## [Unreleased] - 2024-11-09

### Added - Blockchain Infrastructure

#### Smart Contracts
- **ShieldToken.sol**: ERC-20 governance token ($SHIELD)
  - 100M total supply with 10M treasury allocation
  - Burnable and mintable features
  - OpenZeppelin standards implementation
  
- **Shield XRP Vault.sol**: Liquid staking vault contract
  - Mints shXRP tokens 1:1 for deposited XRP
  - Operator-controlled minting/burning
  - Reward distribution system with exchange rate tracking
  - ReentrancyGuard protection
  - Minimum deposit: 0.01 XRP

#### Deployment Infrastructure
- **Hardhat Configuration** (`hardhat.config.ts`)
  - Flare Coston2 testnet (Chain ID: 114)
  - Flare mainnet (Chain ID: 14)
  - Solidity 0.8.20 with optimizer enabled
  - Block explorer verification support

- **Deployment Scripts**
  - `scripts/deploy-flare.ts`: Automated Flare network deployment
  - `scripts/deploy-shield-10m.ts`: SHIELD token deployment
  - Deployment info saved to JSON files
  - Block explorer link generation

#### FAssets Bridge Integration
- XRP → FXRP bridging via Flare FAssets protocol
- FDC (Flare Data Connector) for payment verification
- Collateral reservation with FAssets agents

#### Documentation
- **DEPLOYMENT_GUIDE.md**: Quick reference for all deployment commands
- **README.md**: Updated with comprehensive blockchain infrastructure details
  - New "Smart Contracts" section
  - Updated "Tech Stack" with Hardhat/Solidity
  - Updated "Environment Variables" with blockchain deployment variables
  - Updated "Available Scripts" with deployment commands
  - Updated "Project Structure" with contracts/ and scripts/ directories
  
- **replit.md**: Updated technical architecture
  - New "Blockchain Infrastructure" section
  - Smart contract specifications
  - Deployment configuration details
  - Contract architecture workflow
  - Security features documentation

- **.env.example**: Added blockchain deployment environment variables
  - Flare network deployment keys
  - XRPL hooks deployment secrets
  - Frontend contract address placeholders

### Dependencies Added
- `hardhat`: ^3.0.12
- `@nomicfoundation/hardhat-toolbox`: ^6.1.0
- `@openzeppelin/contracts`: ^5.4.0

### Environment Variables Added
```bash
DEPLOYER_PRIVATE_KEY
TREASURY_ADDRESS
FLARE_COSTON2_RPC_URL
FLARE_MAINNET_RPC_URL
FLARE_API_KEY
XRPL_HOOK_ACCOUNT_SECRET
XRPL_NETWORK
VITE_SHIELD_TOKEN_ADDRESS
VITE_SHXRP_VAULT_ADDRESS
```

### Project Structure Changes
```
New directories:
├── contracts/          # Solidity smart contracts
├── scripts/            # Deployment scripts
└── deployments/        # Deployment artifacts

New files:
├── hardhat.config.ts
├── DEPLOYMENT_GUIDE.md
└── CHANGELOG.md
```

### Security Enhancements
- Operator-controlled minting prevents unauthorized shXRP creation
- ReentrancyGuard protection against reentrancy attacks
- Minimum deposit requirements prevent dust attacks
- XRPL transaction hash verification for every mint operation
- Event emission for all mint/burn operations

### Cross-Chain Architecture
The platform now supports a complete cross-chain workflow:
1. Frontend: User deposits XRP via wallet (Xaman/WalletConnect)
2. XRPL Layer: User sends XRP to FAssets agent address
3. Flare Layer: FDC verifies payment, FXRP minted, deposited to vault
4. Database Layer: Position tracking in PostgreSQL
5. Withdrawal: User requests withdrawal → FXRP redeemed → XRP returned

---

## Previous Releases

### [1.0.0] - Initial Release
- Full-stack DeFi application for XRP liquid staking
- Multi-wallet support (Xaman, WalletConnect, Web3Auth)
- Vault management system
- Position tracking and analytics
- Transaction history
- PostgreSQL database with Drizzle ORM
- Responsive UI with shadcn/ui components
