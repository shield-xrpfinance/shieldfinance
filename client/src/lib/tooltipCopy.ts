export const TOOLTIP_CONTENT = {
  apy: {
    calculation: "Annual Percentage Yield (APY) is calculated based on compound interest, staking rewards, and liquidity provider fees. APY rates may fluctuate based on market conditions and protocol performance.",
    simulated: "This APY is simulated for testnet demonstration purposes. In production, yields would be derived from actual protocol revenue, staking rewards, and market dynamics.",
    historical: "Historical APY data shows trends over time. Past performance does not guarantee future results.",
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
  },
  vault: {
    tvl: "Total Value Locked (TVL) represents the total amount of assets currently deposited in this vault across all users.",
    liquidity: "Available liquidity shows how much can be withdrawn immediately without waiting for lock periods to expire.",
    riskLevel: "Risk level is determined by vault strategy, asset volatility, smart contract audits, and historical performance.",
    depositors: "The number of unique wallet addresses that have active positions in this vault.",
  },
  portfolio: {
    totalValue: "Your total portfolio value includes deposited principal plus accrued rewards across all vaults.",
    rewards: "Rewards are calculated continuously based on your deposited amount and the vault's APY. You can claim rewards at any time.",
    activePositions: "Active positions are vaults where you currently have deposited assets earning rewards.",
  },
  demo: {
    general: "You are using the testnet demo environment. All assets, transactions, and yields are simulated for demonstration purposes only.",
    wallet: "In demo mode, you can connect with any testnet wallet. No real assets are at risk.",
    transactions: "All transactions are executed on testnet networks and use test tokens with no real-world value.",
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
