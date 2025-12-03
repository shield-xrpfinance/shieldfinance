# Shield Finance × Firelight Integration Guide

**For Firelight Team Review**  
**Last Updated:** December 3, 2025  
**Document Version:** 1.0

---

## Executive Summary

Shield Finance is building an XRP liquid staking aggregator on Flare Network. We've developed `FirelightStrategy.sol` to integrate directly with Firelight's stXRP vault, making Firelight a core yield source for our protocol.

**Key Points:**
- **Planned allocation**: 50% of user deposits (FXRP) routed to Firelight's stXRP vault (pending governance approval and mainnet deployment)
- Integration uses standard ERC-4626 interface - no modifications needed on your end
- Brings additional TVL to Firelight from our user base
- **Current status**: Testnet validated with MockStrategy; awaiting external audit for mainnet
- Fully auditable open-source integration

---

## About Shield Finance

Shield Finance provides a liquid staking dashboard for XRP holders on Flare Network. Users deposit FXRP and receive shXRP shares, which accrue yield from multiple strategies.

**Multi-Strategy Architecture:**
| Strategy | Allocation | Source |
|----------|------------|--------|
| Firelight (stXRP staking) | 50% | Firelight.finance |
| Kinetic (FXRP lending) | 40% | Kinetic.xyz |
| Buffer (instant withdrawals) | 10% | Held in vault |

**Why Firelight First:**
- ERC-4626 compliant vault (clean integration)
- Audited by OpenZeppelin & Coinspect
- Strong yield from ESS fees and insurance pools
- Live on mainnet since November 11, 2025

---

## Technical Integration

### Contract: FirelightStrategy.sol

Our integration contract implements the `IStrategy` interface and connects to Firelight's stXRP vault.

**Source Code:** [`contracts/FirelightStrategy.sol`](../../contracts/FirelightStrategy.sol)

```solidity
contract FirelightStrategy is IStrategy, AccessControl {
    IERC20 public immutable fxrpToken;
    IERC4626 public stXRPVault;  // Firelight's vault
    
    // Standard ERC-4626 operations
    function deploy(uint256 amount) external;     // Deposits FXRP → receives stXRP
    function withdraw(uint256 amount) external;   // Redeems stXRP → returns FXRP
    function totalAssets() external view;         // Converts stXRP balance to FXRP value
    function report() external;                   // Reports yield for fee accounting
}
```

### Integration Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User          │     │  Shield Finance  │     │    Firelight    │
│                 │     │                  │     │                 │
│  Deposits FXRP  │────>│  ShXRPVault      │     │                 │
│                 │     │       │          │     │                 │
│                 │     │       ▼          │     │                 │
│                 │     │  VaultController │     │                 │
│                 │     │       │          │     │                 │
│                 │     │       ▼          │     │                 │
│                 │     │  FirelightStrategy│────>│  stXRP Vault   │
│                 │     │       │          │     │       │         │
│                 │     │ Holds stXRP ◄────│─────│ Mints stXRP    │
│                 │     │                  │     │                 │
│  Receives shXRP │<────│  Mints shXRP     │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### ERC-4626 Interactions

Our strategy uses only standard ERC-4626 methods:

| Method | Usage |
|--------|-------|
| `deposit(assets, receiver)` | Deposit FXRP, receive stXRP |
| `redeem(shares, receiver, owner)` | Burn stXRP, receive FXRP |
| `convertToAssets(shares)` | Calculate FXRP value of stXRP |
| `convertToShares(assets)` | Calculate stXRP needed for FXRP amount |
| `balanceOf(address)` | Check strategy's stXRP balance |
| `maxDeposit(address)` | Verify deposit capacity |
| `maxRedeem(address)` | Verify withdrawal capacity |

---

## Contract Addresses

### Flare Mainnet (Chain ID: 14)

| Contract | Address | Status | Notes |
|----------|---------|--------|-------|
| **Firelight stXRP** | `0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3` | ✅ Live | ERC-4626 vault |
| **FXRP Token** | `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` | ✅ Firelight | Used by Firelight as underlying |
| **FirelightStrategy** | *Pending Deployment* | 🔄 Pre-mainnet | Awaiting audit |

> **Note on FXRP Addresses**: Multiple FXRP token addresses exist on Flare mainnet. Our FirelightStrategy uses `0xAd552A64...` because this is the FXRP token address that Firelight's stXRP vault expects as its underlying asset. Verify on [Flarescan](https://flarescan.com/address/0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3) if in doubt.

### Coston2 Testnet (Chain ID: 114)

| Contract | Address | Status | Notes |
|----------|---------|--------|-------|
| **FXRP Token** | `0x0b6A3645c240605887a5532109323A3E12273dc7` | ✅ Active | Retrieved dynamically |
| **ShXRPVault** | `0x3219232a45880b79736Ee899Cb3b2f95D527C631` | ✅ Active | Our ERC-4626 vault |
| **MockStrategy** | `0x1a8c6d2BfD132bCf75B54B3d23CA4c0542957A45` | ✅ Testing | Simulates Firelight |

> **Note on Testnet FXRP**: The FXRP address was retrieved dynamically from the FAssets registry. The legacy address `0xa3Bd00D6...` in older configs is deprecated - always use dynamic lookup via FlareContractRegistry.

*Firelight is mainnet-only. We use MockStrategy on Coston2 to test vault mechanics.*

---

## Security Architecture

### Access Control

```solidity
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

// Only vault/controller can deploy/withdraw
function deploy(uint256 amount) external onlyRole(OPERATOR_ROLE);
function withdraw(uint256 amount, address receiver) external onlyRole(OPERATOR_ROLE);

// Only admin can configure/activate
function setFirelightConfig(address _stXRPVault) external onlyRole(DEFAULT_ADMIN_ROLE);
function activate() external onlyRole(DEFAULT_ADMIN_ROLE);
```

### Safety Checks

1. **Vault Asset Verification**
   ```solidity
   require(vault.asset() == address(fxrpToken), "Vault asset must be FXRP");
   ```

2. **Deposit Capacity Check**
   ```solidity
   uint256 maxDeposit = stXRPVault.maxDeposit(address(this));
   require(maxDeposit >= amount, "Exceeds Firelight deposit limit");
   ```

3. **Withdrawal Capacity Check**
   ```solidity
   uint256 maxRedeem = stXRPVault.maxRedeem(address(this));
   if (sharesToRedeem > maxRedeem) {
       sharesToRedeem = maxRedeem;
   }
   ```

4. **Emergency Withdrawal**
   ```solidity
   function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
       // Redeems all stXRP, deactivates strategy
   }
   ```

### Auditing Status

| Component | Status | Notes |
|-----------|--------|-------|
| Firelight stXRP Vault | ✅ Audited | OpenZeppelin, Coinspect |
| Shield Finance Vault | 🔄 In Progress | Pre-mainnet audit planned |
| FirelightStrategy | 🔄 In Progress | Part of vault audit |

---

## Yield Tracking

Our strategy tracks yield using Firelight's ERC-4626 exchange rate:

```solidity
function totalAssets() external view returns (uint256) {
    uint256 stXRPBalance = stXRPVault.balanceOf(address(this));
    // Automatically includes accrued staking rewards
    return stXRPVault.convertToAssets(stXRPBalance);
}
```

**Reporting Mechanism:**
```solidity
function report() external returns (uint256 profit, uint256 loss, uint256 currentAssets) {
    currentAssets = this.totalAssets();
    
    // Calculate profit/loss since last report
    if (currentAssets > lastReportedAssets) {
        profit = currentAssets - lastReportedAssets;
    }
    
    lastReportedAssets = currentAssets;
    emit StrategyReport(profit, loss, currentAssets);
}
```

This allows Shield Finance to:
- Track Firelight yield contribution accurately
- Distribute yield to shXRP holders
- Charge protocol fees on realized gains

---

## Mutual Benefits

### For Firelight

1. **Increased TVL**: Our users' deposits flow directly to your stXRP vault
2. **User Acquisition**: Exposure to Shield Finance's XRPL-focused user base
3. **No Integration Work**: We use standard ERC-4626 - no changes needed
4. **Fee Revenue**: Standard deposit/yield mechanics apply

### For Shield Finance

1. **Yield Source**: Firelight's stXRP provides base yield for our vault
2. **Security**: Leveraging your audited infrastructure
3. **Liquid Staking**: True liquid staking through stXRP
4. **Composability**: stXRP can be used in DeFi integrations

---

## Expected Volume

### Phase 1 (Launch - Q1 2026)

| Metric | Estimate |
|--------|----------|
| Initial TVL | $100K - $500K |
| Firelight Allocation (50%) | $50K - $250K |
| Target Users | 500 - 2,000 |

### Phase 2 (Growth - 2026)

| Metric | Target |
|--------|--------|
| TVL | $1M - $5M |
| Firelight Allocation | $500K - $2.5M |
| Target Users | 5,000 - 20,000 |

*Projections based on XRP liquid staking market analysis and XRPL user growth.*

---

## Testnet Validation

We've validated our vault mechanics on Coston2 testnet using MockStrategy (simulates Firelight behavior).

### Simulation Results (December 3, 2025)

We've validated all core vault mechanics on Coston2 testnet:

```
📋 Proven Capabilities:
   ✅ Vault correctly mints shares on deposit
   ✅ Share price reflects accrued yield (1.01+ FXRP/shXRP)
   ✅ Vault deploys funds to registered strategies via OPERATOR_ROLE
   ✅ Strategy tracks yield via totalAssets() changes
   ✅ User can redeem shares for underlying FXRP
   ✅ Buffer-aware withdrawals prevent strategy over-withdrawal
   ✅ ERC-4626 accounting works correctly
```

*Note: MockStrategy simulates Firelight behavior. Mainnet will use the real stXRP vault.*

---

## Mainnet Deployment Plan

**Current Status:** Testnet validated. Pending external audit before mainnet deployment.

### Pre-Deployment Checklist

- [ ] External security audit completed (Shield Finance contracts)
- [ ] Multi-sig wallet configured for admin control (Gnosis Safe)
- [ ] Emergency procedures documented and tested
- [ ] Monitoring and alerting infrastructure in place
- [ ] Deposit caps configured for gradual rollout
- [ ] Firelight stXRP vault address verified on mainnet
- [ ] VaultController allocation targets finalized (50% Firelight)

### Deployment Script

We have a mainnet deployment script ready:

```typescript
// scripts/deploy-mainnet-strategies.ts
const MAINNET_ADDRESSES = {
  fxrpToken: "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",
  firelightStXRP: "0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3",
};

// Deploy FirelightStrategy
const firelightStrategy = await FirelightStrategy.deploy(
  MAINNET_ADDRESSES.fxrpToken,
  adminMultisig,
  operatorAddress
);

// Configure Firelight vault
await firelightStrategy.setFirelightConfig(MAINNET_ADDRESSES.firelightStXRP);
await firelightStrategy.activate();
```

---

## Integration Timeline

| Phase | Target Date | Milestone |
|-------|-------------|-----------|
| Testnet Validation | ✅ Complete | MockStrategy proves vault mechanics |
| Security Audit | Q1 2026 | External audit of all contracts |
| Mainnet Deployment | Q1 2026 | FirelightStrategy live on Flare |
| Public Launch | Q1 2026 | Dashboard available to users |

---

## Questions / Clarifications Needed

1. **Deposit Limits**: Are there any per-address deposit caps on stXRP vault?
2. **Withdrawal Timing**: Confirmation that withdrawals are instant (no unbonding)?
3. **Rate Limiting**: Any API rate limits for contract interactions?
4. **Events**: Beyond standard ERC-4626 events, are there Firelight-specific events we should monitor?

---

## Contact Information

**Shield Finance Team**
- Website: https://shyield.finance
- Twitter/X: [@ShieldFinanceX](https://x.com/ShieldFinanceX)
- Email: partnerships@shyield.finance

**Technical Contact**
- GitHub: https://github.com/shield-finance
- Documentation: https://docs.shyield.finance

---

## Appendix: Full Contract Source

The complete `FirelightStrategy.sol` source code is available at:
[`contracts/FirelightStrategy.sol`](../../contracts/FirelightStrategy.sol)

Key interfaces used:
- [`contracts/interfaces/IStrategy.sol`](../../contracts/interfaces/IStrategy.sol)
- Standard ERC-4626 (OpenZeppelin compatible)

---

*This document is intended for technical review by the Firelight team. For questions or clarifications, please contact our partnerships team.*
