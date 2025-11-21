# XRP Liquid Staking Protocol Dashboard

A full-stack DeFi application for XRP liquid staking, providing a comprehensive dashboard for managing cryptocurrency vaults, depositing assets, tracking positions, and earning yield on the XRP Ledger.

## 🌟 Overview

This project enables users to:
- Connect XRP wallets via **Xaman**, **WalletConnect**, or **Web3Auth** (social login)
- Deposit/withdraw **XRP**, **RLUSD**, and **USDC** into yield-generating vaults
- Track positions with real-time APY rates and rewards
- Monitor vault performance with detailed analytics
- Earn passive income through secure, risk-tiered vaults

**Business Vision**: Making DeFi on XRP accessible and efficient, tapping into the growing market for liquid staking solutions.

## ✨ Key Features

### 🔐 Multi-Wallet Support
- **Xaman (XUMM)** - Mobile wallet integration with QR code signing
- **WalletConnect** - Universal wallet connection for XRPL-compatible wallets
- **Web3Auth** - Social login with Google, Facebook, Twitter, Discord, or Email

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
- **Portfolio Page**: Active positions with automatic 5s refresh during withdrawals
- **Transaction History**: Complete wallet-scoped transaction history (deposits, claims, withdrawals)
- **Bridge Tracking**: Real-time status of all bridge operations with detailed progress
- In-flight withdrawal alerts with direct navigation to detailed status
- Active vault statistics and historical APY trends with charts
- Network switching (Mainnet/Testnet)

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
  - `xumm-sdk` for Xaman integration
  - `@walletconnect/universal-provider` for WalletConnect
  - `@web3auth/modal` for social login
- **Key Management**: `@noble/secp256k1` for wallet derivation

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

# Wallet Integration (Optional - falls back to demo mode if not set)
XUMM_API_KEY=your-xumm-api-key
XUMM_API_SECRET=your-xumm-api-secret
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
VITE_WEB3AUTH_CLIENT_ID=your-web3auth-client-id

# Blockchain Deployment (Required for smart contract deployment)
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here
FLARE_COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_MAINNET_RPC_URL=https://flare-api.flare.network/ext/C/rpc
FLARE_API_KEY=your-flare-api-key-here

# Frontend Contract Addresses (Deployed on Coston2 - November 12, 2025)
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992
VITE_SHXRP_VAULT_ADDRESS=0x8fe09217445e90DA692D29F30859dafA4eb281d1
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

### Web3Auth
1. Visit [Web3Auth Dashboard](https://dashboard.web3auth.io)
2. Create a new project
3. Select **sapphire_devnet** for testnet or **sapphire_mainnet** for production
4. Add your domain to the whitelist
5. Copy your Client ID

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
Shield Finance is a **$10K fair launch** with complete smart contract infrastructure on Flare Network. This section covers deploying all contracts for mainnet launch.

**Status**: Production-ready (176/176 tests passing, comprehensive documentation, security checklist)

### Quick Start

For complete deployment instructions, see:
- **📖 [SHIELD_DEPLOYMENT.md](docs/SHIELD_DEPLOYMENT.md)** - Step-by-step deployment guide with verification commands
- **🔒 [SHIELD_SECURITY_CHECKLIST.md](docs/SHIELD_SECURITY_CHECKLIST.md)** - Pre-launch security checklist (100+ items)

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

**See [SHIELD_DEPLOYMENT.md](docs/SHIELD_DEPLOYMENT.md) for complete guide with:**
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
4. ⏳ Security checklist review - see [SHIELD_SECURITY_CHECKLIST.md](docs/SHIELD_SECURITY_CHECKLIST.md)
5. ⏳ Community review period (1-2 weeks)

### Documentation

- **[SHIELD_DEPLOYMENT.md](docs/SHIELD_DEPLOYMENT.md)** - Complete deployment guide (400+ lines)
  - 7-step deployment sequence
  - Verification commands for each step
  - Emergency procedures
  - Cost estimates and troubleshooting

- **[SHIELD_SECURITY_CHECKLIST.md](docs/SHIELD_SECURITY_CHECKLIST.md)** - Pre-launch security (100+ items)
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
- **Total Supply**: 100,000,000 SHIELD
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

### Web3Auth
- Social login providers: Google, Facebook, Twitter, Discord, Email
- Browser-native secp256k1 implementation
- HTML-based Buffer/process polyfills
- Testnet: sapphire_devnet, Production: sapphire_mainnet

## 🛠️ Development

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and helpers
│   │   └── hooks/         # Custom React hooks
│   └── index.html         # HTML entry point
├── server/                # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database interface
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── contracts/             # Solidity smart contracts
│   ├── ShieldToken.sol    # ERC-20 governance token
│   └── Shield XRP Vault.sol     # Liquid staking vault
├── scripts/               # Deployment scripts
│   └── deploy-direct.ts   # Direct ethers.js deployment (Hardhat 3)
├── deployments/           # Deployment artifacts
│   └── *.json             # Deployment info per network
├── db/                    # Database migrations
├── hardhat.config.ts      # Hardhat configuration
├── DEPLOYMENT_GUIDE.md    # Quick deployment reference
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
tsx scripts/deploy-direct.ts                                     # Deploy to testnet/mainnet
npx hardhat verify --network coston2 <ADDRESS> "<CONSTRUCTOR>"   # Verify contracts
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

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

## 🔥 $10K Fair Launch – Live

**Shield Finance ($SHIELD)** has successfully launched with a **$10,000 liquidity commitment** and **100% LP tokens locked for 12 months** on **SparkDEX V3** (Flare mainnet).

### Tokenomics

- **Total Supply**: 10,000,000 SHIELD
- **Circulating**: 8,000,000 SHIELD (80%)
  - 5,353,451 SHIELD + 535,451 wFLR = $10K initial liquidity
  - 2,646,549 SHIELD reserved for ecosystem development
- **Airdrop**: 2,000,000 SHIELD (20%)
  - Claimable via Merkle proof (MerkleDistributor.sol)
  - Fair distribution to early supporters
- **Initial Price**: $0.01 per SHIELD
- **Liquidity Lock**: 12 months via Team Finance (or equivalent)

### Revenue Model: Real Burns, No Inflation

Shield Finance generates **real revenue** from vault fees, creating **deflationary pressure** through automated buyback & burn:

1. **Deposit Fee (0.2%)**: Collected on every vault deposit → sent to RevenueRouter
2. **Withdrawal Fee (0.2%)**: Collected on every vault withdrawal → sent to RevenueRouter
3. **Automated Burns**: Every Sunday, GitHub Actions checks if RevenueRouter has ≥5000 wFLR (~$100):
   - If yes → calls `distribute()` to execute buyback & burn on SparkDEX
   - SHIELD is bought from DEX using accumulated wFLR
   - Purchased SHIELD is permanently burned
   - Reduces total supply, increasing scarcity

**No minting. No inflation. Only burns.** As vault TVL grows, burn rate accelerates.

### Future: Stake $SHIELD → Boost Your XRP Yield

**Coming Soon:** Staking functionality will allow SHIELD holders to boost their XRP liquid staking APY. Implementation pending post-launch based on community feedback.

### Contract Addresses (Flare Mainnet)

**Note:** Deploy contracts using `tsx scripts/deploy-direct.ts` before fair launch.

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
   export REVENUE_ROUTER_ADDRESS="deployed-router-address"
   
   # Deploy
   tsx scripts/deploy-direct.ts
   ```
   Deploys: ShieldToken.sol, RevenueRouter.sol, ShXRPVault.sol, MerkleDistributor.sol

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
   Creates wFLR-SHIELD pool with $10K liquidity

4. **Lock LP NFT** (12 months)
   - Use Team Finance: https://team.finance
   - Lock LP NFT position for 12 months
   - Save proof URL/transaction hash

5. **Enable Automated Burns**
   - Add `REVENUE_ROUTER_ADDRESS` secret to GitHub repo
   - Workflow runs every Sunday at 00:00 UTC
   - Burns occur when RevenueRouter balance ≥ 5000 wFLR

### Announcement Tweet

```
🛡️ Shield Finance $SHIELD just fair-launched with $10K liquidity and 100% LP locked 12 months.

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
- **Twitter**: [@ShieldFinance]
- **Telegram**: [t.me/ShieldFinance]
- **Discord**: [discord.gg/ShieldFinance]

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
- **[replit.md](replit.md)** - Technical architecture and system design
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Quick deployment command reference
- **[design_guidelines.md](design_guidelines.md)** - UI/UX design system
- **[.env.example](.env.example)** - Environment variables reference

## 🔗 Links

- **Repository**: [github.com/shield-xrpfinance/shieldfinance](https://github.com/shield-xrpfinance/shieldfinance)
- **Live Application**: [https://shyield.finance](https://shyield.finance)
- **Block Explorers**:
  - Flare Coston2: https://coston2-explorer.flare.network
  - Flare Mainnet: https://flare-explorer.flare.network
  - XRPL Testnet: https://testnet.xrpl.org
  - XRPL Mainnet: https://livenet.xrpl.org

## 👥 Team

**Shield Yield Vaults Ltd.** - Making DeFi on XRP accessible and efficient

---

Built with ❤️ for the XRP community
