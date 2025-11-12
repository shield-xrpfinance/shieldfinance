/**
 * Custom error class for FDC proof polling timeouts
 * Contains diagnostic information for retry logic
 */
export class FDCTimeoutError extends Error {
  constructor(
    public votingRoundId: number,
    public verifierUrl: string,
    public lastStatusCode: number,
    public requestBytes: string
  ) {
    super(`FDC proof polling timeout after 15 minutes. Voting Round: ${votingRoundId}, Last Status: ${lastStatusCode}`);
    this.name = 'FDCTimeoutError';
  }
}

/**
 * Polls the FDC Verifier API for a finalized proof
 * @param votingRoundId - The voting round ID to poll for
 * @param requestBytes - The ABI encoded request bytes
 * @param network - The network to poll (mainnet or coston2)
 * @returns The complete proof object with merkleProof array
 * @throws FDCTimeoutError if polling times out after maxAttempts
 */
async function pollVerifierProof(
  votingRoundId: number, 
  requestBytes: string,
  network: "mainnet" | "coston2"
): Promise<any> {
  const verifierUrl = network === "mainnet"
    ? "https://flr-data-availability.flare.network/api/v1/fdc/proof-by-request-round"
    : "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round";
  
  const maxAttempts = 60; // 15 minutes max (60 attempts * 15 seconds) - extended for slow FDC finalization
  const pollInterval = 15000; // 15 seconds
  
  let lastStatusCode = 404; // Track last status code for diagnostics
  
  console.log("🔄 Starting FDC Verifier proof polling...");
  console.log("  Voting Round ID:", votingRoundId);
  console.log("  Request Bytes:", requestBytes);
  console.log("  Verifier URL:", verifierUrl);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n⏱️  Polling attempt ${attempt}/${maxAttempts}...`);
      
      const response = await fetch(verifierUrl, {
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
      
      lastStatusCode = response.status; // Update last status code
      
      if (response.ok) {
        const proofData = await response.json();
        console.log("✅ FDC Verifier proof retrieved successfully!");
        console.log("📦 Proof structure:", JSON.stringify(proofData, null, 2));
        console.log("🔍 Merkle proof array length:", proofData.merkleProof?.length || 0);
        return proofData;
      }
      
      if (response.status === 404) {
        console.log(`⏳ Proof not yet finalized (404). Waiting ${pollInterval/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // Other error - throw
      const errorText = await response.text();
      throw new Error(`FDC Verifier error (${response.status}): ${errorText}`);
      
    } catch (error: any) {
      if (error.message.includes("FDC Verifier error")) {
        throw error; // Re-throw Verifier errors
      }
      console.error(`❌ Polling attempt ${attempt} failed:`, error.message);
      console.error(`   Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      if (attempt === maxAttempts) {
        // Throw FDCTimeoutError with diagnostic info for retry logic
        throw new FDCTimeoutError(votingRoundId, verifierUrl, lastStatusCode, requestBytes);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  // This should never be reached, but just in case
  throw new FDCTimeoutError(votingRoundId, verifierUrl, lastStatusCode, requestBytes);
}

/**
 * Generates a complete FDC proof for an XRPL transaction
 * This implements the full flow: prepareRequest -> calculate round -> poll FDC Verifier
 * @param xrplTxHash - The XRPL transaction hash
 * @param network - The network (mainnet or coston2)
 * @param txTimestamp - Optional Unix timestamp of the XRPL transaction (for correct round calculation)
 * @returns Complete proof object with merkleProof array
 */
export async function generateFDCProof(
  xrplTxHash: string, 
  network: "mainnet" | "coston2",
  txTimestamp?: number
): Promise<any> {
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
  console.log("📋 Step 1: Prepare Request (with transaction indexing wait)");
  console.log("  Network:", network);
  console.log("  XRPL Tx Hash:", xrplTxHash);
  console.log("  Attestation Type:", attestationType);
  console.log("  Source ID:", sourceId);
  console.log("  Endpoint:", attestationUrl);
  
  // Poll prepareRequest until transaction is indexed by FDC Verifier
  const maxPrepareAttempts = 10; // 30 seconds max (10 attempts * 3 seconds)
  const prepareInterval = 3000; // 3 seconds
  let prepareResult: any = null;
  
  for (let attempt = 1; attempt <= maxPrepareAttempts; attempt++) {
    console.log(`\n⏱️  PrepareRequest attempt ${attempt}/${maxPrepareAttempts}...`);
    
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
    
    prepareResult = await prepareResponse.json();
    
    // Check if transaction is valid
    if (prepareResult.status === "VALID") {
      console.log("✅ Transaction indexed and validated by FDC Verifier");
      break;
    }
    
    console.log(`⏳ Transaction not yet indexed: ${prepareResult.status}`);
    
    if (attempt < maxPrepareAttempts) {
      console.log(`   Waiting ${prepareInterval/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, prepareInterval));
    } else {
      throw new Error(`Transaction not indexed after ${maxPrepareAttempts} attempts. Status: ${prepareResult.status}`);
    }
  }
  
  console.log("✅ PrepareRequest response received");
  console.log("📦 Response structure:", JSON.stringify(prepareResult, null, 2));
  
  // Step 2: Extract abiEncodedRequest and round parameters
  const abiEncodedRequest = prepareResult.abiEncodedRequest;
  const roundOffsetSec = prepareResult.roundOffsetSec || 0;
  const roundDurationSec = prepareResult.roundDurationSec || 90;
  
  if (!abiEncodedRequest) {
    throw new Error(`Missing abiEncodedRequest in prepareRequest response. Status: ${prepareResult.status}`);
  }
  
  console.log("\n📋 Step 2: Calculate Voting Round ID");
  console.log("  ABI Encoded Request:", abiEncodedRequest);
  console.log("  Round Offset (sec):", roundOffsetSec);
  console.log("  Round Duration (sec):", roundDurationSec);
  
  // Step 3: Calculate voting round ID
  // Use provided txTimestamp (from XRPL transaction) or fallback to current time
  const timestamp = txTimestamp || Math.floor(Date.now() / 1000);
  const votingRoundId = Math.floor((timestamp - roundOffsetSec) / roundDurationSec);
  
  console.log("  Transaction Timestamp:", timestamp, txTimestamp ? "(from XRPL tx)" : "(current time fallback)");
  console.log("  Calculated Voting Round ID:", votingRoundId);
  
  // Step 4: Poll FDC Verifier for the finalized proof
  console.log("\n📋 Step 3: Poll FDC Verifier API for Proof");
  const proof = await pollVerifierProof(votingRoundId, abiEncodedRequest, network);
  
  console.log("\n✅ FDC Proof Generation Complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📦 Final Proof Object:");
  console.log("  Round ID:", proof.roundId);
  console.log("  Hash:", proof.hash);
  console.log("  Merkle Proof Length:", proof.merkleProof?.length || 0);
  console.log("  Has Request:", !!proof.request);
  console.log("  Has Response:", !!proof.response);
  console.log("  Verification Status:", proof.verificationStatus);
  console.log("  Attestation Status:", proof.attestationStatus);
  
  return proof;
}
