# $SHIELD Tokenomics: The Deflationary Flywheel

> **See also:** [Whitepaper (PDF)](https://shyield.finance/whitepaper.pdf) — Complete technical documentation with formal mathematical notation and architecture diagrams.

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
│   XRP/FXRP            Yield Fees        50/40/10                │
│                                                                 │
│         ┌────────────────┬────────────────┬──────────┐          │
│         │                │                │          │          │
│         ▼                ▼                ▼          │          │
│   ┌───────────┐    ┌───────────┐   ┌──────────┐      │          │
│   │  BUYBACK  │    │  STAKER   │   │ PROTOCOL │      │          │
│   │  & BURN   │    │   BOOST   │   │ RESERVES │      │          │
│   │   (50%)   │    │   (40%)   │   │   (10%)  │      │          │
│   └─────┬─────┘    └─────┬─────┘   └──────────┘      │          │
│         │                │                           │          │
│         ▼                ▼                           │          │
│   ┌───────────────────────────────────────────────────┐         │
│   │  FXRP ──► SparkDEX ──► $SHIELD ──► 🔥 BURNED     │         │
│   │  FXRP ──► StakingBoost ──► Pro-rata to stakers   │         │
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
   - **50%** goes to the Buyback & Burn contract (FXRP swapped to SHIELD, then burned)
   - **40%** goes to StakingBoost (FXRP distributed pro-rata to SHIELD stakers)
   - **10%** goes to Protocol Reserves (for development, security audits, partnerships)

4. **Automatic Market Buy**  
   The RevenueRouter swaps accumulated FXRP to $SHIELD on SparkDEX V3.

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
| **Performance Fee** | 0.2% | Small fee on deposits/withdrawals |
| **Burn Allocation** | 50% | Half of fees buy and burn SHIELD |
| **Boost Allocation** | 40% | 40% of fees distributed to SHIELD stakers |
| **Reserve Allocation** | 10% | 10% kept for protocol development |
| **Staking Lock Period** | 30 days | Lock $SHIELD to boost your vault APY |
| **Global Boost Cap** | 25% | Maximum boost percentage (2500 bps) |

---

## Token Distribution

The initial $SHIELD supply of **10,000,000 tokens** is allocated as follows:

### Treasury Allocations

| Category | Percentage | Tokens | Purpose |
|----------|------------|--------|---------|
| **Team** | 9.00% | 900,000 | Core team allocation |
| **Advisors** | 5.00% | 500,000 | Strategic advisors |
| **Ecosystem Development** | 15.00% | 1,500,000 | Protocol development & growth |
| **Airdrops** | 20.00% | 2,000,000 | Community distribution |
| **Marketing** | 3.50% | 350,000 | Marketing & awareness |
| **Ambassadors** | 2.50% | 250,000 | Community ambassadors |
| **Ecosystem Rewards** | 0.00% | 0 | Reserved for future use |
| **Staking Rewards** | 0.00% | 0 | Reserved for future use |
| **Treasury** | 10.00% | 1,000,000 | Protocol treasury |
| **Liquidity / MM / Exchanges** | 10.00% | 1,000,000 | Initial DEX liquidity |
| **Future Liquidity Adds** | 25.00% | 2,500,000 | Future liquidity expansion |
| **Total** | **100%** | **10,000,000** | Fixed supply |

### Key Highlights

- **35% for Liquidity** - Combined 10% initial + 25% future ensures deep trading liquidity
- **20% Airdrop** - Largest single allocation goes directly to the community
- **15% Ecosystem Development** - Significant budget for protocol growth
- **9% Team** - Modest team allocation aligned with long-term success

**Important:** Initial liquidity pool tokens will be **locked for 12 months** via Team Finance, ensuring the team cannot remove liquidity. (TBC - Launch pending)

---

## Staking for APY Boost

Holding $SHIELD isn't just about price appreciation - you can **stake it to boost your vault yields** through real revenue-share.

### How APY Boost Works

The boost is distributed **strictly pro-rata** to locked SHIELD positions using a Synthetix-style reward accumulator:

**Formula (from whitepaper):**
```
Boost APY = Base APY + (Annual Protocol Revenue → FXRP) × (Your Locked SHIELD ÷ Total Locked SHIELD)
```

### Revenue Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Boost Distribution Flow                           │
│                                                                           │
│  Vault Fees (FXRP)                                                        │
│       │                                                                   │
│       ▼                                                                   │
│  RevenueRouter.distribute()                                               │
│       │                                                                   │
│       ├── 50% → FXRP → SHIELD (SparkDEX) → Burn (deflationary)           │
│       ├── 40% → FXRP → StakingBoost.distributeBoost() (direct FXRP)      │
│       └── 10% → Protocol reserves                                         │
│                      │                                                    │
│                      ▼                                                    │
│              rewardPerToken updated (O(1) gas)                           │
│                      │                                                    │
│                      ▼                                                    │
│              Stakers call claim()                                         │
│                      │                                                    │
│                      ▼                                                    │
│              vault.donateOnBehalf() mints shXRP to staker                │
│                                                                           │
│  Result: Stakers receive additional shXRP shares (differentiated yield)  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Example Distribution

Assume $10,000 in weekly vault fees (wFLR):

| Allocation | Amount | Destination |
|------------|--------|-------------|
| **50% Burn** | $5,000 | Buy SHIELD → Burn address |
| **40% Boost** | $4,000 | Swap to FXRP → StakingBoost |
| **10% Reserves** | $1,000 | Protocol treasury |

The $4,000 FXRP is then distributed to stakers pro-rata:

| Staker | SHIELD Staked | Share of Total | FXRP Reward |
|--------|---------------|----------------|-------------|
| Alice | 10,000 SHIELD | 50% | $2,000 FXRP |
| Bob | 6,000 SHIELD | 30% | $1,200 FXRP |
| Carol | 4,000 SHIELD | 20% | $800 FXRP |

When they call `claim()`, the FXRP is converted to shXRP shares minted directly to their wallets.

### Key Technical Details

- **Synthetix Accumulator**: O(1) gas complexity for reward distribution
- **Late-Joiner Safety**: New stakers only earn from distributions after joining
- **Lock Period**: 30 days minimum
- **Global Cap**: Maximum 25% boost (configurable by governance)
- **Non-Staker Exclusion**: Users who don't stake receive zero boost

> **One-liner for website:** "Every week the protocol donates FXRP bought with real revenue. 100% of that donation is distributed pro-rata to SHIELD lockers. No minting. No inflation. Pure revenue-share."

See [STAKING_BOOST_SPEC.md](STAKING_BOOST_SPEC.md) for complete technical specification.

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
| **RevenueRouter** | Splits FXRP fees 50/40/10 | Owner-configurable allocations |
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

**Q: Can the team change the 50/40/10 split?**  
A: Yes. The RevenueRouter has configurable allocations (up to 80% each, max 100% total) for burn/boost. Any changes are transparent on-chain.

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
- **App:** [shyield.finance/app](https://shyield.finance/app)
- **Block Explorer:** View contracts on [Flare Explorer](https://flare-explorer.flare.network)
- **SparkDEX:** Trade $SHIELD on [SparkDEX](https://sparkdex.ai)
- **Discord:** Join our community

---

*Last Updated: December 2025*  
*Document Version: 2.0*
