import { ethers } from "ethers";
import { FLARE_CONTRACTS } from "../../shared/flare-contracts";
import { FIRELIGHT_VAULT_ABI } from "../../shared/flare-abis";

// Vault Controller ABI (ERC-4626 wrapper with additional functionality)
const VAULT_CONTROLLER_ABI = [
  "function createVault(address asset) returns (address)",
  "function getVault(address asset) view returns (address)",
] as const;

export interface FlareClientConfig {
  network: "mainnet" | "coston2";
  privateKey: string;
}

/**
 * FlareClient - Simple EOA Wallet
 * Uses ethers.Wallet directly for smart contract interactions
 */
export class FlareClient {
  public provider: ethers.JsonRpcProvider;
  private network: "mainnet" | "coston2";
  private rpcUrl: string;
  private wallet: ethers.Wallet;

  constructor(config: FlareClientConfig) {
    this.network = config.network;
    
    this.rpcUrl = config.network === "mainnet"
      ? "https://flare-api.flare.network/ext/C/rpc"
      : "https://coston2-api.flare.network/ext/C/rpc";
    
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    
    // Ensure private key has 0x prefix
    const privateKey = config.privateKey.startsWith('0x') 
      ? config.privateKey 
      : `0x${config.privateKey}`;
    
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async initialize(): Promise<void> {
    const address = await this.wallet.getAddress();
    console.log(`🔐 Using Wallet: ${address}`);
  }

  getSignerAddress(): string {
    return this.wallet.address;
  }

  getContractSigner(): ethers.Signer {
    return this.wallet;
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
    const txResponse = await this.wallet.sendTransaction({
      to: tx.to,
      value: tx.value,
      data: tx.data,
    });
    const receipt = await txResponse.wait();
    return receipt!.hash;
  }

  async sendBatchTransactions(txs: Array<{
    to: string;
    value?: bigint | string;
    data?: string;
  }>): Promise<string> {
    // For regular wallets, execute transactions sequentially
    // Last transaction hash is returned
    let lastTxHash = "";
    for (const tx of txs) {
      lastTxHash = await this.sendTransaction(tx);
    }
    return lastTxHash;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }
}
