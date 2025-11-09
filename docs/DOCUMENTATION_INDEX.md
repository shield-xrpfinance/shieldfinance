# Documentation Index

Complete guide to all documentation files in the XRP Liquid Staking Protocol project.

## 📚 Main Documentation

### [README.md](../README.md)
**Purpose**: Main project documentation and getting started guide  
**Audience**: Developers, contributors, users  
**Contents**:
- Project overview and features
- Tech stack (frontend, backend, blockchain)
- Installation and setup instructions
- Environment variables reference
- Smart contracts overview
- Deployment guides (both application and blockchain)
- Security features
- Network support details
- Wallet integration details

**When to Read**: First-time setup, understanding project capabilities, quick reference

---

### [replit.md](../replit.md)
**Purpose**: Technical architecture and system design documentation  
**Audience**: Developers, architects, technical contributors  
**Contents**:
- Detailed system architecture
- Frontend/backend architecture specifications
- Data storage schemas
- External dependencies
- Blockchain infrastructure (smart contracts, deployment, XRPL escrow system)
- Complete deployment configuration
- Environment variables with examples
- Contract architecture workflow
- Security features (blockchain-specific)

**When to Read**: Understanding technical implementation, system design, architecture decisions

---

### [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
**Purpose**: Quick reference for deployment commands  
**Audience**: DevOps, developers deploying to testnet/mainnet  
**Contents**:
- Command summary (compile, deploy, verify)
- Environment variables required
- Testnet faucets
- Block explorers
- Quick troubleshooting table
- Next steps after deployment

**When to Read**: Deploying smart contracts, need quick command reference

---

### [design_guidelines.md](../design_guidelines.md)
**Purpose**: UI/UX design system and component specifications  
**Audience**: Frontend developers, designers  
**Contents**:
- Design approach and rationale
- Layout system and spacing primitives
- Typography hierarchy
- Component library specifications
- Chart and visualization guidelines
- Micro-interactions
- Responsive behavior
- Accessibility guidelines

**When to Read**: Building UI components, maintaining design consistency

---

### [CHANGELOG.md](../CHANGELOG.md)
**Purpose**: Project history and version tracking  
**Audience**: All team members, contributors  
**Contents**:
- Recent changes and additions
- Blockchain infrastructure additions
- New dependencies
- Environment variables added
- Security enhancements
- Cross-chain architecture details

**When to Read**: Understanding recent changes, tracking feature additions

---

## 🔧 Configuration Files

### [.env.example](../.env.example)
**Purpose**: Environment variables template  
**Contents**:
- Wallet integration credentials (Xaman, WalletConnect, Web3Auth)
- Blockchain deployment variables (Flare, XRPL)
- Database connection strings
- All required and optional environment variables with descriptions

**When to Use**: Setting up local development, deploying to production

---

## 🚀 Deployment Documentation

### Application Deployment
See **README.md** → "Deployment (Application)" section
- Replit-specific deployment
- Publishing process
- Custom domain configuration

### Blockchain Deployment
See **README.md** → "How to Deploy to Testnet" section  
See **DEPLOYMENT_GUIDE.md** for quick command reference

**Key Resources**:
- Flare Coston2 Testnet Faucet: https://faucet.flare.network/coston2
- XRPL Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html
- Block Explorers listed in DEPLOYMENT_GUIDE.md

---

## 📖 Smart Contract Documentation

### ShieldToken.sol
- **File**: `contracts/ShieldToken.sol`
- **Type**: ERC-20 governance token
- **Documentation**: See README.md → "Smart Contracts" section

### Shield XRP Vault.sol
- **File**: `contracts/Shield XRP Vault.sol`
- **Type**: Liquid staking vault
- **Documentation**: See README.md → "Smart Contracts" section

### XRPL Escrow System
- **Type**: Standard XRPL escrow transactions (EscrowCreate, EscrowFinish, EscrowCancel)
- **Purpose**: Secure XRP deposits and withdrawals
- **Documentation**: See replit.md → "XRPL Escrow System" section

---

## 🗂️ Documentation by Use Case

### "I'm new to the project"
1. Start with **README.md** - Overview and features
2. Read **replit.md** - Technical architecture
3. Review **design_guidelines.md** - UI/UX standards

### "I want to deploy smart contracts"
1. **DEPLOYMENT_GUIDE.md** - Quick command reference
2. **README.md** → "How to Deploy to Testnet"
3. **.env.example** - Required environment variables

### "I'm building UI components"
1. **design_guidelines.md** - Design system
2. **README.md** → "Tech Stack" - Frontend frameworks

### "I need to understand the architecture"
1. **replit.md** - Complete technical architecture
2. **README.md** → "Project Structure"
3. **CHANGELOG.md** - Recent architectural changes

### "I'm troubleshooting deployment"
1. **DEPLOYMENT_GUIDE.md** → "Troubleshooting"
2. **README.md** → "How to Deploy to Testnet"
3. Check environment variables in **.env.example**

---

## 🔄 Keeping Documentation Updated

When making changes to the project:

1. **Code Changes**: Update technical details in `replit.md`
2. **New Features**: Update `README.md` features section and `CHANGELOG.md`
3. **Deployment Changes**: Update `DEPLOYMENT_GUIDE.md` and deployment sections in `README.md`
4. **UI Changes**: Update `design_guidelines.md`
5. **Environment Variables**: Update `.env.example` and environment sections in `README.md`

---

## 📝 Documentation Standards

All documentation should:
- Use clear, simple language
- Include code examples where applicable
- Link to related documentation
- Stay up-to-date with codebase
- Include both conceptual and practical information

---

Last Updated: 2024-11-09
