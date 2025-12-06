# Shield Finance - XRP Liquid Staking Protocol

> **Project Runbook** - Technical overview for developers and agents working on this codebase.
> For complete documentation, see [docs/README.md](docs/README.md).

## Overview

Full-stack DeFi dashboard for XRP liquid staking on Flare Network. Users deposit XRP/FXRP, receive shXRP tokens, and earn yield. Stake SHIELD governance tokens for APY boost.

**Live App:** [shyield.finance](https://shyield.finance)

## User Preferences

- **Communication:** Simple, everyday language
- **Design:** Modern, clean list-based layouts (not grid cards)
- **Data:** NO mock data anywhere in the app

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming, modern list-based layouts, and Glassmorphism design elements.
- **State Management**: React Context API, TanStack Query, React hooks.
- **Wallet Architecture**: Dual-ecosystem wallet support (`xaman`, `walletconnect` for XRPL, `reown` for EVM) with wallet-type-aware vault filtering.
- **UX Enhancements**: Multi-step progress modals, deposit cancellation, real-time portfolio updates, consolidated position display with aggregated rewards, and a Shepherd.js-based guided tour.
- **Dashboard Enhancements**: Real-time vault balances (PortfolioSummaryCard), historical performance charts (PortfolioPerformanceChart), SHIELD boost impact displays (BoostImpactBanner), persistent notification center (NotificationCenter) with triggers for deposits/withdrawals/staking/rewards/bridge operations, and unified bridge tracking with multi-chain support.
- **Security**: UAE Geo-Blocking for VARA compliance.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.
- **Automated Systems**: FAssets bridge reconciliation, automated withdrawal system, deposit watchdog, withdrawal retry services, multi-chain bridge tracking, and automated strategy allocation & rebalancing.
- **Analytics & Monitoring**: Revenue transparency analytics, testnet monitoring with real-time 24-hour sliding window metrics, and alerting system.
- **Production Readiness**: Fast server startup, asynchronous service initialization, health endpoints, API readiness guards, API rate limiting, and RPC failover utility.
- **Self-Healing Infrastructure**: ServiceSupervisor with auto-restart, ResilientRpcAdapter with multi-endpoint failover, XrplConnectionPool with automatic reconnection, CacheFallbackService for graceful degradation, ReconciliationService for state consistency, and FeatureFlagService for dynamic feature control.
- **Admin Security**: Mutating endpoints protected with `X-Admin-Key` header.
- **Testnet Points System**: Comprehensive points tracking with automatic referral via URL parameters, daily login rewards on wallet connect, swap points logging, staking daily rewards scheduler (5pts/day for active stakers), tier-based multipliers (Bronze 1x, Silver 1.5x, Gold 2x, Diamond 3x) for future SHIELD airdrop.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Comprehensive schema covering vaults, positions, transactions, dashboard snapshots, user notifications, cross-chain bridge jobs, and various system states.
- **Ethereum Address Handling**: Case-insensitive comparison for Ethereum addresses in database queries.

### System Design
- **Separation of Concerns**: Monorepo structure (`/client`, `/server`, `/shared`).
- **Smart Accounts**: ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions.
- **Asset Configuration**: Network-aware asset configuration system for automatic token switching between mainnet and testnet, supporting crypto assets and future RWA/tokenized securities.
- **Smart Contracts (Solidity on Flare Network)**: Developed with Hardhat and OpenZeppelin Contracts. Key contracts include `ShXRPVault.sol` (ERC-4626), `VaultController.sol`, `StakingBoost.sol`, `RevenueRouter.sol`, `BuybackBurn.sol`, `ShieldToken.sol`, and `FirelightStrategy.sol`.
- **StakingBoost ↔ ShXRPVault ↔ RevenueRouter Architecture**: A circular dependency solution for deploying and linking these core contracts for yield boosting and fee distribution.
- **Revenue System (Dec 2025 Security Hardened)**:
  - **RevenueRouter.sol**: Accepts FXRP from vault fees, distributes 50% to SHIELD buyback/burn, 40% direct FXRP to StakingBoost, 10% reserves.
  - **BuybackBurn.sol**: Accepts wFLR from external sources, swaps to SHIELD via SparkDEX V3, burns tokens.
  - **Security Features**: SafeERC20 forceApprove(), allowance clearing after operations, configurable slippage protection (max 20%), price tracking, rescue restrictions for operational tokens.
  - **Test Coverage**: 150 tests passing (99 ShXRPVault + 21 BuybackBurn + 30 RevenueRouter), no Slither findings.
- **Airdrop System**: Faucet API and MerkleDistributor contract for SHIELD token distribution.
- **Multi-Asset Swap**: Full swap feature with SparkDEX V3 router.
- **Multi-Chain Bridge**: Luminite FSwap widget integration for bridging assets across XRPL, Flare, Ethereum, Base, Arbitrum, and other chains.
- **Analytics Data Architecture**: Live TVL and APY from blockchain. On-chain events and bridge operations tracked in real-time. Future enhancement for live APY from vault metrics snapshots.
- **Yield Fee Implementation**: ERC-4626 compliant fee accrual system - fees tracked in `accruedProtocolFees` state variable and claimed only from vault buffer when liquidity available (no unbacked share minting).
- **Multi-Strategy Architecture**: VaultController manages allocation across FirelightStrategy (50% - FXRP staking on Firelight.finance), KineticStrategy (40% - FXRP lending), and 10% buffer. VaultController.executeCompound() tracks actual yield by comparing strategy totalAssets before/after report.
- **Mainnet Deployment**: `scripts/deploy-mainnet-strategies.ts` provides production deployment with Firelight integration (mainnet stXRP: 0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3), security checklist, and multi-sig role transfer instructions.
- **Testnet Validation**: MockStrategy (`0x1a8c6d2BfD132bCf75B54B3d23CA4c0542957A45`) deployed on Coston2 for testing vault mechanics. Simulation validated: deposit, rebalance, yield tracking, and withdrawal all work correctly.
- **StakingBoost V2**: Contract (`0x9dF4C13fd100a8025c663B6aa2eB600193aE5FB3`) deployed with testnet lock bypass feature. Owner can toggle `testnetLockBypass` to skip 30-day lock for testing. Security: chainId guard ensures bypass can ONLY be enabled on Coston2 (chainId 114), preventing mainnet bypass.

### Multi-Chain SHIELD Presale System
- **LayerZero v2 OFT Standard**: SHIELD is an Omnichain Fungible Token supporting cross-chain transfers between Flare (home chain), Base, Arbitrum, and Ethereum.
- **OFT Architecture**: ShieldOFTAdapter on Flare (locks/unlocks tokens), ShieldOFT on other chains (mints/burns).
- **Presale Contracts**: ShieldPresale.sol with 4 stages ($0.005-$0.02), vesting (20% TGE, 80% over 6 months), Merkle tree allowlist, KYC tiers.
- **ZapPresale**: Enables any-token purchases via DEX swaps (SparkDEX on Flare, Uniswap V3 on others). Skipped on testnets due to unverified DEX routers.
- **Deployment Scripts**: `scripts/presale/deploy-presale-testnets.ts` deploys to Coston2, Base Sepolia, Arbitrum Sepolia, Sepolia.
- **Peer Wiring**: `scripts/presale/wire-layerzero-peers.ts` connects OFT contracts across chains with fail-fast validation.
- **Frontend**: Presale page at `/app/presale` with countdown timer, price trajectory, multi-token selector, bridge UI, referral system (hidden from sidebar navigation).
- **Referral System**: 5% bonus for both referrer and referee.
- **KYC Tiers**: $1K limit without KYC, $50K with KYC verification.
- **Coston2 Testnet Deployment (Dec 2025)**:
  - ShieldOFTAdapter: `0x3E4A8f72c319ae72444316c87048104C0f79535A`
  - ShieldPresale: `0x72a81115F2af91e5766707ea4A8e499D269c15a0`
  - Payment Token (Mock USDC): `0x4Ba749c96F6B0c9AddF3a339eb7E79A5f92C7C39`
  - 4 presale stages configured (4M, 5M, 5M, 6M SHIELD) with allowlist disabled for testing.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRPL wallet integration.
- **Reown AppKit v2+**: EVM wallet connection (MetaMask, Trust Wallet, Rabby).
- **WalletConnect (XRPL)**: For other XRPL wallets.
- **XRP Ledger (XRPL)**: For real-time balance fetching.
- **Wagmi**: React hooks for Ethereum with Flare mainnet and Coston2 testnet support.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.
- **Shepherd.js**: Interactive guided tour library.

### Development & Deployment
- **Drizzle ORM**: Database schema management.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification.
- **SparkDEX V3**: Uniswap V2-compatible DEX on Flare Network for token swaps.
- **Luminite FSwap Widget**: Multi-chain bridge widget for cross-network asset transfers.

### Social Media & Community
- **Twitter API (twitter-api-v2)**: Automated thank-you tweets for xpert.page donations.
- **Xpert.page Webhook**: Donation notifications trigger automated tweets at `/api/webhooks/xpert-donation`.
- **Required Secrets**: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`, `XPERT_WEBHOOK_SECRET`.

### RWA & Tokenized Securities (Future Integration)
- **RWA.xyz Integration**: Planned for real-world asset data feeds.

---

## Documentation Links

| Topic | Document |
|-------|----------|
| Complete index | [docs/README.md](docs/README.md) |
| Tokenomics (50/40/10 split) | [docs/protocol/SHIELD_TOKENOMICS.md](docs/protocol/SHIELD_TOKENOMICS.md) |
| Revenue system | [docs/protocol/REVENUE_SYSTEM_SPEC.md](docs/protocol/REVENUE_SYSTEM_SPEC.md) |
| Vault specification | [docs/SHXRP_VAULT_SPECIFICATION.md](docs/SHXRP_VAULT_SPECIFICATION.md) |
| Staking boost | [docs/protocol/STAKING_BOOST_SPEC.md](docs/protocol/STAKING_BOOST_SPEC.md) |
| Contract deployment | [docs/protocol/SHIELD_DEPLOYMENT.md](docs/protocol/SHIELD_DEPLOYMENT.md) |
| FAssets bridge | [docs/integration/FASSETS_GUIDE.md](docs/integration/FASSETS_GUIDE.md) |
| Design system | [design_guidelines.md](design_guidelines.md) |

---

*Last Updated: December 2025*