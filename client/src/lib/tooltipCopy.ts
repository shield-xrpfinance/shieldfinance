export const TOOLTIP_CONTENT = {
  apy: {
    calculation: "Annual Percentage Yield (APY) is calculated based on compound interest, staking rewards, and liquidity provider fees. APY rates may fluctuate based on market conditions and protocol performance.",
    simulated: "This APY is simulated for testnet demonstration purposes. In production, yields would be derived from actual protocol revenue, staking rewards, and market dynamics.",
    historical: "Historical APY data shows trends over time. Past performance does not guarantee future results.",
    base: "Base APY is the standard yield rate without any SHIELD boost applied. All depositors receive at least this rate.",
    boosted: "Boosted APY includes the additional yield from SHIELD staking. The boost percentage is applied on top of the base APY.",
    effective: "Your effective APY combines the base vault yield with your personal SHIELD boost multiplier.",
    formula: "APY = Base Rate + (Base Rate x Boost %). For example, 8% base with 25% boost = 8% + 2% = 10% effective APY.",
  },
  escrow: {
    lockPeriod: "Your deposited XRP is secured in an on-chain escrow for the lock period. This provides cryptographic guarantees that your funds will be returned after the lock period expires.",
    pending: "Your escrow is currently active and locked. You can view its status on the XRPL explorer using the transaction hash.",
    finished: "This escrow has completed its lock period and funds have been released to your wallet.",
    cancelled: "This escrow was cancelled before completion. Funds were returned to the original depositor.",
    failed: "This escrow encountered an error during processing. Please contact support if you believe this is incorrect.",
  },
  withdrawal: {
    timing: "Withdrawal requests are processed based on vault liquidity and lock period requirements. XRP vaults with escrows must wait for the escrow finish time.",
    processing: "Typical withdrawal processing time is 1-3 business days, depending on network conditions and vault liquidity.",
    claimRewards: "Claiming rewards withdraws only your accrued earnings, leaving your principal deposit intact and continuing to earn.",
    exitFee: "Early withdrawal may incur a small exit fee (0.1-0.5%) to protect remaining depositors from volatility.",
  },
  vault: {
    tvl: "Total Value Locked (TVL) represents the total amount of assets currently deposited in this vault across all users.",
    liquidity: "Available liquidity shows how much can be withdrawn immediately without waiting for lock periods to expire.",
    riskLevel: "Risk level is determined by vault strategy, asset volatility, smart contract audits, and historical performance.",
    depositors: "The number of unique wallet addresses that have active positions in this vault.",
    strategy: "The vault strategy determines how deposited assets are used to generate yield - through lending, liquidity provision, or staking.",
  },
  portfolio: {
    totalValue: "Your total portfolio value includes deposited principal plus accrued rewards across all vaults.",
    rewards: "Rewards are calculated continuously based on your deposited amount and the vault's APY. You can claim rewards at any time.",
    activePositions: "Active positions are vaults where you currently have deposited assets earning rewards.",
    stakedValue: "The total value of assets you have deposited across all vaults, not including rewards.",
    shieldValue: "The USD value of SHIELD tokens you have staked to boost your vault yields.",
  },
  demo: {
    general: "You are using the testnet demo environment. All assets, transactions, and yields are simulated for demonstration purposes only.",
    wallet: "In demo mode, you can connect with any testnet wallet. No real assets are at risk.",
    transactions: "All transactions are executed on testnet networks and use test tokens with no real-world value.",
  },
  fees: {
    deposit: "No fees are charged when depositing into vaults. 100% of your deposit goes to work earning yield.",
    withdrawal: "Standard withdrawals are fee-free. Early exits from locked positions may incur a small penalty.",
    performance: "A 10% performance fee is taken from earned rewards, not principal. This funds protocol development and SHIELD buybacks.",
    management: "No ongoing management fees. The protocol only earns when you earn.",
    gas: "Transaction costs are sponsored through our gasless system - you pay no gas fees on supported networks.",
    breakdown: "Fee breakdown: 0% deposit, 0% management, 10% performance on rewards only.",
  },
  rewards: {
    accrual: "Rewards accrue in real-time based on vault performance. View your current rewards in your portfolio.",
    claiming: "Claim rewards anytime without affecting your staked principal. Claimed rewards are sent directly to your wallet.",
    compounding: "Enable auto-compound to automatically reinvest rewards, maximizing your earnings through compound interest.",
    sources: "Rewards come from: lending interest, LP fees, staking rewards, and protocol revenue sharing.",
    frequency: "Rewards are calculated and updated every block (~3.5 seconds on Flare Network).",
    calculation: "Daily rewards = (Your Stake / Total Pool) x Daily Pool Earnings x (1 + Boost%)",
  },
  shield: {
    token: "SHIELD is the governance and utility token for Shield Finance. Stake SHIELD to boost your vault yields.",
    boost: "Stake SHIELD to receive up to 25% APY boost on all your vault deposits. More SHIELD = higher boost.",
    boostFormula: "Boost % = min(SHIELD Staked / 100, 25%). Stake 2,500 SHIELD for maximum 25% boost.",
    boostEffect: "Your boost applies to all vaults simultaneously. A 25% boost on 8% base APY = 10% effective APY.",
    staking: "Staked SHIELD remains liquid - you can unstake at any time. Boost is calculated based on your current stake.",
    governance: "SHIELD holders can vote on protocol upgrades, fee changes, and new vault strategies.",
    earnings: "SHIELD stakers also earn a share of protocol revenue through the RevenueRouter contract.",
    maxBoost: "Maximum boost is capped at 25% to ensure fair distribution of yields among all participants.",
    unstaking: "You can unstake SHIELD at any time. Your boost will be recalculated immediately after unstaking.",
  },
  risk: {
    low: "Low risk vaults use battle-tested strategies on stable assets with extensive audit history.",
    medium: "Medium risk vaults balance yield potential with controlled exposure to market volatility.",
    high: "High risk vaults pursue aggressive yield strategies on volatile assets. Higher potential returns, higher risk.",
    smartContract: "Smart contract risk is minimized through professional audits, formal verification, and bug bounties.",
    marketRisk: "Market risk relates to asset price fluctuations. Diversify across vaults to manage exposure.",
    liquidityRisk: "Liquidity risk occurs when withdrawals are delayed due to lock periods or low vault liquidity.",
    impermanentLoss: "LP vaults may experience impermanent loss if asset prices diverge significantly.",
    counterparty: "Counterparty risk is minimized by using decentralized protocols and on-chain collateral.",
  },
  lockPeriod: {
    none: "No lock period - withdraw your assets at any time without penalty.",
    days7: "7-day lock period. Assets can be withdrawn after 7 days from deposit.",
    days30: "30-day lock period. Higher yield in exchange for reduced liquidity.",
    days90: "90-day lock period. Maximum yield potential with longer commitment.",
    flexible: "Flexible deposits can be withdrawn anytime. Locked deposits earn higher yields.",
    unlock: "Once the lock period ends, your assets become available for withdrawal immediately.",
    early: "Early withdrawal from locked positions incurs a penalty to protect remaining depositors.",
  },
  bridge: {
    xrplToFlare: "Bridge XRP from XRPL to Flare Network as FXRP. FXRP maintains 1:1 backing with real XRP.",
    flareToXrpl: "Redeem FXRP back to native XRP on XRPL. Redemptions are processed through FAssets protocol.",
    processing: "Bridge transactions typically complete within 5-15 minutes depending on network confirmation times.",
    backing: "All FXRP is 100% backed by XRP held in FAssets vaults. Proof of reserves available on-chain.",
    fees: "Bridge fees are minimal (< 0.1%) and cover network transaction costs.",
    status: "Track your bridge transaction status in real-time through the Bridge page.",
  },
  notifications: {
    deposit: "You'll be notified when your deposits are confirmed on-chain.",
    withdrawal: "Receive alerts when withdrawals are processed and funds arrive in your wallet.",
    rewards: "Get periodic updates on your earned rewards and yield performance.",
    boost: "Notifications when your SHIELD boost changes due to staking/unstaking.",
    system: "Important protocol updates, maintenance windows, and security notices.",
  },
  dashboard: {
    summary: "Your dashboard shows total portfolio value, active positions, earned rewards, and SHIELD boost status.",
    performance: "Track your portfolio growth over time with historical performance charts.",
    allocation: "View how your assets are distributed across different vaults and strategies.",
    health: "Portfolio health indicators show overall risk exposure and diversification status.",
  },
} as const;

export type TooltipCategory = keyof typeof TOOLTIP_CONTENT;
export type TooltipKey<T extends TooltipCategory> = keyof typeof TOOLTIP_CONTENT[T];

export function getTooltipContent<T extends TooltipCategory>(
  category: T,
  key: TooltipKey<T>
): string {
  return TOOLTIP_CONTENT[category][key] as string;
}
