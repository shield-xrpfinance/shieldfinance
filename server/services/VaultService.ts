import { ethers } from "ethers";
import { FlareClient } from "../utils/flare-client";
import type { IStorage } from "../storage";

export interface VaultServiceConfig {
  storage: IStorage;
  flareClient: FlareClient;
}

export class VaultService {
  private config: VaultServiceConfig;

  constructor(config: VaultServiceConfig) {
    this.config = config;
  }

  /**
   * Mint vault shares using ERC-4626 deposit function
   * 
   * @returns Object containing vaultMintTxHash and positionId
   */
  async mintShares(
    vaultId: string,
    userAddress: string,
    fxrpAmount: string
  ): Promise<{ vaultMintTxHash: string; positionId: string }> {
    console.log(`🏦 Minting ${fxrpAmount} shXRP shares for ${userAddress}`);

    // Get vault details from database
    const vault = await this.config.storage.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    // Get vault contract address from environment or database
    // TODO: Add contractAddress field to vaults table in future
    const vaultContractAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
    if (!vaultContractAddress || vaultContractAddress === "0x...") {
      throw new Error(
        "ShXRP Vault not deployed. " +
        "Run deployment script first: DEPLOY_NETWORK=coston2 tsx scripts/deploy-direct.ts, " +
        "then set VITE_SHXRP_VAULT_ADDRESS in environment."
      );
    }

    try {
      // Get vault contract with correct ABI
      const vaultContract = this.config.flareClient.getShXRPVault(vaultContractAddress) as any;

      // Get FXRP token and approve vault (now using dynamic address resolution)
      const fxrpToken = await this.config.flareClient.getFXRPToken() as any;
      const approveTx = await fxrpToken.approve(
        vaultContractAddress,
        ethers.parseUnits(fxrpAmount, 6) // FXRP uses 6 decimals, not 18
      );
      await approveTx.wait();

      // Deposit FXRP to mint shXRP shares (ERC-4626 standard)
      // Note: shXRP shares are minted to the smart account (custodial model)
      // User ownership is tracked in the positions table via walletAddress
      const smartAccountAddress = this.config.flareClient.getSignerAddress();
      console.log(`  Minting shXRP to smart account: ${smartAccountAddress}`);
      console.log(`  User's XRP wallet (tracked in DB): ${userAddress}`);
      
      const depositTx = await vaultContract.deposit(
        ethers.parseUnits(fxrpAmount, 6), // FXRP uses 6 decimals, not 18
        smartAccountAddress // Mint shares to smart account (not user's XRP address)
      );

      const receipt = await depositTx.wait();
      console.log(`✅ Shares minted: ${receipt.hash}`);

      // Create position in database
      const position = await this.config.storage.createPosition({
        walletAddress: userAddress,
        vaultId,
        amount: fxrpAmount,
        rewards: "0",
      });

      console.log(`✅ Position created: ${position.id}`);

      return {
        vaultMintTxHash: receipt.hash,
        positionId: position.id,
      };
    } catch (error) {
      console.error("Vault minting error:", error);
      throw error;
    }
  }

  /**
   * Redeem vault shares (burn shXRP → receive FXRP)
   */
  async redeemShares(
    vaultId: string,
    userAddress: string,
    shareAmount: string
  ): Promise<string> {
    console.log(`🔥 Redeeming ${shareAmount} shXRP shares for ${userAddress}`);

    // TODO: Implement ERC-4626 redeem
    return `0x${Date.now().toString(16)}`;
  }
}
