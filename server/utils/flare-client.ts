import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "../../shared/flare-contracts";
import { FIRELIGHT_VAULT_ABI } from "../../shared/flare-abis";
import { SmartAccountClient } from "./smart-account-client";

// Vault Controller ABI (ERC-4626 wrapper with additional functionality)
const VAULT_CONTROLLER_ABI = [
  "function createVault(address asset) returns (address)",
  "function getVault(address asset) view returns (address)",
] as const;

export type SigningMode = 'eoa' | 'smart-account';

export interface FlareClientConfig {
  network: "mainnet" | "coston2";
  privateKey?: string;
  signingMode?: SigningMode;
  bundlerApiKey?: string;
  enablePaymaster?: boolean;
}

export class FlareClient {
  public provider: ethers.JsonRpcProvider;
  public signer?: ethers.Wallet;
  private network: "mainnet" | "coston2";
  private rpcUrl: string;
  private signingMode: SigningMode;
  private smartAccountClient?: SmartAccountClient;

  constructor(config: FlareClientConfig) {
    this.network = config.network;
    this.signingMode = config.signingMode || 'eoa';
    
    this.rpcUrl = config.network === "mainnet"
      ? "https://flare-api.flare.network/ext/C/rpc"
      : "https://coston2-api.flare.network/ext/C/rpc";
    
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    if (config.privateKey) {
      if (this.signingMode === 'smart-account') {
        const chainId = config.network === "mainnet" ? 14 : 114;
        this.smartAccountClient = new SmartAccountClient({
          chainId,
          privateKey: config.privateKey,
          bundlerApiKey: config.bundlerApiKey,
          rpcUrl: this.rpcUrl,
          enablePaymaster: config.enablePaymaster,
        });
      } else {
        this.signer = new ethers.Wallet(config.privateKey, this.provider);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.signingMode === 'smart-account' && this.smartAccountClient) {
      await this.smartAccountClient.initialize();
      console.log(`🔐 Using Smart Account: ${this.smartAccountClient.getAddress()}`);
    } else if (this.signer) {
      console.log(`🔐 Using EOA: ${this.signer.address}`);
    }
  }

  getSignerAddress(): string {
    if (this.signingMode === 'smart-account' && this.smartAccountClient) {
      return this.smartAccountClient.getAddress();
    } else if (this.signer) {
      return this.signer.address;
    }
    throw new Error('No signer configured');
  }

  getContractSigner(): ethers.Signer {
    if (this.signingMode === 'smart-account' && this.smartAccountClient) {
      console.warn('⚠️  Smart account mode not fully implemented - falling back to EOA for contract calls');
      return this.smartAccountClient.getEOASigner();
    } else if (this.signer) {
      return this.signer;
    }
    throw new Error('No signer configured');
  }

  getVaultController(address: string) {
    const contract = new ethers.Contract(address, VAULT_CONTROLLER_ABI, this.provider);
    return this.signer || this.smartAccountClient ? contract.connect(this.getContractSigner()) : contract;
  }

  getShXRPVault(address: string) {
    const contract = new ethers.Contract(address, FIRELIGHT_VAULT_ABI, this.provider);
    return this.signer || this.smartAccountClient ? contract.connect(this.getContractSigner()) : contract;
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
    return this.signer || this.smartAccountClient ? contract.connect(this.getContractSigner()) : contract;
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
    if (this.signingMode === 'smart-account' && this.smartAccountClient) {
      const userOpHash = await this.smartAccountClient.sendTransaction(tx);
      const receipt = await this.smartAccountClient.waitForUserOpReceipt(userOpHash);
      return receipt.receipt.transactionHash;
    } else if (this.signer) {
      const txResponse = await this.signer.sendTransaction({
        to: tx.to,
        value: tx.value,
        data: tx.data,
      });
      const receipt = await txResponse.wait();
      return receipt!.hash;
    }
    throw new Error('No signer configured');
  }

  async sendBatchTransactions(txs: Array<{
    to: string;
    value?: bigint | string;
    data?: string;
  }>): Promise<string> {
    if (this.signingMode === 'smart-account' && this.smartAccountClient) {
      const userOpHash = await this.smartAccountClient.sendBatchTransactions(txs);
      const receipt = await this.smartAccountClient.waitForUserOpReceipt(userOpHash);
      return receipt.receipt.transactionHash;
    } else {
      for (const tx of txs) {
        await this.sendTransaction(tx);
      }
      return 'batch-complete';
    }
  }

  getSmartAccountClient(): SmartAccountClient | undefined {
    return this.smartAccountClient;
  }
}
