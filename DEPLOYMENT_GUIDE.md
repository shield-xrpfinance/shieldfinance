# 🚀 Quick Deployment Reference

## ✅ Deployment Status

**Smart contracts successfully deployed to Flare Coston2 Testnet on November 9, 2025**

### Deployed Contracts

- **ShieldToken ($SHIELD)**: `0x07F943F173a6bE5EC63a8475597d28aAA6B24992`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0x07F943F173a6bE5EC63a8475597d28aAA6B24992)
  - Total Supply: 100,000,000 SHIELD
  - Treasury Allocation: 10,000,000 SHIELD

- **Shield XRP Vault (shXRP)**: `0xd8d78DA41473D28eB013e161232192ead2cc745A`
  - [View on Explorer](https://coston2-explorer.flare.network/address/0xd8d78DA41473D28eB013e161232192ead2cc745A)
  - Initial Exchange Rate: 1.0 shXRP per XRP

## Commands Summary

### 1. Compile Smart Contracts
```bash
npx hardhat compile
```

### 2. Deploy to Flare Coston2 (Testnet) - **COMPLETED ✅**
```bash
# Using direct ethers.js deployment (recommended for Hardhat 3)
tsx scripts/deploy-direct.ts
```

### 3. Deploy to Flare Mainnet
```bash
# Update RPC URL in deploy-direct.ts to mainnet
tsx scripts/deploy-direct.ts
```

### 4. Deploy XRPL Hooks
```bash
chmod +x scripts/deploy-hooks.sh
./scripts/deploy-hooks.sh
```

### 5. Verify Contracts on Block Explorer
```bash
# ShieldToken (Coston2 Testnet)
npx hardhat verify --network coston2 0x07F943F173a6bE5EC63a8475597d28aAA6B24992 "0x105a22e3ff06ee17020a510fa5113b5c6d9feb2d"

# Shield XRP Vault (Coston2 Testnet)
npx hardhat verify --network coston2 0xd8d78DA41473D28eB013e161232192ead2cc745A
```

### 6. Combined Testnet Deployment (Run Both)
```bash
# Step 1: Deploy Flare contracts - ✅ COMPLETED
tsx scripts/deploy-direct.ts

# Step 2: Deploy XRPL hooks (Optional)
./scripts/deploy-hooks.sh
```

## Environment Variables Required

Create a `.env` file with:

```bash
# Flare Deployment
DEPLOYER_PRIVATE_KEY=your-private-key-here
TREASURY_ADDRESS=your-treasury-address-here

# XRPL Hooks
XRPL_HOOK_ACCOUNT_SECRET=your-xrpl-secret-here
XRPL_NETWORK=testnet

# Frontend (deployed addresses for Coston2 testnet)
VITE_SHIELD_TOKEN_ADDRESS=0x07F943F173a6bE5EC63a8475597d28aAA6B24992
VITE_SHXRP_VAULT_ADDRESS=0xd8d78DA41473D28eB013e161232192ead2cc745A
```

## Testnet Faucets

- **Flare Coston2**: https://faucet.flare.network/coston2
- **XRPL Testnet**: https://xrpl.org/xrp-testnet-faucet.html

## Block Explorers

- **Flare Coston2**: https://coston2-explorer.flare.network
- **Flare Mainnet**: https://flare-explorer.flare.network
- **XRPL Testnet**: https://testnet.xrpl.org
- **XRPL Mainnet**: https://livenet.xrpl.org

## Contract Addresses

### Coston2 Testnet (Deployed November 9, 2025)

```
ShieldToken (Coston2): 0x07F943F173a6bE5EC63a8475597d28aAA6B24992
Shield XRP Vault (Coston2): 0xd8d78DA41473D28eB013e161232192ead2cc745A
Deployer Address: 0x105A22E3fF06ee17020A510fa5113B5C6d9FEb2D
Treasury Address: 0x105a22e3ff06ee17020a510fa5113b5c6d9feb2d
```

### Mainnet (Not Yet Deployed)

```
ShieldToken (Flare): TBD
Shield XRP Vault (Flare): TBD
XRPL Hook Account: TBD
```

## Quick Troubleshooting

| Error | Solution |
|-------|----------|
| Insufficient funds | Get testnet tokens from faucets |
| Hook compilation failed | Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Contract verification failed | Wait 2-3 minutes for block explorer to index |
| Private key error | Remove `0x` prefix from private key |
| `hre.ethers is undefined` (Hardhat 3) | Use `tsx scripts/deploy-direct.ts` instead of Hardhat scripts |
| Node.js version mismatch | Upgrade to Node.js 22+ for Hardhat 3 compatibility |

## Next Steps After Deployment

1. ✅ Update `.env` with contract addresses
2. ✅ Configure vault operator using Hardhat console
3. ✅ Test deposit flow on testnet
4. ✅ Test withdrawal flow on testnet
5. ✅ Audit smart contracts before mainnet

---

For detailed instructions, see **README.md** section: "How to Deploy to Testnet"
