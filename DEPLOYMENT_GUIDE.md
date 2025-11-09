# 🚀 Quick Deployment Reference

## Commands Summary

### 1. Compile Smart Contracts
```bash
npx hardhat compile
```

### 2. Deploy to Flare Coston2 (Testnet)
```bash
npx hardhat run scripts/deploy-flare.ts --network coston2
```

### 3. Deploy to Flare Mainnet
```bash
npx hardhat run scripts/deploy-flare.ts --network flare
```

### 4. Deploy XRPL Hooks
```bash
chmod +x scripts/deploy-hooks.sh
./scripts/deploy-hooks.sh
```

### 5. Verify Contracts on Block Explorer
```bash
# ShieldToken
npx hardhat verify --network coston2 <SHIELD_TOKEN_ADDRESS> "<TREASURY_ADDRESS>"

# StXRPVault
npx hardhat verify --network coston2 <STXRP_VAULT_ADDRESS>
```

### 6. Combined Testnet Deployment (Run Both)
```bash
# Step 1: Deploy Flare contracts
npx hardhat run scripts/deploy-flare.ts --network coston2

# Step 2: Deploy XRPL hooks
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

# Frontend (update after deployment)
VITE_SHIELD_TOKEN_ADDRESS=
VITE_STXRP_VAULT_ADDRESS=
```

## Testnet Faucets

- **Flare Coston2**: https://faucet.flare.network/coston2
- **XRPL Testnet**: https://xrpl.org/xrp-testnet-faucet.html

## Block Explorers

- **Flare Coston2**: https://coston2-explorer.flare.network
- **Flare Mainnet**: https://flare-explorer.flare.network
- **XRPL Testnet**: https://testnet.xrpl.org
- **XRPL Mainnet**: https://livenet.xrpl.org

## Contract Addresses (After Deployment)

Save your deployed contract addresses here:

```
ShieldToken (Coston2): 
StXRPVault (Coston2): 
XRPL Hook Account: 
```

## Quick Troubleshooting

| Error | Solution |
|-------|----------|
| Insufficient funds | Get testnet tokens from faucets |
| Hook compilation failed | Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Contract verification failed | Wait 2-3 minutes for block explorer to index |
| Private key error | Remove `0x` prefix from private key |

## Next Steps After Deployment

1. ✅ Update `.env` with contract addresses
2. ✅ Configure vault operator using Hardhat console
3. ✅ Test deposit flow on testnet
4. ✅ Test withdrawal flow on testnet
5. ✅ Audit smart contracts before mainnet

---

For detailed instructions, see **README.md** section: "How to Deploy to Testnet"
