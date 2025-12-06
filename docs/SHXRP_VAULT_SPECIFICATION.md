# ShXRPVault Specification Document

**Version:** 1.1  
**Date:** December 2025  
**Status:** Pre-Audit  

## 1. Overview

ShXRPVault is an ERC-4626 compliant tokenized vault for liquid staking of XRP on Flare Network. Users deposit FXRP (FAssets-wrapped XRP) and receive shXRP shares representing their proportional ownership of the vault's assets and yield.

### 1.1 Core Value Proposition
- **Deposit FXRP** → Receive shXRP (liquid staking token)
- **Automatic Yield** → Vault deploys capital to yield strategies
- **Instant Withdrawals** → 10% buffer for immediate redemptions
- **SHIELD Boost** → Stakers get enhanced APY on withdrawals

### 1.2 Contract Addresses (Testnet - Coston2)
- ShXRPVault: TBD (pending mainnet deployment)
- RevenueRouter: TBD
- StakingBoost: `0x9dF4C13fd100a8025c663B6aa2eB600193aE5FB3`
- VaultController: TBD
- FXRP (Testnet): `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3`
- FXRP (Mainnet): `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`

---

## 2. System Architecture

### 2.1 Contract Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                       ShXRPVault                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  ERC4626    │  │  Ownable    │  │  ReentrancyGuard    │   │
│  │  (shares)   │  │  (access)   │  │  (security)         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│                           │            ┌─────────────────┐   │
│                           │            │    Pausable     │   │
│                           │            │  (emergency)    │   │
│                           │            └─────────────────┘   │
│  ┌────────────────────────┼────────────────────────────┐     │
│  │                        ▼                            │     │
│  │    ┌─────────────────────────────────────────┐     │     │
│  │    │              Strategies                  │     │     │
│  │    │  ┌──────────┐  ┌──────────┐             │     │     │
│  │    │  │ Firelight│  │ Kinetic  │  (IStrategy)│     │     │
│  │    │  │  (50%)   │  │  (40%)   │             │     │     │
│  │    │  └──────────┘  └──────────┘             │     │     │
│  │    └─────────────────────────────────────────┘     │     │
│  │                                                    │     │
│  │    ┌─────────────┐  ┌─────────────────────────┐   │     │
│  │    │   Buffer    │  │     RevenueRouter       │   │     │
│  │    │   (10%)     │  │  (fee distribution)     │   │     │
│  │    └─────────────┘  └─────────────────────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                  StakingBoost                       │     │
│  │    (SHIELD staking → APY boost on withdrawals)     │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 External Dependencies

| Contract | Purpose | Interface |
|----------|---------|-----------|
| RevenueRouter | Fee distribution (burn + boost) | Immutable, receives FXRP fees immediately |
| StakingBoost | APY boost for SHIELD stakers | IStakingBoost.getBoost(), donateOnBehalf() |
| IStrategy | Yield strategy interface | deploy(), withdraw(), report(), totalAssets() |
| FXRP | Underlying asset (6 decimals) | Standard ERC-20 |

---

## 3. State Variables

### 3.1 Immutable State
| Variable | Type | Description |
|----------|------|-------------|
| `revenueRouter` | address | Receives deposit/withdraw fees immediately |
| Asset (via ERC4626) | IERC20 | FXRP token |

### 3.2 Configurable State
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `stakingBoost` | IStakingBoost | Set once post-deploy | SHIELD staking boost contract |
| `minDeposit` | uint256 | 10000 (0.01 FXRP) | Minimum deposit amount |
| `depositLimit` | uint256 | 1,000,000e6 | Maximum TVL |
| `bufferTargetBps` | uint256 | 1000 (10%) | Target buffer allocation |
| `yieldRoutingFeeBps` | uint256 | 10 (0.1%) | Fee on strategy profits |
| `accruedProtocolFees` | uint256 | 0 | Unclaimed yield fees (claimed from buffer when available) |
| `operators` | mapping | Deployer only | Authorized operators |
| `totalStrategyTargetBps` | uint256 | 0 | Sum of all strategy targetBps |

### 3.3 Strategy State
| Variable | Type | Description |
|----------|------|-------------|
| `strategies` | mapping(address => StrategyInfo) | Strategy configurations |
| `strategyList` | address[] | List of all strategy addresses |

### 3.4 Constants
| Constant | Value | Description |
|----------|-------|-------------|
| `DEPOSIT_FEE_BPS` | 20 (0.2%) | Fee on deposits |
| `WITHDRAW_FEE_BPS` | 20 (0.2%) | Fee on withdrawals |

---

## 4. Invariants (MUST Always Hold)

### 4.1 Core Invariants

**INV-1: Share Backing**
```
totalSupply() > 0 → totalAssets() > 0
```
No unbacked shares can exist. Every share must be backed by assets.

**INV-2: Asset Accounting**
```
totalAssets() == bufferBalance + sum(strategy.totalAssets() for active strategies)
```
All assets must be accounted for in buffer or strategies.

**INV-3: Deposit Limit**
```
totalAssets() <= depositLimit
```
Enforced in `_deposit()` and reflected in `maxDeposit()`/`maxMint()`.

**INV-4: Strategy Target Sum**
```
totalStrategyTargetBps + bufferTargetBps <= 10000
```
Allocation targets cannot exceed 100%.

**INV-5: Fee Accrual (No Unbacked Shares)**
```
Protocol fees are NEVER minted as shares
accruedProtocolFees tracks yield fees to be claimed from buffer
```
Yield fees are tracked and claimed from available liquidity, preventing share dilution.

**INV-6: Pause Stops User Operations**
```
paused() == true → deposit(), mint(), withdraw(), redeem() all revert
```
When paused, all user-facing ERC-4626 functions are blocked.

**INV-7: Share Price Monotonicity (Absent Losses)**
```
If no strategy reports loss: totalAssets() / totalSupply() is non-decreasing
```
Share price should only increase from yield (or stay flat), never decrease without explicit loss.

### 4.2 Access Control Invariants

**INV-8: Operator Permissions**
```
onlyOperator modifier: msg.sender == owner || operators[msg.sender]
```

**INV-9: StakingBoost One-Time Set**
```
setStakingBoost() requires address(stakingBoost) == address(0)
```
Can only be set once during deployment setup.

**INV-10: DonateOnBehalf Restriction**
```
donateOnBehalf() requires msg.sender == address(stakingBoost)
```
Only StakingBoost can mint boost shares to users.

### 4.3 Strategy Invariants

**INV-11: Strategy Removal**
```
removeStrategy() requires strategies[strategy].totalDeployed == 0
```
No funds can be stranded in removed strategies.

**INV-12: Strategy Deployment**
```
deployToStrategy() requires strategy.status == Active
```
Only active strategies receive deposits.

**INV-13: Strategy Lifecycle Valid Transitions**
```
Inactive → Active (via activateStrategy)
Active → Paused (via pauseStrategy)
Paused → Active (via resumeStrategy)
Active/Paused → Deprecated (via deprecateStrategy)
Deprecated → Removed (via removeStrategy, requires totalDeployed == 0)
```

### 4.4 Buffer Invariants

**INV-14: Buffer Replenishment**
```
If bufferBalance < withdrawal amount:
  _withdrawFromStrategies() is called to replenish
  Revert if still insufficient after strategy withdrawals
```

**INV-15: Withdrawal Always Succeeds (If Solvent)**
```
If totalAssets() >= requested withdrawal amount:
  Withdrawal must succeed (buffer + strategy liquidity available)
```

---

## 5. Access Control Matrix

### 5.1 Complete Function Access

| Function | Owner | Operator | StakingBoost | Public |
|----------|-------|----------|--------------|--------|
| **User Operations** | | | | |
| deposit | ✓ | ✓ | | ✓ |
| mint | ✓ | ✓ | | ✓ |
| withdraw | ✓ | ✓ | | ✓ |
| redeem | ✓ | ✓ | | ✓ |
| **Strategy Reporting** | | | | |
| reportStrategy | ✓ | ✓ | ✓ | ✓ |
| **Strategy Lifecycle (Owner Only)** | | | | |
| addStrategy | ✓ | | | |
| removeStrategy | ✓ | | | |
| activateStrategy | ✓ | | | |
| resumeStrategy | ✓ | | | |
| deprecateStrategy | ✓ | | | |
| updateAllocation | ✓ | | | |
| **Strategy Operations (Operator)** | | | | |
| pauseStrategy | ✓ | ✓ | | |
| deployToStrategy | ✓ | ✓ | | |
| withdrawFromStrategy | ✓ | ✓ | | |
| **Fee Management** | | | | |
| claimAccruedFees | ✓ | ✓ | | |
| setYieldRoutingFeeBps | ✓ | | | |
| **Configuration** | | | | |
| setBufferTarget | ✓ | | | |
| setDepositLimit | ✓ | | | |
| setMinDeposit | ✓ | | | |
| setStakingBoost | ✓ | | | |
| **Operator Management** | | | | |
| addOperator | ✓ | | | |
| removeOperator | ✓ | | | |
| **Emergency** | | | | |
| pause | ✓ | | | |
| unpause | ✓ | | | |
| **Boost Integration** | | | | |
| donateOnBehalf | | | ✓ | |
| **View Functions** | | | | |
| All view functions | ✓ | ✓ | ✓ | ✓ |

### 5.2 Modifier Definitions

```solidity
modifier onlyOperator() {
    require(operators[msg.sender] || msg.sender == owner(), "Not authorized");
    _;
}
```

---

## 6. Fee Mechanism

### 6.1 Deposit Fee (0.2%) - IMMEDIATE TRANSFER
```
User deposits 1000 FXRP
→ Vault receives 1000 FXRP
→ Fee: 1000 × 0.002 = 2 FXRP → Transferred IMMEDIATELY to RevenueRouter
→ Net: 998 FXRP → Converted to shXRP shares for user
```

**Implementation in `_deposit()`:**
1. `super._deposit()` transfers full assets and mints fee-adjusted shares
2. Fee calculated: `assets * DEPOSIT_FEE_BPS / 10000`
3. Fee transferred immediately: `fxrp.safeTransfer(revenueRouter, depositFee)`

### 6.2 Withdrawal Fee (0.2%) - IMMEDIATE TRANSFER
```
User withdraws 1000 FXRP
→ Shares burned: Worth 1002 FXRP (to cover assets + fee)
→ User receives: 1000 FXRP
→ Fee: 2 FXRP → Transferred IMMEDIATELY to RevenueRouter
```

**Implementation in `_withdraw()`:**
1. Calculate gross assets from shares
2. `super._withdraw()` burns shares and transfers net assets to user
3. Fee transferred immediately: `fxrp.safeTransfer(revenueRouter, withdrawFee)`

### 6.3 Yield Routing Fee (0.1% of profits) - ACCRUED
```
Strategy reports 1000 FXRP profit via reportStrategy()
→ Fee: 1000 × 0.001 = 1 FXRP → Added to accruedProtocolFees
→ Operator calls claimAccruedFees()
→ Fee claimed from buffer (if available) → Sent to RevenueRouter
```

**Key Design Decision:** Yield fees are ACCRUED (not immediately transferred) because:
1. Strategy profits are reinvested, not returned to vault buffer
2. Fees are claimed only when buffer has sufficient liquidity
3. This prevents minting unbacked shares or depleting buffer

**claimAccruedFees() Behavior:**
- Claims `min(accruedProtocolFees, bufferBalance)`
- Partial claims allowed when buffer is low
- Remaining fees stay accrued until next claim

---

## 7. SHIELD Staking Boost

### 7.1 Boost Calculation
```solidity
function getBoost(address user) external view returns (uint256) {
    uint256 rawBoost = (stakes[user].amount / BOOST_PER_TOKENS) * 100;
    return rawBoost > globalBoostCapBps ? globalBoostCapBps : rawBoost;
}
```
- 100 SHIELD staked = +1% APY boost (100 bps)
- 2500 SHIELD staked = +25% max boost (capped by globalBoostCapBps)

### 7.2 Boost Application in `_withdraw()`
After standard ERC-4626 withdrawal completes:
```solidity
uint256 boostBps = stakingBoost.getBoost(owner);
if (boostBps > 0) {
    uint256 boostBonus = (assets * boostBps) / 10000;
    if (boostBonus > 0) {
        fxrp.safeTransfer(receiver, boostBonus);
    }
}
```

**Important:** Boost bonus comes from vault buffer, not minted shares.

### 7.3 donateOnBehalf() - StakingBoost Integration
```solidity
function donateOnBehalf(address user, uint256 fxrpAmount) external nonReentrant returns (uint256 sharesMinted)
```
- **Caller:** Only StakingBoost contract
- **Action:** Transfers FXRP from StakingBoost, mints shXRP shares to user
- **No Fee:** Donations are not subject to deposit fee
- **Share Calculation:** Uses standard ERC-4626 conversion (Floor rounding)

**Flow:**
1. StakingBoost.claim() → calculates user's FXRP reward
2. StakingBoost approves vault for FXRP
3. StakingBoost calls vault.donateOnBehalf(user, amount)
4. Vault mints shXRP shares directly to user

### 7.4 previewRedeem() vs previewRedeemWithBoost()
- `previewRedeem()`: ERC-4626 compliant, NO boost (for integrations)
- `previewRedeemWithBoost(shares, user)`: Includes boost bonus (for frontend display)

---

## 8. Strategy Integration

### 8.1 Strategy Lifecycle
```
Inactive → (activateStrategy) → Active → (pauseStrategy) → Paused
              ↓                              ↓                 ↓
         (owner only)              (operator or owner)   (resumeStrategy - owner only)
                                                               ↓
                                       ← ← ← ← ← ← ← ← ← ← ← Active
              
Active/Paused → (deprecateStrategy - owner only) → Deprecated
                                                        ↓
                                     (removeStrategy - requires totalDeployed == 0)
                                                        ↓
                                                    Deleted
```

### 8.2 Strategy Interface (IStrategy)
```solidity
interface IStrategy {
    function asset() external view returns (address);
    function deploy(uint256 amount) external;
    function withdraw(uint256 amount, address to) external returns (uint256 actual);
    function report() external returns (uint256 profit, uint256 loss, uint256 totalAssets);
    function totalAssets() external view returns (uint256);
}
```

### 8.3 Capital Deployment Flow (deployToStrategy)
1. Vault approves strategy to pull FXRP: `fxrp.approve(strategy, amount)`
2. Calls `strategy.deploy(amount)` - strategy pulls via transferFrom
3. Vault verifies balance decreased: `actualDeployed = balanceBefore - balanceAfter`
4. Updates `totalDeployed` tracking
5. Clears remaining approval: `fxrp.approve(strategy, 0)`

### 8.4 Profit Reporting Flow (reportStrategy)
1. Anyone calls `vault.reportStrategy(strategy)` (publicly callable)
2. Strategy executes `report()` - harvests and reinvests yield
3. Returns (profit, loss, assetsAfter)
4. Vault calculates yield fee: `profit × yieldRoutingFeeBps / 10000`
5. Fee added to `accruedProtocolFees`
6. `totalDeployed` updated to `assetsAfter`

---

## 9. Emergency Procedures

### 9.1 Pause/Unpause (Owner Only)
- **Trigger:** `pause()` - Owner calls during emergency
- **Effect:** 
  - All user operations blocked (deposit, mint, withdraw, redeem)
  - View functions still work
  - Owner/Operators can still manage strategies
  - `maxDeposit()` and `maxMint()` return 0 when paused
- **Recovery:** `unpause()` - Owner calls after issue resolved

### 9.2 Strategy Emergency Procedures

**Pause a Single Strategy:**
- **Trigger:** `pauseStrategy(strategy)` - Operator or Owner
- **Effect:** Strategy stops receiving new deployments
- **Recovery:** `resumeStrategy(strategy)` - Owner only

**Deprecate a Strategy:**
- **Trigger:** `deprecateStrategy(strategy)` - Owner only
- **Effect:** Permanently disabled, cannot be resumed
- **Next Step:** Withdraw all funds, then `removeStrategy()`

**Emergency Strategy Withdrawal:**
- **Action:** Operator calls `withdrawFromStrategy(strategy, amount)`
- **Use Case:** Pull liquidity from failing strategy
- **Note:** Can withdraw from Paused strategies, not just Active

### 9.3 Operator Management During Emergency
- **Remove Compromised Operator:** `removeOperator(address)` - Owner only
- **Effect:** Immediately revokes operator privileges
- **Use Case:** Operator key compromised or malicious behavior

### 9.4 Cross-Contract Coordination

**StakingBoost Emergency:**
- StakingBoost has `setRevenueRouter()` to redirect if router compromised
- StakingBoost owner can `recoverTokens()` for stuck funds

**RevenueRouter Emergency:**
- Owner can `recoverTokens()` to rescue stuck tokens
- Can adjust `burnAllocationBps` and `boostAllocationBps` to redirect revenue

### 9.5 Strategy Failure Fallback in totalAssets()
```solidity
try IStrategy(strategyAddr).totalAssets() returns (uint256 strategyAssets) {
    total += strategyAssets;
} catch {
    // Fallback: use totalDeployed as conservative estimate
    total += strategyInfo.totalDeployed;
}
```
- Prevents single strategy failure from breaking entire vault
- Uses last known deployment amount as fallback

---

## 10. Reentrancy Analysis

### 10.1 Protected Functions (nonReentrant)
All state-changing functions use `nonReentrant` modifier:
- `deposit`, `mint`, `withdraw`, `redeem`
- `deployToStrategy`, `withdrawFromStrategy`
- `donateOnBehalf`

### 10.2 External Call Points & Risk Assessment

| Function | External Call | When | Risk | Mitigation |
|----------|---------------|------|------|------------|
| `_deposit` | `fxrp.safeTransferFrom(caller)` | Before state change | Low | ERC-4626 internal handles this |
| `_deposit` | `fxrp.safeTransfer(revenueRouter)` | After mint | Low | State finalized, trusted recipient |
| `_withdraw` | `fxrp.safeTransfer(receiver)` | After burn | Low | State finalized |
| `_withdraw` | `fxrp.safeTransfer(receiver)` [boost] | After burn | Low | State finalized |
| `_withdraw` | `fxrp.safeTransfer(revenueRouter)` | After burn | Low | Trusted recipient |
| `_withdraw` | `stakingBoost.getBoost(owner)` | During | Low | View function only |
| `deployToStrategy` | `strategy.deploy()` | Middle | Medium | nonReentrant + balance checks |
| `withdrawFromStrategy` | `strategy.withdraw()` | Middle | Medium | nonReentrant + balance checks |
| `_withdrawFromStrategies` | `strategy.withdraw()` | Middle | Medium | try/catch, nonReentrant on parent |
| `reportStrategy` | `strategy.report()` | Only call | Medium | No nonReentrant, but safe* |
| `totalAssets` | `strategy.totalAssets()` | View | Low | View function, try/catch |
| `donateOnBehalf` | `fxrp.safeTransferFrom(stakingBoost)` | Start | Low | nonReentrant, trusted caller |
| `claimAccruedFees` | `fxrp.safeTransfer(revenueRouter)` | End | Low | State updated first |

**\*reportStrategy Safety Note:**
- Does NOT have `nonReentrant` modifier
- Safe because: only calls trusted (owner-approved) strategies
- Strategy cannot manipulate vault state during report()
- Only updates accounting (totalDeployed, accruedProtocolFees)

### 10.3 Cross-Contract Reentrancy Vectors

**StakingBoost → ShXRPVault:**
- Path: `StakingBoost.claim()` → `vault.donateOnBehalf()`
- Protection: `donateOnBehalf()` has `nonReentrant` modifier
- Safe: No reentry possible

**ShXRPVault → Strategy:**
- Path: `deployToStrategy()` → `strategy.deploy()` → (callback?)
- Protection: `nonReentrant` prevents recursive deposit/withdraw
- Residual Risk: Strategy could manipulate external state (DEX, lending pool)
- Mitigation: Only owner-approved strategies, balance verification pre/post

**RevenueRouter Transfers:**
- Path: `_deposit()/_withdraw()` → `fxrp.safeTransfer(revenueRouter)`
- Protection: Transfer happens after all state changes complete
- Safe: RevenueRouter cannot call back into vault

### 10.4 ERC-20 Hook Considerations
- `_mint()` and `_burn()` may trigger ERC-777 hooks if shXRP supports them
- **Current State:** shXRP is ERC-20 (no hooks), not ERC-777
- If upgraded to support hooks, add nonReentrant to mint/burn paths

---

## 11. Known Limitations & Assumptions

### 11.1 Token Assumptions
- FXRP is standard ERC-20 (no fee-on-transfer, no rebasing)
- FXRP uses 6 decimals
- shXRP is standard ERC-20 (no hooks)

### 11.2 Strategy Assumptions
- Strategies implement IStrategy correctly
- Strategies pull exact approved amounts (no over-pull)
- Strategies report accurate profit/loss
- Strategies are deployed by owner (trusted)

### 11.3 Oracle/Price Assumptions
- Share price calculated via ERC-4626 math only
- No external price oracles used
- Exchange rate = totalAssets / totalSupply

### 11.4 Timing Assumptions
- Strategy `report()` should be called regularly (recommended: daily/weekly)
- Buffer may temporarily fall below target during large withdrawals
- accruedProtocolFees may accumulate if buffer is persistently low

### 11.5 Boost Source Limitation
- Boost bonus paid from vault buffer
- If buffer depleted by boosts, may affect instant withdrawal capability
- Consider: buffer target should account for expected boost payouts

---

## 12. Upgrade Considerations

### 12.1 Non-Upgradeable Design
ShXRPVault is NOT upgradeable. Key decisions:
- Immutable revenueRouter
- StakingBoost set once, never changed
- Strategy contracts can be swapped (add new, deprecate old)

### 12.2 Migration Path
To migrate to new vault version:
1. Pause current vault
2. Deprecate all strategies
3. Withdraw all funds from strategies to buffer
4. Users withdraw/redeem from old vault
5. Deploy new vault
6. Users deposit to new vault
7. Coordinate with StakingBoost/RevenueRouter updates

---

## 13. Test Coverage Requirements

### 13.1 Unit Tests - Core ERC-4626

| Test Case | Description |
|-----------|-------------|
| deposit_minDeposit | Revert if below minDeposit |
| deposit_maxDeposit | Revert if exceeds depositLimit |
| deposit_fee | Verify 0.2% fee sent to RevenueRouter |
| deposit_shares | Verify correct shares minted (fee-adjusted) |
| withdraw_fee | Verify 0.2% fee sent to RevenueRouter |
| withdraw_bufferSufficient | Withdraw from buffer only |
| withdraw_bufferInsufficient | Triggers strategy withdrawal |
| redeem_withBoost | Boost bonus applied correctly |
| redeem_withoutBoost | No boost when user has 0 SHIELD staked |
| preview_consistency | Preview matches actual for all operations |

### 13.2 Unit Tests - Strategy Management

| Test Case | Description |
|-----------|-------------|
| addStrategy_validation | Asset mismatch, target exceeds 100% |
| addStrategy_aggregateLimit | Total targets cannot exceed 100% |
| activateStrategy_lifecycle | Inactive → Active |
| pauseStrategy_operator | Operator can pause |
| resumeStrategy_ownerOnly | Only owner can resume |
| deprecateStrategy | Active/Paused → Deprecated |
| removeStrategy_hasFunds | Revert if totalDeployed > 0 |
| deployToStrategy | Verify balance changes, approval cleared |
| withdrawFromStrategy | Verify actual received, accounting |
| reportStrategy_publicAccess | Anyone can call |
| reportStrategy_yieldFee | Fee accrued correctly |

### 13.3 Unit Tests - Fee Mechanism

| Test Case | Description |
|-----------|-------------|
| depositFee_immediate | Fee transferred to RevenueRouter in same tx |
| withdrawFee_immediate | Fee transferred to RevenueRouter in same tx |
| yieldFee_accrued | Added to accruedProtocolFees |
| claimAccruedFees_full | Claim all when buffer sufficient |
| claimAccruedFees_partial | Claim partial when buffer low |
| claimAccruedFees_empty | Returns 0 when no fees accrued |

### 13.4 Unit Tests - Boost Integration

| Test Case | Description |
|-----------|-------------|
| donateOnBehalf_onlyStakingBoost | Revert if caller != stakingBoost |
| donateOnBehalf_sharesMinted | Correct shares minted to user |
| donateOnBehalf_noFee | No deposit fee on donations |
| withdraw_boostApplied | Bonus from buffer to receiver |
| previewRedeemWithBoost | Includes boost in preview |

### 13.5 Unit Tests - Emergency & Access Control

| Test Case | Description |
|-----------|-------------|
| pause_blocksDeposit | deposit() reverts when paused |
| pause_blocksWithdraw | withdraw() reverts when paused |
| pause_ownerCanManage | Owner can still manage strategies |
| unpause_resumes | Operations work after unpause |
| maxDeposit_whenPaused | Returns 0 |
| addOperator | Operator can call operator functions |
| removeOperator | Removed operator cannot call |
| setStakingBoost_onlyOnce | Revert on second call |

### 13.6 Integration Tests

| Test Case | Description |
|-----------|-------------|
| fullFlow_depositYieldWithdraw | Deposit → Strategy → Yield → Report → Withdraw |
| fullFlow_multiStrategy | Multiple strategies, proportional allocation |
| vaultController_compound | VaultController triggers compound |
| stakingBoost_claimToVault | Claim flow mints shXRP |
| revenueRouter_feeFlow | Fees reach RevenueRouter, trigger distribution |

### 13.7 Edge Cases & Adversarial Tests

| Test Case | Description |
|-----------|-------------|
| zeroDeposit | Revert on deposit(0) |
| zeroWithdraw | Revert on withdraw(0) |
| depositAtExactLimit | Deposit fills to depositLimit exactly |
| withdrawMoreThanBuffer | Strategy withdrawal required |
| allUsersRedeem | totalSupply → 0, no revert |
| firstDeposit | Bootstrap: 0 shares → correct initial rate |
| strategyFailure_totalAssets | Fallback to totalDeployed |
| strategyFailure_withdraw | try/catch continues to next |
| maliciousStrategy_overPull | Revert if strategy pulls > approved |
| maliciousStrategy_wrongAsset | Detected during addStrategy |
| flashLoan_attack | nonReentrant prevents manipulation |
| boost_exceedsBuffer | Handle case where boost depletes buffer |

### 13.8 Invariant/Fuzz Tests

| Invariant | Description |
|-----------|-------------|
| INV-1 | No unbacked shares (totalSupply > 0 → totalAssets > 0) |
| INV-2 | Asset accounting balances (buffer + strategies) |
| INV-3 | Deposit limit enforced |
| INV-4 | Strategy allocation ≤ 100% |
| INV-5 | Fee accrual doesn't mint shares |
| INV-7 | Share price monotonically increasing (no losses) |

---

## 14. Audit Checklist

### 14.1 Pre-Audit Requirements
- [ ] All unit tests passing (100% coverage of critical paths)
- [ ] All integration tests passing
- [ ] Static analysis (Slither) - no high/medium findings
- [ ] Gas optimization review
- [ ] NatSpec documentation complete on all public/external functions
- [ ] This specification document reviewed and accurate

### 14.2 Audit Focus Areas
1. **ERC-4626 Compliance** - Preview functions accuracy, rounding direction
2. **Fee Mechanism** - No value extraction beyond stated fees
3. **Reentrancy** - Cross-contract attack vectors, especially strategy interaction
4. **Access Control** - Operator/owner separation, StakingBoost restriction
5. **Strategy Integration** - Malicious strategy protection, accounting accuracy
6. **Rounding** - No precision loss exploits (especially share calculations)
7. **Overflow/Underflow** - Safe math usage (Solidity 0.8.x)
8. **Pause Mechanism** - Correct blocking of operations
9. **Boost Payment** - Buffer impact, source of funds
10. **Fee Accrual** - Proper tracking and claiming

---

## 15. Appendix

### 15.1 Deployment Order (Critical)
1. Deploy SHIELD token
2. Deploy RevenueRouter (needs SHIELD, wFLR, router)
3. Deploy ShXRPVault (needs FXRP, RevenueRouter, **stakingBoost=address(0)**)
4. Deploy StakingBoost (needs SHIELD, FXRP, vault, revenueRouter)
5. **Call vault.setStakingBoost(stakingBoostAddress)** ← Critical linkage
6. Deploy VaultController
7. Register vault in VaultController
8. Deploy strategies (Firelight, Kinetic)
9. Add strategies to vault via `addStrategy()`
10. Activate strategies via `activateStrategy()`
11. Set RevenueRouter.setStakingBoost() and .setFxrpToken()

### 15.2 Circular Dependency Resolution
```
ShXRPVault needs StakingBoost address for donateOnBehalf() access control
StakingBoost needs ShXRPVault address at construction

Solution:
1. Deploy vault with stakingBoost = address(0)
2. Deploy StakingBoost with real vault address
3. Call vault.setStakingBoost() - one-time setter
```

### 15.3 Related Documentation
- ERC-4626 Specification: https://eips.ethereum.org/EIPS/eip-4626
- OpenZeppelin ERC4626: https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC4626
- Flare FAssets: https://flare.network/fassets/

### 15.4 Changelog
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2025 | Initial specification |
| 1.1 | Dec 2025 | Architect review fixes: expanded invariants, corrected access control matrix, clarified fee flow (immediate vs accrued), expanded reentrancy analysis, added emergency procedures, expanded test coverage |
