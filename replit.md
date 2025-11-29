# XRP Liquid Staking Protocol Dashboard

## Whitepaper
[Whitepaper v1.3 (PDF)](https://shyield.finance/whitepaper.pdf) — November 2025 (Testnet Live – Mainnet December 2025). VARA-compliant documentation including Institutional Safeguards, audit citations (Asfalia complete Nov 2025, Hacken in progress, Trail of Bits Q1 2026), realistic APY ranges (5-8% base), and regulatory risk disclosures. Local copy at `public/whitepaper.pdf`, source at `docs/whitepaper/main.tex`.

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, with FAssets protocol for cross-chain XRP bridging to Flare. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market. It features a dual wallet architecture providing tailored experiences for XRPL (Xaman/XUMM) and EVM (Reown AppKit/MetaMask) users, showing XRP or FXRP vaults respectively.

## User Preferences
Preferred communication style: Simple, everyday language.
Design preference: Modern, clean list-based layouts over grid cards for better space utilization.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, modern list-based layouts, and Glassmorphism design elements.
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema including `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `xrp_to_fxrp_bridges`, `fxrp_to_xrp_redemptions`, `firelight_positions`, `compounding_runs`, `service_state`.

### System Design
- **Separation of Concerns**: Monorepo structure (`/client`, `/server`, `/shared`).
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **Automated Systems**: FAssets bridge reconciliation (automated and manual recovery), automated withdrawal system (async processing, ENS resolution, XRPL payment detection, FDC proof generation), deposit watchdog, and withdrawal retry services.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates with on-chain balance verification for FXRP vaults, wallet-type-aware vault filtering, ecosystem-based network switching, consolidated position display with aggregated rewards, and guided tour (v1.3) with mobile sidebar lock mechanism.
- **Guided Tour**: Shepherd.js-based onboarding tour with scenario-based flows (new-user, xrpl-user, evm-user). Mobile sidebar lock mechanism prevents Radix Sheet auto-close during tour steps via `mobileSidebarLocked` state in SidebarContext. Tour opens/locks sidebar for menu steps (Vaults, Staking, Swap, Portfolio), unlocks for non-sidebar steps, and releases lock on complete/cancel.
- **Wallet Architecture**: Dual-ecosystem wallet support with three provider types: `xaman` (native XRPL SDK with xApp integration), `walletconnect` (XRPL via WalletConnect), and `reown` (EVM via Reown AppKit). Wallet type derived from connected addresses (evmAddress → "evm", address → "xrpl"). Header displays connected address with disconnect button. Dark-themed Reown modal with custom CSS overrides.
- **Xaman xApp Integration**: Streamlined xApp experience when opened within Xaman wallet - auto-connect via `xumm.user.account`, deposit auto-sign via `xumm.xapp.openSignRequest()`, xApp context detection (JWT/OTT/ReactNativeWebView), and `xumm.xapp.ready()` loader dismissal. Note: Claim/withdraw flows currently fall back to QR modal pending backend updates.
- **Security & Controls**: P0 vault controls (deposit limits, pausable emergency controls), minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery, wallet-scoped transaction security, and FDC proof generation lock.
- **UAE Geo-Blocking**: Fail-closed front-end geo-blocking for VARA compliance using ipapi.co. GeoProvider context (`client/src/lib/geoContext.tsx`) detects location, shows compliance modal for UAE IPs, and blocks app routes when detection fails (fail-closed). Users can retry detection or return to homepage. Smart contracts remain permissionless by design.
- **Multi-Asset Swap**: Full swap feature with SparkDEX V3 router, real-time quotes, and approval flows.
- **Analytics & Monitoring**: Revenue transparency analytics with on-chain queries from Coston2 testnet. AnalyticsService features paginated RPC queries (29-block chunks to respect Coston2's getLogs limit), 5-minute caching for stakers count, and unique staker detection via Deposit event analysis. Testnet monitoring & alerting system (metrics collection, alerts for delays/failures, API endpoints, real-time dashboard, Prometheus endpoint).
- **Asset Configuration**: Network-aware asset configuration system for automatic token switching between mainnet and testnet.
- **Production Readiness**: Fast server startup, asynchronous service initialization, dual health endpoints, API readiness guards, API rate limiting, and RPC failover utility.
- **Airdrop System**: Faucet API (faucet.shyield.finance) as single source of truth for eligibility, with endpoints `/api/airdrop/stats` and `/api/airdrop/check/:address` (5-second timeout). MerkleDistributor contract at `0x25783E1Ebf2C9Fc7DDe2E764C931348d3bB3AB31`. Live on-chain claim status checking.
- **Portfolio Enhancements**: Pending deposits section, bridge activity integration in position tracking, improved position verification and FXRP balance calculation with on-chain data.
- **Navigation**: Documentation at docs.shyield.finance, blog at blog.shyield.finance, whitepaper at shyield.finance/whitepaper.pdf, governance portal at vote.shyield.finance, Discord at discord.gg/Vzs3KbzU. Landing page features mobile hamburger menu with smooth scroll navigation to page sections and external links.
- **SHIELD Token**: Fair Launch price set at $0.01.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control, ReentrancyGuard).
- **Contracts**: `ShXRPVault.sol` (ERC-4626), `VaultController.sol`, `StakingBoost.sol` (Synthetix accumulator), `RevenueRouter.sol` (fee distribution), `ShieldToken.sol`.

### StakingBoost ↔ ShXRPVault ↔ RevenueRouter Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Stake SHIELD → Boost shXRP Yield                    │
│                                                                          │
│  ┌──────────────┐     fees      ┌───────────────────┐                   │
│  │ ShXRPVault   │ ────────────► │  RevenueRouter    │                   │
│  │ (ERC-4626)   │               │  distribute()     │                   │
│  └──────┬───────┘               └─────────┬─────────┘                   │
│         │                                 │                              │
│         │ donateOnBehalf()                │ 50% burn / 40% boost / 10%  │
│         │ (mints shXRP)                   │ reserves                     │
│         │                                 ▼                              │
│         │                       ┌─────────────────────┐                  │
│         │                       │  StakingBoost       │                  │
│         │◄──────────────────────│  distributeBoost()  │                  │
│         │      claim()          │  rewardPerToken     │                  │
│         │                       │  (Synthetix style)  │                  │
│         │                       └─────────────────────┘                  │
│                                                                          │
│  Formula: Boost = Revenue × (User SHIELD ÷ Total SHIELD)                │
│  Lock: 30 days | Revenue: 40% to boost | Cap: 25% max                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Deployment Flow (Circular Dependency Solution):**
1. Deploy ShXRPVault with `stakingBoost = address(0)`
2. Deploy StakingBoost with real vault address  
3. Call `vault.setStakingBoost()` (one-time setter)

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRPL wallet integration via native SDK. Browser mode uses QR code flow; xApp mode provides auto-connect (`xumm.user.account`) and auto-sign (`xumm.xapp.openSignRequest()`).
- **Reown AppKit v2+**: Modern EVM wallet connection (MetaMask, Trust Wallet, Rabby) with dark theme, replacing legacy WalletConnect for EVM.
- **WalletConnect (XRPL)**: For other XRPL wallets (Bifrost, GemWallet, CrossMark) via WalletConnect protocol.
- **XRP Ledger (XRPL)**: Real-time balance fetching.
- **Wagmi**: React hooks for Ethereum with Flare mainnet (14) and Coston2 testnet (114) chain support.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.
- **Shepherd.js**: Interactive guided tour library for user onboarding.

### Development & Deployment
- **Drizzle ORM**: Database schema management.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, dynamic AssetManager, FDC Attestation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification for attestations.
- **SparkDEX V3**: Uniswap V2-compatible DEX on Flare Network for token swaps.

### RWA & Tokenized Securities (Future Integration)
- **RWA.xyz Integration**: Planned integration with https://app.rwa.xyz/ for real-world asset data feeds including U.S. Treasuries, Private Credit, Commodities, Corporate Bonds, and Tokenized Equities.
- **Vault Asset Categories**: Three-tier asset classification system:
  - `crypto`: Native crypto yield vaults (XRP, FXRP)
  - `rwa`: Real World Asset backed vaults (Treasuries, Gold, Private Credit, Real Estate)
  - `tokenized_security`: Tokenized securities (S&P 500, NASDAQ-100, Dividend Portfolios)
- **Compliance Framework**: KYC verification, accredited investor checks, jurisdiction restrictions, minimum investments, and custodian transparency.
- **Mock RWA Vaults**: 12 example vaults aligned with RWA.xyz categories:
  - U.S. Treasuries: T-Bills (4.2% APY), 10-Year Bonds (4.8% APY) - Blackrock/Fidelity custody
  - Private Credit: Diversified Loans (9.5% APY), Real Estate Debt (8.2% APY) - Apollo/Blackstone custody
  - Commodities: Gold (2.5% APY), Silver (3.1% APY) - Brinks custody
  - Tokenized Securities: S&P 500 (11.5% APY), NASDAQ-100 (14.2% APY), Global Dividends (6.8% APY) - DTCC/State Street custody
  - Corporate Bonds: Investment Grade (5.8% APY), High Yield (8.9% APY) - Vanguard/PIMCO custody
  - Institutional: Money Market (5.2% APY) - JP Morgan custody
- **UI Features**: Category tabs with count badges, asset type badges (RWA/Security), compliance badges (KYC/Accredited), custodian badges, minimum investment indicators, and eligibility checks before deposits.