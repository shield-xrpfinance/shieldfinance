export async function generateFDCProof(xrplTxHash: string, network: "mainnet" | "coston2"): Promise<any> {
  const attestationUrl = network === "mainnet"
    ? "https://fdc-verifiers-mainnet.flare.network/verifier/xrp/Payment/prepareResponse"
    : "https://fdc-verifiers-testnet.flare.network/verifier/xrp/Payment/prepareResponse";
  
  // Attestation type "Payment" in hex, padded to 32 bytes (64 hex chars) - MUST have 0x prefix per Flare docs
  const attestationType = "0x5061796d656e7400000000000000000000000000000000000000000000000000";
  
  // Source ID for XRP (testnet/mainnet), padded to 32 bytes (64 hex chars) - MUST have 0x prefix per Flare docs  
  const sourceId = network === "mainnet"
    ? "0x5852500000000000000000000000000000000000000000000000000000000000" // XRP mainnet
    : "0x7465737458525000000000000000000000000000000000000000000000000000"; // tXRP testnet ("testXRP" per docs)
  
  console.log("🔧 FDC Proof Generation - WITH 0x PREFIX (Official Format)");
  console.log("  attestationType:", attestationType);
  console.log("  sourceId:", sourceId);
  
  const response = await fetch(attestationUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-API-KEY": "00000000-0000-0000-0000-000000000000" // Flare public dev/test API key
    },
    body: JSON.stringify({
      attestationType: attestationType,
      sourceId: sourceId,
      requestBody: {
        transactionId: xrplTxHash,
        inUtxo: "0",
        utxo: "0"
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FDC proof generation failed: ${response.statusText} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log("📦 FDC Proof Response Structure:", JSON.stringify(result, null, 2));
  
  return result;
}
