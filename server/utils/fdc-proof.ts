export async function generateFDCProof(xrplTxHash: string, network: "mainnet" | "coston2"): Promise<any> {
  const attestationUrl = network === "mainnet"
    ? "https://fdc-verifiers-mainnet.flare.network/verifier/xrp/Payment/prepareResponse"
    : "https://fdc-verifiers-testnet.flare.network/verifier/xrp/Payment/prepareResponse";
  
  const sourceId = network === "mainnet"
    ? "0x5852500000000000000000000000000000000000"
    : "0x7458525000000000000000000000000000000000";
  
  const response = await fetch(attestationUrl, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-API-KEY": "00000000-0000-0000-0000-000000000000" // Flare public dev/test API key
    },
    body: JSON.stringify({
      attestationType: "0x5061796d656e74",
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
  
  return await response.json();
}
