# Changelog

All notable changes to the XRP Liquid Staking Protocol Dashboard will be documented in this file.

## [1.1.0] - 2025-11-09

### 🎉 Deployed - Smart Contracts Live on Flare Coston2 Testnet

#### Successful Deployment
- **ShieldToken ($SHIELD)** deployed to: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD sent to treasury
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)

- **StXRPVault (shXRP)** deployed to: `0xd8d78DA41473D28eB013e161232192ead2cc745A`
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
  
- **StXRPVault.sol**: Liquid staking vault contract
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
  - `scripts/deploy-hooks.sh`: XRPL Hooks deployment automation
  - Deployment info saved to JSON files
  - Block explorer link generation

#### XRPL Hooks
- Rust-based escrow hook for cross-chain XRP deposits
- WASM compilation support
- Testnet and mainnet deployment support

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
├── hooks/              # XRPL Hooks (Rust)
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
1. Frontend: User deposits XRP via wallet (Xaman/WalletConnect/Web3Auth)
2. XRPL Layer: Hook locks XRP in escrow
3. Flare Layer: Operator mints shXRP tokens
4. Database Layer: Position tracking in PostgreSQL
5. Withdrawal: User burns shXRP → Operator releases XRP from escrow

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
