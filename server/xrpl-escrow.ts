import { Client, Wallet, xrpToDrops, dropsToXrp } from "xrpl";

/**
 * XRPL Escrow Utility Functions
 * 
 * These functions handle XRPL escrow operations for the liquid staking system:
 * - createEscrow: Lock XRP in escrow from vault to user
 * - finishEscrow: Release XRP from escrow to destination
 * - cancelEscrow: Cancel an escrow and return XRP to source
 */

interface CreateEscrowParams {
  sourceAddress: string;
  sourceSecret: string;
  destinationAddress: string;
  amount: string;
  network: string;
  finishAfterSeconds?: number;
  cancelAfterSeconds?: number;
  condition?: string;
}

interface FinishEscrowParams {
  accountAddress: string;
  accountSecret: string;
  escrowOwner: string;
  escrowSequence: number;
  network: string;
  condition?: string;
  fulfillment?: string;
}

interface CancelEscrowParams {
  accountAddress: string;
  accountSecret: string;
  escrowOwner: string;
  escrowSequence: number;
  network: string;
}

interface EscrowResult {
  success: boolean;
  txHash?: string;
  escrowSequence?: number;
  error?: string;
}

/**
 * Get XRPL client for the specified network
 */
function getXRPLServer(network: string): string {
  return network === "testnet"
    ? "wss://s.altnet.rippletest.net:51233"
    : "wss://xrplcluster.com";
}

/**
 * Create an XRPL escrow transaction
 * 
 * This locks XRP in escrow that can be finished after finishAfter time
 * or cancelled after cancelAfter time.
 * 
 * @param params - Escrow creation parameters
 * @returns Result with transaction hash and escrow sequence number
 */
export async function createEscrow(params: CreateEscrowParams): Promise<EscrowResult> {
  const {
    sourceAddress,
    sourceSecret,
    destinationAddress,
    amount,
    network,
    finishAfterSeconds = 60,
    cancelAfterSeconds = 86400,
    condition,
  } = params;

  let client: Client | null = null;

  try {
    const xrplServer = getXRPLServer(network);
    client = new Client(xrplServer);
    await client.connect();

    const wallet = Wallet.fromSeed(sourceSecret);

    if (wallet.address !== sourceAddress) {
      throw new Error("Source address does not match wallet secret");
    }

    const currentLedger = await client.getLedgerIndex();
    
    const finishAfter = Math.floor(Date.now() / 1000) + finishAfterSeconds;
    const cancelAfter = Math.floor(Date.now() / 1000) + cancelAfterSeconds;

    const escrowCreate: any = {
      TransactionType: "EscrowCreate",
      Account: sourceAddress,
      Destination: destinationAddress,
      Amount: xrpToDrops(amount),
      FinishAfter: finishAfter,
      CancelAfter: cancelAfter,
    };

    if (condition) {
      escrowCreate.Condition = condition;
    }

    const prepared = await client.autofill(escrowCreate);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    
    if (meta && meta.TransactionResult === "tesSUCCESS") {
      return {
        success: true,
        txHash: result.result.hash,
        escrowSequence: prepared.Sequence,
      };
    }

    throw new Error(
      `Escrow creation failed: ${meta?.TransactionResult || "Unknown error"}`
    );
  } catch (error) {
    console.error("Create escrow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Finish (complete) an XRPL escrow transaction
 * 
 * This releases the escrowed XRP to the destination address.
 * Can only be called after the FinishAfter time has passed.
 * 
 * @param params - Escrow finish parameters
 * @returns Result with transaction hash
 */
export async function finishEscrow(params: FinishEscrowParams): Promise<EscrowResult> {
  const {
    accountAddress,
    accountSecret,
    escrowOwner,
    escrowSequence,
    network,
    condition,
    fulfillment,
  } = params;

  let client: Client | null = null;

  try {
    const xrplServer = getXRPLServer(network);
    client = new Client(xrplServer);
    await client.connect();

    const wallet = Wallet.fromSeed(accountSecret);

    if (wallet.address !== accountAddress) {
      throw new Error("Account address does not match wallet secret");
    }

    const escrowFinish: any = {
      TransactionType: "EscrowFinish",
      Account: accountAddress,
      Owner: escrowOwner,
      OfferSequence: escrowSequence,
    };

    if (condition && fulfillment) {
      escrowFinish.Condition = condition;
      escrowFinish.Fulfillment = fulfillment;
    }

    const prepared = await client.autofill(escrowFinish);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    
    if (meta && meta.TransactionResult === "tesSUCCESS") {
      return {
        success: true,
        txHash: result.result.hash,
      };
    }

    throw new Error(
      `Escrow finish failed: ${meta?.TransactionResult || "Unknown error"}`
    );
  } catch (error) {
    console.error("Finish escrow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Cancel an XRPL escrow transaction
 * 
 * This returns the escrowed XRP to the source address.
 * Can only be called after the CancelAfter time has passed.
 * 
 * @param params - Escrow cancel parameters
 * @returns Result with transaction hash
 */
export async function cancelEscrow(params: CancelEscrowParams): Promise<EscrowResult> {
  const {
    accountAddress,
    accountSecret,
    escrowOwner,
    escrowSequence,
    network,
  } = params;

  let client: Client | null = null;

  try {
    const xrplServer = getXRPLServer(network);
    client = new Client(xrplServer);
    await client.connect();

    const wallet = Wallet.fromSeed(accountSecret);

    if (wallet.address !== accountAddress) {
      throw new Error("Account address does not match wallet secret");
    }

    const escrowCancel = {
      TransactionType: "EscrowCancel" as const,
      Account: accountAddress,
      Owner: escrowOwner,
      OfferSequence: escrowSequence,
    };

    const prepared = await client.autofill(escrowCancel);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    
    if (meta && meta.TransactionResult === "tesSUCCESS") {
      return {
        success: true,
        txHash: result.result.hash,
      };
    }

    throw new Error(
      `Escrow cancel failed: ${meta?.TransactionResult || "Unknown error"}`
    );
  } catch (error) {
    console.error("Cancel escrow error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Get escrow information from the XRP Ledger
 * 
 * @param network - Network to query (mainnet or testnet)
 * @param address - Account address to check for escrows
 * @returns Array of escrow objects
 */
export async function getAccountEscrows(
  network: string,
  address: string
): Promise<any[]> {
  let client: Client | null = null;

  try {
    const xrplServer = getXRPLServer(network);
    client = new Client(xrplServer);
    await client.connect();

    const response = await client.request({
      command: "account_objects",
      account: address,
      ledger_index: "validated",
      type: "escrow",
    });

    return response.result.account_objects || [];
  } catch (error) {
    console.error("Get account escrows error:", error);
    return [];
  } finally {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  }
}
