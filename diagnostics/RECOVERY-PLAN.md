# XRP Liquid Staking - Recovery Plan
**Generated:** 2025-11-13 14:32 UTC  
**Status:** CRITICAL - System in inconsistent state

## 🚨 Critical Issues Identified

### 1. Fund Stuck Issue
- **225 FXRP** stuck in smart account (0x0C2b9f...91a4DDd)
- Should have been minted to shXRP shares but wasn't
- **Impact:** Users deposited funds but received no shares

### 2. Database Desynchronization
- **Database claims:** 35 shXRP across 2 positions
- **On-chain reality:** 0 shXRP
- **Discrepancy:** 100% mismatch - CRITICAL

### 3. Missing Withdrawal Record
- **XRPL Transaction:** AFEB1D019217AB1B73479E29ED2E34D985BD66824E53A544A38B8EC044CF1D6A
- **Status:** 10 XRP successfully sent to user wallet
- **Database:** No record of this completion (marked as failed)
- **Impact:** User got paid but system doesn't know

## 📊 Current State Snapshot

### On-Chain Balances (Flare Coston2)
```
Smart Account: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd
├─ CFLR:  51.498 (gas reserve)
├─ FXRP:  225.0  ⚠️ STUCK
└─ shXRP: 0.0    ⚠️ Should be ~35
```

### Database State
```
Positions:
├─ Position 1: 20.00 shXRP (r3fMucz3hfhAaeS3kJsLuU5E2L6dSYGoQn)
└─ Position 2: 15.00 shXRP (r3fMucz3hfhAaeS3kJsLuU5E2L6dSYGoQn)
Total: 35.00 shXRP ⚠️ Doesn't exist on-chain

Redemptions:
├─ Total attempts: 9
├─ Completed: 0 ⚠️ Actually 1 succeeded
├─ Failed: 9
└─ Pending: 0

Transactions:
├─ Deposits: 1
└─ Withdrawals: 0 ⚠️ Missing AFEB1D01... record
```

## 🔧 Recovery Actions Required

### Phase 1: Immediate Fund Recovery
1. ✅ Fix recovery endpoint access to FlareClient
2. ⏳ Mint 225 FXRP → shXRP shares
3. ⏳ Reconcile database positions to match on-chain state
4. ⏳ Record missed withdrawal (AFEB1D01...)

### Phase 2: Fix XRPL Listener
1. Debug why listener missed agent payment
2. Implement transaction history backfill
3. Add pending redemption tracking

### Phase 3: Prevent Future Issues
1. Add atomic transaction guards
2. Implement nightly reconciliation worker
3. Add comprehensive test suite

## ⚠️ Safety Measures

- [x] Diagnostic snapshot saved
- [ ] Withdrawal endpoint disabled (maintenance mode)
- [ ] Manual approval required before executing recovery
- [ ] Test recovery on small amount first

## 📝 Evidence Files

- Diagnostic Snapshot: `diagnostics/snapshot-20251113-*.json`
- XRPL Transaction: https://testnet.xrpl.org/transactions/AFEB1D019217AB1B73479E29ED2E34D985BD66824E53A544A38B8EC044CF1D6A
- Recovery Plan: This file

---

**Next Step:** Execute Phase 1 recovery to mint stuck FXRP
