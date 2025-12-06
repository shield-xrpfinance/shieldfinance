# Shield Finance Documentation

Welcome to the Shield Finance documentation. This is the primary entry point for all project documentation.

**[Read the Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf)** — Complete technical documentation covering protocol architecture, yield mechanics, and SHIELD tokenomics.

---

## Quick Navigation

| Goal | Document |
|------|----------|
| Understand the project | [Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf) |
| Review the codebase | [REVIEWERS.md](../REVIEWERS.md) |
| SHIELD tokenomics | [SHIELD_TOKENOMICS.md](protocol/SHIELD_TOKENOMICS.md) |
| Deploy contracts | [SHIELD_DEPLOYMENT.md](protocol/SHIELD_DEPLOYMENT.md) |
| FAssets bridge | [FASSETS_GUIDE.md](integration/FASSETS_GUIDE.md) |
| Revenue system | [REVENUE_SYSTEM_SPEC.md](protocol/REVENUE_SYSTEM_SPEC.md) |
| Staking boost | [STAKING_BOOST_SPEC.md](protocol/STAKING_BOOST_SPEC.md) |
| Vault specification | [SHXRP_VAULT_SPECIFICATION.md](SHXRP_VAULT_SPECIFICATION.md) |

---

## Documentation Structure

### Protocol (`/protocol`)
Core smart contract and tokenomics documentation.
- [SHIELD_TOKENOMICS.md](protocol/SHIELD_TOKENOMICS.md) - Token economics, revenue split (50/40/10)
- [SHIELD_DEPLOYMENT.md](protocol/SHIELD_DEPLOYMENT.md) - Contract deployment steps
- [STAKING_BOOST_SPEC.md](protocol/STAKING_BOOST_SPEC.md) - APY boost mechanics
- [REVENUE_SYSTEM_SPEC.md](protocol/REVENUE_SYSTEM_SPEC.md) - BuybackBurn & RevenueRouter
- [SHIELD_SECURITY_CHECKLIST.md](protocol/SHIELD_SECURITY_CHECKLIST.md) - Pre-audit checklist

### Integration (`/integration`)
External service integration guides.
- [FASSETS_GUIDE.md](integration/FASSETS_GUIDE.md) - XRP → FXRP bridging (canonical)
- [FIRELIGHT_INTEGRATION.md](integration/FIRELIGHT_INTEGRATION.md) - Yield strategies
- [LP_LOCKING_GUIDE.md](integration/LP_LOCKING_GUIDE.md) - Liquidity management

### Platform (`/platform`)
Application architecture and wallet integration.
- [SMART_ACCOUNTS_SPEC.md](platform/SMART_ACCOUNTS_SPEC.md) - ERC-4337 specification
- [wallet-integration.md](platform/wallet-integration.md) - Wallet connection
- [xaman-integration.md](platform/xaman-integration.md) - XRPL wallet
- [swap.md](platform/swap.md) - Multi-asset swap feature

### API (`/api`)
- [README.md](api/README.md) - API endpoint reference

### Legal (`/legal`)
- [Privacy Policy](legal/privacy-policy.md) | [Terms of Service](legal/terms-of-service.md) | [Cookie Policy](legal/cookie-policy.md)

---

## Key Resources

- **Live App:** [shyield.finance](https://shyield.finance)
- **Technical Overview:** [replit.md](../replit.md)
- **Design System:** [design_guidelines.md](../design_guidelines.md)
- **Full Index:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

---

*Last Updated: December 2025*
