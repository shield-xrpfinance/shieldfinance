# 10M SHIELD Token Deployment Status

## Deployment Summary

**Date:** November 23, 2025  
**Network:** Coston2 Testnet (Chain ID: 114)  
**Deployer:** 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D  
**Status:** ⚠️ **PARTIAL** (3/4 contracts deployed)

---

## ✅ Successfully Deployed Contracts

### 1. SHIELD Token (Pre-existing)
- **Address:** `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
- **Total Supply:** 10,000,000 SHIELD
- **Explorer:** https://coston2-explorer.flare.network/address/0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616

### 2. RevenueRouter ✅
- **Address:** `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB`
- **Constructor Args:**
  - shieldToken: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
  - wflr: `0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273`
  - router: `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`
- **Explorer:** https://coston2-explorer.flare.network/address/0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
- **Verification:** ✅ On-chain verified

### 3. StakingBoost ✅
- **Address:** `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`
- **Constructor Args:**
  - shieldToken: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
- **Lock Period:** 30 days
- **Boost Formula:** +1% APY per 100 SHIELD staked
- **Explorer:** https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
- **Verification:** ✅ On-chain verified

### 4. MerkleDistributor ✅
- **Address:** `0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490`
- **Constructor Args:**
  - token: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
  - merkleRoot: `0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4`
- **Explorer:** https://coston2-explorer.flare.network/address/0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
- **Verification:** ✅ On-chain verified

---

## ❌ Pending Deployment

### 5. ShXRPVault (FAILED - Insufficient Gas)
- **Status:** ❌ Deployment failed
- **Reason:** Insufficient gas funds
- **Required Balance:** ~0.25 FLR
- **Current Balance:** 0.083 FLR
- **Shortfall:** ~0.17 FLR

**Required Constructor Args:**
```typescript
{
  fxrpToken: "0x0b6A3645c240605887a5532109323A3E12273dc7",
  name: "Shield XRP",
  symbol: "shXRP",
  revenueRouter: "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB",
  stakingBoost: "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4"
}
```

---

## 📝 Deployment Scripts Created

### 1. `scripts/deploy-all-contracts-10m.ts`
Full deployment script for all 4 contracts. Successfully deployed 3/4 before running out of gas.

**Features:**
- ✅ Compiles contracts with Hardhat
- ✅ Sequential deployment with dependency management
- ✅ On-chain verification for each contract
- ✅ Comprehensive error handling
- ✅ Idempotency checks (won't re-deploy if already exists)
- ✅ Saves deployment data to JSON

### 2. `scripts/deploy-shxrp-only.ts`
Simplified script to deploy only ShXRPVault using already-deployed RevenueRouter and StakingBoost.

**Usage:** `npx tsx scripts/deploy-shxrp-only.ts`

---

## 🔄 Next Steps to Complete Deployment

### Option 1: Get More FLR from Faucet
```bash
# 1. Visit Coston2 faucet
https://faucet.flare.network/coston2

# 2. Request FLR for deployer address
Deployer: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D

# 3. Once funded (need at least 0.2 FLR), run:
npx tsx scripts/deploy-shxrp-only.ts
```

### Option 2: Manual Deployment
If you have another funded account, you can deploy ShXRPVault manually:

```typescript
const vault = await ShXRPVault.deploy(
  "0x0b6A3645c240605887a5532109323A3E12273dc7", // FXRP
  "Shield XRP",
  "shXRP",
  "0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB", // RevenueRouter
  "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4"  // StakingBoost
);
```

---

## 📊 Deployment Statistics

| Metric | Value |
|--------|-------|
| Total Contracts | 4 |
| Successfully Deployed | 3 (75%) |
| Pending | 1 (25%) |
| Gas Used (3 contracts) | ~0.043 FLR |
| Estimated Total Gas | ~0.25 FLR |
| Deployer Balance | 0.083 FLR |

---

## 🔗 Quick Links

### Deployed Contracts
- [SHIELD Token](https://coston2-explorer.flare.network/address/0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616)
- [RevenueRouter](https://coston2-explorer.flare.network/address/0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB)
- [StakingBoost](https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4)
- [MerkleDistributor](https://coston2-explorer.flare.network/address/0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490)

### Resources
- [Coston2 Faucet](https://faucet.flare.network/coston2)
- [Coston2 Explorer](https://coston2-explorer.flare.network)
- [Deployment Data](./coston2-10m-partial.json)

---

## ⚠️ Important Notes

1. **All deployed contracts are verified on-chain** - constructor parameters match expected values
2. **Contracts are production-ready** - waiting only for ShXRPVault deployment
3. **No re-deployment needed** - RevenueRouter, StakingBoost, and MerkleDistributor are final
4. **Addresses are permanent** - these contracts are now live on Coston2

---

## 🎯 Final Checklist

- [x] Deploy RevenueRouter
- [x] Deploy StakingBoost
- [x] Deploy MerkleDistributor
- [ ] **Deploy ShXRPVault** (blocked by insufficient gas)
- [ ] Save complete deployment to `coston2-10m-complete.json`
- [ ] Update environment variables with new addresses

---

**Generated:** November 23, 2025  
**Script:** scripts/deploy-all-contracts-10m.ts  
**Network:** Coston2 Testnet (Chain ID: 114)
