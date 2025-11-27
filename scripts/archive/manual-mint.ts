/**
 * Manual Minting Utility
 * 
 * This script manually completes a bridge by:
 * 1. Retrieving the FDC proof from the Data Availability API using the correct voting round
 * 2. Formatting the proof for the AssetManager contract
 * 3. Executing the minting transaction via smart account
 * 4. Updating the bridge status to completed
 * 
 * Usage:
 *   tsx scripts/manual-mint.ts <bridgeId> <votingRound>
 * 
 * Example:
 *   tsx scripts/manual-mint.ts a17a5d14-8255-4523-b987-1167319bca40 1161558
 */

import { storage } from "../server/storage";
import { FAssetsClient } from "../server/utils/fassets-client";
import { FlareClient } from "../server/utils/flare-client";

const NETWORK = process.env.DEMO_MODE === "false" ? "coston2" : "coston2" as const;

interface FDCProofData {
  response: {
    attestationType: string;
    sourceId: string;
    votingRound: number;
    lowestUsedTimestamp: number;
    requestBody: {
      transactionId: string;
      inUtxo: number;
      utxo: number;
    };
    responseBody: {
      blockNumber: number;
      blockTimestamp: number;
      sourceAddressHash: string;
      sourceAddressesRoot: string;
      receivingAddressHash: string;
      intendedReceivingAddressHash: string;
      spentAmount: number;
      intendedSpentAmount: number;
      receivedAmount: number;
      intendedReceivedAmount: number;
      standardPaymentReference: string;
      oneToOne: boolean;
      status: number;
    };
  };
  proof: string[];
}

/**
 * Retrieve FDC proof from Data Availability Layer
 * This uses the 2-step process: prepareRequest → proof-by-request-round
 */
async function retrieveFDCProof(
  xrplTxHash: string,
  votingRound: number,
  network: typeof NETWORK
): Promise<FDCProofData> {
  // Step 1: Call prepareRequest to get abiEncodedRequest
  const prepareUrl = network === "coston2"
    ? "https://fdc-verifiers-testnet.flare.network/verifier/xrp/Payment/prepareRequest"
    : "https://fdc-verifiers-mainnet.flare.network/verifier/xrp/Payment/prepareRequest";

  const attestationType = "0x5061796d656e7400000000000000000000000000000000000000000000000000";
  const sourceId = network === "coston2"
    ? "0x7465737458525000000000000000000000000000000000000000000000000000"
    : "0x5852500000000000000000000000000000000000000000000000000000000000";

  console.log("\n📡 Step 1: Calling prepareRequest to get abiEncodedRequest...");
  console.log(`  XRPL Tx: ${xrplTxHash}`);
  console.log(`  URL: ${prepareUrl}`);

  const prepareResponse = await fetch(prepareUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      attestationType,
      sourceId,
      requestBody: {
        transactionId: xrplTxHash,
        inUtxo: "0",
        utxo: "0"
      }
    })
  });

  if (!prepareResponse.ok) {
    const errorText = await prepareResponse.text();
    throw new Error(`PrepareRequest error (${prepareResponse.status}): ${errorText}`);
  }

  const prepareResult = await prepareResponse.json();
  const abiEncodedRequest = prepareResult.abiEncodedRequest;
  console.log("✅ PrepareRequest successful");
  console.log(`  ABI Encoded Request: ${abiEncodedRequest.substring(0, 66)}...`);

  // Step 2: Retrieve proof from Data Availability Layer using requestBytes
  const dataAvailabilityUrl = network === "coston2"
    ? "https://ctn2-data-availability.flare.network/api/v1/fdc/proof-by-request-round"
    : "https://flr-data-availability.flare.network/api/v1/fdc/proof-by-request-round";

  console.log("\n📡 Step 2: Retrieving finalized proof from Data Availability Layer...");
  console.log(`  Voting Round: ${votingRound}`);
  console.log(`  URL: ${dataAvailabilityUrl}`);

  const proofResponse = await fetch(dataAvailabilityUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": "00000000-0000-0000-0000-000000000000"
    },
    body: JSON.stringify({
      votingRoundId: votingRound,
      requestBytes: abiEncodedRequest
    })
  });

  if (!proofResponse.ok) {
    const errorText = await proofResponse.text();
    throw new Error(`Proof retrieval error (${proofResponse.status}): ${errorText}`);
  }

  const proofData = await proofResponse.json();
  console.log("✅ FDC proof retrieved successfully!");
  console.log(`  Payment Reference: ${proofData.response.responseBody.standardPaymentReference}`);
  console.log(`  Amount: ${proofData.response.responseBody.receivedAmount / 1000000} XRP`);
  console.log(`  Status: ${proofData.response.responseBody.status === 0 ? "SUCCESS" : "FAILED"}`);
  
  return proofData;
}

/**
 * Format FDC proof for AssetManager contract
 * 
 * The AssetManager.executeMinting expects a specific proof structure.
 * Based on the Flare SDK, the proof format is:
 * {
 *   merkleProof: string[],
 *   data: {
 *     attestationType: bytes32,
 *     sourceId: bytes32,
 *     votingRound: uint64,
 *     lowestUsedTimestamp: uint64,
 *     requestBody: {...},
 *     responseBody: {...}
 *   }
 * }
 */
function formatProofForContract(fdcProof: FDCProofData): any {
  return {
    merkleProof: fdcProof.proof,
    data: {
      attestationType: fdcProof.response.attestationType,
      sourceId: fdcProof.response.sourceId,
      votingRound: fdcProof.response.votingRound.toString(),
      lowestUsedTimestamp: fdcProof.response.lowestUsedTimestamp.toString(),
      requestBody: {
        transactionId: fdcProof.response.requestBody.transactionId,
        inUtxo: fdcProof.response.requestBody.inUtxo.toString(),
        utxo: fdcProof.response.requestBody.utxo.toString()
      },
      responseBody: {
        blockNumber: fdcProof.response.responseBody.blockNumber.toString(),
        blockTimestamp: fdcProof.response.responseBody.blockTimestamp.toString(),
        sourceAddressHash: fdcProof.response.responseBody.sourceAddressHash,
        sourceAddressesRoot: fdcProof.response.responseBody.sourceAddressesRoot,
        receivingAddressHash: fdcProof.response.responseBody.receivingAddressHash,
        intendedReceivingAddressHash: fdcProof.response.responseBody.intendedReceivingAddressHash,
        spentAmount: fdcProof.response.responseBody.spentAmount.toString(),
        intendedSpentAmount: fdcProof.response.responseBody.intendedSpentAmount.toString(),
        receivedAmount: fdcProof.response.responseBody.receivedAmount.toString(),
        intendedReceivedAmount: fdcProof.response.responseBody.intendedReceivedAmount.toString(),
        standardPaymentReference: fdcProof.response.responseBody.standardPaymentReference,
        oneToOne: fdcProof.response.responseBody.oneToOne,
        status: fdcProof.response.responseBody.status.toString()
      }
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error("Usage: tsx scripts/manual-mint.ts <bridgeId> <votingRound>");
    console.error("Example: tsx scripts/manual-mint.ts a17a5d14-8255-4523-b987-1167319bca40 1161558");
    process.exit(1);
  }

  const [bridgeId, votingRoundStr] = args;
  const votingRound = parseInt(votingRoundStr, 10);

  if (isNaN(votingRound)) {
    console.error("Error: votingRound must be a number");
    process.exit(1);
  }

  console.log("🚀 Manual Minting Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Bridge ID: ${bridgeId}`);
  console.log(`  Voting Round: ${votingRound}`);
  console.log(`  Network: ${NETWORK}`);
  console.log("");

  try {
    // Step 1: Get bridge details
    console.log("📋 Step 1: Retrieving bridge details...");
    const bridge = await storage.getBridgeById(bridgeId);
    
    if (!bridge) {
      throw new Error(`Bridge ${bridgeId} not found`);
    }

    if (!bridge.xrplTxHash) {
      throw new Error("Bridge has no XRPL transaction hash");
    }

    if (!bridge.collateralReservationId) {
      throw new Error("Bridge has no collateral reservation ID");
    }

    console.log("✅ Bridge found:");
    console.log(`  Status: ${bridge.status}`);
    console.log(`  XRPL Tx: ${bridge.xrplTxHash}`);
    console.log(`  Collateral Reservation ID: ${bridge.collateralReservationId}`);
    console.log(`  Amount: ${bridge.xrpAmount} XRP`);

    // Preflight check: Verify collateral reservation hasn't expired
    if (bridge.reservationExpiry) {
      const expiry = new Date(bridge.reservationExpiry);
      const now = new Date();
      if (now > expiry) {
        const minutesExpired = Math.floor((now.getTime() - expiry.getTime()) / 1000 / 60);
        console.error(`\n❌ PREFLIGHT CHECK FAILED: Collateral reservation expired!`);
        console.error(`  Expiry Time: ${expiry.toISOString()}`);
        console.error(`  Current Time: ${now.toISOString()}`);
        console.error(`  Expired: ${minutesExpired} minutes ago`);
        console.error(`\n💡 Solution: Create a new bridge with a fresh collateral reservation.`);
        console.error(`  FAssets reservations expire ~3 minutes after creation.`);
        throw new Error(`Collateral reservation expired ${minutesExpired} minutes ago. Minting cannot succeed with expired reservation.`);
      }
      const minutesRemaining = Math.floor((expiry.getTime() - now.getTime()) / 1000 / 60);
      console.log(`✅ Collateral reservation valid (expires in ${minutesRemaining} minutes)`);
    } else {
      console.warn(`⚠️  Warning: No reservation expiry time found in bridge data`);
    }

    // Step 2: Retrieve FDC proof
    console.log("\n📋 Step 2: Retrieving FDC proof...");
    const fdcProof = await retrieveFDCProof(bridge.xrplTxHash, votingRound, NETWORK);

    // Verify payment reference matches (normalize both to uppercase hex without 0x prefix)
    const normalizePaymentRef = (ref: string) => {
      return ref.replace(/^0x/i, '').toUpperCase();
    };
    
    const expectedPaymentRef = normalizePaymentRef(bridge.paymentReference || '');
    const actualPaymentRef = normalizePaymentRef(fdcProof.response.responseBody.standardPaymentReference);
    
    if (actualPaymentRef !== expectedPaymentRef) {
      console.warn(`⚠️  Payment reference mismatch!`);
      console.warn(`  Expected: ${expectedPaymentRef}`);
      console.warn(`  Actual: ${actualPaymentRef}`);
      throw new Error("Payment reference mismatch - this proof is for a different transaction");
    }

    console.log("✅ Payment reference verified!");

    // Step 3: Initialize Flare client and FAssets client
    console.log("\n📋 Step 3: Initializing smart account...");
    
    const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY;
    const bundlerApiKey = process.env.ETHERSPOT_BUNDLER_API_KEY;
    
    if (!operatorPrivateKey || !bundlerApiKey) {
      throw new Error("Missing required environment variables: OPERATOR_PRIVATE_KEY and ETHERSPOT_BUNDLER_API_KEY");
    }
    
    const flareClient = new FlareClient({
      network: NETWORK,
      privateKey: operatorPrivateKey,
      bundlerApiKey,
      enablePaymaster: true
    });
    await flareClient.initialize();
    console.log(`✅ Smart account initialized: ${flareClient.getSignerAddress()}`);

    const fassetsClient = new FAssetsClient({
      network: NETWORK,
      flareClient
    });

    // Step 4: Format proof for contract
    console.log("\n📋 Step 4: Formatting proof for AssetManager contract...");
    const formattedProof = formatProofForContract(fdcProof);
    console.log("✅ Proof formatted");

    // Step 5: Execute minting
    console.log("\n📋 Step 5: Executing minting transaction...");
    console.log(`  This will call AssetManager.executeMinting()`);
    console.log(`  Collateral Reservation ID: ${bridge.collateralReservationId}`);
    console.log(`  Transaction will be gasless via ERC-4337 bundler`);
    
    const mintingTxHash = await fassetsClient.executeMinting(
      formattedProof,
      BigInt(bridge.collateralReservationId)
    );

    console.log("✅ Minting executed successfully!");
    console.log(`  Transaction Hash: ${mintingTxHash}`);

    // Step 6: Update bridge status
    console.log("\n📋 Step 6: Updating bridge status...");
    await storage.updateBridgeStatus(bridgeId, "completed", {
      flareTxHash: mintingTxHash,
      fdcVotingRoundId: votingRound.toString(),
      fdcProofHash: JSON.stringify(fdcProof),
      fxrpReceived: bridge.fxrpExpected,
      fxrpReceivedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null
    });

    console.log("✅ Bridge status updated to 'completed'");
    
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Manual minting completed successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\nBridge ${bridgeId} has been completed.`);
    console.log(`FXRP has been minted to the vault.`);
    console.log(`\nNext step: Mint vault shares by calling /api/bridges/${bridgeId}/complete-vault-minting`);

  } catch (error) {
    console.error("\n❌ Manual minting failed:");
    console.error(error);
    process.exit(1);
  }
}

main();
