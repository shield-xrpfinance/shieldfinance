import { ethers } from "ethers";
import { FlareClient } from "../utils/flare-client";
import type { IStorage } from "../storage";

export interface YieldServiceConfig {
  storage: IStorage;
  flareClient: FlareClient;
  firelightVaultAddress: string; // ERC-4626 Firelight vault
}

export class YieldService {
  private config: YieldServiceConfig;

  constructor(config: YieldServiceConfig) {
    this.config = config;
  }

  /**
   * Deposit FXRP into Firelight vault to earn yield
   */
  async depositToFirelight(vaultId: string, fxrpAmount: string): Promise<string> {
    console.log(`📈 Depositing ${fxrpAmount} FXRP to Firelight vault`);

    try {
      // Get FXRP token contract (now using dynamic address resolution)
      const fxrpToken = await this.config.flareClient.getFXRPToken() as any;

      // Approve Firelight vault to spend FXRP
      const approveTx = await fxrpToken.approve(
        this.config.firelightVaultAddress,
        ethers.parseEther(fxrpAmount)
      );
      await approveTx.wait();

      // Deposit to Firelight vault (ERC-4626 standard)
      const firelightVault = new ethers.Contract(
        this.config.firelightVaultAddress,
        [
          "function deposit(uint256 assets, address receiver) returns (uint256)",
          "function balanceOf(address) view returns (uint256)",
        ],
        this.config.flareClient.getContractSigner()
      );

      const smartAccountAddress = this.config.flareClient.getSignerAddress();
      const depositTx = await firelightVault.deposit(
        ethers.parseEther(fxrpAmount),
        smartAccountAddress // Receive stXRP to smart account
      );
      const receipt = await depositTx.wait();

      // Get stXRP balance
      const stxrpBalance = await firelightVault.balanceOf(
        smartAccountAddress
      );

      // Record position in database
      await this.config.storage.createFirelightPosition({
        vaultId,
        fxrpDeposited: fxrpAmount,
        stxrpReceived: ethers.formatEther(stxrpBalance),
        currentStxrpBalance: ethers.formatEther(stxrpBalance),
        depositTxHash: receipt.hash,
      });

      console.log(`✅ Deposited to Firelight: ${fxrpAmount} FXRP → ${ethers.formatEther(stxrpBalance)} stXRP`);
      return receipt.hash;
    } catch (error) {
      console.error("Firelight deposit error:", error);
      throw error;
    }
  }

  /**
   * Calculate current yield from Firelight position
   */
  async calculateYield(vaultId: string): Promise<string> {
    const position = await this.config.storage.getFirelightPositionByVault(vaultId);
    if (!position) return "0";

    // In production, query Firelight vault for current stXRP value
    // For now, simulate 5% APY
    const timeDiff = Date.now() - new Date(position.depositedAt).getTime();
    const daysPassed = timeDiff / (1000 * 60 * 60 * 24);
    const annualRate = 0.05; // 5% APY
    const yieldAmount = parseFloat(position.fxrpDeposited) * (annualRate / 365) * daysPassed;

    return yieldAmount.toFixed(6);
  }
}
