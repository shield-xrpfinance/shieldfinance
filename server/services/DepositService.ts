import type { IStorage } from "../storage";
import { BridgeService } from "./BridgeService";
import { VaultService } from "./VaultService";
import { YieldService } from "./YieldService";
import type { DetectedDeposit } from "../listeners/XRPLDepositListener";

export interface DepositServiceConfig {
  storage: IStorage;
  bridgeService: BridgeService;
  vaultService: VaultService;
  yieldService: YieldService;
}

export class DepositService {
  private config: DepositServiceConfig;

  constructor(config: DepositServiceConfig) {
    this.config = config;
  }

  /**
   * Orchestrate initial deposit flow: Create bridge and initiate XRP → FXRP conversion
   * 
   * Note: Vault share minting happens AFTER the bridge completes (3-15 minutes later)
   * via the completion handler in BridgeService.
   */
  async processDeposit(deposit: DetectedDeposit, vaultId: string): Promise<void> {
    console.log(`🎯 Processing deposit: ${deposit.amount} XRP for vault ${vaultId}`);

    try {
      // Step 1: Create bridge request
      const requestId = `bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const bridge = await this.config.storage.createBridge({
        requestId,
        walletAddress: deposit.walletAddress,
        vaultId,
        positionId: null,
        xrpAmount: deposit.amount,
        fxrpExpected: deposit.amount, // 1:1 ratio
        status: "xrpl_confirmed",
        xrplTxHash: deposit.txHash,
        flareTxHash: null,
        vaultMintTxHash: null,
        xrplConfirmedAt: new Date(),
        bridgeStartedAt: null,
        fxrpReceivedAt: null,
        completedAt: null,
        errorMessage: null,
        retryCount: 0,
      });

      console.log(`✅ Bridge request created: ${bridge.id}`);

      // Step 2: Initiate FAssets bridge (XRP → FXRP)
      // This is async and takes 3-15 minutes. Vault minting happens after completion.
      await this.config.bridgeService.initiateBridge(bridge.id);

      console.log(`🌉 Bridge initiated. Vault shares will be minted after FXRP is received.`);
    } catch (error) {
      console.error("Deposit processing error:", error);
      throw error;
    }
  }
}
