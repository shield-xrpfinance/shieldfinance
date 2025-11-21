# SparkDEX V3 Liquidity Deployment Script

## Overview

This directory contains a comprehensive Hardhat deployment script for adding initial liquidity to SparkDEX V3 (Uniswap V3 fork) on Flare mainnet for the Shield Finance ($SHIELD) fair launch.

## Files

- **sparkdex-lp.ts** - Main deployment script for adding liquidity
- **README_SPARKDEX_LP.md** - This file

## Prerequisites

### 1. Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Required
DEPLOYER_PRIVATE_KEY=your_private_key_here
SHIELD_TOKEN_ADDRESS=0x...  # From ShieldToken deployment

# Optional (defaults provided)
FLARE_MAINNET_RPC_URL=https://flare-api.flare.network/ext/C/rpc
```

### 2. Token Balances Required

Before running the script, ensure your deployer wallet has:

- **535,451 wFLR** (wrapped FLR)
- **1,000,000 SHIELD** tokens
- **~10 FLR** for gas fees

### 3. Get wFLR

If you have FLR but need wFLR:

```bash
# Option 1: Using Hardhat console
npx hardhat console --network flare

# In console:
const wflr = await ethers.getContractAt(
  "IWFLR",
  "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d"
);
await wflr.deposit({ value: ethers.parseEther("535451") });

# Option 2: Send FLR to wFLR contract directly
# Send to: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
```

## Usage

### Quick Start

```bash
# 1. Set environment variables
export DEPLOYER_PRIVATE_KEY="your_private_key"
export SHIELD_TOKEN_ADDRESS="0x..."  # Your deployed SHIELD token

# 2. Run deployment script
npx hardhat run scripts/sparkdex-lp.ts --network flare
```

### Detailed Steps

#### Step 1: Deploy ShieldToken (if not already done)

```bash
npx hardhat run scripts/deploy-flare.ts --network flare
```

Note the SHIELD token address from the output.

#### Step 2: Set Environment Variables

```bash
export SHIELD_TOKEN_ADDRESS="0x..."  # From Step 1
```

#### Step 3: Verify Balances

```bash
# Check wFLR balance
npx hardhat console --network flare
> const wflr = await ethers.getContractAt("IERC20", "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d");
> const [signer] = await ethers.getSigners();
> const balance = await wflr.balanceOf(signer.address);
> console.log("wFLR:", ethers.formatEther(balance));

# Check SHIELD balance
> const shield = await ethers.getContractAt("IERC20", process.env.SHIELD_TOKEN_ADDRESS);
> const shieldBal = await shield.balanceOf(signer.address);
> console.log("SHIELD:", ethers.formatEther(shieldBal));
```

#### Step 4: Run Deployment

```bash
npx hardhat run scripts/sparkdex-lp.ts --network flare
```

#### Step 5: Verify and Lock LP

See `docs/LP_LOCKING_GUIDE.md` for detailed locking instructions.

## What the Script Does

### Automated Steps

1. **Validates Configuration**
   - Checks SHIELD_TOKEN_ADDRESS is set
   - Displays all configuration parameters

2. **Connects to Contracts**
   - wFLR token at `0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d`
   - SHIELD token at your deployed address
   - SparkDEX Position Manager at `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da`

3. **Verifies Balances**
   - Checks deployer has sufficient wFLR (535,451)
   - Checks deployer has sufficient SHIELD (1,000,000)
   - Exits with error if insufficient

4. **Sorts Tokens**
   - Uniswap V3 requires token0 < token1 (by address)
   - Automatically handles token ordering

5. **Calculates Uniswap V3 Parameters**
   - **sqrtPriceX96**: Initial pool price in Uniswap V3 format
   - **Center Tick**: Current price tick
   - **Tick Bounds**: Wide range (±100%) for stability
   - All math uses BigInt for precision

6. **Approves Tokens**
   - Approves wFLR for Position Manager
   - Approves SHIELD for Position Manager
   - Skips if already approved

7. **Creates Pool**
   - Creates wFLR/SHIELD pool if doesn't exist
   - Initializes with calculated sqrtPriceX96
   - Skips if pool already exists

8. **Mints LP Position**
   - Adds liquidity to pool
   - Receives LP NFT representing position
   - Extracts token ID from transaction logs

9. **Saves Deployment Info**
   - Creates JSON file in `deployments/` directory
   - Includes all addresses, parameters, and transactions
   - Timestamped for record-keeping

10. **Displays Summary**
    - Pool address
    - LP NFT token ID
    - Useful links (SparkDEX, block explorer)
    - Next steps for locking

### Manual Steps Required

After script completion, you MUST:

1. **Lock LP NFT for 12 months**
   - See `docs/LP_LOCKING_GUIDE.md`
   - Recommended: Team Finance or custom timelock
   - Essential for fair launch credibility

2. **Verify on Block Explorer**
   - Check pool creation: https://flarescan.com/
   - Verify LP NFT ownership
   - Screenshot for community

3. **Announce to Community**
   - Share lock proof
   - Provide block explorer links
   - Build trust and transparency

## Script Output Example

```
================================================================================
🚀 SparkDEX V3 Liquidity Deployment - Shield Finance Fair Launch
================================================================================

📋 Configuration:
   Network: flare
   Chain ID: 14
   wFLR Address: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d
   SHIELD Address: 0x...
   SparkDEX Position Manager: 0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da
   Liquidity: 535451.0 wFLR + 1000000.0 SHIELD
   Fee Tier: 0.3 %
   Price Range: ±100%

👤 Deployer: 0x...
💰 FLR Balance: 100.0 FLR

🔗 Connecting to token contracts...

💰 Checking token balances...
   wFLR Balance: 535451.0 wFLR
   SHIELD Balance: 1000000.0 SHIELD
✅ Sufficient balances confirmed

🔀 Sorting tokens for Uniswap V3...
   Token0: 0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d (wFLR)
   Token1: 0x... (SHIELD)
   Amount0: 535451.0
   Amount1: 1000000.0

🧮 Calculating Uniswap V3 price parameters...
   sqrtPriceX96: ...
   Center Tick: ...
   Tick Lower: ...
   Tick Upper: ...
   Tick Range: ... ticks
   Price Range: [ ... , ... ]

✅ Approving tokens for NonfungiblePositionManager...
   ✅ wFLR approved
   ✅ SHIELD approved

🔗 Connecting to NonfungiblePositionManager...

🏊 Creating/initializing pool...
   ✅ Pool created/initialized
   Transaction: 0x...

💎 Minting LP position NFT...
   Minting position...
   ✅ Position minted!
   Transaction: 0x...

🔍 Extracting LP NFT token ID...
   ✅ LP NFT Token ID: 12345
   Owner: 0x...

🏊 Getting pool address...
   Pool Address: 0x...

💾 Saving deployment info...
   ✅ Saved to: deployments/sparkdex-lp-2025-11-21T12-00-00-000Z.json

================================================================================
✅ LP DEPLOYMENT COMPLETE!
================================================================================

📊 SUMMARY:
   Pool Address: 0x...
   LP NFT Token ID: 12345
   Initial Liquidity:
      - 535451.0 wFLR
      - 1000000.0 SHIELD
   Estimated Value: ~$10,000 USD

🔗 Useful Links:
   Pool on SparkDEX: https://sparkdex.ai/pool/0x...
   Pool Explorer: https://flarescan.com/address/0x...
   LP NFT Explorer: https://flarescan.com/token/0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da?a=12345

⚠️  CRITICAL NEXT STEP: LOCK LP TOKENS FOR 12 MONTHS
================================================================================

🔒 LP Locking Options:

1. Team Finance (Recommended):
   - Website: https://www.team.finance/
   - Check if Flare mainnet is supported
   - Lock NFT token ID: 12345
   - Duration: 365 days (12 months)

2. Unicrypt:
   - Website: https://www.uncx.network/
   - Check Flare mainnet support

3. Custom Timelock Contract:
   - Deploy ERC721 timelock contract
   - Transfer NFT to timelock
   - Set unlock time to: 31536000 seconds from now

4. Gnosis Safe:
   - Create multi-sig wallet
   - Transfer NFT to safe
   - Implement timelock via safe modules

📝 Manual Steps:
   1. Choose a locking mechanism from above
   2. Transfer LP NFT (token ID: 12345) to locker
   3. Set lock duration to 365 days
   4. Verify lock on block explorer
   5. Announce lock to community (proof of commitment)

⚠️  WARNING: DO NOT SKIP LP LOCKING!
   Locked liquidity is essential for:
   - Building community trust
   - Preventing rug pulls
   - Meeting fair launch standards
   - Exchange listings (many require locked LP)

================================================================================
✅ Deployment script complete!
================================================================================
```

## Configuration Details

### SparkDEX V3 Contracts (Flare Mainnet)

All verified on https://flarescan.com/

| Contract | Address | Purpose |
|----------|---------|---------|
| V3Factory | `0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652` | Creates pools |
| NonfungiblePositionManager | `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da` | Manages LP NFTs |
| UniversalRouter | `0x0f3D8a38D4c74afBebc2c42695642f0e3acb15D3` | Swap router |
| SwapRouter | `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781` | Alternative router |

### Token Addresses (Flare Mainnet)

| Token | Address |
|-------|---------|
| wFLR (Wrapped FLR) | `0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d` |
| SHIELD | Set via `SHIELD_TOKEN_ADDRESS` env var |

### Liquidity Parameters

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| wFLR Amount | 535,451 | Approximately $10K at $0.01868/wFLR |
| SHIELD Amount | 1,000,000 | Target liquidity amount |
| Initial Price | $0.01/SHIELD | Fair launch price |
| Fee Tier | 0.3% (3000) | Standard Uniswap V3 tier |
| Tick Spacing | 60 | For 0.3% fee tier |
| Price Range | ±100% | Wide range for stability |

### Uniswap V3 Math Explained

#### sqrtPriceX96

Uniswap V3 stores price as `sqrtPriceX96`:

```
sqrtPriceX96 = sqrt(price) × 2^96
price = amount1 / amount0
```

For our pool:
```
price = 1,000,000 SHIELD / 535,451 wFLR = 1.868 SHIELD per wFLR
sqrtPriceX96 = sqrt(1.868) × 2^96
```

#### Ticks

Ticks represent price levels:

```
tick = floor(log_1.0001(price))
price = 1.0001^tick
```

Price changes by 0.01% per tick.

#### Tick Spacing

For 0.3% fee tier, tick spacing = 60:
- Liquidity can only be added at ticks divisible by 60
- Ensures minimum price granularity

#### Price Range

We use ±100% range:
- **Lower bound**: 50% of initial price
- **Upper bound**: 200% of initial price
- Provides room for price discovery during launch

## Troubleshooting

### "Insufficient wFLR balance"

**Solution**: Wrap FLR to wFLR

```bash
npx hardhat console --network flare

# In console:
const wflr = await ethers.getContractAt("IWFLR", "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d");
const [signer] = await ethers.getSigners();
await wflr.deposit({ value: ethers.parseEther("535451") });
```

### "Insufficient SHIELD balance"

**Solution**: Transfer SHIELD from treasury

```bash
npx hardhat console --network flare

# In console:
const shield = await ethers.getContractAt("IERC20", process.env.SHIELD_TOKEN_ADDRESS);
const [signer] = await ethers.getSigners();
const balance = await shield.balanceOf(signer.address);
console.log("Your SHIELD:", ethers.formatEther(balance));
```

If balance is 0, check that you deployed ShieldToken and it minted tokens to your address.

### "SHIELD_TOKEN_ADDRESS not set"

**Solution**: Set environment variable

```bash
export SHIELD_TOKEN_ADDRESS="0x..."
```

Or add to `.env` file:
```
SHIELD_TOKEN_ADDRESS=0x...
```

### "Pool already initialized"

**Solution**: This is normal! The script will continue and add liquidity to existing pool.

### "Cannot extract token ID"

**Solution**: Manually check the transaction on block explorer:

1. Go to https://flarescan.com/
2. Search for transaction hash (shown in output)
3. Look for Transfer event on NFT contract
4. Token ID is in the event data

## Security Considerations

### Before Running

1. **Audit wallet**: Ensure no unauthorized transactions
2. **Test on Coston2**: Run on testnet first
3. **Double-check amounts**: Verify liquidity amounts are correct
4. **Backup private key**: Securely store deployer private key

### After Running

1. **Verify transactions**: Check all transactions on block explorer
2. **Lock LP immediately**: Do not delay locking step
3. **Announce publicly**: Share pool and lock details
4. **Monitor pool**: Watch for any unusual activity

## Support

### Documentation

- **LP Locking**: See `docs/LP_LOCKING_GUIDE.md`
- **SparkDEX Docs**: https://docs.sparkdex.ai/
- **Uniswap V3 Docs**: https://docs.uniswap.org/contracts/v3/overview

### Community

- **Flare Discord**: https://discord.gg/flarenetwork
- **SparkDEX**: Check their official channels
- **Hardhat Support**: https://hardhat.org/

### Contracts Reference

All contract interfaces are in `contracts/interfaces/`:
- `INonfungiblePositionManager.sol` - Position manager interface
- `IUniswapV3Pool.sol` - Pool interface
- `IWFLR.sol` - Wrapped FLR interface

## License

MIT License - See project LICENSE file
