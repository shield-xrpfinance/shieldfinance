import type { IStorage } from "../storage";
import { BridgeService } from "./BridgeService";
import { VaultService } from "./VaultService";
import { YieldService } from "./YieldService";
import type { DetectedDeposit } from "../listeners/XRPLDepositListener";
import type { FlareClient } from "../utils/flare-client";
import { ethers } from "ethers";
import { db } from "../db";
import { positions } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface DepositServiceConfig {
  storage: IStorage;
  bridgeService: BridgeService;
  vaultService: VaultService;
  yieldService: YieldService;
  flareClient?: FlareClient;
}

export interface DirectDepositRequest {
  userAddress: string;
  evmAddress: string;
  amount: string;
  // SECURITY FIX: Removed vaultAddress from request - now retrieved from server config
}

export interface DirectDepositStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  steps?: Array<{
    id: string;
    title: string;
    status: "pending" | "in-progress" | "completed" | "failed";
    txHash?: string;
  }>;
  txHash?: string;
  error?: string;
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
      // Step 1: Create bridge request with 30-minute expiration
      const requestId = `bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
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
        expiresAt,
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

  /**
   * @deprecated - DO NOT USE
   * FXRP deposits should be signed directly by the user's EOA wallet via WalletConnect.
   * The backend should only track transactions via /api/deposits/fxrp/track.
   * Smart Accounts are ONLY for XRPL bridging operations, NOT for direct FXRP deposits.
   * 
   * This method is retained for reference but should not be called.
   */
  async processDirectFXRPDeposit(request: DirectDepositRequest): Promise<{ depositId: string; txHash?: string }> {
    if (!this.config.flareClient) {
      throw new Error("FlareClient not configured for direct FXRP deposits");
    }

    console.log(`💎 Processing direct FXRP deposit for ${request.evmAddress}`);
    
    const depositId = `fxrp-deposit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // SECURITY FIX: Get vault address from server config, not user input
    // Look for FXRP vault in database
    const vaults = await this.config.storage.getVaults();
    const fxrpVault = vaults.find(v => v.asset === "FXRP" && v.status === "active");
    if (!fxrpVault) {
      throw new Error("FXRP vault not found or not active");
    }

    // Get the deployed vault contract address from VaultService
    const vaultContractAddress = await this.config.vaultService.getVaultContractAddress();
    
    // STATE PERSISTENCE FIX: Create transaction record immediately
    const transaction = await this.config.storage.createTransaction({
      walletAddress: request.userAddress, // User's XRP wallet for tracking
      vaultId: fxrpVault.id,
      positionId: undefined, // Will be updated after position creation
      type: "direct_fxrp_deposit",
      amount: request.amount,
      status: "processing",
      txHash: undefined, // Will be updated after blockchain confirmation
      network: this.config.flareClient.provider.network?.name === "flare" ? "mainnet" : "testnet",
    });

    try {
      // Get FXRP token contract (dynamically resolved from AssetManager)
      const fxrpToken = await this.config.flareClient.getFXRPToken();
      const vault = this.config.flareClient.getShXRPVault(vaultContractAddress);

      // IMPORTANT: FXRP has 6 decimals, not 18!
      const amountWei = ethers.parseUnits(request.amount, 6);

      // Get smart account address (all operations go through smart account)
      const smartAccountAddress = this.config.flareClient.getSignerAddress();
      console.log(`  Using Smart Account: ${smartAccountAddress}`);

      // Check FXRP balance in smart account
      const balance = await fxrpToken.balanceOf(smartAccountAddress);
      if (balance < amountWei) {
        throw new Error(`Insufficient FXRP balance in smart account. Have ${ethers.formatUnits(balance, 6)}, need ${request.amount}`);
      }

      // Step 1: Approve vault to spend FXRP
      const currentAllowance = await fxrpToken.allowance(smartAccountAddress, vaultContractAddress);
      let approveTxHash = undefined;
      
      if (currentAllowance < amountWei) {
        console.log(`  Approving vault to spend ${request.amount} FXRP...`);
        const approveTx = await fxrpToken.approve(vaultContractAddress, amountWei);
        const approveReceipt = await approveTx.wait();
        approveTxHash = approveReceipt.hash;
        console.log(`  ✅ FXRP approval confirmed: ${approveTxHash}`);
      }

      // Step 2: Deposit FXRP to mint shXRP shares
      console.log(`  Depositing ${request.amount} FXRP to vault...`);
      const depositTx = await vault.deposit(
        amountWei,
        smartAccountAddress // Mint shares to smart account (custodial model)
      );
      const depositReceipt = await depositTx.wait();
      const depositTxHash = depositReceipt.hash;
      
      console.log(`  ✅ Direct FXRP deposit successful: ${depositTxHash}`);

      // Step 3: Update transaction status with hash
      await this.config.storage.updateTransaction(transaction.id, {
        status: "completed",
        txHash: depositTxHash,
      });

      // Step 4: Update or create position
      const shXRPBalance = await vault.balanceOf(smartAccountAddress);
      
      let position = await this.config.storage.getPositionByWalletAndVault(request.userAddress, fxrpVault.id);
      
      if (position) {
        // Accumulate to existing position
        const newAmount = (parseFloat(position.amount) + parseFloat(request.amount)).toString();
        position = await this.config.storage.updatePosition(position.id, {
          amount: newAmount,
          status: "active",
        });
        console.log(`  📊 Updated position ${position.id}: ${newAmount} FXRP`);
      } else {
        // Create new position
        position = await this.config.storage.createPosition({
          walletAddress: request.userAddress,
          vaultId: fxrpVault.id,
          amount: request.amount,
          rewards: "0",
          status: "active",
        });
        console.log(`  📊 Created new position ${position.id}: ${request.amount} FXRP`);
      }

      // Update transaction with position ID
      await this.config.storage.updateTransaction(transaction.id, {
        positionId: position.id,
      });

      return { 
        depositId: transaction.id, // Use transaction ID as deposit ID for tracking
        txHash: depositTxHash
      };
    } catch (error) {
      // Update transaction status on failure
      await this.config.storage.updateTransaction(transaction.id, {
        status: "failed",
      });
      
      console.error("Direct FXRP deposit error:", error);
      throw error;
    }
  }

  /**
   * @deprecated - DO NOT USE
   * FXRP withdrawals should be signed directly by the user's EOA wallet via WalletConnect.
   * The backend should only track transactions via /api/withdrawals/fxrp/track.
   * Smart Accounts are ONLY for XRPL bridging operations, NOT for direct FXRP withdrawals.
   * 
   * This method is retained for reference but should not be called.
   */
  async processDirectFXRPWithdrawal(
    request: { userAddress: string; evmAddress: string; amount: string }
  ): Promise<{ withdrawalId: string; txHash?: string }> {
    if (!this.config.flareClient) {
      throw new Error("FlareClient not configured for direct FXRP withdrawals");
    }

    console.log(`🔓 Processing direct FXRP withdrawal for ${request.evmAddress}`);
    
    // SECURITY FIX: Get vault address from server config, not user input
    const vaults = await this.config.storage.getVaults();
    const fxrpVault = vaults.find(v => v.asset === "FXRP" && v.status === "active");
    if (!fxrpVault) {
      throw new Error("FXRP vault not found or not active");
    }

    // Get the deployed vault contract address from VaultService
    const vaultContractAddress = await this.config.vaultService.getVaultContractAddress();
    
    // STATE PERSISTENCE FIX: Create transaction record immediately
    const transaction = await this.config.storage.createTransaction({
      walletAddress: request.userAddress, // User's XRP wallet for tracking
      vaultId: fxrpVault.id,
      positionId: undefined, // Will be updated after position lookup
      type: "direct_fxrp_withdrawal",
      amount: request.amount,
      status: "processing",
      txHash: undefined, // Will be updated after blockchain confirmation
      network: this.config.flareClient.provider.network?.name === "flare" ? "mainnet" : "testnet",
    });

    try {
      const vault = this.config.flareClient.getShXRPVault(vaultContractAddress);
      
      // Get smart account address (all operations go through smart account)
      const smartAccountAddress = this.config.flareClient.getSignerAddress();
      console.log(`  Using Smart Account: ${smartAccountAddress}`);

      // Parse amount - shXRP shares to redeem (18 decimals for shares)
      const sharesWei = ethers.parseUnits(request.amount, 18);

      // Check shXRP balance in smart account
      const shXRPBalance = await vault.balanceOf(smartAccountAddress);
      if (shXRPBalance < sharesWei) {
        throw new Error(`Insufficient shXRP balance in smart account. Have ${ethers.formatUnits(shXRPBalance, 18)}, need ${request.amount}`);
      }

      // Get position for this user and vault
      const position = await this.config.storage.getPositionByWalletAndVault(request.userAddress, fxrpVault.id);
      if (!position) {
        throw new Error(`No position found for user ${request.userAddress} in FXRP vault`);
      }

      // Update transaction with position ID
      await this.config.storage.updateTransaction(transaction.id, {
        positionId: position.id,
      });

      // ERC-4626 redeem: Burn shXRP shares to get FXRP back
      console.log(`  Redeeming ${request.amount} shXRP shares for FXRP...`);
      const withdrawTx = await vault.redeem(
        sharesWei,
        smartAccountAddress, // Receive FXRP to smart account
        smartAccountAddress  // Owner of shares is smart account
      );
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawTxHash = withdrawReceipt.hash;
      
      console.log(`  ✅ Direct FXRP withdrawal successful: ${withdrawTxHash}`);

      // Update transaction status with hash
      await this.config.storage.updateTransaction(transaction.id, {
        status: "completed",
        txHash: withdrawTxHash,
      });

      // Calculate FXRP amount received from shares (assuming 1:1 for simplicity)
      // In production, you'd parse the Withdraw event to get exact FXRP amount
      const fxrpAmount = request.amount; // Shares amount ~ FXRP amount for 1:1 vault

      // Update position - reduce deposited amount
      const newAmount = Math.max(0, parseFloat(position.amount) - parseFloat(fxrpAmount));
      
      if (newAmount > 0) {
        // Update position with reduced amount
        await this.config.storage.updatePosition(position.id, {
          amount: newAmount.toString(),
          status: "active",
        });
        console.log(`  📊 Updated position ${position.id}: ${newAmount} FXRP remaining`);
      } else {
        // Position fully withdrawn - mark as withdrawn
        await this.config.storage.updatePosition(position.id, {
          amount: "0",
          status: "withdrawn",
        });
        console.log(`  📊 Position ${position.id} fully withdrawn`);
      }

      return { 
        withdrawalId: transaction.id, // Use transaction ID as withdrawal ID for tracking
        txHash: withdrawTxHash
      };
    } catch (error) {
      // Update transaction status on failure
      await this.config.storage.updateTransaction(transaction.id, {
        status: "failed",
      });
      
      console.error("Direct FXRP withdrawal error:", error);
      throw error;
    }
  }

  /**
   * Get status for direct FXRP deposit/withdrawal
   * FIXED: Now queries from database for proper state persistence
   */
  async getDirectTransactionStatus(transactionId: string): Promise<DirectDepositStatus> {
    try {
      // Query transaction from database
      const transaction = await this.config.storage.getTransactionByTxHash(transactionId);
      
      if (!transaction) {
        return {
          id: transactionId,
          status: "failed",
          error: "Transaction not found"
        };
      }

      // Map database status to DirectDepositStatus
      let status: "pending" | "processing" | "completed" | "failed";
      switch (transaction.status) {
        case "pending":
          status = "pending";
          break;
        case "processing":
          status = "processing";
          break;
        case "completed":
          status = "completed";
          break;
        default:
          status = "failed";
      }

      // Build steps based on transaction type
      const isDeposit = transaction.type === "direct_fxrp_deposit";
      const steps: DirectDepositStatus["steps"] = isDeposit ? [
        { 
          id: "approve", 
          title: "Approve FXRP", 
          status: transaction.status === "completed" ? "completed" : 
                  transaction.status === "processing" ? "in-progress" : "pending"
        },
        { 
          id: "deposit", 
          title: "Deposit to Vault", 
          status: transaction.status === "completed" ? "completed" :
                  transaction.status === "processing" && transaction.txHash ? "in-progress" : "pending",
          txHash: transaction.txHash || undefined
        },
        { 
          id: "confirmation", 
          title: "Confirm Transaction", 
          status: transaction.status === "completed" ? "completed" : "pending"
        }
      ] : [
        { 
          id: "redeem", 
          title: "Redeem shXRP Shares", 
          status: transaction.status === "completed" ? "completed" :
                  transaction.status === "processing" ? "in-progress" : "pending",
          txHash: transaction.txHash || undefined
        },
        { 
          id: "withdraw", 
          title: "Withdraw FXRP", 
          status: transaction.status === "completed" ? "completed" : "pending"
        },
        { 
          id: "confirmation", 
          title: "Confirm Transaction", 
          status: transaction.status === "completed" ? "completed" : "pending"
        }
      ];

      return {
        id: transactionId,
        status,
        steps,
        txHash: transaction.txHash || undefined,
        error: transaction.status === "failed" ? "Transaction failed" : undefined
      };
    } catch (error) {
      console.error("Error fetching transaction status:", error);
      return {
        id: transactionId,
        status: "failed",
        error: "Failed to fetch transaction status"
      };
    }
  }
}
