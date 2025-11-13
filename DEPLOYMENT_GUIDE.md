# 🚀 Quick Deployment Reference

## ✅ Deployment Status

**Smart contracts successfully deployed to Flare Coston2 Testnet on November 12, 2025**

### Deployed Contracts

- **ShieldToken ($SHIELD)**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD

- **ShXRP Vault (ERC-4626)**: `0x8fe09217445e90DA692D29F30859dafA4eb281d1`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x8fe09217445e90DA692D29F30859dafA4eb281d1)
  - ERC-4626 compliant tokenized vault
  - Minimum deposit: 0.01 FXRP (10000 units with 6 decimals)
  - Decimal precision: 6 (matches FXRP)

- **Smart Account (Etherspot)**: `0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd)
  - ERC-4337 smart account for gasless transactions
  - Manages vault deposits and withdrawals

## Commands Summary

### 1. Compile Smart Contracts
```bash
npx hardhat compile
```

### 2. Deploy to Flare Coston2 (Testnet) - **COMPLETED ✅**
```bash
# Using direct ethers.js deployment (recommended for Hardhat 3)
tsx scripts/deploy-direct.ts
```

### 3. Deploy to Flare Mainnet
```bash
# Update RPC URL in deploy-direct.ts to mainnet
tsx scripts/deploy-direct.ts
```

### 4. Verify Contracts on Block Explorer
```bash
# ShieldToken (Coston2 Testnet)
npx hardhat verify --network coston2 0x07F943F173a6bE5EC63a8475597d28aAA6B24992 "0x105a22e3ff06ee17020a510fa5113b5c6d9feb2d"

# ShXRP Vault (Coston2 Testnet)
npx hardhat verify --network coston2 0x8fe09217445e90DA692D29F30859dafA4eb281d1
```

### 5. Combined Testnet Deployment
```bash
# Deploy Flare contracts - ✅ COMPLETED
tsx scripts/deploy-direct.ts
```

## Environment Variables Required

Create a `.env` file with:

```bash
# Flare Deployment
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here

# Frontend (deployed addresses for Coston2 testnet)
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992
VITE_SHXRP_VAULT_ADDRESS=0x8fe09217445e90DA692D29F30859dafA4eb281d1
```

## Testnet Faucets

- **Flare Coston2**: https://faucet.flare.network/coston2
- **XRPL Testnet**: https://xrpl.org/xrp-testnet-faucet.html

## Block Explorers

- **Flare Coston2**: https://coston2-explorer.flare.network
- **Flare Mainnet**: https://flare-explorer.flare.network
- **XRPL Testnet**: https://testnet.xrpl.org
- **XRPL Mainnet**: https://livenet.xrpl.org

## Contract Addresses

### Coston2 Testnet (Deployed November 12, 2025)

```
ShieldToken (Coston2): 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
ShXRP Vault (Coston2): 0x8fe09217445e90DA692D29F30859dafA4eb281d1
Smart Account (Etherspot): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Deployer Address: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D
```

### Mainnet (Not Yet Deployed)

```
ShieldToken (Flare): TBD
Shield XRP Vault (Flare): TBD
```

## Quick Troubleshooting

| Error | Solution |
|-------|----------|
| Insufficient funds | Get testnet tokens from faucets |
| Contract verification failed | Wait 2-3 minutes for block explorer to index |
| Private key error | Remove `0x` prefix from private key |
| `hre.ethers is undefined` (Hardhat 3) | Use `tsx scripts/deploy-direct.ts` instead of Hardhat scripts |
| Node.js version mismatch | Upgrade to Node.js 22+ for Hardhat 3 compatibility |

## Next Steps After Deployment

1. ✅ Update `.env` with contract addresses
2. ✅ Initialize Etherspot smart account (automatic on backend startup)
3. ✅ Test deposit flow on testnet (XRP → FXRP → shXRP)
4. ✅ Test withdrawal flow on testnet (redeem shXRP → FXRP)
5. ✅ Audit smart contracts before mainnet

## Liquid Staking Architecture

### Overview

The ShXRP Vault implements an **automated liquid staking system** using the FAssets bridge to convert XRP into yield-bearing FXRP tokens on Flare Network.

### How It Works

1. **XRP Deposit**: Users send XRP to monitored XRPL address `r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY`
2. **FAssets Bridge**: Automated conversion of XRP → FXRP using Flare Data Connector attestations
3. **Vault Deposit**: FXRP deposited into ERC-4626 compliant vault
4. **shXRP Minted**: Users receive liquid staking tokens representing their position
5. **Yield Generation**: FXRP deposited into Firelight.finance lending protocol
6. **Auto-Compounding**: Interest automatically reinvested to increase vault exchange rate

### System Flow

```
User Sends XRP (XRPL)
        ↓
XRPL Listener Detects Payment
        ↓
FAssets Bridge: XRP → FXRP (Automated)
        ↓
FXRP Deposited to ERC-4626 Vault
        ↓
shXRP Tokens Minted to User (Gasless via Etherspot)
        ↓
FXRP Deposited to Firelight.finance
        ↓
Yield Auto-Compounds → Exchange Rate Increases
```

### Key Components (Coston2 Testnet)

```bash
# XRPL Side
XRP Deposit Address: r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY

# Flare Side
ShXRP Vault (ERC-4626): 0x8fe09217445e90DA692D29F30859dafA4eb281d1
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Smart Account (ERC-4337): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
```

### ERC-4626 Vault Functions

The ShXRPVault implements standard ERC-4626 functions:

```solidity
// Deposit FXRP and receive shXRP (called by smart account)
function deposit(uint256 assets, address receiver) external returns (uint256 shares)

// Withdraw FXRP by redeeming shXRP (standard ERC-4626)
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)

// View functions
function totalAssets() external view returns (uint256)  // Total FXRP in vault
function convertToShares(uint256 assets) external view returns (uint256)
function convertToAssets(uint256 shares) external view returns (uint256)
```

### Withdrawal Process

Withdrawals use the **standard ERC-4626 redeem function** - no manual operator approval required:

1. User initiates withdrawal from dashboard
2. Smart account calls `vault.redeem(shares, userAddress, userAddress)`
3. Vault burns shXRP tokens
4. FXRP transferred to user's Flare wallet
5. Transaction is **gasless** via Etherspot paymaster

### Yield Generation

FXRP deposits automatically earn yield through **Firelight.finance** integration:

- **Current APY**: ~5-7% on FXRP deposits
- **Compounding**: Interest automatically reinvested
- **Exchange Rate**: shXRP value increases as yield compounds
- **Withdrawal**: Users can redeem shXRP for FXRP anytime

### Production Features

**Current (Coston2 Testnet):**
- ERC-4626 standard vault implementation
- Automated FAssets bridging (XRP → FXRP)
- Firelight.finance yield integration
- Gasless transactions via Etherspot smart accounts

**Upcoming:**
- Additional yield sources (SparkDEX, Kinetic Markets)
- Mainnet deployment on Flare Network
- Enhanced APY through multi-protocol strategies

### Setup Instructions

1. **Deploy ShXRPVault (ERC-4626):**
```bash
# See latest deployment in deployments/coston2-*.json
# Current vault: 0x8fe09217445e90DA692D29F30859dafA4eb281d1
```

2. **Initialize Smart Account:**
```bash
# Smart account automatically initialized by Etherspot Prime SDK
# Address: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
```

3. **Configure Environment:**
```bash
# Required secrets
OPERATOR_PRIVATE_KEY=your-operator-key
ETHERSPOT_BUNDLER_API_KEY=your-bundler-key
VITE_SHXRP_VAULT_ADDRESS=0x8fe09217445e90DA692D29F30859dafA4eb281d1
```

4. **Start Application:**
```bash
npm run dev
# Backend automatically monitors XRPL deposits
# FAssets bridge runs in production mode (DEMO_MODE=false)
```

### Yield Sources

| Platform | Type | APY | Status |
|----------|------|-----|--------|
| **Firelight.finance** | FXRP Lending | 5-7% | ✅ Active |
| **SparkDEX LP** | Liquidity Provision | 3-5% | 🚧 Planned |
| **Kinetic Markets** | Money Market | Variable | 🚧 Planned |

### Security Features

- **ERC-4626 Standard**: Industry-standard tokenized vault implementation
- **Smart Account (ERC-4337)**: Etherspot Prime SDK for secure, gasless transactions
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Minimum Deposits**: 0.01 FXRP minimum prevents dust attacks
- **FDC Attestations**: Flare Data Connector verifies XRPL transactions
- **Idempotent Operations**: Double-mint prevention with unique transaction tracking
- **Automated Reconciliation**: System automatically recovers stuck bridges

### Monitoring System

Check vault and bridge status:

**Vault Metrics:**
```solidity
// View total assets in vault (ERC-4626)
vault.totalAssets()

// View exchange rate (shares to assets)
vault.convertToAssets(1e6)  // 1 shXRP → X FXRP

// View user's position
vault.balanceOf(userAddress)
```

**Bridge Status:**
```bash
# Check bridge records in database
GET /api/bridges?status=completed

# Monitor XRPL deposits
GET /api/deposits?walletAddress=<address>

# View Firelight positions
GET /api/firelight/positions
```

---

For detailed instructions, see **README.md** section: "How to Deploy to Testnet"
