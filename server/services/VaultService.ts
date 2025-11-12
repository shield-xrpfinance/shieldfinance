import { ethers } from "ethers";
import { FlareClient } from "../utils/flare-client";
import type { IStorage } from "../storage";
import fs from "fs";
import path from "path";

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
   * Get the latest deployed vault address from deployment files
   */
  private getVaultAddress(): string {
    let vaultAddress: string | undefined;
    
    // Always read from latest deployment file first (source of truth)
    try {
      const deploymentsDir = path.join(process.cwd(), "deployments");
      const files = fs.readdirSync(deploymentsDir)
        .filter(f => 
          f.startsWith("coston2-") && 
          f.endsWith(".json") && 
          f !== "coston2-latest.json" &&
          f !== "coston2-deployment.json" && // Exclude old deployment file
          /coston2-\d+\.json/.test(f) // Only include timestamped files
        )
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestDeployment = JSON.parse(
          fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
        );
        vaultAddress = latestDeployment.contracts?.ShXRPVault?.address;
        console.log(`📄 Using vault address from deployment file (${files[0]}): ${vaultAddress}`);
      }
    } catch (error) {
      console.warn("Failed to read deployment file, falling back to environment variable:", error);
      vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
    }
    
    // Fallback to environment variable if deployment file reading failed
    if (!vaultAddress || vaultAddress === "0x...") {
      vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
      if (vaultAddress && vaultAddress !== "0x...") {
        console.log(`📄 Using vault address from environment variable: ${vaultAddress}`);
      }
    }
    
    if (!vaultAddress || vaultAddress === "0x...") {
      throw new Error(
        "ShXRP Vault not deployed. " +
        "Run deployment script first: DEPLOY_NETWORK=coston2 tsx scripts/deploy-direct.ts"
      );
    }
    
    return vaultAddress;
  }

  /**
   * Mint vault shares using ERC-4626 deposit function
   * 
   * @param vaultId - Vault identifier from database
   * @param userAddress - User's XRP wallet address (for position tracking)
   * @param fxrpAmount - FXRP amount in decimal format (e.g., "20.000000" for 20 FXRP, NOT raw units)
   * @returns Object containing vaultMintTxHash and positionId
   * 
   * NOTE: fxrpAmount MUST be in decimal format (human-readable), not raw units.
   * This function converts to raw units using parseUnits(fxrpAmount, 6) since FXRP uses 6 decimals.
   * Calling code (BridgeService) provides bridge.fxrpReceived.toString() which is a decimal string.
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

    // Get vault contract address from deployment file
    const vaultContractAddress = this.getVaultAddress();

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
