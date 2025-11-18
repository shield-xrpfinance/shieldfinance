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
 * Polls the FDC Verifier API for a finalized proof with exponential backoff
 * 
 * FDC Timing Background:
 * - Voting rounds are 90 seconds long
 * - Choose phase occurs 90-135 seconds into the round
 * - Finalization happens after the round completes
 * - DA Layer needs time to index the finalized proof (~30-60 seconds)
 * 
 * Expected States During Polling:
 * - 404: Proof not yet finalized (normal - round still in progress)
 * - 400 "attestation request not found": Round finalizing, not yet indexed in DA Layer (normal)
 * - 200: Proof ready and indexed
 * 
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
  // DA Layer endpoints (correct per Flare documentation)
  const verifierUrl = network === "mainnet"
    ? "https://flr-data-availability.flare.network/api/v1/fdc/proof-by-request-round"
    : "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round";
  
  // Exponential backoff configuration
  // Start with shorter intervals, grow to max of 60s
  // This reduces API load while still being responsive
  const initialPollInterval = 10000; // 10 seconds
  const maxPollInterval = 60000; // 60 seconds max
  const backoffMultiplier = 1.5; // Gentler than 2x for smoother progression
  const maxAttempts = 40; // ~15 minutes with exponential backoff
  
  let currentPollInterval = initialPollInterval;
  let lastStatusCode = 404; // Track last status code for diagnostics
  
  console.log("🔄 Starting FDC Verifier proof polling with exponential backoff...");
  console.log("  Voting Round ID:", votingRoundId);
  console.log("  Request Bytes:", requestBytes.substring(0, 66) + "...");
  console.log("  Verifier URL:", verifierUrl);
  console.log("  Initial poll interval: 10s, max: 60s");
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const nextInterval = Math.min(currentPollInterval * backoffMultiplier, maxPollInterval);
      console.log(`\n⏱️  Polling attempt ${attempt}/${maxAttempts} (next wait: ${Math.round(nextInterval/1000)}s)...`);
      
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
      
      lastStatusCode = response.status;
      
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
      
      // 404: Voting round not yet finalized - this is expected and normal
      if (response.status === 404) {
        console.log(`⏳ Voting round ${votingRoundId} not yet finalized (404 - expected state)`);
        console.log(`   Waiting ${Math.round(currentPollInterval/1000)}s before next attempt...`);
        console.log(`   FDC Phase: Likely in choose phase (90-135s) or waiting for finalization`);
        await new Promise(resolve => setTimeout(resolve, currentPollInterval));
        currentPollInterval = nextInterval; // Increase interval for next attempt
        continue;
      }
      
      // 400 "attestation request not found": Round finalizing, not yet indexed in DA Layer
      // This is also expected and normal - DA Layer needs time to index the proof
      if (response.status === 400) {
        const errorText = await response.text();
        if (errorText.includes("attestation request not found")) {
          console.log(`⏳ Attestation not yet indexed in Data Availability Layer (400 - expected state)`);
          console.log(`   Waiting ${Math.round(currentPollInterval/1000)}s before next attempt...`);
          console.log(`   FDC Phase: Round finalized, DA Layer indexing in progress (~30-60s)`);
          await new Promise(resolve => setTimeout(resolve, currentPollInterval));
          currentPollInterval = nextInterval;
          continue;
        }
        // Other 400 error - unexpected, throw
        throw new Error(`FDC Verifier error (${response.status}): ${errorText}`);
      }
      
      // Other error - unexpected, throw
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
      await new Promise(resolve => setTimeout(resolve, currentPollInterval));
      currentPollInterval = Math.min(currentPollInterval * backoffMultiplier, maxPollInterval);
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
  
  // Step 4: Calculate intelligent wait time based on voting round position
  console.log("\n📋 Step 4: Calculate Wait Time for Voting Round Finalization");
  console.log("  Using Voting Round ID:", votingRoundId);
  
  /**
   * FDC Timing Breakdown (per Flare documentation):
   * 
   * 1. Voting Round Duration: 90 seconds
   *    - Attestations submitted during this period are batched
   * 
   * 2. Choose Phase: 90-135 seconds into the round
   *    - Data providers select which attestations to process
   *    - Average duration: ~45 seconds (middle of 90-135s range = 112.5s)
   * 
   * 3. Finalization: After choose phase completes
   *    - Round concludes and relay contract emits event
   *    - Estimated time: ~30 seconds
   * 
   * 4. DA Layer Indexing: After finalization
   *    - Merkle proofs become available in Data Availability Layer
   *    - Estimated time: ~30-60 seconds
   * 
   * Total Wait Strategy:
   * - Calculate time remaining in current voting round
   * - Add choose phase time (~113 seconds from round start)
   * - Add finalization + DA indexing buffer (~60 seconds)
   * - This ensures we don't poll too early and waste API calls
   */
  
  // Calculate position within current voting round
  const roundStartTime = votingRoundConfig.roundOffsetSec + (votingRoundId * votingRoundConfig.roundDurationSec);
  const secondsIntoRound = attestationSubmission.blockTimestamp - roundStartTime;
  const remainingInRound = votingRoundConfig.roundDurationSec - secondsIntoRound;
  
  // Choose phase occurs at ~113 seconds from round start (middle of 90-135s range)
  // If we're past that point, no need to wait for it
  const choosePhaseTiming = 113; // Average of 90-135s range
  const timeUntilChoosePhase = Math.max(0, choosePhaseTiming - secondsIntoRound);
  
  // Add buffer for finalization and DA Layer indexing (~60 seconds total)
  const finalizationBuffer = 60;
  
  // Calculate optimal wait time
  const optimalWaitTime = remainingInRound + timeUntilChoosePhase + finalizationBuffer;
  const waitTime = Math.max(optimalWaitTime, 90) * 1000; // Minimum 90s, convert to ms
  
  console.log("\n⏰ FDC Timing Calculation:");
  console.log(`  Block Timestamp: ${attestationSubmission.blockTimestamp} (${new Date(attestationSubmission.blockTimestamp * 1000).toISOString()})`);
  console.log(`  Round Start Time: ${roundStartTime} (${new Date(roundStartTime * 1000).toISOString()})`);
  console.log(`  Seconds Into Round: ${secondsIntoRound}s / ${votingRoundConfig.roundDurationSec}s`);
  console.log(`  Time Remaining in Round: ${remainingInRound}s`);
  console.log(`  Time Until Choose Phase (~113s): ${timeUntilChoosePhase}s`);
  console.log(`  Finalization + DA Indexing Buffer: ${finalizationBuffer}s`);
  console.log(`  Calculated Wait Time: ${Math.round(waitTime / 1000)}s`);
  console.log("");
  console.log(`⏳ Waiting ${Math.round(waitTime / 1000)}s for voting round to finalize and DA Layer to index...`);
  console.log(`   Expected completion: ${new Date(Date.now() + waitTime).toISOString()}`);
  
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
