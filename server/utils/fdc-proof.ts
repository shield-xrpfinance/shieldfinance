/**
 * Polls the Data Availability Layer for a finalized proof
 * @param votingRoundId - The voting round ID to poll for
 * @param requestBytes - The ABI encoded request bytes
 * @param network - The network to poll (mainnet or coston2)
 * @returns The complete proof object with merkleProof array
 */
async function pollDALayerProof(
  votingRoundId: number, 
  requestBytes: string,
  network: "mainnet" | "coston2"
): Promise<any> {
  const daLayerUrl = network === "mainnet"
    ? "https://mainnet-data-availability.flare.network/api/v0/fdc/get-proof-round-id-bytes"
    : "https://coston2-data-availability.flare.network/api/v0/fdc/get-proof-round-id-bytes";
  
  const maxAttempts = 20; // 5 minutes max (20 attempts * 15 seconds)
  const pollInterval = 15000; // 15 seconds
  
  console.log("🔄 Starting DA Layer polling...");
  console.log("  Voting Round ID:", votingRoundId);
  console.log("  Request Bytes:", requestBytes);
  console.log("  DA Layer URL:", daLayerUrl);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n⏱️  Polling attempt ${attempt}/${maxAttempts}...`);
      
      const response = await fetch(daLayerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": "00000000-0000-0000-0000-000000000000"
        },
        body: JSON.stringify({
          votingRoundId: votingRoundId,
          requestBytes: requestBytes
        })
      });
      
      if (response.ok) {
        const proof = await response.json();
        console.log("✅ DA Layer proof retrieved successfully!");
        console.log("📦 Proof structure:", JSON.stringify(proof, null, 2));
        console.log("🔍 Merkle proof array length:", proof.proof?.length || 0);
        return proof;
      }
      
      if (response.status === 404) {
        console.log(`⏳ Proof not yet finalized (404). Waiting ${pollInterval/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // Other error - throw
      const errorText = await response.text();
      throw new Error(`DA Layer error (${response.status}): ${errorText}`);
      
    } catch (error: any) {
      if (error.message.includes("DA Layer error")) {
        throw error; // Re-throw DA Layer errors
      }
      console.error(`❌ Polling attempt ${attempt} failed:`, error.message);
      console.error(`   Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      if (attempt === maxAttempts) {
        throw new Error(`DA Layer polling timeout after ${maxAttempts} attempts. Last error: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  throw new Error("DA Layer polling failed: Maximum attempts reached");
}

/**
 * Generates a complete FDC proof for an XRPL transaction
 * This implements the full flow: prepareRequest -> calculate round -> poll DA Layer
 * @param xrplTxHash - The XRPL transaction hash
 * @param network - The network (mainnet or coston2)
 * @returns Complete proof object with merkleProof array
 */
export async function generateFDCProof(xrplTxHash: string, network: "mainnet" | "coston2"): Promise<any> {
  // Step 1: Call prepareRequest endpoint
  const attestationUrl = network === "mainnet"
    ? "https://fdc-verifiers-mainnet.flare.network/verifier/xrp/Payment/prepareRequest"
    : "https://fdc-verifiers-testnet.flare.network/verifier/xrp/Payment/prepareRequest";
  
  // Attestation type "Payment" in hex, padded to 32 bytes (64 hex chars) - MUST have 0x prefix per Flare docs
  const attestationType = "0x5061796d656e7400000000000000000000000000000000000000000000000000";
  
  // Source ID for XRP (testnet/mainnet), padded to 32 bytes (64 hex chars) - MUST have 0x prefix per Flare docs  
  const sourceId = network === "mainnet"
    ? "0x5852500000000000000000000000000000000000000000000000000000000000" // XRP mainnet
    : "0x7465737458525000000000000000000000000000000000000000000000000000"; // tXRP testnet ("testXRP" per docs)
  
  console.log("\n🚀 FDC Proof Generation - Complete Flow");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 Step 1: Prepare Request");
  console.log("  Network:", network);
  console.log("  XRPL Tx Hash:", xrplTxHash);
  console.log("  Attestation Type:", attestationType);
  console.log("  Source ID:", sourceId);
  console.log("  Endpoint:", attestationUrl);
  
  const prepareResponse = await fetch(attestationUrl, {
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
  
  if (!prepareResponse.ok) {
    const errorText = await prepareResponse.text();
    throw new Error(`FDC prepareRequest failed: ${prepareResponse.statusText} - ${errorText}`);
  }
  
  const prepareResult = await prepareResponse.json();
  console.log("✅ PrepareRequest response received");
  console.log("📦 Response structure:", JSON.stringify(prepareResult, null, 2));
  
  // Step 2: Extract abiEncodedRequest and round parameters
  const abiEncodedRequest = prepareResult.abiEncodedRequest;
  const roundOffsetSec = prepareResult.roundOffsetSec || 0;
  const roundDurationSec = prepareResult.roundDurationSec || 90;
  
  if (!abiEncodedRequest) {
    throw new Error("Missing abiEncodedRequest in prepareRequest response");
  }
  
  console.log("\n📋 Step 2: Calculate Voting Round ID");
  console.log("  ABI Encoded Request:", abiEncodedRequest);
  console.log("  Round Offset (sec):", roundOffsetSec);
  console.log("  Round Duration (sec):", roundDurationSec);
  
  // Step 3: Calculate voting round ID
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const votingRoundId = Math.floor((currentTimestamp - roundOffsetSec) / roundDurationSec);
  
  console.log("  Current Timestamp:", currentTimestamp);
  console.log("  Calculated Voting Round ID:", votingRoundId);
  
  // Step 4: Poll DA Layer for the finalized proof
  console.log("\n📋 Step 3: Poll Data Availability Layer");
  const proof = await pollDALayerProof(votingRoundId, abiEncodedRequest, network);
  
  console.log("\n✅ FDC Proof Generation Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 Final Proof Object:");
  console.log("  Attestation Type:", proof.attestationType);
  console.log("  Source ID:", proof.sourceId);
  console.log("  Voting Round:", proof.votingRound);
  console.log("  Merkle Proof Length:", proof.proof?.length || 0);
  console.log("  Has Request Body:", !!proof.requestBody);
  console.log("  Has Response Body:", !!proof.responseBody);
  
  return proof;
}
