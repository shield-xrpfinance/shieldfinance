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
- Secure deposit workflow with success modals
- Request-based withdrawal approval system
- Claim rewards functionality
- Complete transaction history and analytics

### 📊 Dashboard Features
- Portfolio overview with total value locked
- Active vault statistics
- Historical APY trends with charts
- Transaction history with filtering
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
- **XRPL Hooks**: Rust-based hooks for cross-chain escrow

## 📦 Installation

### Prerequisites
- Node.js 18+ 
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

# XRPL Hooks Deployment (Required for XRPL hooks deployment)
XRPL_HOOK_ACCOUNT_SECRET=your-xrpl-account-secret-here
XRPL_NETWORK=testnet

# Frontend Contract Addresses (Update after deployment)
VITE_SHIELD_TOKEN_ADDRESS=0x...
VITE_STXRP_VAULT_ADDRESS=0x...
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

**withdrawal_requests**
- Pending withdrawal requests
- Vault operator approval queue
- Claim requests

**vault_metrics_daily**
- Historical performance data
- APY trends over time
- Analytics aggregation

## 🚀 How to Deploy to Testnet

This section covers deploying the **smart contracts** to Flare Coston2 testnet and **XRPL Hooks** to XRP Ledger testnet.

### Prerequisites

1. **Get Testnet Funds**:
   - **Flare Coston2**: Get free C2FLR from https://faucet.flare.network/coston2
   - **XRPL Testnet**: Get free test XRP from https://xrpl.org/xrp-testnet-faucet.html

2. **Set Up Environment Variables**:
   ```bash
   # Copy .env.example to .env
   cp .env.example .env
   
   # Add your private keys and secrets
   nano .env
   ```

3. **Required Environment Variables** (see `.env.example` for full list):
   ```bash
   # Flare deployment
   DEPLOYER_PRIVATE_KEY=your-private-key-here
   TREASURY_ADDRESS=your-treasury-address-here
   
   # XRPL hooks deployment
   XRPL_HOOK_ACCOUNT_SECRET=your-xrpl-secret-here
   XRPL_NETWORK=testnet
   ```

### Step 1: Deploy Flare Smart Contracts

Deploy **ShieldToken** ($SHIELD) and **StXRPVault** (stXRP) contracts to Flare Coston2:

```bash
# Compile contracts
npx hardhat compile

# Deploy to Coston2 testnet
npx hardhat run scripts/deploy-flare.ts --network coston2
```

**Expected Output**:
```
🚀 Starting Flare deployment...
📝 Deploying contracts with account: 0x...
💰 Account balance: 100.0 FLR

1️⃣ Deploying ShieldToken...
✅ ShieldToken deployed to: 0x...
   Total Supply: 100000000.0 SHIELD
   Treasury Allocation: 10000000.0 SHIELD

2️⃣ Deploying StXRPVault...
✅ StXRPVault deployed to: 0x...
   Vault Token: Staked XRP (stXRP)
   Initial Exchange Rate: 1.0 stXRP per XRP

✅ Deployment complete!
```

**Deployment info saved to**: `deployments/coston2-deployment.json`

### Step 2: Verify Contracts (Optional)

Verify your deployed contracts on Flare block explorer:

```bash
# Verify ShieldToken
npx hardhat verify --network coston2 <SHIELD_TOKEN_ADDRESS> "<TREASURY_ADDRESS>"

# Verify StXRPVault
npx hardhat verify --network coston2 <STXRP_VAULT_ADDRESS>
```

### Step 3: Deploy XRPL Hooks

Deploy the XRP escrow hook to XRPL testnet:

```bash
# Make script executable (if not already)
chmod +x scripts/deploy-hooks.sh

# Run deployment
./scripts/deploy-hooks.sh
```

**What this script does**:
1. Installs Rust and Cargo (if needed)
2. Installs xrpl-hooks CLI
3. Compiles the hook (Rust → WASM)
4. Deploys to XRPL testnet

**Expected Output**:
```
🚀 XRPL Hooks Deployment Script
================================

✅ Rust/Cargo installed
✅ xrpl-hooks CLI installed
🔨 Compiling hook...
✅ Hook compiled successfully
🚀 Deploying hook to XRPL testnet...
✅ Hook deployed successfully!
```

### Step 4: Update Frontend Configuration

After deployment, update your frontend `.env` with the contract addresses:

```bash
# Add these to your .env file
VITE_SHIELD_TOKEN_ADDRESS=<deployed-shield-address>
VITE_STXRP_VAULT_ADDRESS=<deployed-vault-address>
```

### Step 5: Configure Vault Operator

The StXRPVault contract needs an operator to mint/burn stXRP:

```bash
# Using Hardhat console
npx hardhat console --network coston2

# Add operator address
const vault = await ethers.getContractAt("StXRPVault", "<VAULT_ADDRESS>");
await vault.addOperator("<OPERATOR_ADDRESS>");
```

### Step 6: Test the Integration

1. **Test Deposit Flow**:
   - Connect wallet to your dApp
   - Initiate deposit (triggers XRPL hook)
   - Hook locks XRP in escrow
   - Operator mints stXRP on Flare

2. **Test Withdrawal Flow**:
   - Request withdrawal (burns stXRP)
   - Operator releases XRP from XRPL escrow

### Production Deployment

To deploy to **mainnet** networks:

```bash
# Flare Mainnet
npx hardhat run scripts/deploy-flare.ts --network flare

# XRPL Mainnet (update XRPL_NETWORK=mainnet in .env)
./scripts/deploy-hooks.sh
```

**⚠️ Important**: 
- Use a hardware wallet or secure key management for mainnet deployments
- Thoroughly test on testnet first
- Audit smart contracts before mainnet deployment
- Ensure sufficient funds for deployment (FLR for gas, XRP for hook fees)

### Deployment File Structure

After deployment, you'll have:

```
deployments/
├── coston2-deployment.json    # Testnet deployment info
└── flare-deployment.json      # Mainnet deployment info (if deployed)

hooks/
├── escrow_hook.rs             # Hook source code
└── target/                    # Compiled WASM
```

### Troubleshooting

**"Insufficient funds" error**:
- Get testnet tokens from faucets
- Check your account balances

**"Hook compilation failed"**:
- Ensure Rust is installed: `cargo --version`
- Check hook syntax in `hooks/escrow_hook.rs`

**"Contract verification failed"**:
- Ensure constructor arguments match deployment
- Wait a few minutes for block explorer to index

### Deployment Scripts Summary

- **`npx hardhat compile`** - Compile Solidity contracts
- **`npx hardhat run scripts/deploy-flare.ts --network coston2`** - Deploy to Flare testnet
- **`./scripts/deploy-hooks.sh`** - Deploy XRPL hooks
- **`npx hardhat verify`** - Verify contracts on block explorer

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

### StXRPVault (stXRP)
- **Type**: Liquid staking vault for XRP
- **Symbol**: stXRP (Staked XRP)
- **Initial Exchange Rate**: 1:1 (stXRP:XRP)
- **Key Features**:
  - Operator-controlled minting/burning for security
  - Reward distribution updates exchange rate
  - Minimum deposit: 0.01 XRP
  - ReentrancyGuard protection
  - Event emission for transparency

### XRPL Hooks
- **Purpose**: Cross-chain escrow for XRP deposits
- **Language**: Rust compiled to WASM
- **Function**: Locks XRP in escrow, emits events for Flare bridge

**Deployment Info**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for testnet/mainnet deployment instructions.

## 🔒 Security Features

- **Request-Based Withdrawals**: All withdrawals require vault operator approval
- **Operator-Controlled Minting**: Only approved operators can mint/burn stXRP tokens
- **ReentrancyGuard Protection**: Smart contracts protected against reentrancy attacks
- **Secure Key Management**: Environment-based secret storage
- **Session Management**: PostgreSQL-backed sessions with secure cookies
- **Transaction Verification**: All blockchain transactions verified on-chain
- **XRP Address Validation**: Client and server-side validation
- **XRPL Hash Verification**: Every stXRP mint requires valid XRPL transaction hash

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
│   └── StXRPVault.sol     # Liquid staking vault
├── scripts/               # Deployment scripts
│   ├── deploy-flare.ts    # Flare network deployment
│   └── deploy-hooks.sh    # XRPL hooks deployment
├── hooks/                 # XRPL Hooks (Rust)
│   └── escrow_hook.rs     # XRP escrow hook
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
npx hardhat run scripts/deploy-flare.ts --network coston2        # Deploy to testnet
npx hardhat run scripts/deploy-flare.ts --network flare          # Deploy to mainnet
./scripts/deploy-hooks.sh                                        # Deploy XRPL hooks
npx hardhat verify --network coston2 <ADDRESS> "<CONSTRUCTOR>"   # Verify contracts
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## 📊 Vault System

All deposits are routed to the vault address:
```
rpC7sRSUcK6F1nPb9E5U8z8bz5ee5mFEjC
```

**Why Approval Required?**
Users don't have direct access to the vault's private key for security. All withdrawals must be approved and executed by vault operators through the Admin dashboard.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Shield Finance Inc.

## 📚 Documentation

- **[README.md](README.md)** - Main project documentation (this file)
- **[replit.md](replit.md)** - Technical architecture and system design
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Quick deployment command reference
- **[design_guidelines.md](design_guidelines.md)** - UI/UX design system
- **[.env.example](.env.example)** - Environment variables reference

## 🔗 Links

- **Repository**: [github.com/shield-xrpfinance/shieldfinance](https://github.com/shield-xrpfinance/shieldfinance)
- **Live Application**: [Coming Soon]
- **Block Explorers**:
  - Flare Coston2: https://coston2-explorer.flare.network
  - Flare Mainnet: https://flare-explorer.flare.network
  - XRPL Testnet: https://testnet.xrpl.org
  - XRPL Mainnet: https://livenet.xrpl.org

## 👥 Team

**Shield Finance Inc.** - Making DeFi on XRP accessible and efficient

---

Built with ❤️ for the XRP community
