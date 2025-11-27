# $SHIELD Tokenomics: The Deflationary Flywheel

## Overview

$SHIELD is designed with a **deflationary tokenomics model** that creates constant buying pressure and reduces supply over time. Every time users earn yield on the Shield Finance platform, a portion of the fees automatically goes toward buying and permanently burning $SHIELD tokens.

**The result?** A self-reinforcing economic flywheel where platform growth directly benefits token holders.

---

## How It Works

### The Buyback & Burn Mechanism

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Users Deposit     Platform Earns     Revenue Split            │
│   ───────────────►  ───────────────►  ───────────────►          │
│   XRP/FXRP            Yield Fees        50% / 50%               │
│                                                                 │
│         ┌───────────────────┴───────────────────┐               │
│         │                                       │               │
│         ▼                                       ▼               │
│   ┌───────────┐                         ┌─────────────┐         │
│   │  BUYBACK  │                         │  PROTOCOL   │         │
│   │  & BURN   │                         │  RESERVES   │         │
│   └─────┬─────┘                         └─────────────┘         │
│         │                                                       │
│         ▼                                                       │
│   ┌───────────────────────────────────────────────────┐         │
│   │                                                   │         │
│   │   wFLR ──► SparkDEX ──► $SHIELD ──► 🔥 BURNED    │         │
│   │                                                   │         │
│   └───────────────────────────────────────────────────┘         │
│                                                                 │
│   Supply Decreases  ──►  Scarcity Increases  ──►  Value Up      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Process

1. **Users Earn Yield**  
   When users deposit XRP or FXRP into Shield Finance vaults, they earn competitive APY through our yield strategies.

2. **Platform Collects Fees**  
   A small performance fee (0.2%) is collected from the yield generated.

3. **Revenue is Split**  
   - **50%** goes to the Buyback & Burn contract
   - **50%** goes to Protocol Reserves (for development, security audits, partnerships)

4. **Automatic Market Buy**  
   The Buyback contract uses accumulated wFLR (Wrapped Flare) to purchase $SHIELD tokens on SparkDEX.

5. **Permanent Burn**  
   Purchased $SHIELD tokens are **permanently burned** - sent to address `0x000...dead` where they can never be recovered or used again.

6. **Supply Shrinks**  
   With each burn, the total $SHIELD supply decreases, making remaining tokens more scarce.

---

## The Flywheel Effect

The Shield Finance tokenomics create a **positive feedback loop**:

```
                    ┌──────────────────────┐
                    │  More TVL Deposited  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  More Fees Generated │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  More $SHIELD Burned │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Supply Decreases    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  $SHIELD More Scarce │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Stake for APY Boost │◄────────┐
                    └──────────┬───────────┘         │
                               │                     │
                               ▼                     │
                    ┌──────────────────────┐         │
                    │  Higher Demand       │─────────┘
                    └──────────────────────┘
```

**Why this matters:** As the platform grows, more tokens are burned, creating natural scarcity. Users who stake $SHIELD also receive APY boosts on their deposits, creating additional demand for the token.

---

## Key Numbers

| Metric | Value | Description |
|--------|-------|-------------|
| **Total Supply** | 10,000,000 SHIELD | Fixed, immutable - can only decrease |
| **Performance Fee** | 0.2% | Small fee on yield generated |
| **Buyback Allocation** | 50% | Half of all fees go to burns |
| **Reserve Allocation** | 50% | Half kept for protocol development |
| **Staking Lock Period** | 30 days | Lock $SHIELD to boost your vault APY |
| **APY Boost Rate** | +1% per 100 SHIELD | Stake more = earn more |

---

## Token Distribution

The initial $SHIELD supply was distributed as follows:

| Allocation | Amount | Percentage | Purpose |
|------------|--------|------------|---------|
| **Liquidity Pool** | 1,000,000 | 10% | SparkDEX trading liquidity (locked 12 months) |
| **Community Airdrop** | 2,000,000 | 20% | Early supporters & community |
| **Team & Development** | 7,000,000 | 70% | Team allocation, ecosystem growth, partnerships |
| **Total** | **10,000,000** | **100%** | Fixed supply |

**Important:** The liquidity pool tokens are **locked for 12 months** via Team Finance, ensuring the team cannot remove liquidity.

---

## Staking for APY Boost

Holding $SHIELD isn't just about price appreciation - you can **stake it to boost your vault yields**.

### How APY Boost Works

1. **Stake $SHIELD** in the StakingBoost contract (30-day lock)
2. **Get Higher APY** on all your vault deposits
3. **Formula:** +1% APY boost per 100 $SHIELD staked

### Example

| Your Stake | Base Vault APY | Boost | Your APY |
|------------|----------------|-------|----------|
| 0 SHIELD | 8.0% | +0.0% | 8.0% |
| 100 SHIELD | 8.0% | +1.0% | 9.0% |
| 500 SHIELD | 8.0% | +5.0% | 13.0% |
| 1,000 SHIELD | 8.0% | +10.0% | 18.0% |

**The more $SHIELD you stake, the more you earn** - creating natural demand for the token while rewarding long-term holders.

---

## Why This Model Benefits You

### For Investors

- **Deflationary Supply** - Token supply only goes down, never up
- **Real Utility** - Stake for APY boosts, not just speculation
- **Aligned Incentives** - Platform success = more burns = more scarcity
- **Transparent Burns** - All burn transactions verifiable on-chain

### For Yield Farmers

- **Competitive APY** - Earn yield on XRP/FXRP deposits
- **Boost Earnings** - Stake $SHIELD for up to +10% additional APY
- **Compound Growth** - Higher APY compounds into more yield

### For the Ecosystem

- **Sustainable Model** - Burns funded by real revenue, not inflation
- **Growing TVL** - More deposits = more burns = flywheel accelerates
- **Long-term Focus** - Locked liquidity and team tokens show commitment

---

## Smart Contract Security

All $SHIELD tokenomics contracts are:

- **Open Source** - Fully auditable on GitHub
- **Immutable** - Key parameters cannot be changed after deployment
- **Verified** - Verified on Flare block explorer
- **Battle-tested** - Using OpenZeppelin's audited contract libraries

### Key Contracts

| Contract | Purpose | Security Features |
|----------|---------|-------------------|
| **ShieldToken** | ERC-20 token with burn capability | Fixed supply, no mint function |
| **RevenueRouter** | Splits fees 50/50 | Immutable split ratio |
| **BuybackBurn** | Swaps wFLR → SHIELD → burn | Permissionless, anyone can trigger |
| **StakingBoost** | Stake for APY boost | Time-locked withdrawals |

---

## Frequently Asked Questions

### General

**Q: Can the total supply ever increase?**  
A: No. The ShieldToken contract has no mint function. The 10M supply cap is permanent and can only decrease through burns.

**Q: How often are burns executed?**  
A: Burns can be triggered at any time by anyone. The protocol typically executes burns weekly, but anyone can call the `buyAndBurn()` function when there's sufficient wFLR accumulated.

**Q: Where can I see burn history?**  
A: All burns are on-chain events. You can view them on the Flare block explorer by looking at the BuybackBurn contract's `BuybackAndBurn` events.

### Staking

**Q: Can I unstake early?**  
A: No. Once you stake $SHIELD, it's locked for 30 days. This ensures committed participation and prevents manipulation.

**Q: Do I lose my tokens if I unstake?**  
A: No. After the 30-day lock period, you can withdraw your full staked amount. You keep all tokens.

**Q: Does staking compound?**  
A: The APY boost is applied to your vault deposits, which do compound. The staked $SHIELD itself doesn't earn yield - it unlocks higher APY on your vault positions.

### Technical

**Q: What DEX is used for buybacks?**  
A: SparkDEX V3 on Flare Network. The smart contract swaps wFLR to $SHIELD using the wFLR/SHIELD liquidity pool.

**Q: What happens if there's no liquidity?**  
A: The buyback transaction would fail. However, with locked liquidity and trading volume, this is extremely unlikely. The contract accepts any swap rate to ensure burns always execute.

**Q: Can the team change the 50/50 split?**  
A: No. The RevenueRouter contract has immutable parameters set at deployment. The split cannot be changed.

---

## Conclusion

$SHIELD tokenomics are designed for **long-term value creation**:

1. **Fixed Supply** - 10M tokens, only decreasing
2. **Real Utility** - Stake for APY boosts
3. **Automatic Burns** - Platform revenue = token burns
4. **Aligned Incentives** - Everyone benefits from growth

As Shield Finance grows, the flywheel accelerates: more users → more fees → more burns → more scarcity → more demand → more users.

---

## Links & Resources

- **Website:** [shyield.finance](https://shyield.finance)
- **App:** [app.shyield.finance](https://app.shyield.finance)
- **Block Explorer:** View contracts on [Flare Explorer](https://flare-explorer.flare.network)
- **SparkDEX:** Trade $SHIELD on [SparkDEX](https://sparkdex.ai)
- **Discord:** Join our community

---

*Last Updated: November 2025*  
*Document Version: 1.0*
