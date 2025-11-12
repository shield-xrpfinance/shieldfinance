import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "../../shared/flare-contracts";
import { FIRELIGHT_VAULT_ABI } from "../../shared/flare-abis";
import { SmartAccountClient } from "./smart-account-client";
import { SmartAccountSigner } from "./smart-account-signer";

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

/**
 * FlareClient - Smart Account Only
 * All transactions are routed through ERC-4337 account abstraction for gasless, batched execution.
 */
export class FlareClient {
  public provider: ethers.JsonRpcProvider;
  private network: "mainnet" | "coston2";
  private rpcUrl: string;
  private smartAccountClient: SmartAccountClient;

  constructor(config: FlareClientConfig) {
    this.network = config.network;
    
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

  getFXRPToken() {
    const address = FLARE_CONTRACTS[this.network].fassets.fxrpToken;
    const ERC20_ABI = [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
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
}
