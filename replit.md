# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application designed for XRP liquid staking. It provides a comprehensive dashboard for users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The application aims to offer a robust platform for yield generation on the XRP Ledger, supporting various risk-tiered vaults and providing detailed portfolio management and transaction analytics. The business vision is to make DeFi on XRP accessible and efficient, tapping into the growing market for liquid staking solutions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query for server state.
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS for styling, Material Design + DeFi patterns, custom CSS variables for theming, responsive layout with collapsible sidebar, 12-column grid.
- **State Management**: React Context API for wallet with localStorage persistence (auto-restores connection on page load/republish), TanStack Query for server state, React hooks for local component state.
- **Typography**: Inter (UI), JetBrains Mono (monospace).

### Backend Architecture
- **Server**: Express.js with Node.js and TypeScript, RESTful API.
- **API Endpoints**: CRUD operations for vaults and user positions, including dedicated endpoints for deposits, withdrawals, and claims.
- **Data Validation**: Zod schemas, drizzle-zod for database schema validation.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM for type-safe queries.
- **Schema**: 
  - `vaults` (vault configurations)
  - `positions` (user deposits, rewards, timestamps)
  - `transactions` (all deposit/withdrawal/claim activities)
  - `vault_metrics_daily` (historical analytics)
  - `withdrawal_requests` (pending withdrawal and claim requests requiring vault operator approval)
- **Key Features**: UUID primary keys, decimal precision for financial data, seed data for initial setup.
- **Withdrawal/Claim System**: Request-based approval flow where users submit withdrawal/claim requests that are reviewed and approved by vault operators through the Admin dashboard.

### System Design Choices
- **Separation of Concerns**: `/client` (frontend), `/server` (backend), `/shared` (shared types/schemas).
- **Environment Variables**: Validation for `DATABASE_URL` and `SESSION_SECRET`.
- **CORS and Session Handling**: Integrated into Express middleware.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration for transaction signing (deposits, withdrawals, claims). Uses `xumm-sdk` for payload generation and a polling mechanism for signature confirmation. Includes automatic payload cleanup to prevent hitting the 61 payload limit. Requires `XUMM_API_KEY` and `XUMM_API_SECRET` environment variables to be set in Replit Secrets.
- **WalletConnect**: XRPL-compatible wallet connection and transaction signing using `@walletconnect/universal-provider` configured for the `xrpl` namespace (not Ethereum). Supports XRPL mainnet (xrpl:0) and testnet (xrpl:1) with dynamic chain switching based on network toggle. Uses `xrpl_signTransaction` for signing which returns `{ tx_json }` or `{ result: { tx_json }}`. Frontend encodes signed tx_json to tx_blob using `xrpl.encode()`, then submits via backend endpoint `/api/xrpl/submit`. Backend handles wallet auto-submission: if sequence error occurs (wallet already submitted), queries XRPL to verify transaction success using `hashes.hashSignedTx()` for hash computation. Returns success if transaction validated with tesSUCCESS. Requires `VITE_WALLETCONNECT_PROJECT_ID` from cloud.walletconnect.com.
- **Web3Auth (Social Login)**: ⚠️ Integration prepared but currently disabled. Web3Auth enables social login (Google, Facebook, Twitter, Discord, Email) for XRP wallet creation. Implementation uses `@web3auth/modal` v10.x with browser-native `@noble/secp256k1` for XRPL wallet derivation from Web3Auth's secp256k1 private keys. **Status**: Code is complete and functional but requires `vite-plugin-node-polyfills` to be added to project configuration to polyfill Node.js Buffer module for browser compatibility. UI shows "Coming Soon" message until polyfills are configured. To enable: install `vite-plugin-node-polyfills`, configure in vite.config.ts, and uncomment Web3Auth code in `client/src/components/ConnectWalletModal.tsx` and import in line 21. Requires `VITE_WEB3AUTH_CLIENT_ID` from dashboard.web3auth.io (already configured in Secrets).
- **Transaction Signing Routing**: Automatically routes to correct signing provider based on wallet connection method - Xaman users sign via Xaman modal with QR codes, WalletConnect users sign directly in their connected wallet app.
- **XRP Ledger Balance Fetching**: Real-time balance retrieval using the `xrpl` library for XRP, RLUSD, and USDC with 30-second auto-refresh.
- **QR Code Display**: `qrcode.react` for generating scannable QR codes for Xaman wallet interactions.
- **Demo Mode**: Fallback for wallet connections when API keys are not configured, providing mock functionality with demo XRP addresses.

### UI & Data Visualization
- **Recharts**: For displaying APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Replit-specific plugins**: Runtime error overlay, cartographer, dev banner.
- **Drizzle Kit**: For database migrations.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.

### Fonts
- Google Fonts CDN: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter.