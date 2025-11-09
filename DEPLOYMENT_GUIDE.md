# 🚀 Quick Deployment Reference

## ✅ Deployment Status

**Smart contracts successfully deployed to Flare Coston2 Testnet on November 9, 2025**

### Deployed Contracts

- **ShieldToken ($SHIELD)**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD

- **Shield XRP Vault (shXRP)**: `0xd8d78DA41473D28eB013e161232192ead2cc745A`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xd8d78DA41473D28eB013e161232192ead2cc745A)
  - Initial Exchange Rate: 1.0 shXRP per XRP

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

# Shield XRP Vault (Coston2 Testnet)
npx hardhat verify --network coston2 0xd8d78DA41473D28eB013e161232192ead2cc745A
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
VITE_SHXRP_VAULT_ADDRESS=0xd8d78DA41473D28eB013e161232192ead2cc745A
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

### Coston2 Testnet (Deployed November 9, 2025)

```
ShieldToken (Coston2): 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
Shield XRP Vault (Coston2): 0xd8d78DA41473D28eB013e161232192ead2cc745A
Deployer Address: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D
Treasury Address: 0x105a22e3ff06ee17020a510fa5113b5c6d9feb2d
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
2. ✅ Configure vault operator using Hardhat console
3. ✅ Test deposit flow on testnet
4. ✅ Test withdrawal flow on testnet
5. ✅ Audit smart contracts before mainnet

## FXRP Yield Strategy

### Overview

The Shield XRP Vault now integrates with Flare's FXRP DeFi ecosystem to generate 5-7% APY through automated yield strategies.

### How It Works

1. **FXRP Integration**: Vault accepts FXRP (wrapped XRP on Flare) for yield generation
2. **SparkDEX LP Staking**: FXRP is paired with WFLR in liquidity pools
3. **Reward Harvesting**: Earns trading fees + SPARK token emissions
4. **Auto-Compounding**: Rewards are swapped to FXRP and reinvested to increase shXRP exchange rate

### Yield Flow

```
User Deposits XRP → XRPL Escrow → Mint shXRP
             ↓
Operator Stakes FXRP in SparkDEX LP (FXRP/WFLR)
             ↓
Earn Yield: Trading Fees + SPARK Emissions
             ↓
Auto-Compound (Daily): Claim → Swap to FXRP → Update Exchange Rate
             ↓
shXRP holders benefit from increased exchange rate
```

### Contract Addresses (Coston2 Testnet)

```bash
# ShXRPVault Dependencies
FXRP Token: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3
SparkDEX Router V2: 0x4a1E5A90e9943467FAd1acea1E7F0e5e88472a1e
WFLR Token: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
```

### Yield Functions

The ShXRPVault contract provides these operator-controlled yield functions:

```solidity
// Deposit FXRP to vault for yield generation
depositFXRP(uint256 amount)

// Stake FXRP in SparkDEX LP pool (FXRP/WFLR)
stakeInDeFi(uint256 fxrpAmount, uint256 flrAmount)

// Withdraw from LP pool
withdrawFromLP(uint256 lpAmount)

// Swap tokens to FXRP (e.g., WFLR, SPARK → FXRP)
swapToFXRP(address tokenIn, uint256 amountIn)

// Claim rewards and auto-compound
claimAndCompound()

// Simulate rewards for testnet demo
simulateRewards(uint256 rewardAmount)
```

### Automation with Gelato

The `scripts/compound.ts` script can be automated using Gelato Network for daily compounding:

```bash
# Manual execution (testnet)
tsx scripts/compound.ts

# Production: Deploy to Gelato for automated daily execution
```

### Testnet vs Production

**Testnet (Current):**
- Uses `simulateRewards()` to demonstrate compounding
- Manual operator calls for testing
- Displays projected 5-7% APY in frontend

**Production (When DeFi Protocols Launch):**
- Integration with Kinetic Markets/Enosys lending pools
- Real SPARK token harvesting from LP staking
- Automated daily compounding via Gelato
- Oracle-based FXRP/XRP value conversion

### Setup Instructions

1. **Deploy ShXRPVault with FXRP Integration:**
```bash
tsx scripts/deploy-direct.ts
# Automatically passes FXRP, SparkRouter, WFLR addresses
```

2. **Enable Yield Generation:**
```bash
# Call on deployed ShXRPVault contract
setYieldEnabled(true)
```

3. **Set LP Token Address:**
```bash
# After first LP stake, get FXRP/WFLR LP token address from SparkDEX
setLPToken(0x...)
```

4. **Configure Gelato Automation (Optional):**
```bash
# Set OPERATOR_PRIVATE_KEY in environment
# Deploy compound.ts script to Gelato for daily execution
```

### Yield Sources

| Platform | Type | APY | Status |
|----------|------|-----|--------|
| **SparkDEX LP** | Liquidity Provision | 3-5% | ✅ Integrated |
| **Kinetic Markets** | Lending | ~5% | 🚧 Coming Soon |
| **Enosys Loans** | CDP Collateral | Variable | 🚧 Coming Soon |

### Security Features

- **Operator-Only Functions**: All yield operations require operator authorization
- **SafeERC20**: Secure token transfers and approvals
- **Separated Accounting**: FXRP yields tracked separately from XRP backing
- **LP Token Tracking**: Full transparency of staked liquidity positions
- **Allowance Revocation**: Router approvals revoked after each transaction

### Monitoring Yield

Check current vault state:
```solidity
// View exchange rate (increases with compounded rewards)
vault.exchangeRate()

// View total FXRP in vault
vault.totalFXRPInVault()

// View total LP tokens staked
vault.totalLPStaked()
```

---

For detailed instructions, see **README.md** section: "How to Deploy to Testnet"
