# Getting Started with Shield Finance

This guide will walk you through connecting your wallet and making your first deposit.

## Prerequisites

Before you begin, you'll need:
- An XRP Ledger wallet (Xaman/XUMM recommended)
- XRP, RLUSD, or USDC tokens
- Basic understanding of liquid staking

## Step 1: Connect Your Wallet

### Using Xaman (Recommended)

1. **Install Xaman**
   - Download from [xaman.app](https://xaman.app)
   - Available for iOS, Android, and desktop

2. **Connect to Shield Finance**
   - Visit the Dashboard page
   - Click "Connect Wallet"
   - Select "Xaman"
   - Scan the QR code with your Xaman app
   - Approve the connection request

### Using WalletConnect

1. Click "Connect Wallet"
2. Select "WalletConnect"
3. Choose your preferred wallet from the modal
4. Approve the connection

## Step 2: Choose a Network

Shield Finance supports both mainnet and testnet:

- **Mainnet**: Real assets and transactions
- **Testnet**: Free test tokens for experimenting

Toggle between networks using the network selector in the top navigation.

## Step 3: Browse Vaults

Explore available vaults on the Vaults page:

- **View vault details**: Click any vault card to see:
  - Current APY
  - Total Value Locked (TVL)
  - Risk level
  - Supported assets
  - Historical performance

- **Filter vaults**: Use filters to find vaults matching your risk tolerance

## Step 4: Make a Deposit

1. **Select a vault** that matches your investment strategy
2. **Click "Deposit"** on the vault card
3. **Enter deposit amount**
   - Choose asset (XRP, RLUSD, or USDC)
   - Enter amount to deposit
   - Review estimated APY
4. **Sign transaction** with your wallet
   - Xaman users: Scan QR code to approve
   - WalletConnect users: Approve in your wallet app
5. **Confirm transaction** is complete
   - View transaction hash on XRPL explorer
   - See updated position in your Portfolio

## Step 5: Track Your Portfolio

Monitor your investments on the Portfolio page:

- **Active positions**: See all vault deposits
- **Total value**: Real-time portfolio valuation
- **Accrued rewards**: Track earnings over time
- **Transaction history**: Complete audit trail

## Managing Your Position

### Claiming Rewards

1. Navigate to Portfolio page
2. Find position with accrued rewards
3. Click "Claim Rewards"
4. Sign transaction with your wallet
5. Receive rewards in your wallet

### Withdrawing Funds

1. Open the position you want to withdraw from
2. Click "Withdraw"
3. Enter withdrawal amount
4. Sign transaction with your wallet
5. Funds returned to your wallet

## Network Configuration

### Mainnet Settings
- **XRP Ledger Server**: `wss://xrplcluster.com`
- **RLUSD Issuer**: `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`
- **USDC Issuer**: `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE`

### Testnet Settings
- **XRP Ledger Server**: `wss://s.altnet.rippletest.net:51233`
- **RLUSD Issuer**: `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`
- **Get test tokens**: Use [XRP Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)

## Next Steps

- Explore [Vault Management](features/vault-management.md) features
- Learn about [Transaction Signing](features/transaction-signing.md) security
- Read [Security Best Practices](guides/security.md)

## Need Help?

- Check our [Troubleshooting Guide](guides/troubleshooting.md)
- Join our community discussions
- Report issues on [GitHub](https://github.com/shield-xrpfinance/shieldfinance/issues)
