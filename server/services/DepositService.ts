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
   * Orchestrate full deposit flow: XRP → FXRP → Vault → Firelight
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
      await this.config.bridgeService.initiateBridge(bridge.id);

      // Step 3: Mint vault shares (FXRP → shXRP)
      const mintTxHash = await this.config.vaultService.mintShares(
        vaultId,
        deposit.walletAddress,
        deposit.amount
      );

      await this.config.storage.updateBridgeStatus(bridge.id, "completed", {
        vaultMintTxHash: mintTxHash,
      });

      // Step 4: (Optional) Deploy to Firelight for yield
      // await this.config.yieldService.depositToFirelight(vaultId, deposit.amount);

      console.log(`🎉 Deposit processed successfully!`);
    } catch (error) {
      console.error("Deposit processing error:", error);
      throw error;
    }
  }
}
