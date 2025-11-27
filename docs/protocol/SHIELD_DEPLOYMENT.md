# Shield Finance ($SHIELD) Deployment Guide

## Overview
Complete deployment guide for Shield Finance fair launch on Flare Network mainnet.

**Token Parameters:**
- Total Supply: 10,000,000 SHIELD (fixed, immutable)
- Blockchain: Flare Network
- Token Decimals: 18
- LP Lock: 12 months (Team Finance or equivalent)

---

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Sequence](#deployment-sequence)
3. [Contract Configuration](#contract-configuration)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### Environment Setup
```bash
# Required environment variables
DEPLOYER_PRIVATE_KEY=<mainnet deployer private key>
SHIELD_TOKEN_ADDRESS=<after step 1>
REVENUE_ROUTER_ADDRESS=<after step 2>
MERKLE_DISTRIBUTOR_ADDRESS=<after step 4>
STAKING_BOOST_ADDRESS=<after step 3>
```

### Security Requirements
- [ ] All 176 tests passing (`npx hardhat test`)
- [ ] Deployer wallet funded with minimum 5 FLR (gas buffer)
- [ ] Private keys secured (hardware wallet recommended)
- [ ] Merkle tree generated and validated off-chain
- [ ] SparkDEX V3 Router addresses verified on Flare mainnet
- [ ] wFLR contract address verified (0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d)
- [ ] Block explorer verification prepared (Etherscan API key)

### Pre-Deployment Test (Testnet)
```bash
# Run full deployment on Coston2 testnet first
npx hardhat run scripts/deploy-shield-finance.ts --network coston2

# Verify all contracts
npx hardhat run scripts/verify-shield-deployment.ts --network coston2

# Test complete flow: deposit → claim → stake → burn
npx hardhat run scripts/test-full-flow.ts --network coston2
```

---

## Deployment Sequence

### Step 1: Deploy ShieldToken
**Contract:** `ShieldToken.sol`  
**Constructor:** No parameters  
**Initial State:** 10M SHIELD minted to deployer

```bash
npx hardhat run scripts/deploy-shield-finance.ts --network flare
```

**Expected Output:**
```
✅ ShieldToken deployed: 0x...
   Total Supply: 10,000,000 SHIELD
   Deployer Balance: 10,000,000 SHIELD
```

**Verification:**
```bash
# Verify on block explorer
npx hardhat verify --network flare <SHIELD_TOKEN_ADDRESS>

# Check total supply
cast call <SHIELD_TOKEN_ADDRESS> "totalSupply()" --rpc-url <FLARE_RPC>
# Expected: 10000000000000000000000000 (10M * 10^18)
```

**⚠️ CRITICAL:** Save `SHIELD_TOKEN_ADDRESS` immediately. All subsequent steps depend on it.

---

### Step 2: Deploy RevenueRouter
**Contract:** `RevenueRouter.sol`  
**Constructor:** `(address _shieldToken, address _wflr, address _router)`  
**Parameters:**
- `_shieldToken`: Address from Step 1
- `_wflr`: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d (Flare mainnet)
- `_router`: 0x8a1E35F5c98C4E85B36B7B253222eE17773b2781 (SparkDEX V3 SwapRouter)

```bash
# Set SHIELD_TOKEN_ADDRESS in .env first
npx hardhat run scripts/deploy-shield-finance.ts --network flare
```

**Expected Output:**
```
✅ RevenueRouter deployed: 0x...
   SHIELD Token: <SHIELD_TOKEN_ADDRESS>
   wFLR: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
   Router: 0x8a1E35F5c98C4E85B36B7B253222eE17773b2781
```

**Verification:**
```bash
# Verify constructor args
npx hardhat verify --network flare <REVENUE_ROUTER_ADDRESS> \
  <SHIELD_TOKEN_ADDRESS> \
  0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d \
  0x8a1E35F5c98C4E85B36B7B253222eE17773b2781

# Check immutable addresses
cast call <REVENUE_ROUTER_ADDRESS> "shieldToken()" --rpc-url <FLARE_RPC>
cast call <REVENUE_ROUTER_ADDRESS> "wflr()" --rpc-url <FLARE_RPC>
cast call <REVENUE_ROUTER_ADDRESS> "router()" --rpc-url <FLARE_RPC>
```

---

### Step 3: Deploy StakingBoost
**Contract:** `StakingBoost.sol`  
**Constructor:** `(address _shieldToken)`  
**Parameters:**
- `_shieldToken`: Address from Step 1

```bash
npx hardhat run scripts/deploy-shield-finance.ts --network flare
```

**Expected Output:**
```
✅ StakingBoost deployed: 0x...
   SHIELD Token: <SHIELD_TOKEN_ADDRESS>
   Lock Period: 30 days (2592000 seconds)
```

**Verification:**
```bash
# Verify
npx hardhat verify --network flare <STAKING_BOOST_ADDRESS> <SHIELD_TOKEN_ADDRESS>

# Check lock period
cast call <STAKING_BOOST_ADDRESS> "LOCK_PERIOD()" --rpc-url <FLARE_RPC>
# Expected: 2592000 (30 days in seconds)
```

**💡 Integration with ShXRPVault:**  
**NOTE:** The ShXRPVault deployment is a **separate step** not included in this fair launch script.

When deploying `ShXRPVault` (typically after shield-finance.ts completes), pass the `STAKING_BOOST_ADDRESS` to the vault constructor:
```bash
# Deploy vault separately (example using Hardhat)
npx hardhat run scripts/deploy-vault.ts --network flare
```

Vault constructor signature:
```solidity
constructor(
    IERC20 _fxrpToken,
    string memory _name,
    string memory _symbol,
    address _revenueRouter,    // ← From Step 2
    address _stakingBoost      // ← From Step 3
)
```

This enables the APY boost mechanism:
- Users stake SHIELD tokens (30-day lock)
- +1% APY boost per 100 SHIELD staked
- Boost applies during redemption via `_withdraw()` using owner's stake
- ERC-4626 compliant: `previewRedeem()` remains pure, boost calculated separately via `previewRedeemWithBoost(shares, user)`
- Economic flywheel: Higher APY → More deposits → More SHIELD demand → Buyback & burn

**Frontend Integration:**  
Set `VITE_STAKING_BOOST_ADDRESS` in `.env` for the `/staking` page to connect to the contract.

---

### Step 4: Deploy MerkleDistributor
**Contract:** `MerkleDistributor.sol`  
**Constructor:** `(address _token, bytes32 _merkleRoot)`  
**Parameters:**
- `_token`: Address from Step 1
- `_merkleRoot`: Generated off-chain from airdrop allocation

```bash
# Generate merkle tree first (off-chain)
npx ts-node scripts/generate-merkle-tree.ts

# Deploy with merkle root
npx hardhat run scripts/deploy-shield-finance.ts --network flare
```

**Expected Output:**
```
✅ MerkleDistributor deployed: 0x...
   SHIELD Token: <SHIELD_TOKEN_ADDRESS>
   Merkle Root: 0x...
   ⚠️  WARNING: Root is IMMUTABLE - verify before funding!
```

**Verification:**
```bash
# Verify
npx hardhat verify --network flare <MERKLE_DISTRIBUTOR_ADDRESS> \
  <SHIELD_TOKEN_ADDRESS> \
  <MERKLE_ROOT>

# Check merkle root
cast call <MERKLE_DISTRIBUTOR_ADDRESS> "merkleRoot()" --rpc-url <FLARE_RPC>

# CRITICAL: Verify root matches generated tree
```

**⚠️ SECURITY WARNING:**  
The merkle root is **IMMUTABLE** after deployment. Double-check that:
1. Root matches your generated merkle tree
2. Airdrop amounts total exactly 2,000,000 SHIELD
3. No duplicate addresses in tree
4. Test claims work with generated proofs

---

### Step 5: Add Liquidity to SparkDEX V3
**Target:** 1,000,000 SHIELD + 535,451 wFLR = ~$10,000  
**Pool Fee:** 0.3% (3000)  
**Price Range:** ±100% (wide range for stability)

```bash
# Ensure deployer has 535,451 wFLR
# Transfer 1M SHIELD to LP deployer wallet (if different)

npx hardhat run scripts/sparkdex-lp.ts --network flare
```

**Expected Output:**
```
✅ LP Position Created
   Token ID: <NFT_ID>
   SHIELD: 1,000,000
   wFLR: 535,451
   Initial Price: $0.01 per SHIELD
   Pool Address: 0x...
   
⚠️  NEXT STEP: Lock LP NFT for 12 months!
```

**Verification:**
```bash
# Check pool exists
cast call <SPARKDEX_FACTORY> "getPool(address,address,uint24)" \
  <WFLR_ADDRESS> <SHIELD_TOKEN_ADDRESS> 3000 --rpc-url <FLARE_RPC>

# Check LP NFT ownership
cast call <POSITION_MANAGER> "ownerOf(uint256)" <NFT_ID> --rpc-url <FLARE_RPC>
```

**⚠️ CRITICAL:** Proceed immediately to Step 6 to lock LP NFT.

---

### Step 6: Lock LP NFT (12 Months)
**Platform:** Team Finance (https://www.team.finance/)  
**Duration:** 365 days (31,536,000 seconds)  
**LP NFT:** From Step 5

**Process:**
1. Navigate to Team Finance Flare Locker
2. Select "Lock Liquidity (V3)"
3. Input LP NFT Token ID from Step 5
4. Set lock duration: 365 days
5. Confirm lock transaction
6. **SAVE LOCK RECEIPT** - needed for unlock after 12 months

**Verification:**
```bash
# Check NFT ownership transferred to locker
cast call <POSITION_MANAGER> "ownerOf(uint256)" <NFT_ID> --rpc-url <FLARE_RPC>
# Should be Team Finance locker address

# Check lock expiry on Team Finance UI
# Expected: Current timestamp + 31,536,000 seconds
```

**⚠️ WARNING:** Once locked, LP cannot be accessed until expiry. Verify:
- Correct NFT ID
- Correct lock duration (365 days)
- Lock receipt saved securely

---

### Step 7: Fund MerkleDistributor
**Amount:** 2,000,000 SHIELD (20% of total supply)  
**From:** Deployer wallet  
**To:** MerkleDistributor address

```bash
# Transfer 2M SHIELD to MerkleDistributor
npx hardhat run scripts/fund-airdrop.ts --network flare
```

**Expected Output:**
```
✅ Airdrop Funded
   Amount: 2,000,000 SHIELD
   Distributor: <MERKLE_DISTRIBUTOR_ADDRESS>
   Remaining Deployer Balance: 8,000,000 SHIELD
```

**Note:** After funding the airdrop (20%), the remaining 8M tokens will be distributed according to the Treasury Allocations table below.

**Verification:**
```bash
# Check distributor balance
cast call <SHIELD_TOKEN_ADDRESS> "balanceOf(address)" \
  <MERKLE_DISTRIBUTOR_ADDRESS> --rpc-url <FLARE_RPC>
# Expected: 2000000000000000000000000 (2M * 10^18)

# Check total claimed = 0
cast call <MERKLE_DISTRIBUTOR_ADDRESS> "totalClaimed()" --rpc-url <FLARE_RPC>
# Expected: 0

# Test claim (with valid proof)
npx hardhat run scripts/test-airdrop-claim.ts --network flare
```

---

## Post-Deployment Token Distribution

After all steps complete, verify final token distribution:

| Category | Percentage | Tokens | Purpose |
|----------|------------|--------|---------|
| Team | 9.00% | 900,000 | Core team allocation |
| Advisors | 5.00% | 500,000 | Strategic advisors |
| Ecosystem Development | 15.00% | 1,500,000 | Protocol development & growth |
| Airdrops | 20.00% | 2,000,000 | Community distribution |
| Marketing | 3.50% | 350,000 | Marketing & awareness |
| Ambassadors | 2.50% | 250,000 | Community ambassadors |
| Ecosystem Rewards | 0.00% | 0 | Reserved for future use |
| Staking Rewards | 0.00% | 0 | Reserved for future use |
| Treasury | 10.00% | 1,000,000 | Protocol treasury |
| Liquidity / MM / Exchanges | 10.00% | 1,000,000 | Initial DEX liquidity |
| Future Liquidity Adds | 25.00% | 2,500,000 | Future liquidity expansion |
| **Total** | **100%** | **10,000,000** | Fixed supply |

**Verification Script:**
```bash
npx hardhat run scripts/verify-token-distribution.ts --network flare
```

**Expected Output:**
```
✅ Token Distribution Verified
   Total Supply: 10,000,000 SHIELD
   Team: 900,000 SHIELD (9%)
   Advisors: 500,000 SHIELD (5%)
   Ecosystem Development: 1,500,000 SHIELD (15%)
   Airdrops: 2,000,000 SHIELD (20%)
   Marketing: 350,000 SHIELD (3.5%)
   Ambassadors: 250,000 SHIELD (2.5%)
   Treasury: 1,000,000 SHIELD (10%)
   Liquidity: 1,000,000 SHIELD (10%)
   Future Liquidity: 2,500,000 SHIELD (25%)
   Sum: 10,000,000 SHIELD ✓
```

---

## Contract Configuration

### RevenueRouter Configuration
**Purpose:** Routes vault revenue (50% buyback & burn, 50% reserves)

**No configuration needed** - contract is immutable after deployment.

**Revenue Flow:**
1. Vaults send wFLR fees to RevenueRouter
2. Anyone calls `distribute()` to trigger buyback & burn
3. 50% swapped to SHIELD via SparkDEX V3 and burned
4. 50% kept as protocol reserves (owner withdrawable)

**Weekly Burn Automation:**
```bash
# GitHub Actions runs weekly (every Sunday)
# See: .github/workflows/weekly-burn.yml

# Manual burn (if needed)
npx hardhat run scripts/burn.ts --network flare
```

### MerkleDistributor Configuration
**Purpose:** Airdrop 2M SHIELD to eligible addresses

**No configuration needed** - merkle root is immutable.

**Claim Process:**
1. Users generate proof off-chain (from merkle tree)
2. Call `claim(amount, proof)` on MerkleDistributor
3. Tokens transferred immediately if proof valid
4. `hasClaimed[user]` set to true (prevents double-claim)

**Owner Functions:**
- `withdraw(recipient, amount)` - Withdraw unclaimed tokens (after 3-6 months recommended)

### StakingBoost Configuration
**Purpose:** Stake SHIELD for vault APY boost

**Parameters:**
- Lock Period: 30 days (LOCK_PERIOD constant)
- Boost Formula: 1% boost per 100 SHIELD staked

**No configuration needed** - parameters are immutable.

---

## Post-Deployment Verification

### Automated Verification
```bash
# Run complete verification suite
npx hardhat run scripts/verify-shield-deployment.ts --network flare
```

**Checks:**
- ✅ All contracts deployed and verified on block explorer
- ✅ Total supply = 10M SHIELD
- ✅ Token distribution correct (see Treasury Allocations table)
- ✅ LP NFT locked for 12 months
- ✅ MerkleDistributor funded with 2M SHIELD
- ✅ RevenueRouter configured correctly
- ✅ StakingBoost lock period = 30 days
- ✅ Ownership transferred (if applicable)

### Manual Verification Checklist
- [ ] ShieldToken total supply = 10M
- [ ] RevenueRouter has correct SHIELD/wFLR/router addresses
- [ ] StakingBoost lock period = 2,592,000 seconds (30 days)
- [ ] MerkleDistributor merkle root matches generated tree
- [ ] LP Pool exists on SparkDEX V3 (wFLR/SHIELD, 0.3% fee)
- [ ] LP NFT locked for 365 days on Team Finance
- [ ] MerkleDistributor balance = 2M SHIELD
- [ ] Test airdrop claim works
- [ ] Block explorer verification complete for all contracts

### Security Audit (Recommended)
Before mainnet launch, consider:
- [ ] External smart contract audit (CertiK, Trail of Bits, etc.)
- [ ] Bug bounty program (Immunefi, Code4rena)
- [ ] Community review period (1-2 weeks)
- [ ] Testnet stress testing

---

## Emergency Procedures

### Critical Issues During Deployment

**Issue: Wrong merkle root deployed**
- **Impact:** Airdrop claims will fail
- **Solution:** Deploy new MerkleDistributor with correct root, fund it, announce address change
- **Prevention:** Triple-check root before deployment, test claims on testnet

**Issue: LP NFT not locked**
- **Impact:** Liquidity not secured, fair launch compromised
- **Solution:** Lock immediately via Team Finance
- **Prevention:** Lock LP NFT immediately after creation (Step 6)

**Issue: Incorrect RevenueRouter parameters**
- **Impact:** Revenue routing fails, burns don't work
- **Solution:** Deploy new RevenueRouter with correct parameters
- **Prevention:** Verify constructor args before deployment

### Post-Deployment Issues

**Issue: distribute() fails on RevenueRouter**
- **Cause:** Insufficient wFLR balance or DEX liquidity too low
- **Check:** `cast call <WFLR_ADDRESS> "balanceOf(address)" <REVENUE_ROUTER_ADDRESS>`
- **Solution:** Wait for more revenue accumulation or check DEX pool

**Issue: Airdrop claims failing**
- **Cause:** Invalid proofs or merkle tree mismatch
- **Check:** Verify merkle root matches, test proof generation
- **Solution:** Re-generate proofs, verify tree construction

**Issue: StakingBoost withdrawals failing**
- **Cause:** Lock period not expired
- **Check:** `cast call <STAKING_BOOST_ADDRESS> "stakes(address)" <USER_ADDRESS>`
- **Solution:** Wait until `unlockTime` < `block.timestamp`

### Contract Ownership

**Current Owner:** Deployer address  
**Owner Functions:**
- RevenueRouter: `withdrawReserves(address, uint256)`
- MerkleDistributor: `withdraw(address, uint256)`

**Ownership Transfer (Optional):**
```bash
# Transfer to multisig or DAO
npx hardhat run scripts/transfer-ownership.ts --network flare
```

**⚠️ WARNING:** Once ownership transferred, deployer loses control. Ensure:
- Multisig threshold configured correctly (e.g., 3-of-5)
- All signers have access and understand responsibilities
- Emergency procedures documented for multisig

---

## Deployment Costs (Estimated)

| Action | Estimated Gas | Cost @ 25 Gwei | Notes |
|--------|--------------|----------------|-------|
| Deploy ShieldToken | ~1,500,000 | ~0.0375 FLR | ERC20 + burnable |
| Deploy RevenueRouter | ~800,000 | ~0.02 FLR | Immutable config |
| Deploy StakingBoost | ~1,200,000 | ~0.03 FLR | Staking logic |
| Deploy MerkleDistributor | ~600,000 | ~0.015 FLR | Merkle verification |
| Add SparkDEX V3 LP | ~500,000 | ~0.0125 FLR | Create position |
| Lock LP NFT | ~150,000 | ~0.00375 FLR | Team Finance |
| Fund Airdrop (2M SHIELD) | ~50,000 | ~0.00125 FLR | ERC20 transfer |
| **Total** | **~4,800,000** | **~0.12 FLR** | **+ 20% buffer** |

**Recommended:** Fund deployer with **5 FLR** for deployment + buffer.

---

## Support & Resources

- **GitHub:** https://github.com/shyield-finance/contracts
- **Documentation:** https://shield-finance.gitbook.io/shield-finance-docs/
- **X (Twitter):** https://x.com/ShieldFinanceX
- **Telegram Official:** https://t.me/ShieldFinanceOfficial
- **Telegram Community:** https://t.me/ShieldFinanceCommunity
- **Discord:** https://discord.gg/Vzs3KbzU
- **Block Explorer:** https://flare-explorer.flare.network
- **SparkDEX Docs:** https://docs.sparkdex.ai
- **Team Finance:** https://www.team.finance

---

## Appendix: Quick Reference

### Contract Addresses (Fill after deployment)
```bash
# Flare Mainnet Deployment
SHIELD_TOKEN_ADDRESS=0x...
REVENUE_ROUTER_ADDRESS=0x...
STAKING_BOOST_ADDRESS=0x...
MERKLE_DISTRIBUTOR_ADDRESS=0x...
SPARKDEX_LP_POOL=0x...
LP_NFT_TOKEN_ID=...
```

### Key Addresses (Flare Mainnet)
```bash
WFLR=0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
SPARKDEX_FACTORY=0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652
SPARKDEX_SWAP_ROUTER=0x8a1E35F5c98C4E85B36B7B253222eE17773b2781
SPARKDEX_POSITION_MANAGER=0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da
```

### Important Constants
```bash
TOTAL_SUPPLY=10000000000000000000000000  # 10M SHIELD (18 decimals)
AIRDROP_AMOUNT=2000000000000000000000000  # 2M SHIELD (20%)
LP_SHIELD_AMOUNT=1000000000000000000000000  # 1M SHIELD (10%)
LP_WFLR_AMOUNT=535451000000000000000000  # 535,451 wFLR
LOCK_PERIOD=2592000  # 30 days (StakingBoost)
LP_LOCK_DURATION=31536000  # 365 days
```

---

**Deployment Version:** 1.0.0  
**Last Updated:** November 21, 2025  
**Status:** Production Ready (176/176 tests passing)
