# Firelight.finance Integration Guide

**Last Updated:** December 3, 2025  
**Status:** Mainnet Live (since December 3, 2025)

## Overview

Firelight is an institutional-grade liquid staking protocol for XRP built on Flare Network. It enables XRP holders to stake FXRP and receive stXRP, a liquid staking token that can be used across DeFi while earning yield.

**Key Features:**
- FXRP → stXRP liquid staking (1:1 initial ratio)
- Fully transferable stXRP (ERC-20)
- Audited by OpenZeppelin and Coinspect
- Bug bounty via Immunefi
- Estimated APY: 4-7%

**Status:** Firelight launched on mainnet December 3, 2025. Contract addresses are now confirmed.

---

## Contract Addresses

### Flare Mainnet (Chain ID: 14)

| Contract | Address | Status | Notes |
|----------|---------|--------|-------|
| **FXRP Token** | `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` | ✅ Firelight | Used by Firelight as underlying |
| **Firelight stXRP Vault** | `0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3` | ✅ Live | ERC-4626 vault |
| **stXRP Token** | `0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3` | ✅ Live | Same as vault (ERC-4626) |

> **Note on FXRP Addresses**: Multiple FXRP token addresses exist on Flare mainnet. Our FirelightStrategy uses `0xAd552A64...` because this is the FXRP token address that Firelight's stXRP vault expects as its underlying asset. The FAssets primary address (`0xAf7278D3...`) should be verified if used outside Firelight context.

**Verify on Flarescan:** https://flarescan.com/address/0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3

### Coston2 Testnet (Chain ID: 114)

| Contract | Address | Status | Notes |
|----------|---------|--------|-------|
| **FXRP Token** | `0x0b6A3645c240605887a5532109323A3E12273dc7` | ✅ Active | Retrieved dynamically |
| **Firelight Vault** | *Not available* | ❌ | Mainnet only |
| **MockStrategy** | `0x1a8c6d2BfD132bCf75B54B3d23CA4c0542957A45` | ✅ Active | Test replacement |

> **Note on Testnet FXRP**: The FXRP address was retrieved dynamically from the FAssets registry. The legacy address `0xa3Bd00D6...` in older configs is deprecated - always use dynamic lookup via FlareContractRegistry.

**Testnet Alternative:** Since Firelight is mainnet-only, we use `MockStrategy.sol` on Coston2 to simulate vault mechanics and test our integration. See [Testnet Simulation](#testnet-simulation) section.

**Block Explorer (Mainnet):** https://flarescan.com  
**Block Explorer (Testnet):** https://coston2-explorer.flare.network

---

## Testnet Simulation

Since Firelight only launched on mainnet, we validate our integration using `MockStrategy.sol` on Coston2 testnet.

### MockStrategy Contract

**Address:** `0x1a8c6d2BfD132bCf75B54B3d23CA4c0542957A45`

**Features:**
- Full `IStrategy` interface implementation
- Configurable yield simulation via `setYieldAmount()`
- AccessControl for vault operator permissions
- Simulates deposit/withdraw/report flow

### Simulation Results (December 3, 2025)

The simulation validates core vault mechanics with variable test amounts:

```
📋 Proven Capabilities:
   ✅ Vault correctly mints shares on deposit (share price reflects yield)
   ✅ Vault can deploy funds to registered strategies
   ✅ Strategy tracks yield via totalAssets() changes
   ✅ User can redeem shares for underlying FXRP
   ✅ ERC-4626 accounting works correctly
   ✅ Buffer-aware withdrawals prevent strategy over-withdrawal
```

*Actual amounts vary per run as testnet balances change.*

### Running the Simulation

```bash
npx hardhat run scripts/test-vault-simulation.ts --network coston2
```

---

## Protocol Architecture

### How Firelight Works

```
XRP Ledger                 Flare Network
    │                          │
    │  1. Lock XRP             │
    ├──────────────────────────>
    │                          │
    │                      2. Mint FXRP (via FAssets)
    │                          │
    │                      3. Deposit FXRP into Firelight
    │                          │
    │                      4. Receive stXRP (1:1)
    │                          │
    │                      5. Use stXRP in DeFi
    │                          │
    │                      6. stXRP accrues value (APY)
```

### Yield Sources

**Phase 1 (Current):**
- Flare Economically Secured Services (ESS) fees
- Insurance pool revenue
- RWA (Real World Assets) service fees

**Phase 2 (Future):**
- Validator staking rewards
- DeFi protocol integrations
- Liquid staking derivatives strategies

---

## Integration Flow

### 1. Mint FXRP (FAssets Bridge)

Before using Firelight, users need FXRP on Flare.

**Options:**
- Mint via FAssets: https://fassets.au.cc/mint
- Purchase on DEX: SparkDEX, BlazeSwap, Enosys
- Receive from another wallet

See `FASSETS_GUIDE.md` for complete minting guide.

### 2. Approve FXRP Spending

```typescript
import { ethers } from 'ethers';

// FXRP token contract
const fxrpAddress = "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE";
const fxrp = new ethers.Contract(fxrpAddress, ERC20_ABI, signer);

// Approve Firelight vault to spend FXRP
const firelightVaultAddress = "0x..."; // Get from app
const amountToDeposit = ethers.parseEther("100"); // 100 FXRP

const approveTx = await fxrp.approve(firelightVaultAddress, amountToDeposit);
await approveTx.wait();
console.log("FXRP approved for Firelight vault");
```

### 3. Deposit into Firelight Vault

**Standard ERC-4626 Vault Interface:**

```typescript
// Firelight Launch Vault (ERC-4626)
const vaultABI = [
  "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)",
  "function totalAssets() external view returns (uint256)",
  "function convertToShares(uint256 assets) external view returns (uint256)",
  "function convertToAssets(uint256 shares) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
];

const vault = new ethers.Contract(firelightVaultAddress, vaultABI, signer);

// Deposit FXRP
const depositTx = await vault.deposit(
  amountToDeposit,  // Amount of FXRP to deposit
  userAddress       // Receiver of stXRP shares
);

const receipt = await depositTx.wait();
console.log("Deposited FXRP, received stXRP shares");

// Parse Deposit event to get shares minted
const depositEvent = receipt.logs.find(log => 
  log.topics[0] === ethers.id("Deposit(address,address,uint256,uint256)")
);
const sharesReceived = depositEvent.args.shares;
console.log(`Received ${ethers.formatEther(sharesReceived)} stXRP`);
```

### 4. Track stXRP Balance

```typescript
// stXRP token contract (same address as vault for ERC-4626)
const stXrpBalance = await vault.balanceOf(userAddress);
console.log(`stXRP Balance: ${ethers.formatEther(stXrpBalance)}`);

// Check stXRP value in FXRP
const fxrpValue = await vault.convertToAssets(stXrpBalance);
console.log(`Value in FXRP: ${ethers.formatEther(fxrpValue)}`);
```

### 5. Withdraw from Vault

**Two Options:**
- **withdraw()**: Specify FXRP amount to receive
- **redeem()**: Specify stXRP shares to burn

```typescript
// Option 1: Withdraw specific FXRP amount
const withdrawTx = await vault.withdraw(
  fxrpAmountToWithdraw,  // Amount of FXRP to receive
  userAddress,           // Receiver of FXRP
  userAddress            // Owner of stXRP shares
);

// Option 2: Redeem all stXRP shares
const redeemTx = await vault.redeem(
  stXrpBalance,    // Amount of stXRP shares to redeem
  userAddress,     // Receiver of FXRP
  userAddress      // Owner of shares
);

await withdrawTx.wait();
console.log("Withdrawal complete, received FXRP");
```

---

## Event Tracking

### Key Events for Integration

```solidity
// ERC-4626 Standard Events
event Deposit(
    address indexed sender,
    address indexed owner,
    uint256 assets,       // FXRP deposited
    uint256 shares        // stXRP minted
);

event Withdraw(
    address indexed sender,
    address indexed receiver,
    address indexed owner,
    uint256 assets,       // FXRP withdrawn
    uint256 shares        // stXRP burned
);

// Additional Firelight Events (if applicable)
event YieldDistributed(uint256 amount);
event RewardsCompounded(uint256 newTotalAssets);
```

### Listening for Events

```typescript
// Listen for deposits
vault.on("Deposit", (sender, owner, assets, shares, event) => {
  console.log(`New deposit: ${ethers.formatEther(assets)} FXRP`);
  console.log(`Shares minted: ${ethers.formatEther(shares)} stXRP`);
});

// Listen for withdrawals
vault.on("Withdraw", (sender, receiver, owner, assets, shares, event) => {
  console.log(`Withdrawal: ${ethers.formatEther(assets)} FXRP`);
  console.log(`Shares burned: ${ethers.formatEther(shares)} stXRP`);
});
```

---

## APY & Yield Mechanics

### Current APY Estimates

**Phase 1 Launch (November 2025):**
- **Estimated APY:** 4-7%
- **Yield Source:** Flare ESS fees, insurance pools, RWA services
- **Compounding:** Automatic (exchange rate increases)

**Exchange Rate Growth:**

The stXRP:FXRP exchange rate increases over time as yield accrues.

**Example:**
- Day 0: 1 stXRP = 1.000000 FXRP
- Day 30: 1 stXRP = 1.005000 FXRP (~6% APY)
- Day 365: 1 stXRP = 1.060000 FXRP (6% APY)

### Checking Current APY

```typescript
// Get total FXRP assets in vault
const totalAssets = await vault.totalAssets();

// Get total stXRP supply
const totalSupply = await vault.totalSupply();

// Calculate exchange rate
const exchangeRate = totalAssets / totalSupply;
console.log(`1 stXRP = ${exchangeRate} FXRP`);

// APY calculation (requires historical data)
// APY = ((currentRate / initialRate) ^ (365 / days)) - 1
```

---

## Minimum Deposits & Limits

### Phase 1 Limits

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Minimum Deposit** | *To be announced* | Check app or docs |
| **Maximum Deposit** | *Governance-set cap* | May have launch caps |
| **Withdrawal Fee** | 0% (expected) | Standard ERC-4626 |
| **Unbonding Period** | Instant (expected) | Liquidity permitting |

**Important:** Phase 1 may have deposit caps to manage risk during initial launch.

### Gas Costs

**Flare Mainnet Estimates:**
- Approve FXRP: ~50,000 gas (~0.005 FLR)
- Deposit: ~150,000 gas (~0.015 FLR)
- Withdraw: ~150,000 gas (~0.015 FLR)

**Total Cost:** ~$0.01-0.05 USD per transaction (depends on FLR price)

---

## Withdrawal & Unbonding

### Instant Withdrawals (Expected)

Unlike traditional staking, **Firelight aims for instant withdrawals** using liquidity pools.

**Withdrawal Flow:**
1. User calls `withdraw()` or `redeem()`
2. stXRP burned immediately
3. FXRP transferred to user wallet
4. **No waiting period** (liquidity permitting)

**Liquidity Considerations:**
- If vault has sufficient FXRP, withdrawal is instant
- If liquidity is low, may need to wait for new deposits or yield

### Emergency Withdrawal

In rare cases where instant liquidity is unavailable:
- Request may enter queue
- Processed as new deposits arrive
- Typical wait time: <24 hours (estimated)

---

## Integration Checklist

### Frontend Integration

```typescript
import { ethers } from 'ethers';

// 1. Connect wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// 2. Get contract addresses (from Firelight app or config)
const FXRP_ADDRESS = "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE";
const VAULT_ADDRESS = "0x..."; // Get from firelight.finance

// 3. Initialize contracts
const fxrp = new ethers.Contract(FXRP_ADDRESS, ERC20_ABI, signer);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

// 4. Check FXRP balance
const fxrpBalance = await fxrp.balanceOf(await signer.getAddress());

// 5. Approve vault
await fxrp.approve(VAULT_ADDRESS, fxrpBalance);

// 6. Deposit into vault
await vault.deposit(depositAmount, receiverAddress);

// 7. Track stXRP balance
const stXrpBalance = await vault.balanceOf(userAddress);

// 8. Calculate value
const fxrpValue = await vault.convertToAssets(stXrpBalance);
```

### Backend Integration

```typescript
// Monitor vault events for user deposits
const vault = new ethers.Contract(vaultAddress, vaultABI, provider);

vault.on("Deposit", async (sender, owner, assets, shares) => {
  // Store deposit record in database
  await db.deposits.create({
    user: owner,
    fxrpAmount: ethers.formatEther(assets),
    stXrpShares: ethers.formatEther(shares),
    timestamp: Date.now(),
    txHash: event.transactionHash
  });
  
  // Update user's stXRP balance
  await updateUserBalance(owner);
});
```

---

## Security & Audits

### Audits

- **OpenZeppelin:** Smart contract security audit (2025)
- **Coinspect:** Independent security review (2025)
- **FAssets Audits:** Zellic, Coinspect, Code4rena (FXRP dependency)

### Bug Bounty

**Active via Immunefi:**
- Critical vulnerabilities: Up to $500,000
- High severity: Up to $100,000
- Medium/Low: Case-by-case rewards

**Submit:** https://immunefi.com (search for Firelight)

### Risk Factors

1. **Smart Contract Risk:** Audited but not risk-free
2. **FXRP Dependency:** Relies on FAssets bridge security
3. **Yield Variability:** APY may fluctuate based on ESS activity
4. **Liquidity Risk:** Instant withdrawals depend on vault liquidity
5. **Early Stage Risk:** Newly launched protocol (November 2025)

---

## DeFi Integration Opportunities

### Using stXRP Across Flare DeFi

**Phase 2 Integrations (Upcoming):**
- **DEXs:** Trade stXRP/FXRP, stXRP/FLR pairs
- **Lending:** Use stXRP as collateral in lending markets
- **Derivatives:** Options and perps on stXRP
- **Yield Aggregators:** Auto-compound stXRP yields

**Example Use Cases:**
1. Deposit FXRP → Get stXRP
2. Provide stXRP/FXRP liquidity on SparkDEX
3. Earn trading fees + Firelight yield (double yield)

---

## Phase Roadmap

### Phase 1 (Current - November 2025)

✅ Launch Vault accepting FXRP deposits  
✅ stXRP minting at 1:1 ratio  
✅ Basic yield distribution from ESS fees  
✅ Firelight Points for early adopters

### Phase 2 (Q1 2026)

- Multiple vaults with different strategies
- stXRP DeFi integrations (DEXs, lending)
- Enhanced yield optimization
- Governance token launch

### Phase 3 (Q2 2026+)

- Cross-chain stXRP bridges
- Validator staking integration
- Advanced DeFi strategies
- Institutional custody solutions

---

## Official Resources

### Documentation

- **Website:** https://firelight.finance
- **Medium:** https://medium.com/@Firelight
- **Twitter:** https://x.com/firelightfi

### Guides

- **Phase 1 Staking Guide:** https://medium.com/@Firelight/step-by-step-guide-to-staking-on-firelight-in-phase-1-65678fcc49c5
- **Institutional Staking:** https://medium.com/@Firelight/institutional-grade-staking-for-xrp (July 2025)
- **Staking vs Restaking:** https://medium.com/@Firelight/why-were-calling-it-staking-on-firelight-not-restaking (Oct 2025)

### Support

- **Discord:** Check website for invite link
- **Telegram:** Community support channels

---

## Next Steps for Integration

### Action Items

1. ✅ **Get Contract Addresses**
   - Visit https://firelight.finance
   - Connect wallet and navigate to Vaults tab
   - Copy vault contract address from vault details
   - Verify on Flarescan

2. ✅ **Implement Deposit Flow**
   - FXRP approval
   - Vault deposit transaction
   - stXRP balance tracking

3. ✅ **Implement Withdrawal Flow**
   - Withdraw or redeem function
   - Handle instant vs queued withdrawals

4. ✅ **Add Event Listeners**
   - Monitor Deposit events for user deposits
   - Monitor Withdraw events for user withdrawals
   - Track vault TVL and APY changes

5. ✅ **UI/UX Considerations**
   - Display stXRP:FXRP exchange rate
   - Show current APY estimate
   - Calculate projected earnings
   - Handle loading states and errors

---

## Fallback Plan (If Addresses Not Available)

If official contract addresses are not yet published:

### Mock Contract for Testing

```typescript
// Mock ERC-4626 vault for development
export const MOCK_FIRELIGHT_VAULT = {
  address: "0x0000000000000000000000000000000000000000",
  // Use standard ERC-4626 ABI
  // Point to testnet FXRP for testing deposits
};

// When mainnet addresses are announced:
// 1. Update shared/flare-contracts.ts
// 2. Verify on Flarescan
// 3. Test with small deposit first
// 4. Update frontend to use real addresses
```

### Monitor for Announcements

- **Twitter:** @Firelightfi
- **Medium:** New posts about mainnet launch
- **Firelight App:** Check for "Contract Addresses" page

---

## Risk Disclosure

⚠️ **Important Notice:**

Firelight launched on December 3, 2025 and is in early Phase 1. Consider the following risks:

1. **New Protocol Risk:** Limited production history
2. **Smart Contract Risk:** Despite audits, bugs may exist
3. **Liquidity Risk:** Instant withdrawals not guaranteed
4. **APY Variability:** Yield estimates may not reflect actual returns
5. **Regulatory Risk:** DeFi protocols face evolving regulations

**Only deposit what you can afford to lose.**

---

## Integration Timeline Estimate

**Optimistic Path:**
- Day 1: Get contract addresses from Firelight app
- Day 2: Implement deposit/withdrawal flows
- Day 3: Add event tracking and UI
- Day 4: Test on mainnet with small amounts
- Day 5: Deploy to production

**Realistic Path:**
- Week 1: Wait for official contract address announcement
- Week 2: Implement and test integration
- Week 3: Security review and testing
- Week 4: Production deployment

**Monitor:** https://firelight.finance for official updates
