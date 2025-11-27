# Shield Finance Testnet User Guide

Welcome to Shield Finance! This guide will help you get started with our testnet deployment on Coston2 (Flare's test network).

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Platform Features](#platform-features)
4. [Connecting Wallets](#connecting-wallets)
5. [Making Deposits](#making-deposits)
6. [Withdrawing](#withdrawing)
7. [SHIELD Token Staking](#shield-token-staking)
8. [Troubleshooting](#troubleshooting)
9. [Important Notes](#important-notes)

---

## Overview

Shield Finance is a **liquid staking protocol for XRP** built on the Flare Network. Our platform allows you to stake your XRP and earn yield while maintaining liquidity through our shXRP vault tokens.

**Key Features:**
- Stake XRP and receive liquid staking tokens
- Earn competitive APY on your deposits
- Stake SHIELD governance tokens to boost your rewards
- Seamlessly bridge between XRP Ledger and Flare Network

**Testnet Environment:**
- Network: Coston2 (Flare Testnet)
- Chain ID: 114
- All tokens are testnet tokens with no real value

---

## Getting Started

### Step 1: Choose Your Wallet

Shield Finance supports two types of wallets depending on your preferred ecosystem:

#### For XRPL Users (XRP Deposits)
**Xaman (formerly XUMM) Wallet**
- Download from [xumm.app](https://xumm.app/) or your app store
- Create or import your XRPL wallet
- Switch to testnet mode in Xaman settings

#### For EVM Users (Direct FXRP Deposits)
**MetaMask or WalletConnect-compatible wallets**
- Download MetaMask from [metamask.io](https://metamask.io/)
- Or use any WalletConnect-compatible wallet (Trust Wallet, Rainbow, etc.)

### Step 2: Add Coston2 Network to MetaMask

If using MetaMask, add the Coston2 testnet:

| Setting | Value |
|---------|-------|
| Network Name | Coston2 Testnet |
| RPC URL | `https://coston2-api.flare.network/ext/C/rpc` |
| Chain ID | 114 |
| Currency Symbol | C2FLR |
| Block Explorer | `https://coston2-explorer.flare.network` |

**To add manually:**
1. Open MetaMask
2. Click the network dropdown (top of screen)
3. Click "Add Network" or "Add network manually"
4. Enter the settings above
5. Click "Save"

### Step 3: Get Testnet Tokens

You'll need testnet tokens to interact with the platform:

**For EVM (Coston2):**
- Visit the [Flare Faucet](https://faucet.flare.network/)
- Connect your wallet and request C2FLR (testnet FLR)
- Request testnet FXRP if available

**For XRPL:**
- Visit the [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
- Generate testnet XRP for your Xaman wallet

---

## Platform Features

### Vaults Page
The Vaults page is your main interface for staking:
- View all available staking vaults with current APY
- See TVL (Total Value Locked) for each vault
- Use the **ecosystem filter** in the header to toggle between XRPL and Flare views
- Deposit or withdraw from any vault

### Dashboard
Your personal dashboard shows:
- Portfolio overview with total staked value
- Your active staking positions across all vaults
- Pending withdrawals and their status
- Real-time earnings and APY

### Swap (EVM Only)
Exchange tokens using SparkDEX V3 integration:
- Swap between FLR, WFLR, USDT, and SHIELD
- View real-time exchange rates
- Note: Swap feature requires an EVM wallet connection

### SHIELD Staking
Boost your vault earnings by staking SHIELD tokens:
- Stake SHIELD to increase your APY on vault deposits
- View your current boost percentage
- Track lock periods and unlock times

### Analytics
Protocol-wide metrics and data:
- Total Value Locked (TVL) across all vaults
- Historical APY charts
- Protocol revenue and distribution

### Bridge Tracking
Monitor your cross-chain transactions:
- Track XRP to FXRP bridge status
- View withdrawal redemption progress
- See complete transaction history

---

## Connecting Wallets

### XRPL Wallets (Xaman)

When you connect with Xaman:
- You'll see **XRP vaults** in the interface
- Deposits use the **FAssets bridge** to convert XRP to FXRP automatically
- The ecosystem toggle will be disabled and locked to "XRPL"
- Your XRP is bridged to Flare, deposited in the vault, and you receive shXRP tokens

**To connect:**
1. Click "Connect Wallet" in the header
2. Select "Xaman"
3. Scan the QR code with your Xaman app
4. Approve the connection in Xaman

### EVM Wallets (MetaMask/WalletConnect)

When you connect with an EVM wallet:
- You'll see **FXRP vaults** in the interface
- Deposits interact directly with Flare contracts
- The ecosystem toggle will be disabled and locked to "Flare"
- You have access to the Swap feature
- Transactions are standard EVM contract calls

**To connect:**
1. Click "Connect Wallet" in the header
2. Select "WalletConnect" or your preferred wallet
3. Approve the connection in your wallet
4. Ensure you're on the Coston2 network (Chain ID: 114)

### Ecosystem Toggle

When no wallet is connected:
- The toggle in the header lets you preview XRPL or Flare ecosystem vaults
- Once connected, the toggle matches your wallet type automatically

---

## Making Deposits

### EVM Wallet Deposits (FXRP)

1. **Connect your EVM wallet** (ensure you're on Coston2)
2. **Navigate to Vaults** and select a vault
3. **Click "Deposit"** on your chosen vault
4. **Enter the amount** of FXRP you want to deposit
5. **Review the transaction details**:
   - Deposit amount
   - Expected shXRP tokens
   - Current APY
6. **Confirm the transaction** in your wallet
7. **Wait for confirmation** - you'll receive shXRP tokens

### XRPL Wallet Deposits (XRP via FAssets Bridge)

1. **Connect your Xaman wallet**
2. **Navigate to Vaults** and select an XRP vault
3. **Click "Deposit"** and enter your XRP amount
4. **Review lot sizing** - FAssets uses lot sizes (minimum 20 XRP increments)
5. **Sign the transaction** in Xaman when prompted
6. **Monitor progress** - the deposit follows these steps:
   - Bridge reservation created
   - XRP payment sent to agent
   - Payment verified on XRPL
   - FXRP minted on Flare
   - FXRP deposited to vault
   - shXRP tokens credited

You can track your bridge status on the **Bridge Tracking** page at any time.

---

## Withdrawing

### From the Portfolio Page

1. Navigate to **Portfolio** in the sidebar
2. Find your staking position
3. Click the **Withdraw** button
4. Enter the amount to withdraw
5. Confirm the transaction

### From the Vault Page

1. Navigate to **Vaults**
2. Click on the vault where you have a position
3. Click **Withdraw**
4. Enter the amount and confirm

### XRP Vault Withdrawals

For XRP vaults (XRPL users):
- Your withdrawal initiates a redemption via FAssets
- FXRP is burned and XRP is sent to your XRPL address
- This process may take several minutes
- Track progress on the **Bridge Tracking** page

### FXRP Vault Withdrawals

For FXRP vaults (EVM users):
- FXRP is returned directly to your EVM wallet
- Standard EVM transaction confirmation
- Usually completes within 1-2 minutes

---

## SHIELD Token Staking

SHIELD is the governance token for Shield Finance. Staking SHIELD provides APY boosts on your vault deposits.

### How It Works

1. **Stake SHIELD tokens** to earn boost multipliers
2. **7-day minimum lock period** - tokens are locked for at least 7 days
3. **Higher stakes = Higher boosts** - more SHIELD staked means better APY
4. **Unstake after lock** - withdraw your SHIELD once the lock period ends

### Staking SHIELD

1. Navigate to **SHIELD Staking** in the sidebar
2. Enter the amount of SHIELD to stake
3. Review the expected APY boost
4. Confirm the transaction in your wallet
5. Your boost takes effect immediately for new deposits

### Unstaking SHIELD

**Before unstaking:**
- Your 7-day lock period must have expired (shown on the staking page)
- Ensure you have sufficient C2FLR for gas fees (~0.01 C2FLR)

**Steps to unstake:**
1. Navigate to **SHIELD Staking** in the sidebar
2. Check the "Unlock Time" - if it shows "Unlocked" or a past date, you can unstake
3. Enter the amount of SHIELD to unstake (or use "Max" for full withdrawal)
4. Click the **Unstake** button
5. Your wallet will prompt you to sign the transaction:
   - MetaMask: Review the transaction and click "Confirm"
   - WalletConnect: Approve the request on your mobile wallet
6. Wait for the transaction to be confirmed (typically 10-30 seconds)
7. Your SHIELD tokens will be returned to your wallet
8. Your APY boost will be reduced proportionally

**After unstaking:**
- Check your wallet balance to confirm receipt of SHIELD tokens
- If you add SHIELD back later, a new 7-day lock period begins

### Testnet Contract Addresses

| Contract | Address |
|----------|---------|
| SHIELD Token | `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616` |
| StakingBoost | `0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4` |
| ShXRPVault | `0x3219232a45880b79736Ee899Cb3b2f95D527C631` |
| FXRP Token | `0x0b6A3645c240605887a5532109323A3E12273dc7` |

View contracts on [Coston2 Explorer](https://coston2-explorer.flare.network)

---

## Troubleshooting

### "Wrong Network" Errors

**Problem:** Your wallet is connected to the wrong network.

**Solution:**
1. Open your wallet (MetaMask)
2. Click the network dropdown
3. Switch to "Coston2 Testnet"
4. If not available, add it using the settings in [Getting Started](#step-2-add-coston2-network-to-metamask)

### Transaction Stuck or Pending

**Problem:** Your transaction has been pending for a long time.

**Solutions:**
1. **Check gas settings** - ensure you have enough C2FLR for gas
2. **Wait for confirmation** - testnet can occasionally be slow
3. **Speed up in wallet** - try increasing the gas price
4. **Check the explorer** - view your transaction on [Coston2 Explorer](https://coston2-explorer.flare.network)

### Bridge Transaction Not Completing

**Problem:** Your XRP to FXRP bridge is taking too long.

**Solutions:**
1. Navigate to **Bridge Tracking** page
2. Check the current status of your bridge
3. Look for any error messages
4. If stuck in "Awaiting Payment", ensure your XRP transaction was sent
5. Allow up to 10-15 minutes for bridge completion

### RPC Connection Issues

**Problem:** The platform shows connection errors or won't load.

**Solution:**
The platform has automatic failover between multiple RPC endpoints:
- Primary: `https://coston2-api.flare.network/ext/C/rpc`
- Backup: `https://coston2.enosys.global/ext/bc/C/rpc`
- Backup: `https://flare-testnet-coston2.rpc.thirdweb.com`

Try refreshing the page. If issues persist, try:
1. Clearing browser cache
2. Disconnecting and reconnecting your wallet
3. Switching to a different browser

### Rate Limit Errors (HTTP 429)

**Problem:** You see "Too Many Requests" errors or your actions seem blocked.

**Cause:** The platform has API rate limiting to prevent abuse:
- General requests: 100 per minute
- Sensitive operations (deposits/withdrawals): 20 per minute

**Solution:**
1. Wait 1-2 minutes before retrying
2. Avoid rapid-fire clicking on buttons
3. Don't refresh pages excessively
4. If you see "Retry-After" header in error, wait that many seconds

This is normal behavior to protect the platform and not an error with your account.

### Wallet Won't Connect

**Problem:** Unable to connect your wallet to the platform.

**Solutions:**
1. Ensure your wallet extension is updated
2. Try refreshing the page
3. Check that pop-ups are allowed for this site
4. Try a different browser
5. For WalletConnect: ensure your mobile wallet is open

### Not Seeing My Tokens

**Problem:** Your balance shows 0 or tokens aren't appearing.

**Solutions:**
1. Confirm you're on the correct network (Coston2, Chain ID: 114)
2. Check if you need to add the token to your wallet:
   - SHIELD: `0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616`
   - FXRP: `0x0b6A3645c240605887a5532109323A3E12273dc7`
3. Wait a few moments and refresh
4. Check the token balance on [Coston2 Explorer](https://coston2-explorer.flare.network)

---

## Important Notes

### This is Testnet

- All tokens on Coston2 testnet have **no real monetary value**
- Use testnet to familiarize yourself with the platform before mainnet launch
- Feel free to experiment with deposits, withdrawals, and staking

### Testnet Limitations

- Testnet may experience occasional downtime or resets
- Faucet tokens are limited - don't abuse the faucets
- Some features may behave differently than mainnet

### Reporting Issues

Found a bug or have feedback?

- **Discord:** Join our community for support
- **GitHub:** Report issues on our repository
- **Twitter/X:** Follow us for updates

### Testnet Resets

Please be aware:
- The testnet may be reset periodically during development
- Your balances and positions may be cleared during resets
- We'll announce any planned resets in advance on our Discord

### Security Reminders

Even on testnet, practice good security habits:
- Never share your seed phrase or private keys
- Double-check transaction details before signing
- Use a dedicated testnet wallet separate from your mainnet funds

### WalletConnect Safety

If using WalletConnect (mobile wallets, Trust Wallet, Rainbow, etc.):

**Best Practices:**
- Only scan QR codes displayed on the official Shield Finance site
- Never scan QR codes shared via Discord, Twitter, or email
- Verify the URL in your mobile wallet shows the correct domain
- Disconnect sessions when you're done testing

**Managing Sessions:**
1. Periodically review active WalletConnect sessions in your wallet
2. Revoke/disconnect any sessions you don't recognize
3. If you see unexpected connection requests, reject them immediately

**If something seems wrong:**
- Disconnect your wallet immediately
- Clear browser cache and cookies
- Report suspicious activity on our Discord

---

## Quick Reference

### Network Details

| Setting | Value |
|---------|-------|
| Network Name | Coston2 Testnet |
| Chain ID | 114 |
| RPC URL | `https://coston2-api.flare.network/ext/C/rpc` |
| Explorer | `https://coston2-explorer.flare.network` |
| Currency | C2FLR |

### Useful Links

- [Flare Testnet Faucet](https://faucet.flare.network/)
- [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
- [Coston2 Block Explorer](https://coston2-explorer.flare.network)
- [MetaMask Download](https://metamask.io/)
- [Xaman Wallet](https://xumm.app/)

---

Thank you for testing Shield Finance! Your feedback helps us build a better product.
