# XRP Liquid Staking Protocol Dashboard

## Overview

This is a full-stack DeFi application for XRP liquid staking, built as a dashboard for managing cryptocurrency vaults with yield generation. Users can connect their XRP wallets (via Xaman or WalletConnect), deposit assets into various risk-tiered vaults, track their positions and rewards, and withdraw funds. The application provides real-time APY tracking, portfolio management, transaction history, and analytics for staking positions.

## Recent Changes (November 8, 2025)
- Created **Transactions page** (`/transactions`) with transaction history list, summary cards, and type filtering
- Created **Analytics page** (`/analytics`) with APY charts, TVL growth visualization, vault distribution, and key protocol metrics
- Both pages are fully accessible via sidebar navigation and rendering properly

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and dev server, providing fast HMR (Hot Module Replacement)
- **Wouter** for client-side routing (lightweight React Router alternative)
- **TanStack Query (React Query)** for server state management, caching, and data fetching

**UI Component System**
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Material Design + DeFi patterns** (inspired by Aave, Curve, Uniswap) as documented in design guidelines
- Custom CSS variables for theming (light/dark mode support)
- Typography: Inter for UI, JetBrains Mono for monospace data (addresses, numbers)

**State Management**
- React Context API for wallet connection state (address, provider type, connection status)
- TanStack Query for server state (vaults, positions, transactions)
- Local component state with React hooks for UI interactions (modals, forms)

**Key Design Decisions**
- Responsive layout with collapsible sidebar (280px desktop, drawer on mobile)
- 12-column grid system for dashboard layouts
- Consistent spacing using Tailwind units (2, 4, 6, 8, 12, 16)
- Hover and active elevation effects for interactive elements
- Toast notifications for user feedback

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript running on Node.js
- RESTful API design for vault and position management
- Custom middleware for request logging and response timing

**API Structure**
- `GET /api/vaults` - Retrieve all available staking vaults
- `GET /api/vaults/:id` - Get specific vault details
- `GET /api/positions` - Fetch user's staking positions
- `POST /api/positions` - Create new staking position (deposit)
- Additional endpoints for withdrawals and claims

**Data Validation**
- **Zod** schemas for runtime type validation
- **drizzle-zod** integration for database schema validation
- Request body validation on API endpoints

### Data Storage

**Database Solution**
- **PostgreSQL** via Neon serverless database
- **Drizzle ORM** for type-safe database queries and schema management
- WebSocket connection pooling with `@neondatabase/serverless`

**Database Schema**
- **vaults table**: Stores vault configurations (APY, TVL, liquidity, lock periods, risk levels)
- **positions table**: Tracks user deposits with foreign key to vaults, amounts, rewards, and timestamps
- UUID primary keys with auto-generation
- Decimal precision for financial data (18,2 for amounts; 5,2 for percentages)

**Data Initialization**
- Seed data for 6+ pre-configured vaults with varying risk/reward profiles
- Mock data generation for development and testing

### External Dependencies

**Blockchain & Wallet Integration**
- **Xaman (formerly XUMM)** - XRP wallet integration with QR code signing flow
  - Backend API (`/api/wallet/xaman/payload`) creates Xaman SignIn payloads securely using `xumm-sdk`
  - Frontend displays QR codes from backend payload URLs
  - Polling mechanism (`/api/wallet/xaman/payload/:uuid`) checks for user signature confirmation
  - Uses `payload.meta.signed` to detect successful wallet signatures
  - Requires `XUMM_API_KEY` and `XUMM_API_SECRET` backend environment variables
  - Falls back to demo mode with mock payload when credentials not configured
- **WalletConnect** - Multi-wallet connection protocol with QR code support
  - Client-side integration using `@walletconnect/ethereum-provider` and `@walletconnect/modal`
  - Shows QR code URI for scanning with any compatible wallet
  - Requires `VITE_WALLETCONNECT_PROJECT_ID` frontend environment variable
  - Falls back to demo mode when project ID not configured
- **XRP Ledger Balance Fetching** - Real-time wallet balance integration
  - Backend API (`/api/wallet/balance/:address`) fetches live balances from XRP Ledger mainnet
  - Uses `xrpl` library with `wss://xrplcluster.com` WebSocket connection
  - Converts balance from drops to XRP (1 XRP = 1,000,000 drops)
  - Calculates USD equivalent using XRP price (configurable, currently $2.45)
  - Frontend hook (`useWalletBalance`) caches balance with 30-second auto-refresh
  - Displays real balance in both header and sidebar when wallet connected
  - Shows loading states and error handling for unfunded/invalid accounts
- **QR Code Display** - Uses `qrcode.react` library for generating scannable QR codes
- **Demo Mode** - When API keys are not configured, both wallets fall back to mock connections:
  - Xaman: Backend returns demo payload with uuid="demo-payload-uuid", immediately signs with mock account
  - WalletConnect: Frontend generates mock URI and connects with demo address
  - Allows full testing without external wallet setup

**UI & Data Visualization**
- **Recharts** - Chart library for APY historical trends and analytics
- **Radix UI** - Headless UI component primitives (dialogs, dropdowns, tooltips, etc.)
- **Lucide React** - Icon library

**Development & Deployment**
- **Replit-specific plugins**: Runtime error overlay, cartographer, dev banner
- **Drizzle Kit** for database migrations
- **esbuild** for production server bundling
- Session management via `connect-pg-simple` (PostgreSQL session store)

**Fonts**
- Google Fonts CDN: Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter

**Key Architectural Decisions**
- Separation of concerns: `/client` (frontend), `/server` (backend), `/shared` (shared types/schemas)
- Path aliases for clean imports: `@/` for client code, `@shared/` for shared code
- Environment variable validation (DATABASE_URL required)
- Static file serving in production, Vite middleware in development
- CORS and session handling built into Express middleware stack

## Configuration

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `SESSION_SECRET` - Session encryption key (auto-configured by Replit)

**Optional Environment Variables (for production wallet connections):**
- `VITE_XUMM_API_KEY` - Xaman (XUMM) API key from https://apps.xumm.dev/
- `VITE_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID from https://cloud.walletconnect.com/

Without optional keys, wallet connections will use demo mode for testing.