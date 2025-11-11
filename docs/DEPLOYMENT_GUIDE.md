# Deployment Guide - Flare Smart Account Integration

This guide covers deploying the ShXRPVault and VaultController contracts to Flare Network (Coston2 testnet or mainnet).

## Prerequisites

1. **Funded Deployer Account**
   - Get testnet FLR from Coston2 faucet: https://faucet.flare.network
   - For mainnet: Ensure sufficient FLR balance for gas fees

2. **Environment Variables** (set in Replit Secrets)
   - `DEPLOYER_PRIVATE_KEY` - Private key of deployer account
   - `TREASURY_ADDRESS` - Address to receive initial SHIELD tokens (optional)

## Deployment Steps

### Step 1: Compile Contracts

```bash
npx hardhat clean
npx hardhat compile
```

Expected output:
```
Compiled 4 Solidity files with solc 0.8.20
```

### Step 2: Deploy to Coston2 Testnet

```bash
DEPLOY_NETWORK=coston2 tsx scripts/deploy-direct.ts
```

This will:
1. Deploy VaultController
2. Deploy ShXRPVault (with FXRP as asset)
3. Register vault in VaultController
4. Save deployment info to `deployments/coston2-{timestamp}.json`

Expected output:
```
🚀 Deploying to coston2...

Deployer address: 0x...
Deployer balance: 10.5 FLR

Using FXRP token: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3

📋 Deploying VaultController...
✅ VaultController deployed: 0x...
   View: https://coston2-explorer.flare.network/address/0x...

🏦 Deploying ShXRPVault...
✅ ShXRPVault deployed: 0x...
   View: https://coston2-explorer.flare.network/address/0x...

🔗 Registering vault in controller...
✅ Vault registered in VaultController

📝 Deployment info saved to: deployments/coston2-1234567890.json

═══════════════════════════════════════════════════════════
✅ DEPLOYMENT COMPLETE
═══════════════════════════════════════════════════════════

VaultController: 0x...
ShXRPVault:      0x...
FXRP Token:      0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3

Next steps:
1. Update .env with contract addresses
2. Fund VaultController with FXRP for operations
3. Test deposit flow on testnet
4. Configure Firelight vault address
═══════════════════════════════════════════════════════════
```

### Step 3: Update Environment Variables

Add deployed contract addresses to Replit Secrets:

```bash
VITE_VAULT_CONTROLLER_ADDRESS=0x...  # From deployment output
VITE_SHXRP_VAULT_ADDRESS=0x...       # From deployment output
```

### Step 4: Configure Services

Update `server/index.ts` with deployed addresses:

```typescript
const compoundingService = new CompoundingService({
  storage,
  flareClient,
  vaultControllerAddress: process.env.VITE_VAULT_CONTROLLER_ADDRESS || "0x...",
  minCompoundAmount: "1.0",
});
```

### Step 5: Test Deployment

1. **Verify Contracts on Explorer**
   - Visit the explorer URLs from deployment output
   - Check contract code is verified (if auto-verification enabled)

2. **Test Vault Registration**
   ```typescript
   // In Hardhat console or test script
   const controller = await ethers.getContractAt("VaultController", "0x...");
   const isRegistered = await controller.registeredVaults("0x...");
   console.log("Vault registered:", isRegistered); // Should be true
   ```

3. **Test Deposit Flow**
   - Use frontend to initiate deposit
   - Monitor Bridge History page for status updates
   - Check vault shares minted

## Deployment to Mainnet

### ⚠️ Pre-Mainnet Checklist

- [ ] All tests passing on Coston2 testnet
- [ ] Contracts audited (recommended for production)
- [ ] Firelight vault address configured
- [ ] FAssets integration tested
- [ ] Sufficient FLR balance for deployment (~0.5 FLR)
- [ ] DEPLOYER_PRIVATE_KEY points to mainnet account
- [ ] TREASURY_ADDRESS verified

### Deploy to Mainnet

```bash
DEPLOY_NETWORK=flare tsx scripts/deploy-direct.ts
```

**Important**: Mainnet uses different FXRP address:
- Mainnet: `0xAf7278D382323A865734f93B687b300005B8b60E`
- Coston2: `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3`

## Post-Deployment Configuration

### 1. Add Operators

```typescript
const controller = await ethers.getContractAt("VaultController", "0x...");
await controller.addOperator("0x..."); // Backend service address
await controller.addCompounder("0x..."); // Compounding bot address
```

### 2. Configure Firelight Vault

```typescript
const vault = await ethers.getContractAt("ShXRPVault", "0x...");
await vault.setFirelightVault("0x..."); // Firelight vault address
```

### 3. Start Backend Services

Update `server/index.ts` to start XRPL listener and compounding service:

```typescript
// Start XRPL deposit listener
const xrplListener = new XRPLDepositListener({
  network: "mainnet",
  vaultAddress: "rYourXRPLAddress",
  storage,
  onDeposit: async (deposit) => {
    await depositService.processDeposit(deposit, "default-vault-id");
  },
});
await xrplListener.start();

// Start compounding service (runs every hour)
compoundingService.start(60);
```

## Troubleshooting

### Deployment Fails: "Insufficient Balance"
- Check deployer balance: `npx hardhat run scripts/check-balance.ts`
- Get testnet FLR from faucet
- For mainnet, ensure ~0.5 FLR balance

### Deployment Fails: "Contract Creation Failed"
- Check Solidity compilation: `npx hardhat compile`
- Verify network RPC is accessible
- Check gas limit in hardhat.config.ts

### Vault Not Registered
- Check VaultController logs for registration transaction
- Verify registerVault() was called successfully
- Query `registeredVaults(address)` to confirm

## Contract Verification

To verify contracts on block explorer:

```bash
npx hardhat verify --network coston2 VAULT_CONTROLLER_ADDRESS
npx hardhat verify --network coston2 SHXRP_VAULT_ADDRESS "FXRP_ADDRESS" "Shield XRP" "shXRP"
```

## Deployment Artifacts

All deployments are saved to `deployments/` directory:
- `coston2-{timestamp}.json` - Testnet deployments
- `flare-{timestamp}.json` - Mainnet deployments

Each file contains:
- Network and chain ID
- Deployer address
- Contract addresses
- Block explorer URLs
- Deployment timestamp
