# Token Swapping

## Overview

Shield Finance's integrated token swap feature allows users to instantly buy and sell $SHIELD tokens directly within the platform, powered by SparkDEX V3 on the Flare Network. The swap interface provides real-time pricing, multi-asset support, and a seamless user experience designed for both beginners and experienced DeFi users.

**Key Benefits:**
- **Instant Trading**: Buy $SHIELD with FLR, wFLR, or USDT in seconds
- **APY Boost Integration**: Stake 100 $SHIELD = +1% APY on all shXRP positions
- **Deflationary Mechanics**: Trading fees contribute to $SHIELD buyback and burn
- **Multi-Hop Routing**: Automatic optimal path finding for best execution
- **No External DEX Required**: Swap without leaving Shield Finance

**Supported Assets:**
- **FLR** (Native Flare Token) - No approval needed
- **wFLR** (Wrapped Flare) - Requires approval
- **USDT** (Bridged Tether via Stargate) - Requires approval
- **SHIELD** (Shield Finance Token) - Requires approval when selling

## Supported Trading Pairs

### Buy $SHIELD

The following trading pairs allow you to acquire $SHIELD tokens:

| Trading Pair | Route Type | Path | Approval Required |
|--------------|------------|------|-------------------|
| **FLR → SHIELD** | Direct | FLR → wFLR → SHIELD | No (native asset) |
| **wFLR → SHIELD** | Direct | wFLR → SHIELD | Yes (wFLR approval) |
| **USDT → SHIELD** | Multi-hop | USDT → wFLR → SHIELD | Yes (USDT approval) |

### Sell $SHIELD

The following trading pairs allow you to sell $SHIELD tokens:

| Trading Pair | Route Type | Path | Approval Required |
|--------------|------------|------|-------------------|
| **SHIELD → FLR** | Direct | SHIELD → wFLR → FLR | Yes (SHIELD approval) |
| **SHIELD → wFLR** | Direct | SHIELD → wFLR | Yes (SHIELD approval) |
| **SHIELD → USDT** | Multi-hop | SHIELD → wFLR → USDT | Yes (SHIELD approval) |

### Direct vs Multi-Hop Routing

**Direct Routing:**
- Single liquidity pool swap (e.g., wFLR → SHIELD)
- Lower gas costs (~150,000 gas)
- Faster execution
- Lower price impact on large trades

**Multi-Hop Routing:**
- Routes through intermediate token (e.g., USDT → wFLR → SHIELD)
- Higher gas costs (~250,000 gas)
- Slightly slower execution
- May provide better pricing on certain pairs
- Automatically used when direct pools don't exist

The swap interface automatically selects the optimal routing strategy based on your chosen trading pair.

## How to Swap Tokens

### Step 1: Connect Wallet

**Requirements:**
- EVM-compatible wallet (MetaMask, WalletConnect, etc.)
- Flare Network (Mainnet or Coston2 Testnet)
- Sufficient FLR for gas fees (~0.1-0.5 FLR per swap)

**Supported Wallets:**
- MetaMask (Browser Extension)
- WalletConnect (Mobile Wallets)
- Brave Wallet
- Coinbase Wallet
- Any EVM-compatible wallet

**Connection Steps:**
1. Navigate to the Swap page
2. Click "Connect Wallet" button in header
3. Select your wallet provider
4. Approve connection request
5. Ensure you're on Flare Network (switch if needed)

### Step 2: Select Trading Direction

The swap interface defaults to **Buy $SHIELD** mode, but you can toggle between buying and selling:

**Buy $SHIELD Mode:**
- Input: Choose from FLR, wFLR, or USDT
- Output: Automatically set to $SHIELD
- Use Case: Acquire $SHIELD for staking APY boosts

**Sell $SHIELD Mode:**
- Input: Automatically set to $SHIELD
- Output: Choose from FLR, wFLR, or USDT
- Use Case: Exit position or take profits

**To Toggle Direction:**
- Click the "Buy/Sell" button in the card header
- Or click the swap direction icon between input/output fields
- Interface automatically updates available assets

### Step 3: Choose Input/Output Assets

**Asset Selector Features:**
- Displays asset icon, symbol, and full name
- Shows real-time wallet balance for each asset
- Dropdown menu with all available trading pairs
- Balance formatted to 4 decimal places

**How to Select Assets:**
1. Click the asset button (shows current selection)
2. Review available assets in dropdown
3. View your balance for each asset
4. Click desired asset to select it
5. Selector automatically updates opposite side

**Balance Display:**
- **FLR**: Native Flare balance (refreshed every 10 seconds)
- **wFLR**: ERC-20 balance from blockchain
- **USDT**: Bridged USDT balance
- **SHIELD**: $SHIELD token balance

### Step 4: Enter Amount

**Input Validation:**
- Minimum: 0.01 tokens (prevents dust trades)
- Maximum: Your available balance
- Real-time validation as you type
- Red border indicates invalid amount
- Helpful error messages guide corrections

**Real-Time Price Quotes:**
- Quotes update 500ms after you stop typing
- Powered by SparkDEX V3 `getAmountsOut()`
- Displays expected output amount
- Shows exchange rate (e.g., "1 FLR = 125 SHIELD")
- Loading indicator while fetching quote

**Price Impact Warnings:**

The interface displays color-coded price impact warnings:

| Amount Range | Impact Level | Color | Message |
|--------------|--------------|-------|---------|
| < 100 FLR | Low (0.3%) | Green | "Low impact" |
| 100-500 FLR | Medium-Low (0.8%) | Yellow | "Moderate impact" |
| 500-1000 FLR | Medium (1.5%) | Orange | "Medium impact" |
| 1000-5000 FLR | High (3.0%) | Red | "High impact - caution" |
| > 5000 FLR | Very High (5.0%) | Red | "Very high impact - review carefully" |

**Note:** Price impact estimates are conservative. Actual impact may be lower depending on current liquidity depth.

**Max Button:**
- Click "Max" to fill input with entire balance
- Automatically reserves gas fees (0.1 FLR) for native FLR swaps
- Ensures you never fail due to insufficient gas

### Step 5: Approve Tokens (ERC-20 Only)

**When Approval is Needed:**

Token approvals are required for ERC-20 tokens but NOT for native FLR:

- ✅ **FLR**: No approval needed (native asset)
- ⚠️ **wFLR**: Approval required
- ⚠️ **USDT**: Approval required
- ⚠️ **SHIELD**: Approval required (when selling)

**Pre-Check Allowance:**

Before each swap, the interface automatically:
1. Checks current token allowance for SparkDEX Router
2. Compares allowance to swap amount
3. Displays "Approve" button if insufficient
4. Skips approval if sufficient allowance exists

**Approval Options:**

When approving tokens, you have two choices:

**1. Unlimited Approval (Recommended)**
- Approve `MaxUint256` (effectively unlimited)
- Only need to approve once per token
- Saves gas on future swaps
- Standard practice in DeFi

**2. Exact Amount Approval**
- Approve only the amount needed for current swap
- Requires approval for every swap
- Higher total gas costs over time
- More conservative security approach

**Approval Process:**
1. Click "Approve [TOKEN]" button
2. Choose "Unlimited" or "Exact Amount" in modal
3. Confirm transaction in wallet
4. Wait for blockchain confirmation (~2-5 seconds)
5. Swap button becomes enabled

**Security Note:** Approvals are granted to the SparkDEX Router contract (`0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`), a trusted Uniswap V2-compatible router audited by the Flare Foundation.

### Step 6: Execute Swap

**Slippage Tolerance:**
- Fixed at 0.5% for all swaps
- Protects against price movement during execution
- Ensures minimum output amount
- Transaction reverts if slippage exceeds tolerance

**Transaction Signing:**
1. Click "Swap" button (must have sufficient balance + approval)
2. Review transaction details in wallet popup:
   - Input amount
   - Expected output amount
   - Minimum output (with slippage)
   - Gas fee estimate
   - Total transaction cost
3. Confirm transaction in wallet
4. Wait for blockchain confirmation

**Execution Flow:**
- "Swap Submitted" toast notification
- "Waiting for confirmation..." message
- Transaction confirmed (~2-5 seconds)
- Success modal appears with confetti animation

**Success Modal:**
- Shows swapped amounts
- Displays transaction hash (clickable, opens block explorer)
- Balance updates automatically
- **For $SHIELD buyers:** "Stake Now" CTA button
  - Links directly to Staking page
  - Highlights APY boost benefits
  - One-click navigation to maximize returns

**Failed Transaction Handling:**
- Clear error message in toast notification
- Reason for failure (e.g., "Insufficient liquidity", "User rejected transaction")
- Suggested next steps
- Input values preserved for retry

## Technical Details

### SparkDEX V3 Integration

Shield Finance integrates with SparkDEX V3, the leading decentralized exchange on Flare Network.

**Router Contract:**
- **Address**: `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`
- **Interface**: Uniswap V2-compatible
- **Network**: Flare Mainnet & Coston2 Testnet

**Key Features:**
- Constant Product AMM (x * y = k)
- 0.3% trading fee per swap
- Liquidity pools for wFLR/SHIELD, wFLR/USDT
- Flash swap support (not currently used)

**Contract Functions Used:**
```solidity
// Get price quote (read-only)
function getAmountsOut(uint amountIn, address[] path) 
    returns (uint[] amounts)

// Swap native FLR for tokens
function swapExactETHForTokens(
    uint amountOutMin,
    address[] path,
    address to,
    uint deadline
) payable returns (uint[] amounts)

// Swap tokens for native FLR
function swapExactTokensForETH(
    uint amountIn,
    uint amountOutMin,
    address[] path,
    address to,
    uint deadline
) returns (uint[] amounts)

// Swap ERC-20 to ERC-20
function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] path,
    address to,
    uint deadline
) returns (uint[] amounts)
```

### Swap Routing Logic

**Path Construction (`buildSwapPath` function):**

The swap interface automatically constructs optimal token paths:

```typescript
function buildSwapPath(): string[] {
  if (isBuyingShield) {
    // Buying SHIELD
    if (selectedInputAsset.symbol === "FLR") {
      // FLR is converted to wFLR automatically by router
      return [contracts.WFLR, contracts.SHIELD_TOKEN];
    } else if (selectedInputAsset.symbol === "WFLR") {
      return [contracts.WFLR, contracts.SHIELD_TOKEN];
    } else if (selectedInputAsset.symbol === "USDT") {
      // Multi-hop through wFLR
      return [selectedInputAsset.address, contracts.WFLR, contracts.SHIELD_TOKEN];
    }
  } else {
    // Selling SHIELD
    if (selectedOutputAsset.symbol === "FLR" || selectedOutputAsset.symbol === "WFLR") {
      // Router converts wFLR to FLR automatically if needed
      return [contracts.SHIELD_TOKEN, contracts.WFLR];
    } else if (selectedOutputAsset.symbol === "USDT") {
      // Multi-hop through wFLR
      return [contracts.SHIELD_TOKEN, contracts.WFLR, selectedOutputAsset.address];
    }
  }
}
```

**Path Validation:**
- Checks for direct pool existence
- Warns if routing through low-liquidity pools
- Suggests alternative pairs if validation fails
- Prevents swaps with no available liquidity

**Multi-Hop Routing:**

When swapping USDT ↔ SHIELD, the router automatically:
1. Executes first swap: USDT → wFLR (or vice versa)
2. Executes second swap: wFLR → SHIELD (or vice versa)
3. Returns final output amount
4. All in a single atomic transaction

**Gas Costs:**
- Direct swap: ~150,000 gas (~0.15 FLR)
- Multi-hop swap: ~250,000 gas (~0.25 FLR)
- Approval: ~50,000 gas (~0.05 FLR)

### Price Quotes

**Real-Time Quote Fetching:**

Price quotes update automatically using SparkDEX's `getAmountsOut()` function:

```typescript
async function getSwapQuote(
  router: Contract,
  amountIn: bigint,
  path: string[]
): Promise<bigint> {
  const amounts = await router.getAmountsOut(amountIn, path);
  return amounts[amounts.length - 1]; // Final output amount
}
```

**Quote Update Triggers:**
- User types in input field (500ms debounce)
- Asset selection changes
- Swap direction toggles
- Every 10 seconds (background refresh)

**Slippage Calculation:**

```typescript
function applySlippage(amount: bigint, slippagePercent: number): bigint {
  const slippageBps = Math.floor(slippagePercent * 100); // 0.5% = 50 bps
  const slippageAmount = (amount * BigInt(slippageBps)) / BigInt(10000);
  return amount - slippageAmount; // Minimum acceptable output
}
```

**Price Impact Thresholds:**

Conservative estimates based on typical SparkDEX liquidity:

| Trade Size | Estimated Impact | Warning Level |
|------------|------------------|---------------|
| < 100 tokens | 0.3% | None (green) |
| 100-500 tokens | 0.8% | Low (yellow) |
| 500-1000 tokens | 1.5% | Medium (orange) |
| 1000-5000 tokens | 3.0% | High (red) |
| > 5000 tokens | 5.0% | Very High (red) |

For precise price impact, query pool reserves:
```typescript
const pool = new Contract(poolAddress, POOL_ABI, provider);
const [reserve0, reserve1] = await pool.getReserves();
const actualImpact = calculatePriceImpact(amountIn, reserve0, reserve1);
```

### Approval Flow

**Allowance Checking:**

Before every swap, the interface checks current allowance:

```typescript
const token = new Contract(tokenAddress, ERC20_ABI, provider);
const allowance = await token.allowance(userAddress, routerAddress);

if (allowance < swapAmount) {
  setNeedsApproval(true);
} else {
  setNeedsApproval(false);
}
```

**Unlimited Approval (MaxUint256):**

The recommended approach for frequent traders:

```typescript
const approvalAmount = ethers.MaxUint256; // 2^256 - 1
await token.approve(routerAddress, approvalAmount);
```

**Benefits:**
- Approve once per token
- No approval gas costs on future swaps
- Seamless UX for repeat users

**Security Consideration:** Only approve trusted contracts. SparkDEX Router is audited and non-upgradeable.

**Exact Approval:**

For conservative users:

```typescript
const approvalAmount = parseTokenAmount(inputAmount, decimals);
await token.approve(routerAddress, approvalAmount);
```

**Drawbacks:**
- Must approve before every swap
- Higher cumulative gas costs
- Slower user experience

**Error Handling:**

Common approval errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "User denied transaction" | User rejected in wallet | Retry approval |
| "Insufficient gas" | Low FLR balance | Add FLR for gas |
| "Nonce too low" | Pending transaction | Wait for confirmation |
| "Gas estimation failed" | Network congestion | Increase gas limit manually |

### Swap Execution Methods

The swap interface uses different router functions depending on asset types:

**1. swapExactETHForTokens (FLR → Tokens):**

Used when buying $SHIELD with native FLR:

```typescript
await router.swapExactETHForTokens(
  minOutputWei,           // Minimum SHIELD output (with slippage)
  path,                   // [wFLR, SHIELD]
  userAddress,            // Recipient address
  deadline,               // Transaction deadline (10 min)
  { value: inputAmountWei } // FLR sent with transaction
);
```

**Key Points:**
- No approval needed (native asset)
- FLR automatically wrapped to wFLR by router
- Most gas-efficient method (~150k gas)

**2. swapExactTokensForETH (Tokens → FLR):**

Used when selling $SHIELD for native FLR:

```typescript
await router.swapExactTokensForETH(
  inputAmountWei,  // SHIELD input amount
  minOutputWei,    // Minimum FLR output (with slippage)
  path,            // [SHIELD, wFLR]
  userAddress,     // Recipient address
  deadline         // Transaction deadline
);
```

**Key Points:**
- Requires $SHIELD approval
- wFLR automatically unwrapped to FLR by router
- Outputs native FLR to user wallet

**3. swapExactTokensForTokens (ERC-20 → ERC-20):**

Used for all other swaps (wFLR, USDT ↔ SHIELD):

```typescript
await router.swapExactTokensForTokens(
  inputAmountWei,  // Input token amount
  minOutputWei,    // Minimum output (with slippage)
  path,            // Token path (e.g., [wFLR, SHIELD])
  userAddress,     // Recipient address
  deadline         // Transaction deadline
);
```

**Key Points:**
- Requires input token approval
- Supports multi-hop paths
- Used for most trading pairs

**Transaction Deadline:**

All swaps include a 10-minute deadline to prevent stale transactions:

```typescript
function getDeadline(): number {
  return Math.floor(Date.now() / 1000) + 60 * 10; // Current time + 10 min
}
```

If a transaction isn't mined within 10 minutes, it will revert to protect against price manipulation.

## Safety Features

### Path Validation

**Liquidity Pool Detection:**

Before executing swaps, the interface validates that liquidity pools exist:

```typescript
function validateSwapPath(path: string[]): string | null {
  // Check for USDT direct pairs (may lack liquidity)
  if (path.includes(USDT_ADDRESS)) {
    if (path.length === 2 && !path.includes(WFLR_ADDRESS)) {
      return "Direct USDT pairs may have limited liquidity. Route through wFLR recommended.";
    }
  }
  return null; // Path is valid
}
```

**Validation Checks:**
- Pool existence verification
- Minimum liquidity thresholds
- Reserve balance checks
- Historical volume analysis (for warnings)

**User Warnings:**
- Yellow alert for low-liquidity pools
- Red alert for non-existent pools
- Suggested alternative routes
- "Proceed anyway" option for advanced users

### Liquidity Detection

**Insufficient Liquidity Errors:**

When `getAmountsOut()` reverts, the interface catches and displays helpful messages:

```typescript
try {
  const outputWei = await getSwapQuote(router, inputAmountWei, path);
} catch (error) {
  if (error.message.includes("INSUFFICIENT_LIQUIDITY")) {
    setPathValidationError(
      `No liquidity pool exists for ${inputAsset} → ${outputAsset}. Try a different pair.`
    );
  }
}
```

**Fallback Suggestions:**
- Recommend routing through wFLR
- Suggest splitting large trades
- Link to SparkDEX pool analytics
- Option to add liquidity (advanced)

### Minimum Output Amount (Slippage Protection)

**How It Works:**

Every swap calculates a minimum acceptable output:

```typescript
const expectedOutput = await getSwapQuote(router, inputAmount, path);
const minOutput = applySlippage(expectedOutput, 0.5); // 0.5% slippage

// Transaction will revert if actual output < minOutput
```

**Revert Conditions:**
- Price moves unfavorably during execution
- Front-running by MEV bots
- Large trades that exhaust pool reserves
- Network congestion causes delays

**User Protection:**
- Transaction reverts instead of executing at bad price
- Funds returned to user wallet
- No loss except gas fees
- Can retry with adjusted parameters

### Balance Guards

**Pre-Execution Validation:**

Before submitting transactions, multiple balance checks ensure success:

**1. Input Token Balance:**
```typescript
if (parseFloat(inputAmount) > parseFloat(userBalance)) {
  toast({ 
    title: "Insufficient Balance",
    description: `You only have ${userBalance} ${asset}`,
    variant: "destructive"
  });
  return;
}
```

**2. Gas Fee Reserve (Native FLR):**
```typescript
if (selectedAsset.isNative) {
  const totalNeeded = inputAmount + estimatedGasFee;
  if (totalNeeded > flrBalance) {
    toast({
      title: "Insufficient FLR for Gas",
      description: "Reserve 0.1 FLR for transaction fees",
      variant: "destructive"
    });
    return;
  }
}
```

**3. Approval Amount:**
```typescript
const currentAllowance = await token.allowance(user, router);
if (currentAllowance < swapAmount) {
  setNeedsApproval(true);
}
```

**Max Button Logic:**

Automatically reserves gas when using native FLR:

```typescript
const maxAmount = selectedAsset.isNative 
  ? flrBalance - 0.1  // Reserve 0.1 FLR for gas
  : tokenBalance;      // Use full balance for ERC-20
```

### Transaction Deadline

**10-Minute Expiration:**

All swaps include a deadline parameter to prevent execution of stale transactions:

```typescript
const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes
```

**Why This Matters:**
- Network congestion can delay transactions
- Prices may move significantly during delays
- Deadline ensures transaction reverts if too slow
- Protects against sandwich attacks

**User Experience:**
- Transactions typically confirm in 2-5 seconds
- 10-minute buffer provides ample time
- If deadline exceeded, transaction reverts gracefully
- User can retry with fresh quote

## Troubleshooting

### "Insufficient Liquidity" Error

**Cause:**
This error occurs when there isn't enough liquidity in the pool to execute your swap at the current price.

**Common Scenarios:**
- Trading pair doesn't exist on SparkDEX
- Pool reserves too low for trade size
- One side of pool is depleted
- New token with limited liquidity

**Solutions:**

**1. Try Alternative Routes:**
- Instead of USDT → SHIELD direct, use USDT → wFLR → SHIELD
- Route through more liquid intermediate tokens
- Check if reverse direction has better liquidity

**2. Reduce Trade Size:**
- Split large order into smaller swaps
- Execute trades over multiple blocks
- Monitor pool reserves between swaps

**3. Check Pool Status:**
- Visit [SparkDEX Analytics](https://sparkdex.com/pools) (hypothetical link)
- Verify wFLR/SHIELD pool has sufficient reserves
- Check 24h volume to gauge liquidity depth

**4. Add Liquidity (Advanced):**
- Provide liquidity to the pool yourself
- Earn trading fees as liquidity provider
- Helps entire Shield Finance ecosystem

**Prevention:**
- Start with small test swap
- Monitor price impact warnings
- Avoid trading during low liquidity periods

### "Approval Failed" Error

**Cause:**
Token approval transaction was rejected or failed to execute.

**Common Causes & Solutions:**

**1. User Rejected Transaction:**
- **Cause:** Clicked "Reject" in wallet
- **Solution:** Click "Approve" button again and confirm in wallet

**2. Insufficient Gas:**
- **Cause:** FLR balance too low to pay gas fees
- **Solution:** Add at least 0.5 FLR to wallet for gas

**3. Nonce Too Low:**
- **Cause:** Previous transaction still pending
- **Solution:** Wait for pending transaction to confirm, then retry

**4. Gas Estimation Failed:**
- **Cause:** Network congestion or contract issue
- **Solution:** Manually set gas limit to 100,000 in wallet

**5. Already Approved:**
- **Cause:** Token already has sufficient allowance
- **Solution:** Proceed directly to swap (no approval needed)

**Retry Strategy:**
1. Check FLR balance for gas
2. Clear pending transactions in wallet
3. Refresh page to reset state
4. Try approval again
5. If repeated failures, contact support with transaction hash

**Verification:**
After approval succeeds, the interface will:
- Show success toast notification
- Update allowance state
- Enable "Swap" button
- Store approval in wallet for future swaps

### "Transaction Rejected" Error

**Cause:**
Swap transaction was rejected by user or failed during execution.

**User Rejection:**
- **Symptom:** "User denied transaction" message
- **Cause:** Clicked "Reject" in wallet popup
- **Solution:** Click "Swap" again and confirm transaction

**Insufficient Gas:**
- **Symptom:** "Insufficient funds for gas" error
- **Cause:** FLR balance too low for gas fees
- **Solution:** Add 0.5-1 FLR to wallet and retry

**Gas Price Too Low:**
- **Symptom:** Transaction pending for long time
- **Cause:** Network congestion, gas price set too low
- **Solution:** Cancel pending tx, increase gas price, retry

**Slippage Exceeded:**
- **Symptom:** "Price slippage check"  or "Too little received" error
- **Cause:** Price moved more than 0.5% during execution
- **Solution:** Wait a few seconds for price to stabilize, retry swap

**Deadline Exceeded:**
- **Symptom:** "Transaction too old" or "Expired" error
- **Cause:** Transaction took longer than 10 minutes to mine
- **Solution:** Retry swap (new deadline will be set)

**Contract Revert:**
- **Symptom:** "Execution reverted" with no specific reason
- **Cause:** Router contract rejected transaction (rare)
- **Solution:** Check block explorer for detailed error, contact support

**Troubleshooting Steps:**
1. Check wallet FLR balance (need 0.5+ FLR)
2. Verify input amount doesn't exceed balance
3. Ensure token is approved (for ERC-20)
4. Try smaller swap amount
5. Wait 1 minute and retry
6. Check network status (Flare Explorer)

### Swap Path Validation Errors

**USDT Routing Issues:**

**Symptom:**
"Direct USDT pairs may have limited liquidity. Route through wFLR recommended."

**Cause:**
USDT/SHIELD pool has low liquidity or doesn't exist.

**Solution:**
- Use multi-hop routing: USDT → wFLR → SHIELD
- Interface automatically suggests this route
- Accept slightly higher gas cost for better execution

**Pool Availability:**

**Symptom:**
"No liquidity pool exists for [TOKEN A] → [TOKEN B]"

**Cause:**
Trading pair not supported on SparkDEX.

**Supported Pairs:**
- ✅ wFLR/SHIELD (primary pool)
- ✅ wFLR/USDT
- ✅ FLR/wFLR (always available via router)
- ❌ USDT/SHIELD direct (use wFLR route)

**Solution:**
- Select alternative output asset
- Use wFLR as intermediate token
- Check SparkDEX for newly added pools

**Low Liquidity Warnings:**

**Symptom:**
Yellow warning: "This pair has low liquidity. Price impact may be high."

**Implications:**
- Swap will execute but at worse price
- Higher price impact than normal
- Consider splitting into smaller trades

**Solution:**
- Reduce trade size
- Accept higher slippage
- Wait for liquidity to increase
- Provide liquidity yourself

**Network Mismatch:**

**Symptom:**
"Swap not available" or missing token addresses

**Cause:**
Wallet connected to wrong network (e.g., Ethereum instead of Flare)

**Solution:**
1. Click network dropdown in header
2. Switch to "Flare Mainnet" or "Coston2 Testnet"
3. Confirm network switch in wallet
4. Swap interface will activate

## Post-Swap Experience

### Confetti Celebration

**Visual Feedback:**
Upon successful swap, the interface triggers a celebratory confetti animation:

```typescript
confetti({
  particleCount: 100,  // Number of confetti pieces
  spread: 70,          // Spread angle in degrees
  origin: { y: 0.6 }   // Starts from 60% down the screen
});
```

**Purpose:**
- Positive reinforcement for successful trade
- Delightful user experience
- Signals completion clearly
- Encourages repeat usage

### Success Modal

**Modal Contents:**
- ✅ Checkmark icon with success message
- Swapped amounts: "[INPUT AMT] [TOKEN] → [OUTPUT AMT] [TOKEN]"
- Transaction hash (clickable, opens Flare Explorer)
- Current $SHIELD balance (if applicable)
- "View Transaction" link
- "Stake Now" button (for $SHIELD buyers)
- "Close" button

**Transaction Hash Link:**
```typescript
<a 
  href={`https://flare-explorer.flare.network/tx/${txHash}`}
  target="_blank"
  rel="noopener noreferrer"
>
  View on Explorer
</a>
```

**Staking CTA (for SHIELD Buyers):**

When users buy $SHIELD, the success modal prominently displays:

**"Maximize Your Returns - Stake Now"**
- Explains: "100 $SHIELD staked = +1% APY on all shXRP positions"
- Button: "Go to Staking" → `/staking` page
- Shows current staking APR
- One-click navigation to stake immediately

**Purpose:**
- Educates users on $SHIELD utility
- Encourages immediate staking for APY boost
- Reduces friction in user journey
- Increases protocol TVL and $SHIELD demand

### Balance Updates

**Automatic Refresh:**

After swap confirmation, all balances update automatically:

**1. Wallet Balance Polling:**
```typescript
// Triggered immediately after swap
useComprehensiveBalance(); // Fetches latest balances

// Continues polling every 10 seconds
useEffect(() => {
  const interval = setInterval(fetchBalances, 10000);
  return () => clearInterval(interval);
}, []);
```

**2. Updated Components:**
- Header wallet display
- Asset selector balances
- Portfolio page holdings
- Staking page $SHIELD balance
- Transaction history (new swap entry)

**3. Toast Notification:**
```typescript
toast({
  title: "Swap Successful! 🎉",
  description: `Swapped ${inputAmount} ${inputAsset} for ${outputAmount} ${outputAsset}`,
  duration: 5000,
});
```

**4. Input Fields Reset:**
- Input amount cleared
- Output amount cleared
- Ready for next swap
- Asset selections preserved

**5. Transaction History:**
- New entry appears in "Transactions" page
- Shows swap details, timestamp, status
- Linked to block explorer
- Filterable by type (Swap, Deposit, Withdraw, Claim)

**User Experience Flow:**
1. User confirms swap
2. "Swap Submitted" toast
3. Blockchain confirmation (~2-5 sec)
4. Confetti animation 🎊
5. Success modal appears
6. Balances refresh automatically
7. Transaction added to history
8. Ready for staking or next swap

---

## Developer Notes

**Contract Addresses (Mainnet):**
- SparkDEX Router: `0x8a1E35F5c98C4E85B36B7B253222eE17773b2781`
- WFLR: `0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d`
- USDT (Stargate): `0x9C3046C0DaA60b6F061f123CccfC29B7920d0d4f`
- SHIELD: Set via `VITE_SHIELD_TOKEN_ADDRESS` environment variable

**Testing on Coston2:**
- Use testnet addresses from `CONTRACTS.testnet`
- Request test FLR from [Flare Faucet](https://faucet.flare.network)
- Ensure SHIELD token is deployed to testnet

**Key Files:**
- Swap UI: `client/src/pages/Swap.tsx`
- SparkDEX Integration: `client/src/lib/sparkdex.ts`
- Asset Selector: `client/src/components/AssetSelector.tsx`
- Balance Hooks: `client/src/hooks/useComprehensiveBalance.ts`

**External Resources:**
- [SparkDEX Documentation](https://docs.sparkdex.ai)
- [Uniswap V2 Protocol Docs](https://docs.uniswap.org/protocol/V2/introduction)
- [Flare Network Explorer](https://flare-explorer.flare.network)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

---

**Last Updated:** November 21, 2025  
**Version:** 1.0.0  
**Author:** Shield Finance Team
