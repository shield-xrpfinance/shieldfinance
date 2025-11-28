import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "../../shared/flare-contracts";
import { FIRELIGHT_VAULT_ABI } from "../../shared/flare-abis";
import { SmartAccountClient } from "./smart-account-client";
import { SmartAccountSigner } from "./smart-account-signer";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

// Vault Controller ABI (ERC-4626 wrapper with additional functionality)
const VAULT_CONTROLLER_ABI = [
  "function createVault(address asset) returns (address)",
  "function getVault(address asset) view returns (address)",
] as const;

export interface FlareClientConfig {
  network: "mainnet" | "coston2";
  privateKey: string;
  bundlerApiKey: string;
  enablePaymaster?: boolean;
}

export interface VaultMetrics {
  totalAssets: string;
  totalSupply: string;
  pricePerShare: string;
  utilization: number;
}

/**
 * FlareClient - Smart Account Implementation for BRIDGING ONLY
 * 
 * IMPORTANT: This client should ONLY be used for XRPL bridging operations.
 * Direct FXRP deposits/withdrawals on Flare should be signed by users' EOA wallets.
 * 
 * Use cases:
 * - ✅ XRPL → FXRP bridging via FAssets protocol
 * - ✅ Managing bridged funds during the bridging process
 * - ❌ Direct FXRP deposits (users should sign with their own wallets)
 * - ❌ Direct FXRP withdrawals (users should sign with their own wallets)
 * 
 * All transactions through this client are routed via ERC-4337 account abstraction.
 */
export class FlareClient {
  public provider: ethers.JsonRpcProvider;
  private network: "mainnet" | "coston2";
  private rpcUrl: string;
  private smartAccountClient: SmartAccountClient;
  private fAssetTokenAddressCache: string | null = null;
  private operatorPrivateKey: string; // Operator EOA private key (for emergency prefunding)
  private paymasterEnabled: boolean;

  constructor(config: FlareClientConfig) {
    this.network = config.network;
    this.operatorPrivateKey = config.privateKey;
    this.paymasterEnabled = config.enablePaymaster || false;
    
    this.rpcUrl = config.network === "mainnet"
      ? "https://flare-api.flare.network/ext/C/rpc"
      : "https://coston2-api.flare.network/ext/C/rpc";
    
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    const chainId = config.network === "mainnet" ? 14 : 114;
    this.smartAccountClient = new SmartAccountClient({
      chainId,
      privateKey: config.privateKey,
      bundlerApiKey: config.bundlerApiKey,
      rpcUrl: this.rpcUrl,
      enablePaymaster: config.enablePaymaster,
    });
  }

  async initialize(): Promise<void> {
    await this.smartAccountClient.initialize();
    console.log(`🔐 Using Smart Account: ${this.smartAccountClient.getAddress()}`);
  }

  getSignerAddress(): string {
    return this.smartAccountClient.getAddress();
  }

  async getSmartAccountBalance(): Promise<bigint> {
    return await this.smartAccountClient.getNativeBalance();
  }

  getContractSigner(): ethers.Signer {
    return new SmartAccountSigner(this.smartAccountClient, this.provider);
  }

  getVaultController(address: string) {
    const contract = new ethers.Contract(address, VAULT_CONTROLLER_ABI, this.provider);
    return contract.connect(this.getContractSigner());
  }

  getShXRPVault(address: string) {
    const contract = new ethers.Contract(address, FIRELIGHT_VAULT_ABI, this.provider);
    return contract.connect(this.getContractSigner());
  }

  /**
   * Dynamically fetches the FAsset (FXRP) token address from AssetManager contract.
   * Uses caching to avoid repeated on-chain calls.
   * This ensures we always use the correct token address.
   */
  async getFAssetTokenAddress(): Promise<string> {
    // Return cached address if available
    if (this.fAssetTokenAddressCache) {
      return this.fAssetTokenAddressCache;
    }

    // Get AssetManager address from Flare Contract Registry
    const networkName = this.network;
    const assetManagerAddress = await nameToAddress(
      "AssetManagerFXRP",
      networkName,
      this.provider
    );

    // Query AssetManager for the fAsset token address
    const assetManagerAbi = ["function fAsset() external view returns (address)"];
    const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, this.provider);
    const fAssetAddress = await assetManager.fAsset();

    // Cache the result
    this.fAssetTokenAddressCache = fAssetAddress;
    
    console.log(`✅ FXRP Token Address (from AssetManager): ${fAssetAddress}`);
    
    return fAssetAddress;
  }

  /**
   * Returns an FXRP token contract instance with the dynamically resolved address.
   * IMPORTANT: This is now async and resolves the token address from AssetManager.
   */
  async getFXRPToken() {
    const address = await this.getFAssetTokenAddress();
    const ERC20_ABI = [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];
    const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
    return contract.connect(this.getContractSigner());
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async waitForTransaction(txHash: string, confirmations: number = 1) {
    const receipt = await this.provider.waitForTransaction(txHash, confirmations);
    return receipt;
  }

  async sendTransaction(tx: {
    to: string;
    value?: bigint | string;
    data?: string;
  }): Promise<string> {
    const userOpHash = await this.smartAccountClient.sendTransaction(tx);
    const receipt = await this.smartAccountClient.waitForUserOpReceipt(userOpHash);
    return receipt.receipt.transactionHash;
  }

  async sendBatchTransactions(txs: Array<{
    to: string;
    value?: bigint | string;
    data?: string;
  }>): Promise<string> {
    const userOpHash = await this.smartAccountClient.sendBatchTransactions(txs);
    const receipt = await this.smartAccountClient.waitForUserOpReceipt(userOpHash);
    return receipt.receipt.transactionHash;
  }

  getSmartAccountClient(): SmartAccountClient {
    return this.smartAccountClient;
  }

  /**
   * Check if paymaster is enabled for gasless transactions
   */
  isPaymasterEnabled(): boolean {
    return this.paymasterEnabled;
  }

  /**
   * Auto-prefund Smart Account from operator EOA
   * 
   * This is an emergency remediation method used when:
   * 1. Smart Account has insufficient FLR for gas
   * 2. Paymaster is not enabled or failed
   * 3. A transaction needs to be submitted (e.g., redemption confirmation)
   * 
   * @param amountFLR - Amount of FLR to send (default: 0.5 FLR)
   * @returns Transaction hash of the funding transaction
   */
  async prefundSmartAccount(amountFLR: string = "0.5"): Promise<string> {
    console.log(`\n💰 Auto-prefunding Smart Account...`);
    
    // Create EOA wallet from operator private key
    const operatorWallet = new ethers.Wallet(this.operatorPrivateKey, this.provider);
    const smartAccountAddress = this.smartAccountClient.getAddress();
    
    // Check operator balance
    const operatorBalance = await this.provider.getBalance(operatorWallet.address);
    const amountWei = ethers.parseEther(amountFLR);
    
    console.log(`   Operator EOA: ${operatorWallet.address}`);
    console.log(`   Operator Balance: ${ethers.formatEther(operatorBalance)} FLR`);
    console.log(`   Smart Account: ${smartAccountAddress}`);
    console.log(`   Funding Amount: ${amountFLR} FLR`);
    
    // Validate operator has enough balance (including gas buffer)
    const gasBuffer = ethers.parseEther("0.01"); // 0.01 FLR for gas
    if (operatorBalance < amountWei + gasBuffer) {
      throw new Error(
        `Insufficient operator balance: ${ethers.formatEther(operatorBalance)} FLR ` +
        `(need ${ethers.formatEther(amountWei + gasBuffer)} FLR including gas)`
      );
    }
    
    // Send FLR from operator EOA to Smart Account
    console.log(`   📤 Sending ${amountFLR} FLR from operator EOA to Smart Account...`);
    
    const tx = await operatorWallet.sendTransaction({
      to: smartAccountAddress,
      value: amountWei,
    });
    
    console.log(`   ⏳ Waiting for funding transaction: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Funding transaction failed - no receipt received');
    }
    
    console.log(`   ✅ Smart Account funded: ${tx.hash}`);
    console.log(`   Gas used: ${receipt.gasUsed} (${ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || BigInt(0)))} FLR)`);
    
    // Verify new balance
    const newBalance = await this.provider.getBalance(smartAccountAddress);
    console.log(`   💰 New Smart Account balance: ${ethers.formatEther(newBalance)} FLR`);
    
    return tx.hash;
  }

  /**
   * Get operator EOA address (for logging/debugging)
   */
  getOperatorEOAAddress(): string {
    const wallet = new ethers.Wallet(this.operatorPrivateKey);
    return wallet.address;
  }

  /**
   * Get operator EOA balance
   */
  async getOperatorEOABalance(): Promise<bigint> {
    const wallet = new ethers.Wallet(this.operatorPrivateKey);
    return await this.provider.getBalance(wallet.address);
  }

  /**
   * Returns the current network ("mainnet" | "coston2")
   */
  getNetwork(): "mainnet" | "coston2" {
    return this.network;
  }

  /**
   * Returns the JsonRpcProvider for external use
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Returns a read-only ethers.Contract connected to provider (no signer needed)
   * for querying ERC-4626 vault data
   * 
   * @param address - The vault contract address
   * @returns Read-only ethers.Contract instance
   */
  getVaultReadContract(address: string): ethers.Contract {
    return new ethers.Contract(address, FIRELIGHT_VAULT_ABI, this.provider);
  }

  /**
   * Fetches vault metrics from an ERC-4626 vault contract
   * 
   * @param vaultAddress - The vault contract address
   * @returns VaultMetrics with totalAssets, totalSupply, pricePerShare, and utilization
   *          Returns null if RPC calls fail
   */
  async getVaultMetrics(vaultAddress: string): Promise<VaultMetrics | null> {
    try {
      const vault = this.getVaultReadContract(vaultAddress);
      const DECIMALS = 6;

      const zero = BigInt(0);
      const [totalAssets, totalSupply, depositLimit] = await Promise.all([
        vault.totalAssets() as Promise<bigint>,
        vault.totalSupply() as Promise<bigint>,
        vault.depositLimit().catch(() => zero) as Promise<bigint>,
      ]);

      let pricePerShare: string;
      if (totalSupply === zero) {
        pricePerShare = "1.000000";
      } else {
        const oneShare = BigInt(10 ** DECIMALS);
        const assetsPerShare = await vault.convertToAssets(oneShare) as bigint;
        pricePerShare = ethers.formatUnits(assetsPerShare, DECIMALS);
      }

      let utilization = 0;
      if (depositLimit > zero) {
        const multiplier = BigInt(10000);
        utilization = Number((totalAssets * multiplier) / depositLimit) / 100;
      }

      return {
        totalAssets: ethers.formatUnits(totalAssets, DECIMALS),
        totalSupply: ethers.formatUnits(totalSupply, DECIMALS),
        pricePerShare,
        utilization,
      };
    } catch (error) {
      console.error(`Failed to fetch vault metrics for ${vaultAddress}:`, error);
      return null;
    }
  }
}
