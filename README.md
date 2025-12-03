# XRP Liquid Staking Protocol Dashboard

A full-stack DeFi application for XRP liquid staking, providing a comprehensive dashboard for managing cryptocurrency vaults, depositing assets, tracking positions, and earning yield on the XRP Ledger.

## 📄 Whitepaper

**[Read the Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf)** — Complete technical documentation covering the protocol architecture, yield mechanics, and SHIELD tokenomics.

## 🌟 Overview

This project enables users to:
- Connect wallets via **Xaman** (XRPL) or **WalletConnect/MetaMask** (EVM)
- Deposit/withdraw **XRP**, **RLUSD**, and **USDC** into yield-generating vaults
- Track positions with real-time APY rates and rewards
- Monitor vault performance with detailed analytics
- Earn passive income through secure, risk-tiered vaults

**Business Vision**: Making DeFi on XRP accessible and efficient, tapping into the growing market for liquid staking solutions.

## ✨ Key Features

### 🔐 Dual Wallet Experience

Shield Finance provides tailored experiences based on wallet type:

**XRPL Natives (Xaman/XUMM)**
- Connect with familiar XRPL wallet (QR code signing)
- See XRP-denominated vaults only
- Deposit XRP → Automated FAssets bridge → FXRP → Vault
- Seamless cross-chain experience without EVM complexity

**EVM Users (WalletConnect/MetaMask)**
- Connect with Ethereum-compatible wallets
- See FXRP vaults + access to Swap feature
- Direct FXRP deposits to Flare contracts
- Full access to SparkDEX trading

The platform automatically detects your wallet type and shows compatible vaults.

### 💰 Vault Management
- Multiple vault types with different risk/reward profiles
- Real-time balance display with 30-second auto-refresh
- Support for XRP, RLUSD, and USDC tokens
- Automated reward calculation and compounding

### 🔄 Transaction System
- Automated XRP to FXRP bridging via FAssets protocol
- ERC-4626 compliant vault deposits and withdrawals
- Gasless transactions using Etherspot smart accounts
- **Wallet-scoped transaction history** with privacy controls
- Separate views: Portfolio (positions + alerts), Transactions (history), Bridge Tracking (real-time status)

### 📊 Dashboard Features
- **Portfolio Summary**: Real-time display of total assets, staked amounts, pending rewards, and SHIELD boost contribution
- **Performance Charts**: Historical portfolio visualization with 7D/30D/90D time range selectors
- **Boost Impact Banner**: Side-by-side comparison of base APY vs boosted APY with SHIELD staking CTA
- **Notification Center**: Persistent bell icon with unread count, triggers for deposits, withdrawals, staking, and reward claims
- **Portfolio Page**: Active positions with automatic 5s refresh during withdrawals
- **Transaction History**: Complete wallet-scoped transaction history (deposits, claims, withdrawals)
- **Bridge Tracking**: Real-time status of all bridge operations with detailed progress
- In-flight withdrawal alerts with direct navigation to detailed status
- Active vault statistics and historical APY trends with charts
- Interactive tooltips explaining fees, rewards, and vault mechanics
- Network switching (Mainnet/Testnet)

### 🔄 Multi-Asset Swap
- **Instant bidirectional trading** (FLR, wFLR, USDT ↔ SHIELD) via SparkDEX V3 integration
- **Real-time price quotes** with automatic exchange rate updates
- **ERC-20 approval flow** with one-click token allowance management
- **Slippage protection** with customizable tolerance settings
- **Liquidity detection** to ensure sufficient pool depth before execution

## 🏗️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: React Context API + TanStack Query
- **UI Components**: shadcn/ui (Radix UI based)
- **Styling**: Tailwind CSS with custom design system
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Server**: Express.js with Node.js and TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe queries
- **Validation**: Zod schemas
- **Session Management**: PostgreSQL session store

### Blockchain Integration
- **XRPL Library**: `xrpl` for blockchain interactions
- **Wallet SDKs**: 
  - `xumm-sdk` for Xaman (XRPL) integration
  - `@walletconnect/universal-provider` for WalletConnect/MetaMask (EVM)
- **Key Management**: `@noble/secp256k1` for wallet derivation
- **Blockchain Protocols**:
  - **SparkDEX V3**: Uniswap V2-compatible DEX on Flare Network for token swaps

### Smart Contract Development
- **Development Framework**: Hardhat for Solidity development
- **Smart Contract Language**: Solidity 0.8.20
- **Libraries**: OpenZeppelin Contracts (ERC-20, Access Control, ReentrancyGuard)
- **Networks**: 
  - Flare Coston2 testnet (Chain ID: 114)
  - Flare mainnet (Chain ID: 14)
- **Tooling**: 
  - Hardhat Toolbox (ethers.js v6, testing, verification)
  - Contract verification on Flare block explorers
- **FAssets Bridge**: Cross-chain XRP to FXRP conversion using Flare Data Connector attestations

## 📦 Installation

### Prerequisites
- Node.js 22+ (required for Hardhat 3)
- PostgreSQL database
- Replit account (or local development environment)

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Session
SESSION_SECRET=your-secure-session-secret

# Admin API (Required for admin endpoints)
ADMIN_API_KEY=your-secure-admin-api-key-min-32-chars

# Wallet Integration (Optional - falls back to demo mode if not set)
XUMM_API_KEY=your-xumm-api-key
XUMM_API_SECRET=your-xumm-api-secret
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# Blockchain Deployment (Required for smart contract deployment)
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here
FLARE_COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_MAINNET_RPC_URL=https://flare-api.flare.network/ext/C/rpc
FLARE_API_KEY=your-flare-api-key-here

# Frontend Contract Addresses (Deployed on Coston2 - November 23, 2025 - CORRECTED 10M SHIELD)
VITE_SHIELD_TOKEN_ADDRESS=0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
VITE_SHXRP_VAULT_ADDRESS=0x3219232a45880b79736Ee899Cb3b2f95D527C631
VITE_REVENUE_ROUTER_ADDRESS=0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
VITE_STAKING_BOOST_ADDRESS=0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
```

> **Note**: See `.env.example` for a complete list with descriptions. For detailed deployment instructions, refer to [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) and the "How to Deploy to Testnet" section below.

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/shield-xrpfinance/shieldfinance.git
   cd shieldfinance
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your API keys and credentials

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open your browser to `http://localhost:5000`

## 🔑 Getting API Keys

### Xaman (XUMM)
1. Visit [XUMM Developer Console](https://apps.xumm.dev/)
2. Create a new application
3. Copy your API Key and API Secret

### WalletConnect
1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy your Project ID

## 🗄️ Database Schema

### Core Tables

**vaults**
- Vault configurations and settings
- APY rates and risk profiles
- Supported asset types

**positions**
- User deposits and balances
- Reward calculations
- Timestamps for tracking

**transactions**
- All deposit/withdrawal/claim activities
- Transaction status and history
- Blockchain transaction hashes
- **Wallet-scoped**: `wallet_address` column ensures users only access their own data

**fxrp_to_xrp_redemptions**
- Withdrawal transaction tracking with dual-status model
- Real-time redemption status monitoring with userStatus/backendStatus
- FDC proof generation and confirmation tracking
- Historical withdrawal records

**vault_metrics_daily**
- Historical performance data
- APY trends over time
- Analytics aggregation

## 🚀 Shield Finance Fair Launch - Complete Deployment Guide

### Overview
Shield Finance is planning a **$10K fair launch** (TBC) with complete smart contract infrastructure on Flare Network. This section covers deploying all contracts for mainnet launch.

**Status**: Production-ready (176/176 tests passing, comprehensive documentation, security checklist). Launch pending.

### Quick Start

For complete deployment instructions, see:
- **📖 [SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md)** - Step-by-step deployment guide with verification commands
- **🔒 [SHIELD_SECURITY_CHECKLIST.md](docs/protocol/SHIELD_SECURITY_CHECKLIST.md)** - Pre-launch security checklist (100+ items)

### Deployment Sequence (7 Steps)

```bash
# Step 1: Generate merkle tree for airdrop (2M SHIELD)
npx ts-node scripts/generate-merkle-tree.ts
export MERKLE_ROOT=<generated-root>

# Step 2-4: Deploy all contracts (Testnet first!)
DEPLOYER_PRIVATE_KEY=<key> MERKLE_ROOT=<root> \
  npx hardhat run scripts/deploy-shield-finance.ts --network coston2

# Step 5: Add liquidity on SparkDEX V3
SHIELD_TOKEN_ADDRESS=<address> \
  npx hardhat run scripts/sparkdex-lp.ts --network coston2

# Step 6: Lock LP NFT (Team Finance - manual)
# Navigate to https://team.finance and lock LP NFT for 12 months

# Step 7: Fund MerkleDistributor with 2M SHIELD
cast send <SHIELD_ADDRESS> "transfer(address,uint256)" \
  <MERKLE_DISTRIBUTOR_ADDRESS> 2000000000000000000000000
```

### Contracts Deployed

| Contract | Purpose | Network |
|----------|---------|---------|
| **ShieldToken** | 10M SHIELD, pure ERC20 | Flare |
| **RevenueRouter** | 50% burn, 50% reserves | Flare |
| **StakingBoost** | 30-day lock, APY boost | Flare |
| **MerkleDistributor** | 2M SHIELD airdrop | Flare |
| **SparkDEX V3 Pool** | 1M SHIELD + 535,451 wFLR | Flare |

### Test Coverage
- ✅ **176/176 unit tests** passing
- ✅ **78 adversarial tests** for security validation
- ✅ **100% code coverage** for critical paths

### Next: Smart Contracts on Testnet

Before mainnet deployment:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Coston2 testnet
DEPLOYER_PRIVATE_KEY=<key> MERKLE_ROOT=<root> \
  npx hardhat run scripts/deploy-shield-finance.ts --network coston2

# Verify deployment
npx hardhat run scripts/verify-shield-deployment.ts --network coston2
```

**See [SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md) for complete guide with:**
- Pre-deployment checklist
- Detailed step-by-step instructions
- Verification commands for each step
- Emergency procedures
- Post-deployment verification
- Cost estimates and gas analysis

### Pre-Mainnet Requirements

Before deploying to Flare mainnet:

1. ✅ All 176 tests passing - verified
2. ⏳ External audit - recommended (CertiK, Trail of Bits, OpenZeppelin)
3. ⏳ Testnet deployment and validation
4. ⏳ Security checklist review - see [SHIELD_SECURITY_CHECKLIST.md](docs/protocol/SHIELD_SECURITY_CHECKLIST.md)
5. ⏳ Community review period (1-2 weeks)

### Documentation

- **[SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md)** - Complete deployment guide (400+ lines)
  - 7-step deployment sequence
  - Verification commands for each step
  - Emergency procedures
  - Cost estimates and troubleshooting

- **[SHIELD_SECURITY_CHECKLIST.md](docs/protocol/SHIELD_SECURITY_CHECKLIST.md)** - Pre-launch security (100+ items)
  - Smart contract security audit checklist
  - Deployment security requirements
  - Operational security guidelines
  - Legal compliance requirements
  - Emergency incident response procedures

### Important: Deprecated Scripts

⚠️ **scripts/deploy-flare.ts** is deprecated:
- Uses incorrect ShieldToken constructor (takes treasury parameter that doesn't exist)
- Replaced by **scripts/deploy-shield-finance.ts** (production-ready)
- Do NOT use deploy-flare.ts for new deployments

Use **scripts/deploy-shield-finance.ts** instead (all bugs fixed, production-ready)

## 🚀 Deployment (Application)

The web application is designed to run on Replit with automatic deployments:

1. **Push to main branch**
   ```bash
   git push origin main
   ```

2. **Publish on Replit**
   - Use the "Publish" button in Replit
   - Configure custom domain (optional)
   - SSL/TLS handled automatically

## 🔐 Smart Contracts

The platform includes a complete smart contract infrastructure deployed on Flare Network:

### ShieldToken ($SHIELD)
- **Type**: ERC-20 governance and utility token
- **Total Supply**: 10,000,000 SHIELD
- **Treasury**: 10,000,000 SHIELD (10% allocation)
- **Features**: Burnable, Mintable (owner-controlled), Transferable ownership

### ShXRP Vault (ERC-4626)
- **Type**: ERC-4626 compliant tokenized vault
- **Symbol**: shXRP (Shield XRP)
- **Asset**: FXRP (wrapped XRP on Flare Network)
- **Key Features**:
  - Standard ERC-4626 deposit/redeem functions
  - Automated yield compounding via Firelight.finance
  - Minimum deposit: 0.01 FXRP (10000 units with 6 decimals)
  - Decimal precision: 6 (matches FXRP token)
  - ReentrancyGuard protection
  - Gasless transactions via Etherspot smart accounts

### FAssets Bridge Integration
- **Purpose**: Cross-chain bridge converting XRP to FXRP on Flare Network
- **Protocol**: Flare FAssets with FDC attestation proofs
- **Flow**: XRP deposits → Automated minting → FXRP in ERC-4626 vault

**Deployment Info**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for testnet/mainnet deployment instructions.

## 🔒 Security Features

### Smart Contract Security
- **ERC-4626 Standard Compliance**: Industry-standard tokenized vault implementation
- **Smart Account Security**: ERC-4337 compliant smart accounts via Etherspot Prime SDK
- **ReentrancyGuard Protection**: Smart contracts protected against reentrancy attacks
- **Minimum Deposit Enforcement**: 0.01 FXRP minimum prevents dust attacks

### Platform Security
- **Wallet-Scoped Transactions**: Complete end-to-end wallet authentication for transaction history
  - API requires wallet parameter (returns 400 if missing)
  - Direct column filtering prevents JOIN-based security bypasses
  - Users can only access their own transaction data
- **Automated Bridge Verification**: FDC attestation proofs verify cross-chain transactions
- **Secure Key Management**: Environment-based secret storage with Replit integration
- **Transaction Verification**: All blockchain transactions verified on-chain
- **Double-Mint Prevention**: Idempotent bridge operations with unique transaction tracking
- **Data Integrity**: All transaction creation includes wallet address validation

## 🌐 Network Support

- **Mainnet**: Production XRP Ledger network
- **Testnet**: Development and testing environment
- **Dynamic Switching**: Toggle between networks in the UI
- **Network-Specific Configuration**: Separate API endpoints and wallet configurations

## 📱 Wallet Integration Details

### Xaman (XUMM)
- QR code-based transaction signing
- Mobile wallet support
- Automatic payload cleanup (prevents 61 payload limit)
- Polling mechanism for signature confirmation

### WalletConnect
- XRPL namespace configuration (`xrpl:0` mainnet, `xrpl:1` testnet)
- Direct in-wallet signing (no QR codes needed)
- `xrpl_signTransaction` method with tx_json encoding
- Auto-submission handling with sequence error recovery

### Wallet Type Detection
- **Ecosystem auto-sync**: Connects XRPL wallet → shows XRPL vaults; connects EVM wallet → shows Flare vaults
- **Manual override**: Users can browse other ecosystems when disconnected
- **Mismatch handling**: Toast notifications guide users to connect compatible wallets

## 🛠️ Development

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and helpers
│   └── index.html         # HTML entry point
├── server/                # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── services/          # Business logic (Bridge, Vault, XRPL)
│   ├── storage.ts         # Database interface
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── contracts/             # Solidity smart contracts
│   ├── ShieldToken.sol    # ERC-20 governance token
│   └── ShXRPVault.sol     # ERC-4626 liquid staking vault
├── scripts/               # Deployment scripts
│   └── deploy-shield-10m.ts  # Production deployment script
├── deployments/           # Deployment artifacts
│   └── *.json             # Deployment info per network
├── docs/                  # Documentation
│   ├── protocol/          # Token & contract docs
│   ├── integration/       # External service integrations
│   └── platform/          # App architecture docs
├── hardhat.config.ts      # Hardhat configuration
└── design_guidelines.md   # UI/UX design system
```

### Available Scripts

```bash
# Application
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push database schema changes
npm run db:studio    # Open Drizzle Studio (database GUI)

# Smart Contract Deployment
npx hardhat compile                                              # Compile contracts
npx hardhat run scripts/deploy-shield-10m.ts --network coston2   # Deploy to testnet
npx hardhat verify --network coston2 <ADDRESS> "<CONSTRUCTOR>"   # Verify contracts
```

For detailed deployment instructions, see [docs/protocol/SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md).

## 📊 Liquid Staking System

### Deposit Flow
1. **User sends XRP** to monitored XRPL address: `r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY`
2. **Automated FAssets bridge** converts XRP → FXRP on Flare Network
3. **FXRP deposited** into ERC-4626 vault contract
4. **User receives shXRP** liquid staking tokens representing their position

### Smart Contracts (Flare Coston2 Testnet)
- **ShXRP Vault**: [`0x8fe09217445e90DA692D29F30859dafA4eb281d1`](https://coston2-explorer.flare.network/address/0x8fe09217445e90DA692D29F30859dafA4eb281d1)
  - ERC-4626 compliant tokenized vault
  - Minimum deposit: 0.01 FXRP
  - Decimal precision: 6 (matches FXRP)
  
- **Smart Account**: [`0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd`](https://coston2-explorer.flare.network/address/0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd)
  - ERC-4337 smart account via Etherspot Prime SDK
  - Enables gasless transactions for users
  - Manages vault deposits and withdrawals

### Withdrawal Flow
Users can withdraw anytime through the vault's standard ERC-4626 `redeem()` function:
1. **User initiates withdrawal** from dashboard
2. **Smart account executes** ERC-4626 redeem transaction (gasless)
3. **FXRP returned** to user's Flare wallet
4. **shXRP tokens burned** maintaining proper accounting

No manual approvals required - all withdrawals are automated and instant via smart contracts.

## 🔥 $10K Fair Launch – Planned (TBC)

**Shield Finance ($SHIELD)** is planning a fair launch with a **$10,000 liquidity commitment** and **100% LP tokens locked for 12 months** on **SparkDEX V3** (Flare mainnet).

> **Status:** Launch details are TBC (To Be Confirmed). The information below represents planned tokenomics pending official launch.

### Tokenomics (Planned)

- **Total Supply**: 10,000,000 SHIELD
- **Circulating**: 8,000,000 SHIELD (80%)
  - 5,353,451 SHIELD + 535,451 wFLR = $10K initial liquidity (TBC)
  - 2,646,549 SHIELD reserved for ecosystem development
- **Airdrop**: 2,000,000 SHIELD (20%)
  - Claimable via Merkle proof (MerkleDistributor.sol)
  - Fair distribution to early supporters
- **Initial Price**: $0.01 per SHIELD (TBC)
- **Liquidity Lock**: 12 months via Team Finance (or equivalent) (TBC)

### Revenue Model: Burns, Boost, Reserves

Shield Finance generates **real revenue** from vault fees, creating **deflationary pressure** and **differentiated yield**:

1. **Deposit Fee (0.2%)**: Collected on every vault deposit → sent to RevenueRouter
2. **Withdrawal Fee (0.2%)**: Collected on every vault withdrawal → sent to RevenueRouter
3. **Revenue Distribution**: Every Sunday, GitHub Actions checks if RevenueRouter has ≥5000 wFLR (~$100):
   - **50% Burn**: wFLR swapped to SHIELD → permanently burned
   - **40% Boost**: wFLR swapped to FXRP → distributed to SHIELD stakers
   - **10% Reserves**: Kept for protocol development and security

```
┌─────────────────────────────────────────────────────────────────┐
│                        Revenue Flow                             │
│                                                                 │
│   Vault Fees      RevenueRouter          Distribution           │
│   ──────────────► ──────────────►  ┌─────────────────────────┐  │
│   wFLR (0.2%)     distribute()     │ 50% → SHIELD buyback/burn│  │
│                                    │ 40% → FXRP → StakingBoost │  │
│                                    │ 10% → Protocol reserves   │  │
│                                    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**No minting. No inflation. Pure revenue-share.** As vault TVL grows, burn rate and boost rewards accelerate.

### Stake $SHIELD → Boost Your shXRP Yield

**LIVE — Stake SHIELD to boost your shXRP APY**

SHIELD holders can stake their tokens to receive proportionally higher yield on their shXRP holdings. The boost is distributed **strictly pro-rata** to locked SHIELD positions.

**Formula (from whitepaper):**
```
Boost APY = Base APY + (Annual Protocol Revenue → FXRP) × (Your Locked SHIELD ÷ Total Locked SHIELD)
```

**Key Features:**
- **30-Day Lock**: Stake SHIELD in StakingBoost contract for minimum 30 days
- **Pro-Rata Distribution**: Rewards distributed proportionally by stake weight
- **Synthetix Accumulator**: O(1) gas complexity, fair late-joiner calculations
- **Claim Rewards**: Call `claim()` to mint shXRP shares directly to your wallet
- **Global Cap**: Maximum 25% boost (configurable by governance)

**How It Works:**
1. RevenueRouter receives wFLR from vault fees (0.2% deposit/withdrawal)
2. 40% of revenue → swapped to FXRP → `StakingBoost.distributeBoost()`
3. Reward accumulator updates `rewardPerToken` (O(1) gas, no loops)
4. Stakers call `claim()` → FXRP sent to `vault.donateOnBehalf()` → shXRP minted to staker
5. **Non-stakers receive zero boost** (differentiated yield)

**One-liner for whitepaper:**
> "Every week the protocol donates FXRP bought with real revenue. 100% of that donation is distributed pro-rata to SHIELD lockers. No minting. No inflation. Pure revenue-share."

**Deployment Flow (Circular Dependency Solution):**
```bash
# Three-step deployment required:
1. Deploy ShXRPVault with stakingBoost = address(0)
2. Deploy StakingBoost with real vault address
3. Call vault.setStakingBoost(stakingBoostAddress)
```

See [docs/protocol/STAKING_BOOST_SPEC.md](docs/protocol/STAKING_BOOST_SPEC.md) for complete technical specification.

### Contract Addresses (Flare Mainnet)

**Note:** Deploy contracts using `npx hardhat run scripts/deploy-shield-10m.ts --network coston2` before fair launch.

After deployment, update these addresses:
- **SHIELD Token**: TBD
- **RevenueRouter**: TBD
- **ShXRP Vault**: TBD
- **SparkDEX Pool**: TBD (create via `tsx scripts/sparkdex-lp.ts`)
- **LP Lock**: TBD (lock LP NFT via Team Finance)
- **MerkleDistributor**: TBD

### Fair Launch Steps

1. **Deploy Contracts** (Flare Mainnet)
   ```bash
   # Set environment variables
   export DEPLOYER_PRIVATE_KEY="your-private-key"
   export TREASURY_ADDRESS="your-treasury-address"
   export MERKLE_ROOT="your-merkle-root"
   
   # Deploy all contracts
   npx hardhat run scripts/deploy-shield-10m.ts --network flare
   ```
   Deploys: ShieldToken.sol, RevenueRouter.sol, StakingBoost.sol, ShXRPVault.sol, MerkleDistributor.sol

2. **Generate Merkle Tree for Airdrop**
   ```bash
   # Create airdrop list (example using ethers.js)
   const airdropList = [
     { address: "0x123...", amount: "100000000000000000000" }, // 100 SHIELD
     { address: "0x456...", amount: "50000000000000000000" }   // 50 SHIELD
   ];
   
   # Generate tree and root
   const { MerkleTree } = require('merkletreejs');
   const { keccak256 } = require('ethers');
   
   const leaves = airdropList.map(x => 
     keccak256(ethers.solidityPacked(['address', 'uint256'], [x.address, x.amount]))
   );
   const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
   const root = tree.getRoot().toString('hex');
   
   # Deploy MerkleDistributor with this root
   # IMPORTANT: Merkle root is immutable - cannot be changed after deployment
   # This prevents double-claim exploits in fair launch
   # For additional airdrops, deploy a NEW MerkleDistributor contract
   
   # SECURITY WARNING FOR FUTURE MAINTAINERS:
   # - Do NOT re-add updateMerkleRoot() without implementing bitmap claim tracking
   # - Address-based tracking allows double-claims if root changes
   # - Any root update feature REQUIRES bitmap pattern + regression tests
   # - If unsure, deploy a new MerkleDistributor instead
   ```

3. **Add Liquidity on SparkDEX V3**
   ```bash
   # Run LP deployment script
   tsx scripts/sparkdex-lp.ts
   ```
   Creates wFLR-SHIELD pool with $10K liquidity (TBC)

4. **Lock LP NFT** (12 months - TBC)
   - Use Team Finance: https://team.finance
   - Lock LP NFT position for 12 months (TBC)
   - Save proof URL/transaction hash

5. **Enable Automated Burns**
   - Add `REVENUE_ROUTER_ADDRESS` secret to GitHub repo
   - Workflow runs every Sunday at 00:00 UTC
   - Burns occur when RevenueRouter balance ≥ 5000 wFLR

### Announcement Tweet (Draft - TBC)

> **Note:** This is a draft announcement for when the fair launch occurs. Launch details are TBC.

```
🛡️ Shield Finance $SHIELD fair-launching with $10K liquidity and 100% LP locked 12 months.

✅ 10M total supply
✅ Real revenue → real burns
✅ Stake $SHIELD → boost your XRP yield
✅ 2M SHIELD airdrop live

No VCs. No presale. 100% fair launch.

Trade: [SparkDEX pool link]
Claim airdrop: [MerkleDistributor link]

#XRPL #Flare #DeFi
```

### Community

- **Website**: https://shyield.finance
- **X (Twitter)**: https://x.com/ShieldFinanceX
- **Telegram Official**: https://t.me/ShieldFinanceOfficial
- **Telegram Community**: https://t.me/ShieldFinanceCommunity
- **Discord**: https://discord.gg/Vzs3KbzU

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Shield Yield Vaults Ltd.

## 📚 Documentation

- **[README.md](README.md)** - Main project documentation (this file)
- **[REVIEWERS.md](REVIEWERS.md)** - Research team navigation guide
- **[replit.md](replit.md)** - Technical architecture and system design
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Quick deployment command reference
- **[docs/protocol/](docs/protocol/)** - Token & contract documentation
- **[docs/integration/](docs/integration/)** - External service integrations (FAssets, Firelight)
- **[docs/platform/](docs/platform/)** - App architecture docs
- **[design_guidelines.md](design_guidelines.md)** - UI/UX design system

## 🔗 Links

- **Repository**: [github.com/shield-xrpfinance/shieldfinance](https://github.com/shield-xrpfinance/shieldfinance)
- **Live Application**: [https://shyield.finance](https://shyield.finance)
- **Documentation**: [shield-finance.gitbook.io](https://shield-finance.gitbook.io/shield-finance-docs/)
- **Community**:
  - X (Twitter): https://x.com/ShieldFinanceX
  - Telegram Official: https://t.me/ShieldFinanceOfficial
  - Telegram Community: https://t.me/ShieldFinanceCommunity
  - Discord: https://discord.gg/Vzs3KbzU
- **Block Explorers**:
  - Flare Coston2: https://coston2-explorer.flare.network
  - Flare Mainnet: https://flare-explorer.flare.network
  - XRPL Testnet: https://testnet.xrpl.org
  - XRPL Mainnet: https://livenet.xrpl.org

## 👥 Team

**Shield Yield Vaults Ltd.** - Making DeFi on XRP accessible and efficient

---

Built with ❤️ for the XRP community
