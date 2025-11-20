# Getting Started with Shield Yield Vaults

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

2. **Connect to Shield Yield Vaults**
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

Shield Yield Vaults supports both mainnet and testnet:

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

Shield Yield Vaults provides three dedicated pages for monitoring your investments:

### Portfolio Page
- **Active positions**: See all your current vault deposits
- **Total value**: Real-time portfolio valuation
- **Accrued rewards**: Track earnings over time
- **In-flight withdrawal alerts**: Count badge with direct navigation to Bridge Tracking for detailed status
- **Auto-refresh**: Automatic 5-second refresh during active withdrawals

### Transaction History Page
- **Complete history**: All deposits, claims, and withdrawals tied to your wallet
- **Wallet-scoped security**: You only see transactions from your connected wallet
- **Blockchain verification**: Transaction hashes link to XRPL explorer

### Bridge Tracking Page
- **Real-time status**: Live updates on all bridge operations (XRP → FXRP conversions)
- **Detailed progress**: Step-by-step status for deposits and withdrawals
- **Historical records**: Complete bridge transaction history

## Managing Your Position

### Claiming Rewards

1. Navigate to **Portfolio** page
2. Find position with accrued rewards
3. Click "Claim Rewards"
4. Sign transaction with your wallet
5. Receive rewards in your wallet
6. View claim transaction in **Transaction History** page

### Withdrawing Funds

1. Navigate to **Portfolio** page
2. Open the position you want to withdraw from
3. Click "Withdraw"
4. Enter withdrawal amount
5. Sign transaction with your wallet
6. **Monitor progress**:
   - Portfolio page shows in-flight withdrawal alert
   - Click alert to view detailed status on **Bridge Tracking** page
   - Automatic 5-second refresh until withdrawal completes
7. Funds returned to your wallet
8. View withdrawal transaction in **Transaction History** page

### Privacy & Security

All transaction data is **wallet-scoped**, meaning:
- You only see transactions from your connected wallet address
- Other users cannot access your transaction history
- API endpoints require wallet authentication for all data access

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
