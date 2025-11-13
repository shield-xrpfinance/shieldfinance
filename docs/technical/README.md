# Technical Architecture

Shield Yield Vaults is built with a modern, production-ready full-stack architecture.

## System Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   React SPA     │◄────►│  Express API    │◄────►│   PostgreSQL    │
│   (Frontend)    │      │   (Backend)     │      │   (Database)    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                        │
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  Xaman/Xumm SDK │      │   XRP Ledger    │
│  (Wallet Auth)  │      │   (Blockchain)  │
└─────────────────┘      └─────────────────┘
```

## Technology Stack

### Frontend
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type safety across the entire codebase
- **Vite**: Lightning-fast dev server and optimized production builds
- **Wouter**: Lightweight routing
- **TanStack Query v5**: Server state management with caching
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality component library built on Radix UI

### Backend
- **Express.js**: RESTful API server
- **Node.js**: JavaScript runtime
- **TypeScript**: Full type safety on backend
- **Drizzle ORM**: Type-safe database queries
- **Zod**: Runtime schema validation
- **PostgreSQL (Neon)**: Serverless database

### Blockchain Integration
- **xumm-sdk**: Xaman wallet integration for XRPL
- **xrpl**: XRP Ledger client library
- **@walletconnect/***: Multi-wallet support

## Architecture Patterns

### Separation of Concerns

```
/client          - Frontend React application
  /src/pages     - Page components
  /src/components - Reusable UI components
  /src/lib       - Utilities and contexts
  
/server          - Backend Express API
  /routes.ts     - API endpoints
  /storage.ts    - Database interface
  /db.ts         - Database connection
  
/shared          - Shared types and schemas
  /schema.ts     - Database schema and types
```

### Frontend Architecture

**State Management:**
- React Context for wallet state
- TanStack Query for server state
- Local state with useState/useReducer

**Data Flow:**
```
User Action → API Request → TanStack Query → Backend API
                                ↓
                         Cache Update
                                ↓
                        UI Re-render
```

### Backend Architecture

**Request Flow:**
```
HTTP Request → Route Handler → Validation (Zod) 
                                    ↓
                            Storage Interface
                                    ↓
                            Database (Drizzle)
                                    ↓
                            HTTP Response
```

### Database Schema

See [Database Schema](database.md) for detailed table structures.

**Key Tables:**
- `vaults` - Vault configurations
- `positions` - User positions
- `transactions` - Transaction history
- `vault_metrics_daily` - Historical analytics

## Security Architecture

### Authentication
- Wallet-based authentication (no passwords)
- Session management with Express sessions
- PostgreSQL session store

### Transaction Security
- All transactions signed in user's wallet
- No private key storage on server
- Transaction hash verification on blockchain
- Network isolation (mainnet/testnet)

### API Security
- Environment variable validation
- Request body validation with Zod
- CORS configuration
- Rate limiting (production)

## Deployment Architecture

### Development
- Replit development environment
- Hot module reloading
- Development database (PostgreSQL)
- Demo mode for testing without API keys

### Production
- Replit deployment platform
- Automatic TLS/HTTPS
- Production database (separate from dev)
- Environment variable management
- Health checks and monitoring

## Performance Optimizations

### Frontend
- Code splitting with React.lazy
- TanStack Query caching
- Optimistic updates
- Debounced search and filters
- Image optimization

### Backend
- Database connection pooling
- Prepared statements (Drizzle)
- Response caching headers
- Efficient query patterns

### Database
- Indexed columns for fast lookups
- Proper foreign key relationships
- Decimal precision for financial data
- Timestamps for audit trails

## Monitoring & Logging

### Development
- Console logging
- Hot reload notifications
- Error boundaries
- LSP diagnostics

### Production
- Application logs
- Error tracking
- Performance monitoring
- Database query logging

## Learn More

- [Frontend Stack](frontend.md)
- [Backend Stack](backend.md)
- [Database Schema](database.md)
- [Xaman Integration](xaman-integration.md)
