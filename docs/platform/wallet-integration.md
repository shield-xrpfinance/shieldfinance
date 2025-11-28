# Wallet Integration

Shield Yield Vaults supports multiple wallet connection methods for maximum flexibility across both XRPL and EVM ecosystems.

## Supported Wallets

### XRPL Wallets

#### Xaman (XUMM) - Recommended

**Why Xaman?**
- Native XRP Ledger wallet
- QR code transaction signing (browser)
- **xApp integration** with auto-connect (in-app)
- Mobile and desktop support
- Best security for XRPL transactions

**Features:**
- Real-time balance fetching
- Transaction signing with QR codes or native xApp signing
- Network detection (mainnet/testnet)
- Deep linking support
- **Auto-connect when opened as xApp**
- **Auto-sign via `xumm.xapp.openSignRequest()`**

#### Other XRPL Wallets (via WalletConnect)

**Supported:**
- Bifrost Wallet
- GemWallet
- CrossMark
- Other WalletConnect-compatible XRPL wallets

### EVM Wallets (via Reown AppKit)

**Supported Wallets:**
- MetaMask
- Trust Wallet
- Rabby Wallet
- Rainbow Wallet
- And 100+ more

**Features:**
- Flare Network support (mainnet + Coston2 testnet)
- Dark-themed modal
- Session persistence
- Multi-chain switching

## Connection Flow

### Xaman Connection (Browser Mode)

1. User clicks "Connect Wallet"
2. Backend creates Xaman SignIn payload
3. QR code displayed in modal
4. User scans with Xaman app
5. User approves connection
6. Frontend polls for signature
7. Wallet address retrieved and stored

### Xaman Connection (xApp Mode) ✨

When Shield Finance is opened **inside Xaman wallet** as an xApp:

1. User opens Shield Finance xApp in Xaman
2. SDK automatically detects xApp context (JWT/OTT token)
3. **Auto-connect**: User account retrieved via `xumm.user.account`
4. **No QR scan needed** - wallet is instantly connected
5. `xumm.xapp.ready()` notifies Xaman to hide loader
6. Deposit transactions use native signing via `xumm.xapp.openSignRequest()`

> **Note:** Deposit flows use native xApp signing. Claim and withdrawal flows currently fall back to QR modal signing pending backend updates.

### EVM Connection (Reown AppKit)

1. User clicks "Connect Wallet"
2. Reown AppKit modal appears (dark theme)
3. User selects wallet provider
4. Approves connection in wallet
5. Address stored in frontend context
6. Network switched to Flare if needed

## Wallet Context

The application uses React Context API for wallet state management:

```typescript
interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  provider: 'xaman' | 'walletconnect' | null;
  connect: (provider: 'xaman' | 'walletconnect') => Promise<void>;
  disconnect: () => void;
  balances: {
    XRP: string;
    RLUSD: string;
    USDC: string;
  };
  refreshBalances: () => Promise<void>;
}
```

## Balance Fetching

### Real-Time XRPL Balance

The application fetches real wallet balances from XRPL:

- **XRP Balance**: Native account balance
- **RLUSD Balance**: Trust line balance for RLUSD issuer
- **USDC Balance**: Trust line balance for USDC issuer

### Auto-Refresh

Balances automatically refresh every 30 seconds when wallet is connected.

### Network-Specific Issuers

**Mainnet:**
- RLUSD: `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`
- USDC: `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE` (currency: USD)

**Testnet:**
- RLUSD: `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`

## Demo Mode

When Xaman API keys are not configured, the application falls back to demo mode:

- Mock wallet addresses
- Simulated transaction signing
- No real blockchain transactions
- Useful for UI testing and development

## Security Considerations

- **Never store private keys**: All signing happens in user's wallet
- **Transaction verification**: Every transaction shows details before signing
- **Network validation**: Ensures correct network for transactions
- **Session management**: Secure session storage with logout functionality
