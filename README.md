# XRP Liquid Staking Protocol Dashboard

A full-stack DeFi application for XRP liquid staking, providing a comprehensive dashboard for managing cryptocurrency vaults, depositing assets, tracking positions, and earning yield on the XRP Ledger.

## 🌟 Overview

This project enables users to:
- Connect XRP wallets via **Xaman**, **WalletConnect**, or **Web3Auth** (social login)
- Deposit/withdraw **XRP**, **RLUSD**, and **USDC** into yield-generating vaults
- Track positions with real-time APY rates and rewards
- Monitor vault performance with detailed analytics
- Earn passive income through secure, risk-tiered vaults

**Business Vision**: Making DeFi on XRP accessible and efficient, tapping into the growing market for liquid staking solutions.

## ✨ Key Features

### 🔐 Multi-Wallet Support
- **Xaman (XUMM)** - Mobile wallet integration with QR code signing
- **WalletConnect** - Universal wallet connection for XRPL-compatible wallets
- **Web3Auth** - Social login with Google, Facebook, Twitter, Discord, or Email

### 💰 Vault Management
- Multiple vault types with different risk/reward profiles
- Real-time balance display with 30-second auto-refresh
- Support for XRP, RLUSD, and USDC tokens
- Automated reward calculation and compounding

### 🔄 Transaction System
- Secure deposit workflow with success modals
- Request-based withdrawal approval system
- Claim rewards functionality
- Complete transaction history and analytics

### 📊 Dashboard Features
- Portfolio overview with total value locked
- Active vault statistics
- Historical APY trends with charts
- Transaction history with filtering
- Network switching (Mainnet/Testnet)

## 🏗️ Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: React Context API + TanStack Query
- **UI Components**: shadcn/ui (Radix UI based)
- **Styling**: Tailwind CSS with custom design system
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Server**: Express.js with Node.js and TypeScript
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe queries
- **Validation**: Zod schemas
- **Session Management**: PostgreSQL session store

### Blockchain Integration
- **XRPL Library**: `xrpl` for blockchain interactions
- **Wallet SDKs**: 
  - `xumm-sdk` for Xaman integration
  - `@walletconnect/universal-provider` for WalletConnect
  - `@web3auth/modal` for social login
- **Key Management**: `@noble/secp256k1` for wallet derivation

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Replit account (or local development environment)

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Session
SESSION_SECRET=your-secure-session-secret

# Xaman (XUMM)
XUMM_API_KEY=your-xumm-api-key
XUMM_API_SECRET=your-xumm-api-secret

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id

# Web3Auth
VITE_WEB3AUTH_CLIENT_ID=your-web3auth-client-id
```

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/shield-xrpfinance/shieldfinance.git
   cd shieldfinance
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your API keys and credentials

4. **Run database migrations**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open your browser to `http://localhost:5000`

## 🔑 Getting API Keys

### Xaman (XUMM)
1. Visit [XUMM Developer Console](https://apps.xumm.dev/)
2. Create a new application
3. Copy your API Key and API Secret

### WalletConnect
1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a new project
3. Copy your Project ID

### Web3Auth
1. Visit [Web3Auth Dashboard](https://dashboard.web3auth.io)
2. Create a new project
3. Select **sapphire_devnet** for testnet or **sapphire_mainnet** for production
4. Add your domain to the whitelist
5. Copy your Client ID

## 🗄️ Database Schema

### Core Tables

**vaults**
- Vault configurations and settings
- APY rates and risk profiles
- Supported asset types

**positions**
- User deposits and balances
- Reward calculations
- Timestamps for tracking

**transactions**
- All deposit/withdrawal/claim activities
- Transaction status and history
- Blockchain transaction hashes

**withdrawal_requests**
- Pending withdrawal requests
- Vault operator approval queue
- Claim requests

**vault_metrics_daily**
- Historical performance data
- APY trends over time
- Analytics aggregation

## 🚀 Deployment

The application is designed to run on Replit with automatic deployments:

1. **Push to main branch**
   ```bash
   git push origin main
   ```

2. **Publish on Replit**
   - Use the "Publish" button in Replit
   - Configure custom domain (optional)
   - SSL/TLS handled automatically

## 🔒 Security Features

- **Request-Based Withdrawals**: All withdrawals require vault operator approval
- **Secure Key Management**: Environment-based secret storage
- **Session Management**: PostgreSQL-backed sessions with secure cookies
- **Transaction Verification**: All blockchain transactions verified on-chain
- **XRP Address Validation**: Client and server-side validation

## 🌐 Network Support

- **Mainnet**: Production XRP Ledger network
- **Testnet**: Development and testing environment
- **Dynamic Switching**: Toggle between networks in the UI
- **Network-Specific Configuration**: Separate API endpoints and wallet configurations

## 📱 Wallet Integration Details

### Xaman (XUMM)
- QR code-based transaction signing
- Mobile wallet support
- Automatic payload cleanup (prevents 61 payload limit)
- Polling mechanism for signature confirmation

### WalletConnect
- XRPL namespace configuration (`xrpl:0` mainnet, `xrpl:1` testnet)
- Direct in-wallet signing (no QR codes needed)
- `xrpl_signTransaction` method with tx_json encoding
- Auto-submission handling with sequence error recovery

### Web3Auth
- Social login providers: Google, Facebook, Twitter, Discord, Email
- Browser-native secp256k1 implementation
- HTML-based Buffer/process polyfills
- Testnet: sapphire_devnet, Production: sapphire_mainnet

## 🛠️ Development

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and helpers
│   │   └── hooks/         # Custom React hooks
│   └── index.html         # HTML entry point
├── server/                # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database interface
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema definitions
└── db/                    # Database migrations
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Push database schema changes
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## 📊 Vault System

All deposits are routed to the vault address:
```
rpC7sRSUcK6F1nPb9E5U8z8bz5ee5mFEjC
```

**Why Approval Required?**
Users don't have direct access to the vault's private key for security. All withdrawals must be approved and executed by vault operators through the Admin dashboard.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software owned by Shield Finance Inc.

## 🔗 Links

- **Live Application**: [Coming Soon]
- **Documentation**: See `replit.md` for technical architecture details
- **Support**: Please check our docs or contact the development team

## 👥 Team

**Shield Finance Inc.** - Making DeFi on XRP accessible and efficient

---

Built with ❤️ for the XRP community
