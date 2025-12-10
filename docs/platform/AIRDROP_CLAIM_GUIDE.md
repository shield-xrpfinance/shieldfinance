# SHIELD Airdrop Claim Guide

Complete guide for earning points during testnet and claiming your SHIELD tokens at mainnet launch.

---

## Overview

Shield Finance is distributing **2,000,000 SHIELD tokens** to early testnet participants. Your share is determined by the points you accumulate during the testnet phase, multiplied by your tier bonus.

| Metric | Value |
|--------|-------|
| Total Airdrop Pool | 2,000,000 SHIELD |
| Diamond Tier Multiplier | 3.0x |
| First Deposit Bonus | +100 points |
| Faucet Claim | +15 points |

Your allocation is calculated proportionally based on your weighted points relative to all participants.

---

## Prerequisites

### 1. Set Up Your Wallet

You need a wallet configured for the Coston2 testnet. We recommend **Bifrost Wallet** or **MetaMask**.

#### Bifrost Wallet (Recommended)
1. Open Bifrost Wallet and go to **Settings**
2. Navigate to **Advanced** and enable **Developer Mode**
3. The app will now show test networks including Coston2

#### MetaMask - Automatic Setup
1. Visit the [Coston2 Explorer](https://coston2-explorer.flare.network/)
2. Click **Connect** in the top right corner
3. Approve the network addition and click **Switch network**

#### MetaMask - Manual Setup
Add the network manually with these details:

| Setting | Value |
|---------|-------|
| Network Name | Flare Testnet Coston2 |
| RPC URL | `https://coston2-api.flare.network/ext/C/rpc` |
| Chain ID | 114 |
| Currency Symbol | C2FLR |
| Block Explorer | `https://coston2-explorer.flare.network` |

---

## Step 1: Get Testnet Tokens (Faucet)

Before you can earn points, you need testnet tokens for gas fees and staking.

**Faucet URL:** [faucet.shyield.finance](https://faucet.shyield.finance)
**How-to Guide:** [faucet.shyield.finance/how-to-use](https://faucet.shyield.finance/how-to-use)

### Claim C2FLR (Gas Tokens)
1. Go to the [Faucet page](https://faucet.shyield.finance/)
2. Enter your wallet address in the **C2FLR** card
3. Click **"Claim 10 C2FLR"** to receive gas tokens
4. Wait for the transaction to confirm (usually a few seconds)

### Claim SHIELD Tokens
1. Enter your wallet address in the **SHIELD** card
2. Keep the **"Include me in the testnet airdrop"** checkbox enabled
3. Click **"Claim 1,000 SHIELD"** to receive test tokens

### Add SHIELD to Your Wallet

**SHIELD Token Contract Address:**
```
0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616
```

1. Open your wallet on Coston2 network
2. Go to **Import tokens** (MetaMask) or **Add Token** (Bifrost)
3. Paste the contract address above
4. Token Symbol and Decimals will auto-fill (SHIELD, 18)
5. Click **Import** to add the token

### Rate Limits
Each wallet can claim tokens once every **12 hours** per token type.

---

## Step 2: Earn Points

Points determine your share of the 2M SHIELD airdrop. Here's how to earn them:

### Points Breakdown

| Activity | Points | Notes |
|----------|--------|-------|
| First Deposit | +100 | One-time bonus for your first deposit |
| Deposits | +10 per $10 | Points scale with deposit value |
| Withdrawal Cycle | +25 | Complete withdrawal from vault |
| Stake SHIELD | +5/day | Daily reward for active stakers |
| Boost Activated | +30 | One-time bonus when activating boost |
| Bridge XRPL→Flare | +20 | Per bridge operation |
| Bridge Flare→XRPL | +20 | Per bridge operation |
| Swap | +15 | Per swap transaction |
| Faucet Claim | +15 | Per claim (12h cooldown) |
| Referral | +50 | When referred user makes first deposit |
| Social Share | +10 | Per verified X post |
| Daily Login | +2 | Once per day |
| Bug Report | +500 | Per verified bug report |

### How to Maximize Points

1. **First Deposit**: Make your first deposit to earn the 100-point bonus
2. **Stake SHIELD**: Active stakers earn 5 points per day automatically
3. **Activate Boost**: Stake SHIELD and activate the APY boost for 30 bonus points
4. **Refer Friends**: Share your referral link for 50 points when they deposit
5. **Social Sharing**: Share on X and click "Verify Post" to earn 10 points
6. **Report Bugs**: Submit bug reports via Discord for up to 500 points

### Social Share Verification

To earn social share points:
1. Click the **"Share on X"** button on the Airdrop page
2. Complete your post on X (Twitter)
3. Return to the app and click **"Verify Post"**
4. The system will verify your post and award 10 points

Note: You must verify the post to receive points. Simply sharing without verification won't award points.

---

## Step 3: Tier Progression

Your tier determines your **airdrop multiplier**. Higher tiers mean more SHIELD tokens!

| Tier | Points Required | Multiplier | Badge |
|------|-----------------|------------|-------|
| Bronze | 0+ | 1.0x | Bronze Tester |
| Silver | 500+ | 1.5x | Silver Tester |
| Gold | 2,000+ | 2.0x | Gold OG |
| Diamond | 5,000+ | 3.0x | Diamond OG |

### Progression Example
- **Bronze user** with 400 points = 400 × 1.0 = 400 effective points
- **Silver user** with 600 points = 600 × 1.5 = 900 effective points
- **Diamond user** with 6,000 points = 6,000 × 3.0 = 18,000 effective points

### Allocation Formula
Your estimated airdrop allocation is calculated as:
```
Your Allocation = (Your Points × Tier Multiplier) / Total Weighted Points × 2,000,000 SHIELD
```

The app shows your estimated allocation on the Airdrop page based on current participation levels.

---

## Step 4: Check Your Status

### View Your Points & Tier
1. Go to [shyield.finance/app/airdrop](https://shyield.finance/app/airdrop)
2. Connect your wallet
3. View your current points, tier, and estimated allocation

### Leaderboard
Check your rank against other participants:
- [shyield.finance/app/leaderboard](https://shyield.finance/app/leaderboard)

### Points Dashboard
Detailed breakdown of all your point sources:
- [shyield.finance/app/points](https://shyield.finance/app/points)

---

## Step 5: Claim at Mainnet Launch

When Shield Finance launches on Flare mainnet, eligible participants can claim their SHIELD tokens.

### Eligibility Requirements
- Accumulated testnet points during the qualification period
- Connected EVM wallet (Bifrost, MetaMask, or compatible wallet)
- Wallet must be on Flare mainnet

### Claim Process

1. **Connect Wallet**: Connect your EVM wallet to [shyield.finance](https://shyield.finance)
2. **Switch to Mainnet**: Ensure your wallet is on Flare mainnet (not Coston2)
3. **Navigate to Airdrop**: Go to the Airdrop page
4. **Check Eligibility**: The system will verify your Merkle proof
5. **Claim Tokens**: Click "Claim SHIELD" and confirm the transaction
6. **Receive Tokens**: SHIELD tokens are sent directly to your wallet

### Transaction Details
- Gas fees are paid in FLR (Flare native token)
- Each address can only claim once
- Unclaimed tokens remain in the contract until claimed

---

## Troubleshooting

### "Not Eligible" Message
- Ensure you're using the same wallet address from testnet
- Verify you accumulated points during the qualification period
- Try disconnecting and reconnecting your wallet

### "Already Claimed" Error
- Each address can only claim once
- Check your transaction history for the previous claim

### Transaction Failed
- Ensure you have enough FLR for gas fees
- Try increasing gas limit in your wallet
- Wait a few minutes and retry

### Wallet Not Connecting
- Refresh the page and try again
- Clear browser cache and cookies
- Try a different browser or wallet

---

## Contract Addresses

### Testnet (Coston2)

| Contract | Address |
|----------|---------|
| SHIELD Token | `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616` |
| MerkleDistributor | Check [SHIELD_DEPLOYMENT.md](../protocol/SHIELD_DEPLOYMENT.md) |

### Mainnet (Flare)
*Addresses will be published at mainnet launch.*

---

## Related Documentation

- [SHIELD Tokenomics](../protocol/SHIELD_TOKENOMICS.md) - Token distribution and economics
- [SHIELD Deployment](../protocol/SHIELD_DEPLOYMENT.md) - Contract addresses
- [Wallet Integration](wallet-integration.md) - Wallet connection guide
- [Staking Boost](../protocol/STAKING_BOOST_SPEC.md) - How staking affects rewards

---

## Support

- **Discord**: Join our community for help
- **Twitter/X**: [@ShieldFinanceX](https://x.com/ShieldFinanceX)
- **Bug Reports**: Submit via Discord for bonus points

---

*Last Updated: December 2025*
