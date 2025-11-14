# Strategy Contracts Deployment Guide

## Overview
This document describes the deployment script for KineticStrategy and FirelightStrategy contracts on Flare Network Coston2 testnet.

## Deployment Script
**Location:** `scripts/deploy-strategies.ts`

## Prerequisites

### Required Environment Variables
```bash
# Required: Private key for deployment
# Either of these (script will use whichever is available)
DEPLOYER_PRIVATE_KEY=0x...
OPERATOR_PRIVATE_KEY=0x...

# Optional: Vault address (will be read from coston2-latest.json if not set)
VITE_SHXRP_VAULT_ADDRESS=0x...

# Optional: Kinetic protocol addresses (for KineticStrategy configuration)
# If not provided, KineticStrategy will be deployed but not configured
KINETIC_CFXRP_ADDRESS=0x...        # Kinetic cToken (cFXRP) address
KINETIC_COMPTROLLER_ADDRESS=0x...  # Kinetic Comptroller address
```

### Existing Deployments Required
The script requires the following contracts to be already deployed:
- **FXRP Token** (FAssets TestFXRP on Coston2)
- **ShXRPVault** (Shield XRP Vault)

These addresses are automatically loaded from `deployments/coston2-latest.json`.

## Running the Deployment

### 1. Deploy to Coston2 Testnet
```bash
npx hardhat run scripts/deploy-strategies.ts --network coston2
```

### 2. Expected Output
The script will:
1. ✅ Deploy KineticStrategy contract
2. ✅ Deploy FirelightStrategy contract
3. ✅ Configure KineticStrategy (if KINETIC_* env vars provided) OR skip configuration
4. ✅ Grant OPERATOR_ROLE to vault contract automatically
5. ✅ Verify both strategies are inactive
6. ✅ Check role assignments (deployer admin, vault operator)
7. ✅ Save deployment info to `deployments/coston2-strategies.json`
8. ✅ Display verification commands and next steps

## Contract Details

### KineticStrategy
**Purpose:** FXRP lending on Kinetic Markets protocol  
**Expected APY:** ~3.83-6% (historical)  
**Status:** Deployed (may or may not be configured), INACTIVE  
**Configuration:** Conditional - only configured if KINETIC_* env vars are provided  
**Constructor Parameters:**
- `_fxrpToken`: FXRP token address
- `_admin`: Admin address (receives DEFAULT_ADMIN_ROLE)
- `_operator`: Operator address (receives OPERATOR_ROLE initially, vault also receives it post-deployment)

### FirelightStrategy
**Purpose:** FXRP liquid staking on Firelight protocol  
**Expected Launch:** Q1 2026  
**Status:** INACTIVE (disabled until Firelight launches)  
**Constructor Parameters:**
- `_fxrpToken`: FXRP token address
- `_admin`: Admin address (receives DEFAULT_ADMIN_ROLE)
- `_operator`: Operator address (receives OPERATOR_ROLE)

## Important Notes

### Constructor Signatures
⚠️ **Note:** The actual contract constructors are:
```solidity
constructor(address _fxrpToken, address _admin, address _operator)
```

The deployment script correctly uses these signatures. Both strategies receive:
- `DEFAULT_ADMIN_ROLE` → deployer address (initial setup)
- `OPERATOR_ROLE` → deployer address AND vault contract (automatically granted during deployment)

### Role Management

The contracts implement AccessControl with two roles:

1. **DEFAULT_ADMIN_ROLE** (0x000...000)
   - Can grant/revoke other roles
   - Can activate/deactivate strategies
   - Can configure strategy parameters
   - **Initially assigned to:** Deployer address
   - **Production recommendation:** Transfer to multisig wallet for security

2. **OPERATOR_ROLE** (keccak256("OPERATOR_ROLE"))
   - Can call deploy(), withdraw(), and report()
   - **Automatically granted to:** Both deployer AND ShXRPVault contract
   - The vault needs this role to execute strategy operations

⚠️ **Important Notes:**
- There is **no VAULT_ROLE** - the vault receives OPERATOR_ROLE instead
- The deployment script automatically grants OPERATOR_ROLE to the vault
- For production security, transfer DEFAULT_ADMIN_ROLE to a multisig wallet
- Deployer retains both roles initially for testing/configuration convenience

## Post-Deployment Steps

### 1. Verify Contracts on Block Explorer
```bash
# KineticStrategy
npx hardhat verify --network coston2 <KINETIC_STRATEGY_ADDRESS> \
  "<FXRP_ADDRESS>" "<DEPLOYER_ADDRESS>" "<DEPLOYER_ADDRESS>"

# FirelightStrategy
npx hardhat verify --network coston2 <FIRELIGHT_STRATEGY_ADDRESS> \
  "<FXRP_ADDRESS>" "<DEPLOYER_ADDRESS>" "<DEPLOYER_ADDRESS>"
```

### 2. Configure KineticStrategy (if not already configured)

**If KINETIC_* env vars were NOT provided during deployment:**

You can use the helper script to configure KineticStrategy after deployment:

```bash
# Set environment variables
export KINETIC_CFXRP_ADDRESS=0x...        # Kinetic cToken (cFXRP) address
export KINETIC_COMPTROLLER_ADDRESS=0x...  # Kinetic Comptroller address

# Run configuration script
npx hardhat run scripts/configure-kinetic.ts --network coston2
```

The `configure-kinetic.ts` helper script will:
- Load the deployment information from `deployments/coston2-strategies.json`
- Configure KineticStrategy with the provided addresses
- Update the deployment JSON file with configuration details
- Display next steps for activation

**Alternative: Manual configuration via contract call:**
```solidity
// Call directly on KineticStrategy contract
setKineticConfig(
  address _cToken,        // Kinetic cFXRP token address
  address _comptroller    // Kinetic Comptroller address
)
```

**If KINETIC_* env vars WERE provided during deployment:**
- Configuration is already complete ✅
- Skip this step and proceed to activation

### 3. Add Strategies to Vault
```solidity
// On ShXRPVault contract
vault.addStrategy(kineticStrategyAddress);
vault.addStrategy(firelightStrategyAddress);

// Set allocation percentages
vault.setStrategyAllocation(kineticStrategyAddress, 50); // 50%
vault.setStrategyAllocation(firelightStrategyAddress, 50); // 50%
```

### 4. Activate KineticStrategy
After configuring with real Kinetic addresses:
```solidity
kineticStrategy.activate();
```

### 5. Transfer DEFAULT_ADMIN_ROLE to Multisig (PRODUCTION ONLY)

⚠️ **CRITICAL FOR PRODUCTION SECURITY**

For testnet, you can skip this step. For production deployment:

1. **Create a multisig wallet** (e.g., using Gnosis Safe)
2. **Grant DEFAULT_ADMIN_ROLE to multisig:**
   ```solidity
   // On both KineticStrategy and FirelightStrategy
   strategy.grantRole(DEFAULT_ADMIN_ROLE, multisigAddress);
   ```

3. **Verify multisig has admin role:**
   ```solidity
   bool hasRole = strategy.hasRole(DEFAULT_ADMIN_ROLE, multisigAddress);
   ```

4. **Revoke DEFAULT_ADMIN_ROLE from deployer:**
   ```solidity
   // ⚠️ Only do this AFTER multisig has the role
   strategy.revokeRole(DEFAULT_ADMIN_ROLE, deployerAddress);
   ```

5. **Verify deployer no longer has admin role:**
   ```solidity
   bool deployerStillAdmin = strategy.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress);
   // Should be false
   ```

**Why this is important:**
- Hot deployer key is a single point of failure
- If deployer key is compromised, attacker could drain strategies
- Multisig provides distributed control and better security
- Deployer still retains OPERATOR_ROLE for convenience (less critical)

### 6. Configure FirelightStrategy (when ready in Q1 2026)
```solidity
// Set Firelight contract addresses
firelightStrategy.setFirelightConfig(
  address _stakingContract,
  address _stXRP,
  address _oracle
);

// Activate strategy
firelightStrategy.activate();
```

## Deployment Output File

**Location:** `deployments/coston2-strategies.json`

**Structure:**
```json
{
  "network": "coston2",
  "chainId": 114,
  "timestamp": "2025-11-14T...",
  "deployer": "0x...",
  "contracts": {
    "KineticStrategy": {
      "address": "0x...",
      "fxrpToken": "0x...",
      "admin": "0x...",
      "vaultOperator": "0x...",
      "isActive": false,
      "configured": true,
      "kineticCToken": "0x..." or "Not configured",
      "kineticComptroller": "0x..." or "Not configured",
      "explorerUrl": "https://coston2-explorer.flare.network/address/0x..."
    },
    "FirelightStrategy": {
      "address": "0x...",
      "fxrpToken": "0x...",
      "admin": "0x...",
      "vaultOperator": "0x...",
      "isActive": false,
      "expectedLaunch": "Q1 2026",
      "explorerUrl": "https://coston2-explorer.flare.network/address/0x..."
    }
  },
  "relatedContracts": {
    "FXRP": "0x...",
    "ShXRPVault": "0x..."
  },
  "roles": {
    "DEFAULT_ADMIN_ROLE": "0x...",
    "OPERATOR_ROLE": {
      "deployer": "0x...",
      "vault": "0x..."
    }
  }
}
```

## Security Checklist

Before activating strategies on mainnet:

- [ ] Verify contract source code on block explorer
- [ ] Audit role assignments (admin on multisig, operator on vault and deployer)
- [ ] **Transfer DEFAULT_ADMIN_ROLE to multisig wallet**
- [ ] Confirm vault has OPERATOR_ROLE on both strategies
- [ ] Test deposit/withdraw flow on testnet
- [ ] Verify Kinetic contract addresses are correct (not placeholder values)
- [ ] Test emergency withdrawal functionality
- [ ] Confirm yield reporting works correctly
- [ ] Test strategy deactivation/reactivation
- [ ] Verify vault can call all operator functions
- [ ] Verify deployer cannot call admin functions after multisig transfer
- [ ] Test with small amounts first on mainnet
- [ ] Monitor for 24-48 hours before larger deployments
- [ ] Have emergency pause procedure documented and tested

## Troubleshooting

### "DEPLOYER_PRIVATE_KEY not set"
Set either `DEPLOYER_PRIVATE_KEY` or `OPERATOR_PRIVATE_KEY` environment variable.

### "coston2-latest.json not found"
Deploy the vault contracts first using `scripts/deploy-flare.ts`.

### "Account has zero balance"
Get testnet C2FLR from: https://faucet.flare.network/coston2

### "Kinetic not configured"
This is expected if you didn't provide KINETIC_* environment variables. The deployment will succeed, but you'll need to call `setKineticConfig()` manually before activating the strategy.

### "Strategy not active"
Strategies are inactive by default. Call `activate()` after configuration.

### "OPERATOR_ROLE already granted"
This is normal - the deployment script automatically grants OPERATOR_ROLE to the vault. You don't need to do it manually.

### Configuration was skipped but I have the addresses now
No problem! You can configure KineticStrategy after deployment using the helper script:

**Recommended approach - Use the helper script:**
```bash
# Set environment variables
export KINETIC_CFXRP_ADDRESS=0x...
export KINETIC_COMPTROLLER_ADDRESS=0x...

# Run configuration script
npx hardhat run scripts/configure-kinetic.ts --network coston2
```

The script will automatically:
- Load your deployment information
- Configure the KineticStrategy contract
- Update the deployment JSON file
- Display next steps

**Alternative - Manual configuration:**
1. Call `setKineticConfig(cTokenAddress, comptrollerAddress)` directly on the deployed KineticStrategy
2. Or redeploy with the environment variables set

### How do I know if KineticStrategy is configured?
Check the deployment JSON file at `deployments/coston2-strategies.json`:
- Look for `"configured": true` in the KineticStrategy section
- Check that `kineticCToken` and `kineticComptroller` have real addresses (not "Not configured")

## References

- **Kinetic Markets:** https://kinetic-market.com/
- **Firelight Finance:** https://firelight.finance/
- **Coston2 Explorer:** https://coston2-explorer.flare.network/
- **Flare Faucet:** https://faucet.flare.network/coston2

## Questions or Issues?

Contact: security@shyield.finance
