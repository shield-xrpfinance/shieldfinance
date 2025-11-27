# Shield Finance Faucet

A testnet faucet application for Shield Finance on the Flare Coston2 network. Users can claim test SHIELD and wFLR tokens for development and testing purposes.

## Features

- **Wallet Connection**: ConnectKit integration with support for multiple wallets
- **Auto Network Switch**: Automatically prompts users to switch to Flare Coston2 testnet
- **Two Token Faucets**: Claim both test SHIELD and test wFLR tokens
- **Server-Side Token Distribution**: Secure backend API handles token transfers from faucet wallet
- **Rate Limiting**: Server-side rate limiting (1 claim per wallet/IP every 12 hours per token)
- **reCAPTCHA v3 Protection**: Invisible bot protection
- **Real-time Balance**: Shows current faucet balance on-chain
- **Transaction Status**: Loading states, success/error messages, and explorer links
- **Mobile Responsive**: Works on all device sizes
- **Dark Cyberpunk Theme**: Branded UI matching Shield Finance design

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **Wallet**: wagmi v2 + viem + ConnectKit
- **Blockchain**: viem for server-side transaction signing
- **Icons**: Lucide React

## Architecture

The faucet uses a server-side architecture where:

1. User connects their wallet and clicks "Claim"
2. Frontend sends request to `/api/claim` endpoint
3. Backend validates the request (captcha, rate limits)
4. Backend signs and sends the token transfer transaction using the faucet wallet
5. Transaction hash is returned to the frontend for display

This approach ensures:
- Users don't need gas to claim tokens
- The faucet wallet private key stays secure on the server
- Server-side rate limiting prevents abuse

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A wallet with C2FLR (for gas) and test tokens (SHIELD, wFLR)

### Installation

1. Clone the repository and navigate to the faucet directory:
```bash
cd faucet
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env.local
```

4. Update the `.env.local` with your values (see Configuration section below)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:5000](http://localhost:5000)

## Deployment

### Step 1: Create and Fund the Faucet Wallet

1. **Generate a new wallet** for the faucet (recommended to use a dedicated wallet):
   ```bash
   # You can use any wallet generator or create one programmatically
   # Store the private key securely - you'll need it for FAUCET_PRIVATE_KEY
   ```

2. **Fund the wallet with native gas tokens (C2FLR)**:
   - Go to the [Flare Coston2 Faucet](https://faucet.flare.network/coston2)
   - Request C2FLR tokens for your faucet wallet address
   - Recommended: At least 100 C2FLR for several hundred transactions

3. **Fund the wallet with test tokens**:
   - Transfer SHIELD tokens to the faucet wallet
   - Transfer wFLR tokens to the faucet wallet
   - Recommended amounts depend on your expected usage

### Step 2: Configure Environment Variables

```env
# Required: Faucet wallet private key (without 0x prefix is fine)
FAUCET_PRIVATE_KEY=your_private_key_here

# Required: Token contract addresses
NEXT_PUBLIC_SHIELD_ADDRESS=0x...your_shield_address
NEXT_PUBLIC_WFLR_ADDRESS=0x...your_wflr_address
NEXT_PUBLIC_FAUCET_ADDRESS=0x...your_faucet_wallet_address

# Optional but recommended: reCAPTCHA for bot protection
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key

# Optional: WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Step 3: Deploy

#### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Set the Root Directory to `faucet`
4. Add environment variables in Vercel dashboard:
   - **Important**: Add `FAUCET_PRIVATE_KEY` as an encrypted secret
5. Deploy

#### Manual Build

```bash
npm run build
npm start
```

## Configuration

### Network Configuration

The faucet is configured for **Flare Coston2 Testnet**:
- **Chain ID**: 114
- **RPC**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network
- **Native Token**: C2FLR (for gas fees)

### Gas Considerations

Each token claim transaction costs approximately:
- **Gas Limit**: ~65,000 gas
- **Gas Price**: Variable (check network conditions)
- **Estimated Cost**: ~0.001-0.01 C2FLR per transaction

Monitor your faucet wallet balance regularly to ensure:
1. Sufficient C2FLR for gas fees
2. Sufficient test tokens (SHIELD, wFLR) for distribution

### Token Distribution Amounts

Default claim amounts (configured in `lib/contracts.ts`):
- **SHIELD**: 1,000 tokens per claim
- **wFLR**: 100 tokens per claim

### Rate Limiting

Server-side rate limiting is implemented with:
- **Per-wallet limit**: 1 claim per token every 12 hours
- **Per-IP limit**: 1 claim per token every 12 hours
- **Storage**: In-memory (resets on server restart)

For production with multiple instances, consider implementing Redis-based rate limiting.

### reCAPTCHA Setup

1. Go to [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)
2. Create a new site with reCAPTCHA v3
3. Add your domain(s)
4. Copy the Site Key and Secret Key to your environment variables

If reCAPTCHA is not configured, the faucet will work without captcha verification.

## API Reference

### POST /api/claim

Claims tokens from the faucet.

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "tokenSymbol": "SHIELD" | "WFLR",
  "captchaToken": "optional_recaptcha_token"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "txHash": "0x...",
  "amount": "1000",
  "tokenSymbol": "SHIELD"
}
```

**Error Responses:**
- `400`: Invalid request (missing/invalid parameters)
- `403`: Captcha verification failed
- `429`: Rate limit exceeded
- `500`: Server error (faucet not configured)
- `503`: Insufficient faucet funds

## Project Structure

```
faucet/
├── app/
│   ├── api/
│   │   ├── claim/route.ts           # Token claim endpoint (server-side transfer)
│   │   └── verify-captcha/route.ts  # reCAPTCHA verification endpoint
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout with providers
│   └── page.tsx                      # Main faucet page
├── components/
│   ├── FaucetCard.tsx               # Token faucet card component
│   ├── Footer.tsx                   # Footer with community links
│   ├── Header.tsx                   # Header with wallet button
│   └── WalletProvider.tsx           # wagmi + ConnectKit provider
├── lib/
│   ├── chains.ts                    # Chain configuration
│   ├── contracts.ts                 # ABIs and contract addresses
│   ├── rateLimit.ts                 # Rate limiting (client + server)
│   └── wagmiConfig.ts               # wagmi configuration
├── .env.example                     # Environment template
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## Monitoring

### Faucet Wallet Health

Monitor the following for your faucet wallet:

1. **Gas Balance**: Ensure C2FLR balance > 10 for continued operation
2. **Token Balances**: Track SHIELD and wFLR balances
3. **Transaction Success Rate**: Monitor for failed transactions

### Logging

The server logs important events:
- Successful claims: wallet address, token, amount, transaction hash
- Errors: insufficient funds, rate limits, transaction failures

## Security Considerations

1. **Private Key Protection**: Never expose `FAUCET_PRIVATE_KEY` in client-side code
2. **Rate Limiting**: Both wallet-based and IP-based limits prevent abuse
3. **Captcha**: reCAPTCHA v3 prevents automated bot claims
4. **Input Validation**: All inputs are validated server-side

## Troubleshooting

### "Faucet not configured" Error
- Ensure `FAUCET_PRIVATE_KEY` is set in environment variables
- Restart the server after adding environment variables

### "Insufficient funds" Error
- Check faucet wallet balance for the requested token
- Fund the wallet with more test tokens

### "Rate limit exceeded" Error
- Wait for the cooldown period (12 hours)
- Rate limits apply per wallet AND per IP address

### Transactions Not Appearing
- Verify the correct network (Coston2) in block explorer
- Check that RPC endpoint is accessible

## Community Links

- **Main App**: [shyield.finance](https://shyield.finance)
- **X (Twitter)**: [@ShieldFinanceX](https://x.com/ShieldFinanceX)
- **Telegram Official**: [ShieldFinanceOfficial](https://t.me/ShieldFinanceOfficial)
- **Telegram Community**: [ShieldFinanceCommunity](https://t.me/ShieldFinanceCommunity)
- **Discord**: [Join Discord](https://discord.gg/Vzs3KbzU)
- **Documentation**: [GitBook Docs](https://shield-finance.gitbook.io/shield-finance-docs/)

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues, please open a GitHub issue or reach out on our community channels.
