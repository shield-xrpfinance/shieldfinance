# Revenue System Specification

**Version:** 1.0  
**Date:** December 2025  
**Status:** Pre-Audit (Security Hardened)

## Overview

The Shield Finance revenue system distributes vault fees to create sustainable tokenomics through buyback & burn, staker rewards, and protocol reserves. Two core contracts handle revenue: **BuybackBurn** for direct wFLR-to-SHIELD burns, and **RevenueRouter** for FXRP-based fee distribution from the vault.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Revenue Distribution System                          │
│                                                                               │
│  ┌──────────────────┐         FXRP fees         ┌─────────────────────────┐  │
│  │   ShXRPVault     │ ─────────────────────────► │   RevenueRouter         │  │
│  │   (ERC-4626)     │                           │   (FXRP input)          │  │
│  │ 0.2% deposit fee │                           │                         │  │
│  │ 0.2% withdraw fee│                           │  ┌───────────────────┐  │  │
│  └──────────────────┘                           │  │  50% → Burn       │  │  │
│                                                  │  │  FXRP → SHIELD    │  │  │
│                                                  │  │  → burn()         │  │  │
│  ┌──────────────────┐                           │  ├───────────────────┤  │  │
│  │   BuybackBurn    │ ◄───wFLR (external)       │  │  40% → Boost      │  │  │
│  │   (wFLR input)   │                           │  │  Direct FXRP to   │  │  │
│  │                  │                           │  │  StakingBoost     │  │  │
│  │  wFLR → SHIELD   │                           │  ├───────────────────┤  │  │
│  │  → burn()        │                           │  │  10% → Reserves   │  │  │
│  └──────────────────┘                           │  │  Owner withdraw   │  │  │
│                                                  │  └───────────────────┘  │  │
│                                                  └─────────────────────────┘  │
│                                                                               │
│                              ┌─────────────────────┐                         │
│                              │    StakingBoost     │                         │
│                              │ ─────────────────── │                         │
│                              │  Receives FXRP      │                         │
│                              │  Distributes pro-   │                         │
│                              │  rata to stakers    │                         │
│                              └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## BuybackBurn Contract

### Purpose
Accepts wFLR, swaps to SHIELD via SparkDEX V3, and burns the SHIELD tokens. Used for external wFLR revenue sources (partnerships, grants, etc.).

### Constructor Parameters
```solidity
constructor(
    address _shieldToken,    // SHIELD token (must be burnable)
    address _wflr,           // Wrapped FLR token
    address _router,         // SparkDEX V3 SwapRouter
    uint256 _initialPrice    // wFLR/SHIELD price (scaled 1e18)
)
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `buybackAndBurn()` | Public | Swaps wFLR balance to SHIELD and burns |
| `setMaxSlippage(uint256)` | Owner | Set max slippage (0-2000 bps) |
| `setLastKnownPrice(uint256)` | Owner | Calibrate price for slippage calc |
| `rescueTokens(address, address, uint256)` | Owner | Rescue stuck tokens (not wFLR) |
| `getStatus()` | View | Returns balance, price, slippage config |

### Security Features

1. **SafeERC20 forceApprove()**: Handles non-standard approve implementations
2. **Slippage Protection**: Configurable 0-20% max slippage with price tracking
3. **Allowance Clearing**: Router approval set to 0 after each swap
4. **Rescue Restriction**: Cannot rescue wFLR (operational token)
5. **Custom Errors**: Gas-efficient error handling

### Flow
```
1. wFLR deposited to contract (direct transfer)
2. Anyone calls buybackAndBurn()
3. Calculate minShieldOut = expectedShield * (1 - slippage)
4. forceApprove(router, wflrAmount)
5. Swap via SparkDEX V3: wFLR → SHIELD
6. forceApprove(router, 0)  // Clear allowance
7. Update lastKnownPrice from actual swap result
8. Burn SHIELD tokens
9. Emit BuybackAndBurn event with amounts
```

---

## RevenueRouter Contract

### Purpose
Receives FXRP fees from ShXRPVault and distributes according to allocation:
- **50%** → Swap FXRP to SHIELD and burn
- **40%** → Send FXRP to StakingBoost for staker rewards
- **10%** → Protocol reserves

### Constructor Parameters
```solidity
constructor(
    address _shieldToken,    // SHIELD token (must be burnable)
    address _fxrpToken,      // FXRP token (vault's underlying)
    address _router,         // SparkDEX V3 SwapRouter
    uint256 _initialPrice    // FXRP/SHIELD price (scaled 1e18)
)
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `distribute()` | Public | Distributes FXRP according to allocations |
| `setBurnAllocation(uint256)` | Owner | Set burn % (0-8000 bps) |
| `setBoostAllocation(uint256)` | Owner | Set boost % (0-8000 bps) |
| `setStakingBoost(address)` | Owner | Set StakingBoost contract |
| `setMaxSlippage(uint256)` | Owner | Set max slippage (0-2000 bps) |
| `setDistributionThreshold(uint256)` | Owner | Min FXRP for distribution |
| `withdrawReserves(address, uint256)` | Owner | Withdraw protocol reserves |
| `rescueTokens(address, address, uint256)` | Owner | Rescue tokens (not FXRP) |
| `getRevenueStatus()` | View | Returns balance, allocations, status |

### Security Features

1. **SafeERC20 forceApprove()**: Safe approval handling
2. **Allowance Clearing**: All approvals cleared after operations
   - Router approval cleared after swap
   - StakingBoost approval cleared after distribution
   - Old StakingBoost approval cleared on address change
3. **Slippage Protection**: Configurable with price tracking
4. **Allocation Limits**: Each allocation max 80%, total max 100%
5. **Distribution Threshold**: Prevents dust distributions
6. **Rescue Restriction**: Cannot rescue FXRP (operational token)
7. **Custom Errors**: Gas-efficient error handling

### Distribution Flow
```
1. FXRP deposited by vault (deposit/withdraw fees)
2. Anyone calls distribute() when balance > threshold
3. Calculate allocations:
   - burnAmount = balance * burnAllocationBps / 10000
   - boostAmount = balance * boostAllocationBps / 10000
   - reserves = balance - burnAmount - boostAmount

4. Burn allocation (if > 0):
   a. forceApprove(router, burnAmount)
   b. Swap FXRP → SHIELD via SparkDEX V3
   c. forceApprove(router, 0)
   d. Update lastKnownPrice
   e. Burn SHIELD tokens

5. Boost allocation (if > 0 and stakingBoost set):
   a. forceApprove(stakingBoost, boostAmount)
   b. Call stakingBoost.distributeBoost(boostAmount)
   c. forceApprove(stakingBoost, 0)

6. Reserves remain in contract for owner withdrawal
7. Emit RevenueDistributed event
```

---

## Configuration Parameters

### BuybackBurn
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `maxSlippageBps` | 500 | 0-2000 | Max slippage % (5% default) |
| `lastKnownPrice` | Constructor | > 0 | wFLR per SHIELD (1e18 scaled) |

### RevenueRouter
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `burnAllocationBps` | 5000 | 0-8000 | % to SHIELD burn (50%) |
| `boostAllocationBps` | 4000 | 0-8000 | % to staker boost (40%) |
| `maxSlippageBps` | 500 | 0-2000 | Max slippage % (5%) |
| `minDistributionThreshold` | 1e6 | >= 0 | Min FXRP (1 FXRP) |
| `lastKnownPrice` | Constructor | > 0 | FXRP per SHIELD (1e18) |

---

## Events

### BuybackBurn Events
```solidity
event BuybackAndBurn(uint256 wflrAmount, uint256 shieldBurned);
event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
event PriceUpdated(uint256 oldPrice, uint256 newPrice);
event TokensRescued(address indexed token, address indexed to, uint256 amount);
```

### RevenueRouter Events
```solidity
event RevenueDistributed(
    uint256 totalFxrp,
    uint256 shieldBurned,
    uint256 fxrpToBoost,
    uint256 reserves
);
event BurnAllocationUpdated(uint256 oldBps, uint256 newBps);
event BoostAllocationUpdated(uint256 oldBps, uint256 newBps);
event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost);
event DistributionThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
event PriceUpdated(uint256 oldPrice, uint256 newPrice);
event ReservesWithdrawn(address indexed to, uint256 amount);
event TokensRescued(address indexed token, address indexed to, uint256 amount);
```

---

## Custom Errors

```solidity
// Shared errors
error ZeroAmount();
error InvalidSlippage();
error InvalidPrice();
error InvalidRecipient();
error CannotRescueOperationalToken();

// RevenueRouter specific
error AllocationTooHigh();
error TotalAllocationExceeds100();
error BelowDistributionThreshold();
```

---

## Test Coverage

### BuybackBurn Tests (21 tests)
- Constructor validation
- Buyback and burn flow
- Slippage protection
- Price tracking and updates
- Rescue token restrictions
- Access control
- Event emissions

### RevenueRouter Tests (30 tests)
- Constructor validation
- Distribution with all allocations
- Burn-only mode (boost = 0)
- Boost-only mode (burn = 0)
- Below threshold handling
- Allocation updates
- StakingBoost management
- Slippage configuration
- Reserve withdrawal
- Rescue token restrictions
- Access control
- Event emissions

---

## Security Audit Notes

### Addressed Vulnerabilities

1. **Residual Approval Attack**: All approvals explicitly cleared after operations
2. **Slippage Manipulation**: Price tracking with configurable bounds
3. **Token Extraction**: Operational tokens (wFLR/FXRP) cannot be rescued
4. **Allocation Overflow**: Sum of allocations capped at 100%
5. **Zero Address Handling**: All recipient/address parameters validated

### Slither Results
- No high/medium findings on BuybackBurn.sol
- No high/medium findings on RevenueRouter.sol

---

## Deployment Checklist

### BuybackBurn
- [ ] Deploy with correct SHIELD, wFLR, router addresses
- [ ] Set initial price based on market rate
- [ ] Verify contract on block explorer
- [ ] Test buybackAndBurn with small amount
- [ ] Transfer ownership to multisig (optional)

### RevenueRouter
- [ ] Deploy with correct SHIELD, FXRP, router addresses
- [ ] Set initial price based on market rate
- [ ] Set StakingBoost address
- [ ] Configure allocation percentages if non-default
- [ ] Verify contract on block explorer
- [ ] Test distribute with vault deposit
- [ ] Transfer ownership to multisig (optional)

---

## Integration with ShXRPVault

The vault sends FXRP fees immediately on each deposit/withdraw:

```solidity
// In ShXRPVault._deposit()
uint256 depositFee = assets * DEPOSIT_FEE_BPS / 10000;
fxrpToken.safeTransfer(revenueRouter, depositFee);

// In ShXRPVault._withdraw()
uint256 withdrawFee = assets * WITHDRAW_FEE_BPS / 10000;
fxrpToken.safeTransfer(revenueRouter, withdrawFee);
```

Revenue accumulates in RevenueRouter until `distribute()` is called (manually or via automation).

---

Last Updated: December 6, 2025
