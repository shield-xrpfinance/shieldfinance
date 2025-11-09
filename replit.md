# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application designed for XRP liquid staking with integrated blockchain infrastructure. It provides a comprehensive dashboard for users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform includes smart contracts deployed on Flare Network for the $SHIELD governance token and shXRP liquid staking vault, along with XRPL Hooks for cross-chain escrow. The business vision is to make DeFi on XRP accessible and efficient, tapping into the growing market for liquid staking solutions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state.
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS for styling, Material Design + DeFi patterns, custom CSS variables for theming, responsive layout with collapsible sidebar, 12-column grid.
- **State Management**: React Context API for wallet with localStorage persistence (auto-restores connection on page load/republish), TanStack Query for server state, React hooks for local component state.
- **Typography**: Inter (UI), JetBrains Mono (monospace).

### Backend Architecture
- **Server**: Express.js with Node.js and TypeScript, RESTful API.
- **API Endpoints**: CRUD operations for vaults and user positions, including dedicated endpoints for deposits, withdrawals, and claims.
- **Data Validation**: Zod schemas, drizzle-zod for database schema validation.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM for type-safe queries.
- **Schema**: 
  - `vaults` (vault configurations)
  - `positions` (user deposits, rewards, timestamps)
  - `transactions` (all deposit/withdrawal/claim activities)
  - `vault_metrics_daily` (historical analytics)
  - `withdrawal_requests` (pending withdrawal and claim requests requiring vault operator approval)
- **Key Features**: UUID primary keys, decimal precision for financial data, seed data for initial setup.
- **Withdrawal/Claim System**: Request-based approval flow where users submit withdrawal/claim requests that are reviewed and approved by vault operators through the Admin dashboard.

### System Design Choices
- **Separation of Concerns**: `/client` (frontend), `/server` (backend), `/shared` (shared types/schemas).
- **Environment Variables**: Validation for `DATABASE_URL` and `SESSION_SECRET`.
- **CORS and Session Handling**: Integrated into Express middleware.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration for transaction signing (deposits, withdrawals, claims). Uses `xumm-sdk` for payload generation and a polling mechanism for signature confirmation. Includes automatic payload cleanup to prevent hitting the 61 payload limit. Requires `XUMM_API_KEY` and `XUMM_API_SECRET` environment variables to be set in Replit Secrets.
- **WalletConnect**: XRPL-compatible wallet connection and transaction signing using `@walletconnect/universal-provider` configured for the `xrpl` namespace (not Ethereum). Supports XRPL mainnet (xrpl:0) and testnet (xrpl:1) with dynamic chain switching based on network toggle. Uses `xrpl_signTransaction` for signing which returns `{ tx_json }` or `{ result: { tx_json }}`. Frontend encodes signed tx_json to tx_blob using `xrpl.encode()`, then submits via backend endpoint `/api/xrpl/submit`. Backend handles wallet auto-submission: if sequence error occurs (wallet already submitted), queries XRPL to verify transaction success using `hashes.hashSignedTx()` for hash computation. Returns success if transaction validated with tesSUCCESS. Requires `VITE_WALLETCONNECT_PROJECT_ID` from cloud.walletconnect.com.
- **Web3Auth (Social Login)**: ✅ Fully functional. Web3Auth enables social login (Google, Facebook, Twitter, Discord, Email) for XRP wallet creation. Implementation uses `@web3auth/modal` v10.x with browser-native `@noble/secp256k1` for XRPL wallet derivation from Web3Auth's secp256k1 private keys. Uses HTML-based polyfills for Buffer and process (loaded in `client/index.html`) following Web3Auth's official documentation. **Configuration**: Always uses sapphire_devnet (testnet) network as the current Client ID is configured for testnet on Web3Auth dashboard. Requires `VITE_WEB3AUTH_CLIENT_ID` from dashboard.web3auth.io (configured in Secrets). To support mainnet, create a separate Web3Auth project for sapphire_mainnet and configure different Client IDs.
- **Transaction Signing Routing**: Automatically routes to correct signing provider based on wallet connection method - Xaman users sign via Xaman modal with QR codes, WalletConnect users sign directly in their connected wallet app.
- **XRP Ledger Balance Fetching**: Real-time balance retrieval using the `xrpl` library for XRP, RLUSD, and USDC with 30-second auto-refresh.
- **QR Code Display**: `qrcode.react` for generating scannable QR codes for Xaman wallet interactions.
- **Demo Mode**: Fallback for wallet connections when API keys are not configured, providing mock functionality with demo XRP addresses.

### UI & Data Visualization
- **Recharts**: For displaying APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Smart Contract Development
- **Hardhat**: Ethereum development environment for compiling, testing, and deploying Solidity contracts.
- **OpenZeppelin Contracts**: Secure, audited implementations of ERC-20 and access control standards.
- **Solidity 0.8.20**: Smart contract language with built-in overflow protection.
- **Flare Network Integration**: 
  - Coston2 testnet (Chain ID: 114) for testing
  - Flare mainnet (Chain ID: 14) for production
  - Block explorer integration for contract verification

### Development & Deployment
- **Replit-specific plugins**: Runtime error overlay, cartographer, dev banner.
- **Drizzle Kit**: For database migrations.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Comprehensive development tools including ethers.js v6, contract verification, and testing utilities.

### Fonts
- Google Fonts CDN: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter.

## Blockchain Infrastructure

### Smart Contracts (Flare Network)

#### ShieldToken.sol
- **Type**: ERC-20 governance and utility token
- **Symbol**: SHIELD
- **Total Supply**: 100,000,000 SHIELD
- **Features**:
  - Treasury Allocation: 10,000,000 SHIELD (10%)
  - Burnable by token holders
  - Mintable by owner (for controlled emissions)
  - Ownership transferable to DAO governance
- **Decimals**: 18
- **Network**: Deployed on Flare Coston2 testnet and Flare mainnet

#### StXRPVault.sol
- **Type**: Liquid staking vault for XRP
- **Symbol**: shXRP (Shield XRP)
- **Features**:
  - Mints shXRP 1:1 for deposited XRP (initially)
  - Burns shXRP on withdrawal
  - Operator-controlled minting/burning for security
  - Reward distribution system updates exchange rate
  - Minimum deposit: 0.01 XRP equivalent
  - Exchange rate tracking (shXRP to XRP)
  - ReentrancyGuard protection
- **Integration**: Works with XRPL Hooks for cross-chain bridge
- **Decimals**: 18
- **Network**: Deployed on Flare Coston2 testnet and Flare mainnet

### XRPL Hooks
- **Hook Type**: XRP escrow hook for liquid staking
- **Purpose**: Locks XRP in escrow and emits events for Flare bridge
- **Language**: Rust compiled to WASM
- **Deployment**: XRPL testnet and mainnet
- **Workflow**:
  1. User initiates deposit → Frontend calls XRPL hook
  2. XRPL hook locks XRP in escrow → Emits event
  3. Operator calls `mintStXRP()` on Flare → Issues shXRP to user
  4. User requests withdrawal → Burns shXRP on Flare
  5. Operator releases XRP from XRPL escrow

### Deployment Scripts

#### deploy-direct.ts
- **Purpose**: Deploy ShieldToken and StXRPVault to Flare Network using direct ethers.js
- **Features**:
  - Uses ethers.js v6 directly (bypasses Hardhat plugin issues)
  - Deploys both contracts in sequence
  - Saves deployment info to JSON (deployments/ directory)
  - Provides block explorer links
  - Validates deployer balance
  - Configurable treasury address
- **Networks**: Configured for Coston2 testnet, easily adaptable for mainnet
- **Usage**: `tsx scripts/deploy-direct.ts`

#### Deployed Contracts (Coston2 Testnet)
- **ShieldToken ($SHIELD)**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD
  
- **StXRPVault (shXRP)**: `0xd8d78DA41473D28eB013e161232192ead2cc745A`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xd8d78DA41473D28eB013e161232192ead2cc745A)
  - Initial Exchange Rate: 1.0 shXRP per XRP
  - Deployed on: 2025-11-09

#### deploy-hooks.sh
- **Purpose**: Deploy XRPL escrow hook to XRP Ledger
- **Features**:
  - Auto-installs Rust toolchain if needed
  - Installs xrpl-hooks CLI
  - Compiles Rust hook to WASM
  - Deploys to XRPL testnet or mainnet
  - Environment-driven configuration
- **Networks**: Configurable via XRPL_NETWORK env variable
- **Usage**: `./scripts/deploy-hooks.sh`

### Deployment Configuration

#### hardhat.config.ts
- **Solidity Version**: 0.8.20 with optimizer enabled (200 runs)
- **Networks**:
  - Coston2 (testnet): Chain ID 114, RPC: https://coston2-api.flare.network/ext/C/rpc
  - Flare (mainnet): Chain ID 14, RPC: https://flare-api.flare.network/ext/C/rpc
  - Local Hardhat network: Chain ID 31337
- **Gas Configuration**: 25 gwei for both networks
- **Verification**: Custom chain configuration for Flare block explorers
- **Environment Variables**: DEPLOYER_PRIVATE_KEY, TREASURY_ADDRESS, FLARE_API_KEY

### Environment Variables (Blockchain)

Required for smart contract deployment:

```bash
# Flare Network Deployment
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here
FLARE_COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_MAINNET_RPC_URL=https://flare-api.flare.network/ext/C/rpc
FLARE_API_KEY=your-flare-api-key-here

# XRPL Hooks Deployment
XRPL_HOOK_ACCOUNT_SECRET=your-xrpl-account-secret-here
XRPL_NETWORK=testnet

# Frontend Contract Addresses (updated post-deployment)
VITE_SHIELD_TOKEN_ADDRESS=0x...
VITE_SHXRP_VAULT_ADDRESS=0x...
```

### Contract Architecture

The smart contract system operates alongside the existing vault infrastructure:

1. **Frontend Layer**: User deposits XRP via wallet (Xaman/WalletConnect/Web3Auth)
2. **XRPL Layer**: Hook locks XRP in escrow on XRP Ledger
3. **Flare Layer**: Operator mints shXRP tokens on Flare Network
4. **Database Layer**: Position and transaction tracking in PostgreSQL
5. **Withdrawal Flow**: User burns shXRP → Operator releases XRP from escrow

### Security Features (Blockchain)

- **Operator Model**: Only approved operators can mint/burn shXRP, preventing unauthorized token creation
- **ReentrancyGuard**: Protection against reentrancy attacks on vault operations
- **Minimum Deposits**: 0.01 XRP minimum prevents dust attacks
- **Exchange Rate Tracking**: Transparent reward distribution with on-chain verification
- **Event Emission**: All mint/burn operations emit events for transparency and indexing
- **XRPL Hash Verification**: Every mint operation requires XRPL transaction hash for verification