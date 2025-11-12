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
        const rawProofData = await response.json();
        console.log("✅ FDC Verifier proof retrieved successfully!");
        console.log("📦 Raw proof structure:", JSON.stringify(rawProofData, null, 2));
        
        // Transform FDC Verifier response to AssetManager contract format
        // FDC Verifier returns: { proof: [...], response: {...} }
        // AssetManager expects: { merkleProof: [...], data: {...} }
        const transformedProof = {
          merkleProof: rawProofData.proof || [],
          data: rawProofData.response || rawProofData.data
        };
        
        console.log("✅ Proof transformed for AssetManager contract");
        console.log("🔍 Merkle proof array length:", transformedProof.merkleProof.length);
        
        return transformedProof;
      }
      
      if (response.status === 404) {
        console.log(`⏳ Proof not yet finalized (404). Waiting ${pollInterval/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
      
      // Handle 400 "attestation request not found" - voting round may still be finalizing
      if (response.status === 400) {
        const errorText = await response.text();
        if (errorText.includes("attestation request not found")) {
          console.log(`⏳ Attestation not yet indexed in Data Availability Layer (400). Waiting ${pollInterval/1000}s before retry...`);
          console.log(`   This is normal - voting round may still be finalizing`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        // Other 400 error - throw
        throw new Error(`FDC Verifier error (${response.status}): ${errorText}`);
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
 * This implements the full flow: prepareRequest -> submit to FdcHub -> poll DA Layer
 * @param xrplTxHash - The XRPL transaction hash
 * @param network - The network (mainnet or coston2)
 * @param flareClient - FlareClient instance for FdcHub submission
 * @param txTimestamp - Optional Unix timestamp of the XRPL transaction (for logging/validation)
 * @returns Object containing proof and attestation submission details
 */
export async function generateFDCProof(
  xrplTxHash: string, 
  network: "mainnet" | "coston2",
  flareClient: any,
  txTimestamp?: number
): Promise<{
  proof: any;
  attestationTxHash: string;
  votingRoundId: number;
}> {
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
  
  // Step 2: Extract abiEncodedRequest from prepareRequest response
  const abiEncodedRequest = prepareResult.abiEncodedRequest;
  
  if (!abiEncodedRequest) {
    throw new Error(`Missing abiEncodedRequest in prepareRequest response. Status: ${prepareResult.status}`);
  }
  
  console.log("\n📋 Step 2: Submit Attestation to FdcHub (On-Chain)");
  console.log("  ABI Encoded Request:", abiEncodedRequest);
  
  // Import and initialize FdcHubClient
  const { FdcHubClient } = await import("./fdchub-client");
  const fdcHubClient = new FdcHubClient({
    network,
    flareClient
  });
  
  // Submit attestation request to FdcHub on-chain
  const attestationSubmission = await fdcHubClient.submitAttestationRequest(abiEncodedRequest);
  
  console.log("✅ Attestation submitted to FdcHub on-chain");
  console.log("  Tx Hash:", attestationSubmission.txHash);
  console.log("  Block Number:", attestationSubmission.blockNumber);
  console.log("  Block Timestamp:", attestationSubmission.blockTimestamp);
  
  console.log("\n📋 Step 3: Calculate Voting Round ID Using Flare's Official Constants");
  
  // Use Flare's official hardcoded voting round constants
  // Per Flare documentation, these constants are the same across all networks
  // Source: https://dev.flare.network/fdc/guides/fdc-by-hand/
  const votingRoundConfig = await fdcHubClient.getVotingRoundConfig();
  const votingRoundId = await fdcHubClient.getVotingRoundId(attestationSubmission.blockTimestamp);
  
  console.log("  ✅ Voting Round ID calculated using Flare's official constants:");
  console.log("     Block Timestamp:", attestationSubmission.blockTimestamp, `(${new Date(attestationSubmission.blockTimestamp * 1000).toISOString()})`);
  console.log("     Calculated Voting Round ID:", votingRoundId);
  console.log("     Round Offset:", votingRoundConfig.roundOffsetSec, `sec (${new Date(votingRoundConfig.roundOffsetSec * 1000).toISOString()})`);
  console.log("     Round Duration:", votingRoundConfig.roundDurationSec, "sec");
  console.log("     Source: Flare's official hardcoded constants (documented at dev.flare.network)");
  
  // Step 4: Wait for voting round to finalize, then poll Data Availability Layer
  console.log("\n📋 Step 4: Wait for Voting Round Finalization");
  console.log("  Using Voting Round ID:", votingRoundId);
  
  // Calculate wait time based on actual round duration from on-chain contract
  // We wait 2x the round duration to be safe and ensure finalization
  const waitTime = votingRoundConfig.roundDurationSec * 2 * 1000; // Convert to milliseconds
  console.log(`  Round Duration: ${votingRoundConfig.roundDurationSec}s (from VotingRounds contract)`);
  console.log(`  Waiting ${waitTime / 1000}s (2x round duration) before polling...`);
  console.log(`  This ensures the voting round has time to finalize`);
  
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  console.log("\n📋 Step 5: Poll Data Availability Layer for Proof");
  console.log("  Voting round should be finalized now");
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
  console.log("\n📤 Attestation Submission Details:");
  console.log("  FdcHub Tx Hash:", attestationSubmission.txHash);
  console.log("  FdcHub Block:", attestationSubmission.blockNumber);
  console.log("  FdcHub Block Timestamp:", attestationSubmission.blockTimestamp);
  console.log("  Voting Round ID (from FdcHub block):", votingRoundId);
  console.log("  Round Parameters: offset=" + votingRoundConfig.roundOffsetSec + "s, duration=" + votingRoundConfig.roundDurationSec + "s");
  
  return {
    proof,
    attestationTxHash: attestationSubmission.txHash,
    votingRoundId: votingRoundId,
  };
}
