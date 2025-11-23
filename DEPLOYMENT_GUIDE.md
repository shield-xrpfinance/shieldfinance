# 🚀 Quick Deployment Reference

## ⚠️ IMPORTANT: Current Deployment Notice

**As of November 23, 2025, Shield Finance uses a 10M SHIELD token supply.**

All previous 100M SHIELD deployments are **DEPRECATED** and should not be used. See [Deployment Timeline](#deployment-timeline) and [Migration Guide](#migration-guide-from-100m-to-10m) below.

---

## 📅 Deployment Timeline

Shield Finance underwent several iterations during testnet development to reach the optimal token economics:

| Date | Event | SHIELD Supply | Status |
|------|-------|---------------|--------|
| **Nov 23, 2025** | First 100M deployment | 100,000,000 | ❌ **DEPRECATED** (Renounced) |
| **Nov 23, 2025** | Second 100M deployment | 100,000,000 | ❌ **DEPRECATED** (Renounced) |
| **Nov 23, 2025** | Third 100M deployment | 100,000,000 | ❌ **DEPRECATED** (To be renounced) |
| **Nov 23, 2025** | **CURRENT: 10M deployment** | **10,000,000** | ✅ **ACTIVE** |

**Why the change?** The 10M supply provides better tokenomics:
- Airdrop represents 20% of supply (vs 2% with 100M)
- More decentralized governance distribution
- Better price stability with lower circulating supply
- Same absolute 2M SHIELD airdrop to community

---

## ✅ Current Deployment (10M SHIELD Supply)

**Smart contracts deployed to Flare Coston2 Testnet - November 23, 2025**

### Active Contracts (10M SHIELD)

- **ShieldToken ($SHIELD)**: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616)
  - Total Supply: **10,000,000 SHIELD** (correct supply)
  - Deployer holds: 10,000,000 SHIELD (to be distributed)
  - Airdrop allocation: 2,000,000 SHIELD (20% of supply)
  - Status: ✅ **ACTIVE - Use this address**

- **RevenueRouter**: `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB)
  - Revenue distribution: 50% swapped to SHIELD and burned, 50% kept as reserves
  - Uses Uniswap V3-compatible router: `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`
  - Status: ✅ Deployed and verified

- **StakingBoost**: `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4)
  - Lock period: 30 days (2,592,000 seconds)
  - Boost formula: 1% APY boost per 100 SHIELD staked
  - Maximum boost: Uncapped
  - Status: ✅ Deployed and verified

- **MerkleDistributor**: `0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490)
  - Airdrop distribution: 2,000,000 SHIELD tokens (20% of total supply)
  - Merkle Root: `0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4`
  - Eligible addresses: 20 (test airdrop)
  - Status: ✅ Deployed and verified (pending funding)

- **ShXRP Vault (ERC-4626)**: ⏳ **PENDING DEPLOYMENT**
  - Status: ❌ Deployment blocked - insufficient gas (need ~0.2 FLR)
  - Required constructor args:
    - FXRP Token: `0x0b6A3645c240605887a5532109323A3E12273dc7`
    - RevenueRouter: `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB`
    - StakingBoost: `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`
  - Deploy script: `npx tsx scripts/deploy-shxrp-only.ts`
  - **Note:** Get test FLR from [Coston2 Faucet](https://faucet.flare.network/coston2) to complete deployment

- **Smart Account (Etherspot)**: `0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd)
  - ERC-4337 smart account for gasless transactions
  - Manages vault deposits and withdrawals
  - Status: ✅ Active

---

## ❌ DEPRECATED: 100M SHIELD Deployments

### ⚠️ DO NOT USE THESE ADDRESSES

The following contracts were deployed with 100M SHIELD supply and are now **permanently deprecated**. All have been or will be renounced to prevent confusion.

### Deprecated Deployment #1 (100M Supply)
- **ShieldToken**: `0xD6D4768Ffac6cA26d5a34b36555bDB3ad85B8308`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xD6D4768Ffac6cA26d5a34b36555bDB3ad85B8308)
  - Status: ❌ **DEPRECATED - Ownership Renounced**
  - Renounce TX: [0x54a7360c...](https://coston2-explorer.flare.network/tx/0x54a7360cd386508aa7a47d32db90e7289435a2ac086873e7c4b85cd9f9a52493)
  - Block: 24297250
  - Total Supply: 100,000,000 SHIELD (incorrect supply)
  - **Contract permanently frozen - cannot mint or burn**

### Deprecated Deployment #2 (100M Supply)
- **ShieldToken**: `0x59fF3b46f0Fa0cF1aa3ca48E5FC0a6f93e2B8209`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x59fF3b46f0Fa0cF1aa3ca48E5FC0a6f93e2B8209)
  - Status: ❌ **DEPRECATED - Ownership Renounced**
  - Renounce TX: [0x49ea271b...](https://coston2-explorer.flare.network/tx/0x49ea271b40f1a1234ceb6c9e5cdcf0254f949059d06cc719b70bbb7170adf83c)
  - Block: 24297253
  - Total Supply: 100,000,000 SHIELD (incorrect supply)
  - **Contract permanently frozen - cannot mint or burn**

### Deprecated Deployment #3 (100M Supply)
- **ShieldToken**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Status: ❌ **DEPRECATED - To Be Renounced**
  - Total Supply: 100,000,000 SHIELD (incorrect supply)
  - Associated contracts (also deprecated):
    - ShXRP Vault: `0x82d74B5fb005F7469e479C224E446bB89031e17F`
    - RevenueRouter: `0x8e5C9933c08451a6a31635a3Ea1221c010DF158e`
    - StakingBoost: `0xD8DF192872e94F189602ae3634850C989A1802C6`
    - MerkleDistributor: `0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31`
  - **Will be renounced after 10M deployment is complete**

### Why Were These Deprecated?

During testnet development, we discovered that a **10M SHIELD supply** provides superior tokenomics:

| Metric | 100M Supply | 10M Supply | Improvement |
|--------|------------|-----------|-------------|
| Total Supply | 100,000,000 | 10,000,000 | 10x reduction |
| Airdrop Amount | 2,000,000 | 2,000,000 | Same absolute amount |
| Airdrop % | 2% | 20% | 10x more decentralized |
| Treasury | 98,000,000 | 8,000,000 | Leaner treasury |

The 10M supply gives the community airdrop significantly more governance weight while maintaining the same absolute 2M SHIELD distribution.

---

## 🔄 Migration Guide (from 100M to 10M)

### For Users

If you received SHIELD tokens from the old 100M deployments:

1. **Old tokens are deprecated** - They have no value and cannot be exchanged
2. **No action required** - The airdrop will use the same merkle tree
3. **Same addresses eligible** - If you were eligible before, you still are
4. **Same amount (2M total)** - Airdrop distribution unchanged
5. **Claim from new contract** - Use MerkleDistributor at `0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490`

### For Developers

Update all contract addresses in your application:

**OLD (100M - DEPRECATED):**
```bash
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992  # ❌ DEPRECATED
VITE_REVENUE_ROUTER_ADDRESS=0x8e5C9933c08451a6a31635a3Ea1221c010DF158e  # ❌ DEPRECATED
VITE_STAKING_BOOST_ADDRESS=0xD8DF192872e94F189602ae3634850C989A1802C6  # ❌ DEPRECATED
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31  # ❌ DEPRECATED
VITE_SHXRP_VAULT_ADDRESS=0x82d74B5fb005F7469e479C224E446bB89031e17F  # ❌ DEPRECATED
```

**NEW (10M - ACTIVE):**
```bash
# ✅ Use these addresses
VITE_SHIELD_TOKEN_ADDRESS=0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
VITE_REVENUE_ROUTER_ADDRESS=0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
VITE_STAKING_BOOST_ADDRESS=0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
VITE_SHXRP_VAULT_ADDRESS=<PENDING_DEPLOYMENT>
```

**Migration Steps:**

1. Update environment variables (see above)
2. Clear any cached token balances from old contracts
3. Restart your application
4. Verify connection to new SHIELD token address
5. Test airdrop claiming with new MerkleDistributor

### For Contract Integrations

If you integrated Shield Finance contracts:

```solidity
// ❌ OLD - Do not use
IShieldToken shield = IShieldToken(0x07F943F173a6bE5EC63a8475597d28aAA6B24992);

// ✅ NEW - Use this
IShieldToken shield = IShieldToken(0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616);
```

**ABI remains unchanged** - Same contract interface, just different deployment address.

---

## Commands Summary

### 1. Compile Smart Contracts
```bash
npx hardhat compile
```

### 2. Deploy 10M SHIELD (Testnet) - ⚠️ PARTIALLY COMPLETE

```bash
# Deploy all contracts (3/4 complete - ShXRPVault pending)
npx tsx scripts/deploy-all-contracts-10m.ts

# Deploy only ShXRPVault (after getting more test FLR)
npx tsx scripts/deploy-shxrp-only.ts
```

**Current Status:**
- ✅ ShieldToken: Deployed
- ✅ RevenueRouter: Deployed
- ✅ StakingBoost: Deployed
- ✅ MerkleDistributor: Deployed
- ❌ ShXRPVault: Pending (need ~0.2 FLR for gas)

**To complete deployment:**
1. Get FLR from [Coston2 Faucet](https://faucet.flare.network/coston2)
2. Send to deployer: `0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D`
3. Run: `npx tsx scripts/deploy-shxrp-only.ts`

### 3. Fund MerkleDistributor

```bash
# Transfer 2M SHIELD to MerkleDistributor for airdrop
npx tsx scripts/fund-merkle-distributor.ts
```

### 4. Renounce Old 100M SHIELD Token

```bash
# Permanently freeze the old 100M deployment
npx tsx scripts/renounce-old-shield-tokens.ts
```

**Safety features:**
- Will NOT renounce the new 10M token (`0x061Cf4B...`)
- Only renounces old 100M token (`0x07F943...`)
- Requires explicit confirmation

### 5. Verify Contracts on Block Explorer

```bash
# ShieldToken (10M - Already deployed, may need verification)
npx hardhat verify --network coston2 \
  0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616 \
  "10000000000000000000000000"

# RevenueRouter
npx hardhat verify --network coston2 \
  0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB \
  "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616" \
  "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273" \
  "0x8a1E35F5c98C4E85B36B7B253222eE17773b2781"

# StakingBoost
npx hardhat verify --network coston2 \
  0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4 \
  "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616"

# MerkleDistributor
npx hardhat verify --network coston2 \
  0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490 \
  "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616" \
  "0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4"

# ShXRP Vault (once deployed)
# Constructor: (address asset, string name, string symbol, address revenueRouter, address stakingBoost)
npx hardhat verify --network coston2 \
  <SHXRP_VAULT_ADDRESS> \
  "0x0b6A3645c240605887a5532109323A3E12273dc7" \
  "Shield XRP" \
  "shXRP" \
  "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB" \
  "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4"
```

### 6. Deploy to Flare Mainnet

```bash
# Update RPC URL in deploy-all-contracts-10m.ts to mainnet
# Then run the same deployment script
npx tsx scripts/deploy-all-contracts-10m.ts
```

---

## Environment Variables Required

Create a `.env` file with (or use Replit Secrets):

```bash
# Flare Deployment
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here

# Frontend - ACTIVE 10M SHIELD Deployment (Coston2 Testnet)
VITE_SHIELD_TOKEN_ADDRESS=0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
VITE_REVENUE_ROUTER_ADDRESS=0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
VITE_STAKING_BOOST_ADDRESS=0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
VITE_SHXRP_VAULT_ADDRESS=<PENDING_DEPLOYMENT>
```

---

## Testnet Faucets

- **Flare Coston2**: https://faucet.flare.network/coston2
- **XRPL Testnet**: https://xrpl.org/xrp-testnet-faucet.html

---

## Block Explorers

- **Flare Coston2**: https://coston2-explorer.flare.network
- **Flare Mainnet**: https://flare-explorer.flare.network
- **XRPL Testnet**: https://testnet.xrpl.org
- **XRPL Mainnet**: https://livenet.xrpl.org

---

## Contract Addresses

### Coston2 Testnet - ACTIVE (10M SHIELD)

**✅ Use these addresses:**

```
ShieldToken (10M): 0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
RevenueRouter: 0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
StakingBoost: 0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
MerkleDistributor: 0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
ShXRPVault: <PENDING_DEPLOYMENT>

Smart Account (Etherspot): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Deployer Address: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D

Merkle Root (Airdrop): 0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4
```

### Coston2 Testnet - DEPRECATED (100M SHIELD)

**❌ Do NOT use these addresses:**

```
# Deprecated Deployment #1 (100M - RENOUNCED)
ShieldToken: 0xD6D4768Ffac6cA26d5a34b36555bDB3ad85B8308

# Deprecated Deployment #2 (100M - RENOUNCED)
ShieldToken: 0x59fF3b46f0Fa0cF1aa3ca48E5FC0a6f93e2B8209

# Deprecated Deployment #3 (100M - TO BE RENOUNCED)
ShieldToken: 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
ShXRP Vault: 0x82d74B5fb005F7469e479C224E446bB89031e17F
RevenueRouter: 0x8e5C9933c08451a6a31635a3Ea1221c010DF158e
StakingBoost: 0xD8DF192872e94F189602ae3634850C989A1802C6
MerkleDistributor: 0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31
```

### Mainnet (Not Yet Deployed)

```
ShieldToken (Flare): TBD
Shield XRP Vault (Flare): TBD
RevenueRouter (Flare): TBD
StakingBoost (Flare): TBD
MerkleDistributor (Flare): TBD
```

---

## Quick Troubleshooting

| Error | Solution |
|-------|----------|
| Insufficient funds | Get testnet tokens from faucets |
| Contract verification failed | Wait 2-3 minutes for block explorer to index |
| Private key error | Remove `0x` prefix from private key |
| `hre.ethers is undefined` (Hardhat 3) | Use `tsx scripts/deploy-direct.ts` instead of Hardhat scripts |
| Node.js version mismatch | Upgrade to Node.js 22+ for Hardhat 3 compatibility |
| Wrong SHIELD token balance | Verify you're using new 10M address: `0x061Cf4B...` |
| Airdrop claim fails | Use new MerkleDistributor: `0x8b3eC671...` |

---

## Next Steps After Deployment

### Immediate (Testnet)
1. ⏳ Complete ShXRPVault deployment (waiting for gas)
2. ⏳ Fund MerkleDistributor with 2M SHIELD
3. ⏳ Renounce old 100M SHIELD token
4. ⏳ Update environment variables in application
5. ⏳ Test airdrop claims with new contract

### Before Mainnet
1. ✅ Audit smart contracts
2. ✅ Test full deposit/withdrawal flow
3. ✅ Verify yield generation
4. ✅ Test StakingBoost mechanics
5. ✅ Confirm buyback-and-burn mechanism
6. ✅ Load test with multiple concurrent users

---

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

### Key Components (Coston2 Testnet - 10M SHIELD)

```bash
# XRPL Side
XRP Deposit Address: r4bydXhaVMFzgDmqDmxkXJBKUgXTCwsWjY

# Flare Side (10M SHIELD - ACTIVE)
ShieldToken: 0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
ShXRP Vault (ERC-4626): <PENDING_DEPLOYMENT>
FXRP Token: 0x0b6A3645c240605887a5532109323A3E12273dc7
Smart Account (ERC-4337): 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd

# Revenue & Governance (10M SHIELD - ACTIVE)
RevenueRouter: 0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
StakingBoost: 0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
MerkleDistributor: 0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
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

**Current (Coston2 Testnet - 10M SHIELD):**
- ERC-4626 standard vault implementation
- Automated FAssets bridging (XRP → FXRP)
- Firelight.finance yield integration
- Gasless transactions via Etherspot smart accounts
- RevenueRouter buyback-and-burn (50% of fees)
- StakingBoost APY enhancement system
- Fair airdrop via MerkleDistributor (2M SHIELD)

**Upcoming:**
- ShXRPVault deployment completion
- Additional yield sources (SparkDEX, Kinetic Markets)
- Mainnet deployment on Flare Network
- Enhanced APY through multi-protocol strategies

### Setup Instructions

1. **Deploy Smart Contracts (10M SHIELD):**
```bash
# Get test FLR from faucet first
# https://faucet.flare.network/coston2

# Deploy all contracts
npx tsx scripts/deploy-all-contracts-10m.ts

# Or deploy only ShXRPVault (if others already deployed)
npx tsx scripts/deploy-shxrp-only.ts
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

# Contract addresses (10M SHIELD - ACTIVE)
VITE_SHIELD_TOKEN_ADDRESS=0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
VITE_REVENUE_ROUTER_ADDRESS=0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
VITE_STAKING_BOOST_ADDRESS=0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
VITE_SHXRP_VAULT_ADDRESS=<PENDING_DEPLOYMENT>
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
- **Ownership Controls**: Old contracts renounced to prevent misuse

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

## Deployment Resources

### Documentation
- **Full Deployment Guide**: [deployments/DEPLOYMENT_STATUS_10M.md](deployments/DEPLOYMENT_STATUS_10M.md)
- **Environment Updates**: [deployments/ENV_UPDATES_10M.md](deployments/ENV_UPDATES_10M.md)
- **Deployment Data**: [deployments/coston2-10m-partial.json](deployments/coston2-10m-partial.json)
- **Token Deployment**: [deployments/coston2-shield-10m.json](deployments/coston2-shield-10m.json)

### Scripts
- **Full Deployment**: `scripts/deploy-all-contracts-10m.ts`
- **ShXRPVault Only**: `scripts/deploy-shxrp-only.ts`
- **Fund Airdrop**: `scripts/fund-merkle-distributor.ts`
- **Renounce Old Token**: `scripts/renounce-old-shield-tokens.ts`

### Explorer Links (10M SHIELD - ACTIVE)
- [ShieldToken](https://coston2-explorer.flare.network/address/0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616)
- [RevenueRouter](https://coston2-explorer.flare.network/address/0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB)
- [StakingBoost](https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4)
- [MerkleDistributor](https://coston2-explorer.flare.network/address/0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490)

---

**For detailed instructions, see README.md section: "How to Deploy to Testnet"**
