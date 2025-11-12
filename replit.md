# XRP Liquid Staking Protocol Dashboard

## Overview
This project is a full-stack DeFi application providing a dashboard for XRP liquid staking. It enables users to manage cryptocurrency vaults, deposit assets, track positions, monitor real-time APY, and withdraw funds. The platform integrates smart contracts on Flare Network for its $SHIELD governance token and shXRP liquid staking vault, alongside XRPL Escrow for cross-chain asset locking. The vision is to enhance DeFi accessibility and efficiency on the XRP Ledger, capitalizing on the growing liquid staking market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Frameworks**: React 18 (TypeScript, Vite, Wouter, TanStack Query).
- **UI/UX**: shadcn/ui (Radix UI based), Tailwind CSS, Material Design, responsive design, custom theming.
- **State Management**: React Context API, TanStack Query, React hooks.

### Backend
- **Server**: Express.js (Node.js, TypeScript) with a RESTful API.
- **Data Validation**: Zod schemas.

### Data Storage
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.
- **Schema**: Includes `vaults`, `positions`, `transactions`, `vault_metrics_daily`, `withdrawal_requests`, `xrp_to_fxrp_bridges`, `firelight_positions`, `compounding_runs`.

### System Design
- **Separation of Concerns**: Monorepo structure with `/client`, `/server`, and `/shared` directories.
- **Smart Accounts**: Implemented ERC-4337 account abstraction using Etherspot Prime SDK for gasless transactions via paymaster sponsorship.
- **FAssets Bridge Reconciliation**: Automated and manual recovery systems for stuck/failed XRP to FXRP bridges.
- **Fee Disclosure**: Transparent fee system implemented for all deposits.

### Smart Contracts (Solidity on Flare Network)
- **Development Environment**: Hardhat.
- **Standards**: OpenZeppelin Contracts (ERC-20, access control).
- **Contracts**:
    - `ShXRPVault.sol`: ERC-4626 tokenized vault for shXRP.
    - `VaultController.sol`: Orchestrates vault operations, role-based access control.

### Security Features
- **Smart Contracts**: ERC-4626 standard, OpenZeppelin AccessControl, ReentrancyGuard.
- **Platform**: Minimum deposits, transparent accounting, double-mint prevention, idempotency, crash recovery.

## External Dependencies

### Blockchain & Wallet Integration
- **Xaman (XUMM)**: XRP wallet integration (`xumm-sdk`).
- **WalletConnect**: XRPL-compatible wallet connection (`@walletconnect/universal-provider`).
- **Web3Auth**: Social login for XRP wallet creation (`@web3auth/modal`).
- **XRP Ledger (XRPL)**: Real-time balance fetching (`xrpl` library).
- **QR Code Display**: `qrcode.react`.

### UI & Data Visualization
- **Recharts**: For APY trends and analytics.
- **Radix UI**: Headless UI component primitives.
- **Lucide React**: Icon library.

### Development & Deployment
- **Drizzle Kit**: For database migrations.
- **esbuild**: For production server bundling.
- **connect-pg-simple**: For PostgreSQL session store.
- **Hardhat Toolbox**: Smart contract development tools.

### Blockchain Protocols
- **FAssets Integration**: For bridging XRP to FXRP on Flare Network, dynamic AssetManager address resolution, FDC Attestation for payment proof generation.
- **Firelight.finance Integration**: For generating yield on FXRP deposits.
- **Flare Data Connector (FDC)**: Cross-chain data verification protocol for attestation submission and proof generation.
    - **Data Availability API**: `ctn2-data-availability.flare.network` (Coston2), `flr-data-availability.flare.network` (mainnet).
    - **Verifier Service**: `fdc-verifiers-testnet.flare.network`.
    - **FdcHub Integration**: On-chain attestation submission workflow.
    - **Voting Round Calculation**: Uses Flare's official hardcoded constants (firstRoundStartTime=1658430000, roundDuration=90s) per official documentation at dev.flare.network/fdc/guides/fdc-by-hand/.

## Recent Changes (November 12, 2025)

### Fixed FXRP Integration Issues
1. **Dynamic FXRP Address Resolution**: Services now fetch correct FXRP token address (0x0b6A3645c240605887a5532109323A3E12273dc7) dynamically from AssetManager instead of using hardcoded wrong address (0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3).
2. **Optimistic Balance Tracking**: BridgeService now reads actual minted FXRP from Transfer event logs instead of assuming fxrpReceived = fxrpExpected.
3. **Decimal Formatting Updates**: Updated VaultService, YieldService, BridgeService, and all diagnostic scripts to use formatUnits/parseUnits with proper decimal precision.
4. **Vault Contract Fixes**: Fixed minDeposit parameter and redeployed ShXRPVault with dynamically-fetched FXRP address.

### Current Deployment Status
- **Smart Account**: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd (Etherspot Prime SDK ERC-4337)
- **ShXRPVault**: 0x1CE23bAEC4bb9709F827082d24a83d8Bc8865249 (redeployed with correct FXRP)
- **FXRP Token (Correct)**: 0x0b6A3645c240605887a5532109323A3E12273dc7
- **Smart Account Balance**: 145 FXRP, 70.67 CFLR

### Known Issues
- **Decimal Mismatch**: FXRP token on Coston2 reports 18 decimals on-chain via decimals() method, but AssetManager.assetMintingDecimals() returns 6. This creates a mismatch where:
  - Service layer formats values using 6 decimals (parseUnits(amount, 6))
  - Vault contract expects 18-decimal values (inherits from OpenZeppelin ERC4626)
  - Deposit transactions fail with "execution reverted" because amounts are 10^12 times too small
- **Root Cause**: Need to either (a) update service layer to use 18 decimals everywhere, or (b) override vault's convertToShares/convertToAssets to handle 6-decimal math
- **Impact**: XRP → FXRP bridging works successfully, but FXRP → shXRP vault deposits fail during gas estimation