# Documentation Index

Complete guide to all documentation files in the Shield Finance XRP Liquid Staking Protocol.

---

## Whitepaper

**[Read the Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf)** — Complete technical documentation covering the protocol architecture, yield mechanics, and SHIELD tokenomics.

---

## Quick Start

| If you want to... | Start here |
|-------------------|------------|
| Read the whitepaper | [Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf) |
| Review the project | [REVIEWERS.md](../REVIEWERS.md) |
| Understand tokenomics | [docs/protocol/SHIELD_TOKENOMICS.md](protocol/SHIELD_TOKENOMICS.md) |
| Deploy contracts | [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) |
| Understand FAssets bridge | [docs/integration/FASSETS_GUIDE.md](integration/FASSETS_GUIDE.md) |
| Build UI components | [design_guidelines.md](../design_guidelines.md) |

---

## Documentation Structure

```
docs/
├── whitepaper/         # Official whitepaper
│   └── main.tex                  # LaTeX source (PDF at shyield.finance/whitepaper.pdf)
│
├── protocol/           # Token & smart contract documentation
│   ├── SHIELD_TOKENOMICS.md      # Token economics & distribution
│   ├── SHIELD_DEPLOYMENT.md      # Contract deployment guide
│   ├── SHIELD_SECURITY_CHECKLIST.md  # Pre-deployment security
│   ├── STAKING_BOOST_SPEC.md     # SHIELD staking for APY boost
│   └── REVENUE_SYSTEM_SPEC.md    # BuybackBurn & RevenueRouter
│
├── integration/        # External service integrations
│   ├── FASSETS_GUIDE.md              # XRP → FXRP bridging (canonical)
│   ├── FIRELIGHT_INTEGRATION.md      # Yield generation + testnet simulation
│   └── LP_LOCKING_GUIDE.md           # Liquidity pool locking
│
├── partners/           # Partner-facing documentation
│   └── FIRELIGHT_PARTNER_GUIDE.md    # Firelight team integration guide
│
├── platform/           # Application architecture
│   ├── SMART_ACCOUNTS_SPEC.md    # ERC-4337 specification
│   ├── swap.md                   # Multi-asset swap feature
│   ├── wallet-integration.md     # Wallet connection guide
│   ├── transaction-signing.md    # Signing flows
│   └── xaman-integration.md      # Xaman wallet details
│
├── api/                # API documentation
│   └── README.md
│
└── operations/         # Operational guides (future)
```

---

## Protocol Documentation

### [Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf)
**Purpose**: Complete technical documentation for Shield Finance  
**Contents**:
- Protocol architecture and user flow
- Yield boost mechanics with mathematical formulas
- Synthetix-style reward accumulator specification
- SHIELD tokenomics and revenue distribution
- Smart contract architecture diagrams

### [SHIELD_TOKENOMICS.md](protocol/SHIELD_TOKENOMICS.md)
**Purpose**: Complete $SHIELD token economics and distribution  
**Contents**:
- 10M total supply breakdown (11 categories)
- Buyback & burn mechanism (50% of revenue)
- Staking boost system (1% APY per 100 SHIELD)
- Vesting schedules and unlock timelines

### [SHIELD_DEPLOYMENT.md](protocol/SHIELD_DEPLOYMENT.md)
**Purpose**: Smart contract deployment guide  
**Contents**:
- Deployed contract addresses (Coston2 testnet)
- Step-by-step deployment process
- Post-deployment verification
- LP locking and airdrop funding

### [SHIELD_SECURITY_CHECKLIST.md](protocol/SHIELD_SECURITY_CHECKLIST.md)
**Purpose**: Security audit and deployment checklist  
**Contents**:
- Pre-deployment security review
- Access control verification
- Operational security guidelines
- Emergency procedures

### [STAKING_BOOST_SPEC.md](protocol/STAKING_BOOST_SPEC.md)
**Purpose**: Complete technical specification for SHIELD staking yield boost  
**Contents**:
- Synthetix-style reward accumulator math
- Pro-rata distribution formula
- StakingBoost ↔ ShXRPVault integration
- Circular dependency deployment solution
- Security considerations and test coverage

### [REVENUE_SYSTEM_SPEC.md](protocol/REVENUE_SYSTEM_SPEC.md)
**Purpose**: Technical specification for revenue distribution contracts  
**Contents**:
- BuybackBurn contract (wFLR → SHIELD burn)
- RevenueRouter contract (FXRP → burn + boost + reserves)
- SafeERC20 forceApprove security patterns
- Slippage protection with price tracking
- Allowance clearing for security
- 51 comprehensive tests (21 + 30)

---

## Dashboard Features

### Dashboard Enhancements (v2.2.0)
**Purpose**: Real-time portfolio analytics and notification system  
**Components**:
- **PortfolioSummaryCard**: Total assets, staked amounts, rewards, SHIELD boost contribution
- **PortfolioPerformanceChart**: Historical visualization with 7D/30D/90D selectors
- **BoostImpactBanner**: Base vs boosted APY comparison with delta indicator
- **NotificationCenter**: Persistent bell icon with categorized notifications

**API Endpoints**:
- `GET /api/user/dashboard-summary` - Aggregated portfolio data
- `GET /api/user/portfolio-history` - Historical snapshots
- `GET /api/user/notifications` - Paginated notifications
- `PATCH /api/user/notifications/:id/read` - Mark as read

**Notification Triggers**:
- Deposit completion (vault_minted status)
- Withdrawal completion (userStatus = completed)
- Staking operations (stake/unstake SHIELD)
- Reward claims

---

## Integration Documentation

### [FASSETS_GUIDE.md](integration/FASSETS_GUIDE.md)
**Purpose**: XRP → FXRP bridging via FAssets protocol (canonical guide)  
**Contents**:
- FAssets protocol overview
- Contract addresses (mainnet + testnet)
- Collateral reservation and minting flow
- FDC proof generation and redemption
- Integration best practices

### [FIRELIGHT_INTEGRATION.md](integration/FIRELIGHT_INTEGRATION.md)
**Purpose**: Yield generation strategy integration  
**Contents**:
- Firelight.finance protocol overview
- FXRP deposit strategies
- Yield optimization
- Compounding automation
- Testnet simulation with MockStrategy

---

## Partner Documentation

### [FIRELIGHT_PARTNER_GUIDE.md](partners/FIRELIGHT_PARTNER_GUIDE.md)
**Purpose**: Technical documentation for Firelight team partnership  
**Audience**: Firelight.finance team, integration partners  
**Contents**:
- FirelightStrategy.sol contract architecture
- Technical integration points (ERC-4626)
- Security measures and access control
- Expected TVL contribution and mutual benefits
- Testnet validation results
- Mainnet deployment plan


### [LP_LOCKING_GUIDE.md](integration/LP_LOCKING_GUIDE.md)
**Purpose**: Liquidity pool token locking  
**Contents**:
- SparkDEX V3 LP creation
- Team Finance locking process
- NFT position management

---

## Platform Documentation

### [SMART_ACCOUNTS_SPEC.md](platform/SMART_ACCOUNTS_SPEC.md)
**Purpose**: ERC-4337 account abstraction specification  
**Contents**:
- Smart account architecture
- XRPL-triggered Flare transactions
- Proxy account system
- Coming December 2025 features

### [swap.md](platform/swap.md)
**Purpose**: Multi-asset swap feature documentation  
**Contents**:
- Token swapping overview
- SparkDEX V3 integration
- Approval and routing logic
- Troubleshooting guide

### [wallet-integration.md](platform/wallet-integration.md)
**Purpose**: Wallet connection and management  
**Contents**:
- Xaman (XRPL) integration
- WalletConnect (EVM) integration
- Dual wallet support

### [transaction-signing.md](platform/transaction-signing.md)
**Purpose**: Transaction signing flows  
**Contents**:
- XRPL transaction signing
- EVM transaction signing
- Smart account operations

### [xaman-integration.md](platform/xaman-integration.md)
**Purpose**: Xaman wallet specific details  
**Contents**:
- Xaman SDK integration
- QR code signing flow
- Mobile deep linking

---

## Root-Level Documentation

### [REVIEWERS.md](../REVIEWERS.md)
**Purpose**: Executive summary for research teams and auditors  
**Audience**: External reviewers, research teams, auditors

### [README.md](../README.md)
**Purpose**: Main project documentation and getting started  
**Audience**: Developers, contributors, users

### [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
**Purpose**: Quick deployment reference with contract addresses  
**Audience**: DevOps, developers deploying to testnet/mainnet

### [SMART_ACCOUNTS.md](../SMART_ACCOUNTS.md)
**Purpose**: ERC-4337 implementation guide (Etherspot Prime SDK)  
**Audience**: Backend developers, blockchain engineers

### [MONITORING_GUIDE.md](../MONITORING_GUIDE.md)
**Purpose**: Testnet monitoring and alerting system with real-time metrics  
**Contents**:
- Real-time 24-hour sliding window metrics for operational health
- Bridge failure rate tracking (excludes cancelled, only counts actual failures)
- On-chain event monitoring (OpenZeppelin Monitor-style)
- Prometheus metrics export for Grafana integration
- Alert conditions and webhook configuration
**Audience**: Operations, DevOps

### [design_guidelines.md](../design_guidelines.md)
**Purpose**: UI/UX design system specifications  
**Audience**: Frontend developers, designers

### [replit.md](../replit.md)
**Purpose**: Technical architecture and system design  
**Audience**: Developers, architects

### [CHANGELOG.md](../CHANGELOG.md)
**Purpose**: Project history and version tracking  
**Audience**: All team members

---

## Documentation by Use Case

### For Research Teams / Auditors
1. [Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf) - Complete technical documentation
2. [REVIEWERS.md](../REVIEWERS.md) - Executive summary
3. [docs/protocol/SHIELD_TOKENOMICS.md](protocol/SHIELD_TOKENOMICS.md) - Token economics
4. [docs/protocol/SHIELD_SECURITY_CHECKLIST.md](protocol/SHIELD_SECURITY_CHECKLIST.md) - Security review
5. Contract source code in `/contracts`

### For Smart Contract Developers
1. [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Contract addresses
2. [docs/protocol/SHIELD_DEPLOYMENT.md](protocol/SHIELD_DEPLOYMENT.md) - Deployment steps
3. [SMART_ACCOUNTS.md](../SMART_ACCOUNTS.md) - ERC-4337 implementation

### For Integration Engineers
1. [docs/integration/FASSETS_GUIDE.md](integration/FASSETS_GUIDE.md) - Bridge integration
2. [docs/integration/FIRELIGHT_INTEGRATION.md](integration/FIRELIGHT_INTEGRATION.md) - Yield strategies
3. [replit.md](../replit.md) - System architecture

### For Frontend Developers
1. [design_guidelines.md](../design_guidelines.md) - Design system
2. [docs/platform/swap.md](platform/swap.md) - Swap feature
3. [docs/platform/wallet-integration.md](platform/wallet-integration.md) - Wallet UX

---

## Scripts Reference

Essential operational scripts are in `/scripts`:

| Script | Purpose |
|--------|---------|
| `deploy-shield-10m.ts` | Main SHIELD token deployment |
| `deploy-all-contracts-10m.ts` | Full contract suite deployment |
| `fund-merkle-distributor.ts` | Fund airdrop contract |
| `generate-merkle-tree.ts` | Generate airdrop merkle tree |
| `sparkdex-lp.ts` | Create SparkDEX liquidity pool |
| `compound.ts` | Vault compounding operations |
| `burn.ts` | Manual SHIELD token burn |

Archived diagnostic scripts are in `/scripts/archive`.

---

Last Updated: December 6, 2025
