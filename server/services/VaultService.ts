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
   * Public method for DepositService to use
   */
  public getVaultContractAddress(): string {
    return this.getVaultAddress();
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

      // Check for existing position and accumulate if found
      let position = await this.config.storage.getPositionByWalletAndVault(userAddress, vaultId);

      if (position) {
        // Existing position found (may be closed) - accumulate and reactivate
        const oldAmount = parseFloat(position.amount || "0");
        const newAmount = oldAmount + parseFloat(fxrpAmount);
        
        if (position.status === "closed") {
          console.log(`  🔄 Reactivating closed position: adding ${parseFloat(fxrpAmount).toFixed(6)} shXRP`);
        } else {
          console.log(`  📊 Updating existing position: ${oldAmount.toFixed(6)} + ${parseFloat(fxrpAmount).toFixed(6)} = ${newAmount.toFixed(6)} shXRP`);
        }
        
        position = await this.config.storage.updatePosition(position.id, {
          amount: newAmount.toFixed(6),
          status: "active", // ALWAYS reactivate on new deposit
        });
        console.log(`✅ Position updated: ${position.id}`);
      } else {
        // No existing position - create new
        console.log(`  ✨ Creating new position: ${parseFloat(fxrpAmount).toFixed(6)} shXRP`);
        position = await this.config.storage.createPosition({
          walletAddress: userAddress,
          vaultId,
          amount: fxrpAmount,
          rewards: "0",
          status: "active", // Explicitly set active for new positions
        });
        console.log(`✅ Position created: ${position.id}`);
      }

      // Create transaction record for deposit
      await this.config.storage.createTransaction({
        walletAddress: userAddress,
        vaultId,
        positionId: position.id,
        type: "deposit",
        amount: fxrpAmount,
        rewards: "0",
        status: "completed",
        txHash: receipt.hash,
        network: "coston2",
      });

      console.log(`✅ Transaction record created for deposit`);

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
   * 
   * @param vaultId - Vault identifier from database
   * @param userAddress - User's XRP wallet address (for position tracking)
   * @param shareAmount - shXRP shares to redeem in decimal format (e.g., "20.000000" for 20 shares)
   * @returns Object containing fxrpReceived and txHash
   * 
   * ERC-4626 redeem() burns shares and returns underlying assets (FXRP).
   * The function signature is: redeem(uint256 shares, address receiver, address owner)
   */
  async redeemShares(
    vaultId: string,
    userAddress: string,
    shareAmount: string
  ): Promise<{ fxrpReceived: string; txHash: string }> {
    console.log(`🔥 Redeeming ${shareAmount} shXRP shares for ${userAddress}`);

    // Get vault details from database
    const vault = await this.config.storage.getVault(vaultId);
    if (!vault) throw new Error("Vault not found");

    // Get vault contract address from deployment file
    const vaultContractAddress = this.getVaultAddress();

    try {
      // Get vault contract with ERC-4626 ABI
      const vaultContract = this.config.flareClient.getShXRPVault(vaultContractAddress) as any;

      // Get smart account address (shares are held here in custodial model)
      const smartAccountAddress = this.config.flareClient.getSignerAddress();
      console.log(`  Redeeming shares from smart account: ${smartAccountAddress}`);
      console.log(`  User's XRP wallet (position owner): ${userAddress}`);

      // Parse share amount to contract units (shXRP uses same decimals as FXRP: 6)
      const shareAmountRaw = ethers.parseUnits(shareAmount, 6);
      
      // Call ERC-4626 redeem: redeem(shares, receiver, owner)
      // - shares: amount of shXRP to burn
      // - receiver: address to receive FXRP (smart account)
      // - owner: address that owns the shares (smart account)
      const redeemTx = await vaultContract.redeem(
        shareAmountRaw,
        smartAccountAddress, // Receiver of FXRP
        smartAccountAddress  // Owner of shares
      );

      const receipt = await redeemTx.wait();
      console.log(`✅ Shares redeemed: ${receipt.hash}`);

      // Parse Withdraw event to get actual FXRP received
      // ERC-4626 Withdraw event: Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)
      const withdrawEventSignature = ethers.id("Withdraw(address,address,address,uint256,uint256)");
      
      console.log(`🔍 Searching for Withdraw event in ${receipt.logs.length} logs...`);
      console.log(`   Expected signature: ${withdrawEventSignature}`);
      
      let fxrpReceived = "0";
      let withdrawEventFound = false;
      
      for (const log of receipt.logs) {
        console.log(`   Log ${receipt.logs.indexOf(log)}: topic[0] = ${log.topics[0]}`);
        
        if (log.topics[0] === withdrawEventSignature) {
          withdrawEventFound = true;
          console.log(`✅ Found Withdraw event!`);
          
          try {
            // Parse the Withdraw event
            // topics[1] = caller, topics[2] = receiver, topics[3] = owner
            // data contains: assets (FXRP received) and shares (shXRP burned)
            const iface = new ethers.Interface([
              "event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
            ]);
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            
            if (parsed && parsed.args) {
              // Extract assets (FXRP received)
              const assetsRaw = parsed.args.assets;
              fxrpReceived = ethers.formatUnits(assetsRaw, 6); // FXRP uses 6 decimals
              
              console.log(`✅ Parsed Withdraw event:`);
              console.log(`   Caller: ${parsed.args.caller}`);
              console.log(`   Receiver: ${parsed.args.receiver}`);
              console.log(`   Owner: ${parsed.args.owner}`);
              console.log(`   shXRP burned: ${ethers.formatUnits(parsed.args.shares, 6)}`);
              console.log(`   FXRP received: ${fxrpReceived}`);
              
              break;
            } else {
              console.error(`❌ Failed to parse Withdraw event - parsed object is null or missing args`);
            }
          } catch (parseError) {
            console.error(`❌ Error parsing Withdraw event:`, parseError);
          }
        }
      }

      if (!withdrawEventFound) {
        console.error(`❌ No Withdraw event found in transaction logs`);
        console.error(`   Transaction hash: ${receipt.hash}`);
        console.error(`   All log topics:`, receipt.logs.map((l: any) => l.topics[0]));
      }

      if (fxrpReceived === "0") {
        throw new Error("Failed to parse Withdraw event - could not determine FXRP received. Check logs for details.");
      }

      return {
        fxrpReceived,
        txHash: receipt.hash,
      };
    } catch (error) {
      console.error("Vault redeem error:", error);
      throw error;
    }
  }
}
