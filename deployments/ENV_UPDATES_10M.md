# Environment Variable Updates for 10M SHIELD Deployment

## Status: ⚠️ PARTIAL (Waiting for ShXRPVault deployment)

Last Updated: November 23, 2025

---

## 🎯 Required Environment Variable Updates

### Current Values (OLD - 100M SHIELD)
```bash
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992  # ❌ OLD (100M)
VITE_REVENUE_ROUTER_ADDRESS=0x8e5C9933c08451a6a31635a3Ea1221c010DF158e  # ❌ OLD
VITE_STAKING_BOOST_ADDRESS=0xD8DF192872e94F189602ae3634850C989A1802C6  # ❌ OLD
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31  # ❌ OLD
VITE_SHXRP_VAULT_ADDRESS=0x82d74B5fb005F7469e479C224E446bB89031e17F  # ❌ OLD
```

### New Values (NEW - 10M SHIELD) ✅
```bash
# ✅ NEW SHIELD Token (10M Supply)
VITE_SHIELD_TOKEN_ADDRESS=0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616

# ✅ NEW RevenueRouter (Deployed)
VITE_REVENUE_ROUTER_ADDRESS=0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB

# ✅ NEW StakingBoost (Deployed)
VITE_STAKING_BOOST_ADDRESS=0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4

# ✅ NEW MerkleDistributor (Deployed)
VITE_MERKLE_DISTRIBUTOR_ADDRESS=0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490

# ⏳ PENDING ShXRPVault (Not deployed yet - need gas)
VITE_SHXRP_VAULT_ADDRESS=<TO_BE_DEPLOYED>
```

---

## 📋 Deployment Checklist

### ✅ Completed
- [x] Deploy new SHIELD Token (10M supply)
- [x] Deploy RevenueRouter
- [x] Deploy StakingBoost
- [x] Deploy MerkleDistributor
- [x] Create funding script (scripts/fund-merkle-distributor.ts)
- [x] Create renouncement script (scripts/renounce-old-shield-tokens.ts)

### ✅ Completed
- [x] Deploy ShXRPVault
- [x] Fund MerkleDistributor with 2M SHIELD
- [x] Renounce old 100M SHIELD token (TX: 0x271b89ff5ba9cf3a9a2a43e3a65ab71bd3b419558edeecaaf7c3cd2b9c2da66a)
- [x] Update environment variables
- [x] Update DEPLOYMENT_GUIDE.md
- [x] Verify all contracts on explorer

---

## 🚀 Next Steps

### 1. Get More Test FLR
The deployer account needs more gas to complete the deployment.

**Deployer Address:** `0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D`  
**Current Balance:** 0.083 FLR  
**Required:** ~0.25 FLR  
**Needed:** ~0.2 FLR more

**Get test FLR from Coston2 faucet:**
- https://faucet.flare.network/coston2
- Request for: `0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D`

### 2. Deploy ShXRPVault
Once you have enough FLR, run:
```bash
npx tsx scripts/deploy-shxrp-only.ts
```

This will deploy ShXRPVault with:
- FXRP Token: `0x0b6A3645c240605887a5532109323A3E12273dc7`
- RevenueRouter: `0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB`
- StakingBoost: `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4`

### 3. Fund MerkleDistributor
After ShXRPVault is deployed, fund the airdrop:
```bash
npx tsx scripts/fund-merkle-distributor.ts
```

This transfers 2,000,000 SHIELD to MerkleDistributor for the airdrop.

### 4. Renounce Old SHIELD Token
Renounce ownership of the old 100M SHIELD token:
```bash
npx tsx scripts/renounce-old-shield-tokens.ts
```

This makes the old token immutable (no more minting/burning).

### 5. Update Environment Variables
Use the Replit Secrets tab or run:
```bash
# Copy from "New Values" section above
# Paste into Replit Secrets or .env file
```

### 6. Restart Application
After updating environment variables:
```bash
npm run dev
```

Or use the Replit "Restart" button to reload with new addresses.

---

## 🔗 Explorer Links

### New Contracts (10M SHIELD)
- **SHIELD Token:** https://coston2-explorer.flare.network/address/0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
- **RevenueRouter:** https://coston2-explorer.flare.network/address/0x262582942Dcf97F59Cb0fe61e5852DDa10fD6fFB
- **StakingBoost:** https://coston2-explorer.flare.network/address/0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4
- **MerkleDistributor:** https://coston2-explorer.flare.network/address/0x8b3eC671c14E44B9EC8274eA3B6884A4259Ef490
- **ShXRPVault:** ⏳ Pending deployment

### Old Contracts (100M SHIELD - DEPRECATED)
- **Old SHIELD #1:** https://coston2-explorer.flare.network/address/0xD6D4768Ffac6cA26d5a34b36555bDB3ad85B8308 (✅ Renounced)
- **Old SHIELD #2:** https://coston2-explorer.flare.network/address/0x59fF3b46f0Fa0cF1aa3ca48E5FC0a6f93e2B8209 (✅ Renounced)
- **Old SHIELD #3:** https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992 (✅ Renounced)

---

## 📊 Token Supply Comparison

| Metric | Old (100M) | New (10M) | Change |
|--------|-----------|-----------|--------|
| **Total Supply** | 100,000,000 SHIELD | 10,000,000 SHIELD | -90% |
| **Airdrop Amount** | 2,000,000 SHIELD | 2,000,000 SHIELD | 0% |
| **Airdrop %** | 2% of supply | 20% of supply | +900% |
| **Treasury** | 98,000,000 SHIELD | 8,000,000 SHIELD | -91.8% |

**Key Insight:** The new 10M supply gives the airdrop 10x more weight (20% vs 2%), making governance more decentralized while maintaining the same absolute 2M SHIELD distribution.

---

## ⚠️ Important Notes

1. **DO NOT** renounce the new 10M SHIELD token (`0x061Cf4B...`)
   - This is the active token
   - It's protected by script safety checks

2. **ONLY renounce** the old 100M SHIELD token (`0x07F943...`)
   - The other two old tokens are already renounced

3. **Gas requirements:**
   - ShXRPVault deployment: ~0.15-0.2 FLR
   - MerkleDistributor funding: ~0.05 FLR
   - Old token renouncement: ~0.05 FLR
   - **Total needed:** ~0.25-0.3 FLR

4. **Merkle root unchanged:**
   - Same addresses (20 wallets)
   - Same amounts (100k SHIELD each)
   - Same total (2M SHIELD)
   - Root: `0xee1f232297e8aeb301dbf175781d8e8d2356cdf0d5d9276989463417cd0510d4`

---

## 🎯 Success Criteria

Deployment is complete when:
- [ ] ShXRPVault is deployed and verified
- [ ] MerkleDistributor has 2M SHIELD balance
- [ ] Old 100M SHIELD token ownership renounced
- [ ] All environment variables updated
- [ ] Application running with new contracts
- [ ] Documentation updated

---

*Generated: November 23, 2025*
