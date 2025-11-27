# StakingBoost Technical Specification

Complete technical specification for the "Stake SHIELD → Boost shXRP Yield" feature.

---

## Overview

StakingBoost implements a Synthetix-style reward accumulator to distribute FXRP rewards pro-rata to SHIELD stakers. When stakers claim their rewards, shXRP shares are minted directly to their wallet via `vault.donateOnBehalf()`, creating differentiated yield for stakers vs non-stakers.

### Formula (from whitepaper)

```
Boost APY = Base APY + (Annual Protocol Revenue → FXRP) × (Your Locked SHIELD ÷ Total Locked SHIELD)
```

**Key Property:** 100% of the boost allocation is distributed pro-rata to SHIELD lockers. No minting. No inflation. Pure revenue-share.

---

## Architecture

### Contract Interactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Revenue Distribution Flow                           │
│                                                                              │
│  ┌──────────────┐    deposit/withdraw fees    ┌───────────────────┐         │
│  │ ShXRPVault   │ ───────────────────────────► │  RevenueRouter    │         │
│  │ (ERC-4626)   │                             │  (Fee Splitter)   │         │
│  └──────┬───────┘                             └─────────┬─────────┘         │
│         │                                               │                    │
│         │ donateOnBehalf()                              │ distribute()       │
│         │ (mints shXRP)                                 │                    │
│         │                                               ▼                    │
│         │                                     ┌─────────────────────┐        │
│         │                                     │   Revenue Split     │        │
│         │                                     │ ────────────────── │        │
│         │                                     │ 50% → Burn SHIELD  │        │
│         │                                     │ 40% → FXRP → Boost │        │
│         │                                     │ 10% → Reserves     │        │
│         │                                     └─────────┬─────────┘        │
│         │                                               │                    │
│         │                                               │ distributeBoost()  │
│         │                                               ▼                    │
│         │                                     ┌─────────────────────┐        │
│         │                                     │  StakingBoost       │        │
│         │                                     │ ─────────────────── │        │
│         │                                     │ rewardPerToken +=   │        │
│         │                                     │ fxrp/totalStaked    │        │
│         └─────────────────────────────────────│                     │        │
│                           claim()             │ SHIELD stakers      │        │
│                                               └─────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Circular Dependency Solution

StakingBoost and ShXRPVault have a mutual dependency:
- StakingBoost needs vault address to call `donateOnBehalf()`
- Vault needs StakingBoost address for access control on `donateOnBehalf()`

**Solution: Three-Step Deployment**

```solidity
// Step 1: Deploy vault with placeholder
ShXRPVault vault = new ShXRPVault(fxrp, "shXRP", "shXRP", router, address(0));

// Step 2: Deploy StakingBoost with real vault
StakingBoost boost = new StakingBoost(shield, fxrp, address(vault), router);

// Step 3: Wire vault to StakingBoost (one-time setter)
vault.setStakingBoost(address(boost));
```

---

## Synthetix Reward Accumulator

The reward accumulator pattern enables O(1) gas complexity for reward distribution, regardless of the number of stakers.

### Core State Variables

```solidity
uint256 public rewardPerTokenStored;           // Global accumulator
mapping(address => uint256) public userRewardPerTokenPaid;  // Per-user checkpoint
mapping(address => uint256) public rewards;    // Pending rewards per user
```

### Mathematics

**On Distribution (`distributeBoost`):**
```
rewardPerTokenStored += (fxrpAmount * 1e18) / totalStaked
```

**Computing Earned Rewards:**
```
earned = (stake.amount * (rewardPerTokenStored - userRewardPerTokenPaid)) / 1e18 + rewards
```

**On Stake/Withdraw/Claim:**
```
// Update user's pending rewards
rewards[user] = earned(user)
// Checkpoint the global accumulator
userRewardPerTokenPaid[user] = rewardPerTokenStored
```

### Gas Complexity

| Operation | Gas Complexity | Notes |
|-----------|---------------|-------|
| `stake()` | O(1) | Single storage update |
| `withdraw()` | O(1) | Single storage update |
| `distributeBoost()` | O(1) | Single division, no loops |
| `claim()` | O(1) | Fixed number of storage operations |
| `earned()` | O(1) | View function, no loops |

---

## Smart Contract Interface

### StakingBoost.sol

```solidity
// State variables
IERC20 public immutable shieldToken;
IERC20 public immutable fxrpToken;
IShXRPVault public immutable vault;
address public revenueRouter;
uint256 public constant LOCK_PERIOD = 30 days;
uint256 public globalBoostCapBps = 2500; // 25% max boost
uint256 public totalStaked;
uint256 public rewardPerTokenStored;

struct Stake {
    uint256 amount;
    uint256 stakedAt;
}
mapping(address => Stake) public stakes;
mapping(address => uint256) public userRewardPerTokenPaid;
mapping(address => uint256) public rewards;

// Core functions
function stake(uint256 amount) external;
function withdraw(uint256 amount) external;
function claim() external returns (uint256);
function claimAndWithdraw(uint256 amount) external;

// View functions
function earned(address account) external view returns (uint256);
function getStakeInfo(address account) external view returns (
    uint256 amount,
    uint256 stakedAt,
    uint256 unlockTime,
    uint256 pendingRewards
);

// Distribution (called by RevenueRouter)
function distributeBoost(uint256 fxrpAmount) external;

// Admin functions
function setGlobalBoostCap(uint256 newCapBps) external onlyOwner;
function setRevenueRouter(address newRouter) external onlyOwner;
function recoverTokens(address token, address to, uint256 amount) external onlyOwner;
```

### ShXRPVault.sol Additions

```solidity
// State (not immutable - set via setter)
IStakingBoost public stakingBoost;

// One-time setter (solves circular dependency)
function setStakingBoost(address _stakingBoost) external onlyOwner;

// Donation function (StakingBoost only)
function donateOnBehalf(address user, uint256 fxrpAmount) external returns (uint256 shares);
```

### RevenueRouter.sol Additions

```solidity
uint256 public boostAllocationBps = 4000; // 40%

function setBoostAllocation(uint256 bps) external onlyOwner;
function _swapAndDistributeBoost(uint256 wflrAmount) internal;
```

---

## Events

### StakingBoost Events

```solidity
event Staked(address indexed user, uint256 amount, uint256 unlockTime);
event Withdrawn(address indexed user, uint256 amount);
event RewardDistributed(uint256 fxrpAmount, uint256 newRewardPerToken);
event RewardClaimed(address indexed user, uint256 fxrpAmount, uint256 shXRPShares);
event GlobalBoostCapUpdated(uint256 oldCap, uint256 newCap);
event RevenueRouterUpdated(address indexed oldRouter, address indexed newRouter);
```

### ShXRPVault Events

```solidity
event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost);
event DonatedOnBehalf(address indexed user, uint256 fxrpAmount, uint256 sharesMinted);
```

---

## Security Considerations

### Access Control

| Function | Access | Reason |
|----------|--------|--------|
| `distributeBoost()` | onlyRevenueRouter | Prevents arbitrary reward injection |
| `donateOnBehalf()` | onlyStakingBoost | Prevents unauthorized share minting |
| `setStakingBoost()` | onlyOwner + one-time | Immutable after initial setup |
| `setGlobalBoostCap()` | onlyOwner | Governance control |
| `setRevenueRouter()` | onlyOwner | Governance control |
| `recoverTokens()` | onlyOwner | Emergency recovery (not staked tokens) |

### Reentrancy Protection

All state-changing functions use:
- `ReentrancyGuard` from OpenZeppelin
- CEI (Checks-Effects-Interactions) pattern

```solidity
function claim() external nonReentrant {
    // Check
    uint256 reward = earned(msg.sender);
    require(reward > 0, "No rewards to claim");
    
    // Effect
    rewards[msg.sender] = 0;
    userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;
    
    // Interaction
    fxrpToken.safeTransfer(address(vault), reward);
    vault.donateOnBehalf(msg.sender, reward);
}
```

### Edge Cases

1. **Zero Total Staked**: `distributeBoost()` with no stakers leaves FXRP in contract (no division by zero)
2. **Late Joiner**: New stakers only earn from distributions after their stake
3. **Partial Withdraw**: Updates checkpoint before releasing tokens
4. **Double Claim**: Second claim returns 0 (rewards already claimed)

---

## Test Coverage

### test/boost-flow.ts (16 tests)

**Tests 1-4: Reward Accumulator**
- `distributeBoost` updates `rewardPerTokenStored` correctly
- `earned()` returns correct proportional amounts
- Multiple distributions accumulate correctly
- Late stakers only earn from post-stake distributions

**Tests 5-8: Claim Integration**
- `claim()` mints shXRP to staker only
- Non-stakers have zero earned, receive nothing
- Multiple stakers get proportional shares
- Only StakingBoost can call `donateOnBehalf()`

**Tests 9-12: End-to-End**
- Complete flow: stake → distribute → claim → verify shXRP
- `getStakeInfo()` returns correct pending rewards
- `claimAndWithdraw()` convenience function works
- Admin can update global boost cap

**Security Tests**
- Zero totalStaked handled gracefully
- Only owner can set RevenueRouter
- `setStakingBoost()` is one-time only
- Reentrancy protection verified
- Correct events emitted
- Excess token recovery works

---

## Configuration Parameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `LOCK_PERIOD` | 30 days | Fixed | Minimum stake duration |
| `globalBoostCapBps` | 2500 | 0-10000 | Max boost % (25% default) |
| `boostAllocationBps` | 4000 | 0-5000 | % of revenue to boost (40%) |

---

## Upgrade Considerations

### Current Design Limitations

1. **One-Time Setter**: `vault.setStakingBoost()` cannot be changed after initial setup
2. **Immutable Vault**: StakingBoost's vault reference is immutable

### Upgrade Path

To upgrade StakingBoost:
1. Deploy new StakingBoost contract
2. Deploy new ShXRPVault contract
3. Wire them using the three-step process
4. Migrate user stakes via governance proposal

### Future Improvements (Post-V1)

- Governance-controlled StakingBoost setter on vault
- Proxy pattern for upgradeable StakingBoost
- Multi-asset boost support

---

## Deployment Checklist

- [ ] Deploy ShXRPVault with `stakingBoost = address(0)`
- [ ] Deploy StakingBoost with real vault address
- [ ] Call `vault.setStakingBoost(stakingBoostAddress)`
- [ ] Verify bidirectional wiring
- [ ] Update RevenueRouter's boost allocation if needed
- [ ] Run full test suite
- [ ] Verify on block explorer

---

Last Updated: November 27, 2025
