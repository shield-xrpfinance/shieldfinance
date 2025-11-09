export const DEMO_ERROR_MESSAGES = {
  wallet: {
    connectionFailed: "Unable to connect wallet in demo mode. Please try again or use a different wallet provider.",
    disconnected: "Your wallet has been disconnected. In testnet mode, you can reconnect anytime without affecting real assets.",
    networkMismatch: "Your wallet is connected to a different network. Please switch to XRPL Testnet or Coston2 Testnet to continue.",
    insufficientBalance: "Insufficient testnet balance. In demo mode, you can request test tokens from the XRPL Testnet Faucet.",
    signatureRejected: "Transaction signature was rejected. No worries - this is just a demo environment!",
  },
  deposit: {
    amountTooLow: "Minimum deposit amount is 10 XRP in demo mode. Please increase your deposit amount.",
    amountTooHigh: "Maximum demo deposit is 100,000 XRP. Please reduce the amount for this testnet demonstration.",
    insufficientFunds: "Your testnet wallet doesn't have enough funds. Visit the XRPL Testnet Faucet to get free test XRP.",
    vaultNotActive: "This vault is currently inactive in demo mode. Please try another vault.",
    transactionFailed: "Demo transaction simulation failed. This is a testnet environment - please try again.",
    invalidAmount: "Please enter a valid amount between 10 and 100,000 XRP for the demo.",
  },
  withdrawal: {
    amountTooLow: "Minimum withdrawal amount is 1 XRP. Please increase the amount.",
    insufficientPosition: "You don't have enough deposited in this vault to withdraw that amount.",
    lockPeriodActive: "This position is still within its lock period. Withdrawals will be available after the lock expires.",
    escrowPending: "Your XRP is secured in an active escrow. You can withdraw once the escrow finish time is reached.",
    processingFailed: "Withdrawal simulation failed in demo mode. Please try again.",
    vaultLiquidityLow: "This demo vault has limited liquidity at the moment. Try a smaller amount or wait for liquidity to replenish.",
  },
  claim: {
    noRewards: "You don't have any rewards to claim yet. Keep your position active to earn rewards!",
    processingFailed: "Reward claim simulation failed. This is a demo environment - please try again.",
    minimumNotMet: "Minimum claimable rewards is 0.01 XRP. Continue earning to reach the threshold!",
  },
  general: {
    networkError: "Network connection issue in demo mode. Please check your internet connection and try again.",
    serverError: "Demo server encountered an error. This is a testnet environment - data may reset periodically.",
    rateLimitExceeded: "Too many demo requests. Please wait a moment and try again.",
    maintenanceMode: "Demo environment is under maintenance. Please try again later.",
    unexpectedError: "An unexpected error occurred in the demo. Don't worry - no real assets are affected!",
  },
  testnet: {
    dataReset: "Testnet data may reset periodically. Your demo positions and transactions are not permanent.",
    faucetNeeded: "Need testnet XRP? Visit the XRPL Testnet Faucet to get free test tokens for this demo.",
    simulatedYields: "All yields are simulated for demonstration. Actual mainnet yields will differ based on real market conditions.",
    noRealValue: "Remember: Testnet tokens have no real-world value. This is a safe environment to explore the protocol!",
  },
} as const;

export type ErrorCategory = keyof typeof DEMO_ERROR_MESSAGES;
export type ErrorKey<T extends ErrorCategory> = keyof typeof DEMO_ERROR_MESSAGES[T];

export function getDemoErrorMessage<T extends ErrorCategory>(
  category: T,
  key: ErrorKey<T>
): string {
  return DEMO_ERROR_MESSAGES[category][key] as string;
}

export function getErrorMessage(
  category: ErrorCategory,
  key: string,
  isTestnet: boolean,
  fallback?: string
): string {
  if (isTestnet && category in DEMO_ERROR_MESSAGES) {
    const categoryErrors = DEMO_ERROR_MESSAGES[category];
    if (key in categoryErrors) {
      return categoryErrors[key as keyof typeof categoryErrors] as string;
    }
  }
  return fallback || "An error occurred. Please try again.";
}
