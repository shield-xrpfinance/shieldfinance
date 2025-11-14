/**
 * Shared lot-size calculation logic for FAssets protocol.
 * FAssets requires deposits in whole "lots" - for FXRP, each lot is 10 tokens.
 * 
 * This utility is used by both backend and frontend to ensure consistent rounding behavior.
 */

export const LOT_SIZE = 10; // FXRP lot size in tokens

export interface LotRoundingResult {
  requestedAmount: string;
  roundedAmount: string;
  lots: number;
  needsRounding: boolean;
  shortfall: number; // How much extra will be charged (roundedAmount - requestedAmount)
}

/**
 * Calculate lot-rounded amount for a given user input.
 * 
 * @param requestedAmountStr - User's requested amount as string
 * @returns LotRoundingResult with rounding details
 * @throws Error if amount is invalid or too small
 */
export function calculateLotRounding(requestedAmountStr: string): LotRoundingResult {
  // Trim and validate input
  const trimmed = requestedAmountStr.trim();
  
  // Allow only standard decimal format (no commas, no scientific notation)
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount format. Please enter a valid number.");
  }
  
  const requested = parseFloat(trimmed);
  
  if (requested <= 0 || isNaN(requested)) {
    throw new Error("Amount must be greater than 0");
  }
  
  // Calculate lots using ceiling division
  const lots = Math.ceil(requested / LOT_SIZE);
  
  // Check minimum (at least 1 lot required)
  if (lots < 1) {
    throw new Error(
      `Amount too small. Minimum deposit is ${LOT_SIZE} XRP (1 lot). ` +
      `Please increase your deposit amount.`
    );
  }
  
  // Calculate rounded amount
  const roundedAmount = lots * LOT_SIZE;
  
  // Check if rounding occurred (using small epsilon for floating point comparison)
  const needsRounding = Math.abs(roundedAmount - requested) > 0.000001;
  
  // Calculate shortfall (how much extra user will pay)
  const shortfall = roundedAmount - requested;
  
  return {
    requestedAmount: trimmed,
    roundedAmount: roundedAmount.toFixed(6),
    lots,
    needsRounding,
    shortfall: Number(shortfall.toFixed(6)),
  };
}
