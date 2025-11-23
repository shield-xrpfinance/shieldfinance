# 🚀 Quick Deployment Reference

## ✅ Deployment Status

**Smart contracts successfully deployed to Flare Coston2 Testnet - Updated November 23, 2025**

### Deployed Contracts

- **ShieldToken ($SHIELD)**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Total Supply: 100,000,000 SHIELD
  - Deployer holds: 98,000,000 SHIELD
  - MerkleDistributor funded: 2,000,000 SHIELD (for airdrop)

- **ShXRP Vault (ERC-4626)** (Updated): `0x82d74B5fb005F7469e479C224E446bB89031e17F`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x82d74B5fb005F7469e479C224E446bB89031e17F)
  - ERC-4626 compliant tokenized vault with revenue distribution and staking boost
  - Integrated with RevenueRouter for fee management
  - Integrated with StakingBoost for APY enhancement
  - Minimum deposit: 0.01 FXRP (10000 units with 6 decimals)
  - Decimal precision: 6 (matches FXRP)

- **RevenueRouter**: `0x8e5C9933c08451a6a31635a3Ea1221c010DF158e`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x8e5C9933c08451a6a31635a3Ea1221c010DF158e)
  - Revenue distribution: 50% swapped to SHIELD and burned, 50% kept as reserves
  - Implementation: See `RevenueRouter.sol` `distribute()` function (line: `uint256 buybackAmount = balance / 2;`)
  - Uses Uniswap V3-compatible router: `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`

- **StakingBoost**: `0xD8DF192872e94F189602ae3634850C989A1802C6`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xD8DF192872e94F189602ae3634850C989A1802C6)
  - Lock period: 30 days (2,592,000 seconds)
  - Boost formula: 1% APY boost per 100 SHIELD staked
  - Maximum boost: Uncapped

- **MerkleDistributor**: `0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31)
  - Airdrop distribution: 2,000,000 SHIELD tokens
  - Merkle Root: `0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4`
  - Eligible addresses: 20 (test airdrop)
  - Status: ✅ Funded and ready for claims

- **Smart Account (Etherspot)**: `0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd)
  - ERC-4337 smart account for gasless transactions
  - Manages vault deposits and withdrawals

### Legacy Contracts (Old Deployment)

- **Old ShXRP Vault**: `0x8fe09217445e90DA692D29F30859dafA4eb281d1`
  - ⚠️ **Deprecated** - Deployed without RevenueRouter and StakingBoost integration
  - Migrate user positions to new vault if any exist

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
# Note: ShieldToken is already verified on Coston2 - no need to verify again
# Contract: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992

# RevenueRouter (November 23, 2025)
# Constructor: (address shieldToken, address wflr, address router)
npx hardhat verify --network coston2 \
  0x8e5C9933c08451a6a31635a3Ea1221c010DF158e \
  "0x07F943F173a6bE5EC63a8475597d28aAA6B24992" \
  "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273" \
  "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781"

# StakingBoost (November 23, 2025)
# Constructor: (address shieldToken)
npx hardhat verify --network coston2 \
  0xD8DF192872e94F189602ae3634850C989A1802C6 \
  "0x07F943F173a6bE5EC63a8475597d28aAA6B24992"

# MerkleDistributor (November 23, 2025)
# Constructor: (address token, bytes32 merkleRoot)
npx hardhat verify --network coston2 \
  0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31 \
  "0x07F943F173a6bE5EC63a8475597d28aAA6B24992" \
  "0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4"

# ShXRP Vault (November 23, 2025)
# Constructor: (address asset, string name, string symbol, address revenueRouter, address stakingBoost)
npx hardhat verify --network coston2 \
  0x82d74B5fb005F7469e479C224E446bB89031e17F \
  "0x0b6A3645c240605887a5532109323A3E12273dc7" \
  "Shield XRP" \
  "shXRP" \
  "0x8e5C9933c08451a6a31635a3Ea1221c010DF158e" \
  "0xD8DF192872e94F189602ae3634850C989A1802C6"
```

### 5. Combined Testnet Deployment
```bash
# Deploy Flare contracts - ✅ COMPLETED
tsx scripts/deploy-direct.ts
```

## Environment Variables Required

Create a `.env` file with (or use Replit Secrets):

```bash
# Flare Deployment
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here

# Frontend (deployed addresses for Coston2 testnet - Updated November 23, 2025)
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992
VITE_SHXRP_VAULT_ADDRESS=0x82d74B5fb005F7469e479C224E446bB89031e17F
VITE_REVENUE_ROUTER_ADDRESS=0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
VITE_STAKING_BOOST_ADDRESS=0xD8DF192872e94F189602ae3634850C989A1802C6
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31
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

### Coston2 Testnet (Updated November 23, 2025)

```
ShieldToken (Coston2): 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
ShXRP Vault (Coston2): 0x82d74B5fb005F7469e479C224E446bB89031e17F
RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
StakingBoost: 0xD8DF192872e94F189602ae3634850C989A1802C6
MerkleDistributor: 0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31
Smart Account (Etherspot): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Deployer Address: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D

Merkle Root (Airdrop): 0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4
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

### Key Components (Coston2 Testnet - Updated November 23, 2025)

```bash
# XRPL Side
XRP Deposit Address: r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY

# Flare Side
ShXRP Vault (ERC-4626): 0x82d74B5fb005F7469e479C224E446bB89031e17F
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Smart Account (ERC-4337): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd

# Revenue & Governance
RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
StakingBoost: 0xD8DF192872e94F189602ae3634850C989A1802C6
MerkleDistributor: 0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31
ShieldToken: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
```

### Contract Versioning & Deprecated Deployments

During testnet development, multiple SHIELD token contracts were deployed as the protocol evolved. **Only the ACTIVE contract should be used.**

| Address | Status | Deployment Date | Notes |
|---------|--------|-----------------|-------|
| `0xD6D476149D169fdA8e05f4EF5Da8a8f8c27a8308` | ❌ DEPRECATED | Nov 9, 2025 | Ownership renounced Nov 23, 2025 ([TX](https://coston2-explorer.flare.network/tx/0x54a7360cd386508aa7a47d32db90e7289435a2ac086873e7c4b85cd9f9a52493)) - Contract frozen |
| `0x59fF3b7Ae628beEFFAe980F30240ec4e84448209` | ❌ DEPRECATED | Earlier testnet | Ownership renounced Nov 23, 2025 ([TX](https://coston2-explorer.flare.network/tx/0x49ea271b40f1a1234ceb6c9e5cdcf0254f949059d06cc719b70bbb7170adf83c)) - Contract frozen |
| `0x07F943F173a6bE5EC63a8475597d28aAA6B24992` | ✅ ACTIVE | Nov 23, 2025 | **Current production contract** with RevenueRouter, StakingBoost, and MerkleDistributor integration |

#### Why Multiple Deployments?

The protocol underwent architectural improvements during testnet development:

1. **First Deployment** (`0x59fF3b...`): Initial testnet deployment for basic testing
2. **Second Deployment** (`0xD6D476...`): Enhanced deployment documented in `docs/archive/TESTNET_DEPLOYMENT_SUMMARY.md`
3. **Current Deployment** (`0x07F943...`): Production-ready deployment with:
   - **RevenueRouter**: Automated buyback-and-burn mechanism (50% of fees)
   - **StakingBoost**: APY enhancement for SHIELD stakers (1% boost per 100 SHIELD)
   - **MerkleDistributor**: Fair airdrop distribution system

#### What Happened to Old Deployments?

Deprecated contracts **had ownership renounced** on **November 23, 2025** to permanently freeze them:

**Contract #1** (`0xD6D476...8308`):
- Transaction: [`0x54a7360cd386508aa7a47d32db90e7289435a2ac086873e7c4b85cd9f9a52493`](https://coston2-explorer.flare.network/tx/0x54a7360cd386508aa7a47d32db90e7289435a2ac086873e7c4b85cd9f9a52493)
- Block: 24297250
- Status: ✅ Permanently frozen

**Contract #2** (`0x59fF3b...8209`):
- Transaction: [`0x49ea271b40f1a1234ceb6c9e5cdcf0254f949059d06cc719b70bbb7170adf83c`](https://coston2-explorer.flare.network/tx/0x49ea271b40f1a1234ceb6c9e5cdcf0254f949059d06cc719b70bbb7170adf83c)
- Block: 24297253
- Status: ✅ Permanently frozen

After renouncement:
- ❌ No new tokens can be minted
- ❌ No contract parameters can be changed
- ❌ Contracts are permanently frozen in their current state

This ensures that old deployments cannot be confused with the active contract.

#### How to Identify the Active Contract

**✅ Always use: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`**

You can verify this is the active contract by:
1. Check [Coston2 Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
2. Verify contract owner is NOT `0x0000000000000000000000000000000000000000` (active)
3. Verify integration with RevenueRouter, StakingBoost, and MerkleDistributor

**⚠️ Important:** Only use the ACTIVE contract address. Deprecated contracts will have ownership renounced to permanently freeze them. Using old addresses will result in failed transactions or incorrect token balances.

**For historical deployment records, see:**
- `deployments/coston2-deployment.json` - Deprecated Nov 9 deployment (marked DEPRECATED)
- `docs/archive/TESTNET_DEPLOYMENT_SUMMARY.md` - Historical documentation (marked DEPRECATED)
- `scripts/audit-shield-tokens.ts` - Audit script showing all deployments
- `scripts/renounce-old-shield-tokens.ts` - Renouncement transaction records

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

# Contract addresses (Updated November 23, 2025)
VITE_SHXRP_VAULT_ADDRESS=0x82d74B5fb005F7469e479C224E446bB89031e17F
VITE_REVENUE_ROUTER_ADDRESS=0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
VITE_STAKING_BOOST_ADDRESS=0xD8DF192872e94F189602ae3634850C989A1802C6
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31
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
