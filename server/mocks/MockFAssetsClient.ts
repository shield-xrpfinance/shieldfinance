/**
 * Mock FAssetsClient for demo mode testing.
 * Simulates FAssets bridge operations without real blockchain calls.
 */

export class MockFAssetsClient {
  async calculateLotRoundedAmount(requestedAmount: string): Promise<{
    requestedAmount: string;
    roundedAmount: string;
    lots: number;
    needsRounding: boolean;
    shortfall: number;
  }> {
    const { calculateLotRounding } = await import("../../shared/lotRounding");
    const result = calculateLotRounding(requestedAmount);
    
    console.log("🎭 MOCK: calculateLotRoundedAmount", result);
    return result;
  }
  
  async reserveCollateral(params: any): Promise<any> {
    console.log("🎭 MOCK: reserveCollateral called", params);
    return {
      collateralReservationId: "MOCK_RESERVATION_" + Date.now(),
      agentVaultAddress: "0xMOCK_AGENT_VAULT",
      agentUnderlyingAddress: "rMOCK_AGENT_XRP_ADDRESS",
      paymentReference: "MOCK_REF_" + Date.now(),
      valueUBA: "0",
      feeUBA: "0",
    };
  }
  
  async mintFAssets(params: any): Promise<string> {
    console.log("🎭 MOCK: mintFAssets called", params);
    return "0xMOCK_MINT_TX_HASH_" + Date.now();
  }
  
  async redeemFAssets(params: any): Promise<any> {
    console.log("🎭 MOCK: redeemFAssets called", params);
    return {
      redemptionRequestId: "MOCK_REDEMPTION_" + Date.now(),
      agentVaultAddress: "0xMOCK_AGENT_VAULT",
      agentUnderlyingAddress: "rMOCK_AGENT_XRP_ADDRESS",
      valueUBA: params.amount || "0",
    };
  }
  
  // Prevent type errors
  [key: string]: any;
}
