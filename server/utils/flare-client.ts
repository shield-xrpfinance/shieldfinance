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
  privateKey?: string; // Optional: for operator transactions
}

export class FlareClient {
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private network: "mainnet" | "coston2";

  constructor(config: FlareClientConfig) {
    this.network = config.network;
    
    // RPC URLs
    const rpcUrl = config.network === "mainnet"
      ? "https://flare-api.flare.network/ext/C/rpc"
      : "https://coston2-api.flare.network/ext/C/rpc";
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  // Get contract instances
  getVaultController(address: string) {
    const contract = new ethers.Contract(address, VAULT_CONTROLLER_ABI, this.provider);
    return this.signer ? contract.connect(this.signer) : contract;
  }

  getShXRPVault(address: string) {
    const contract = new ethers.Contract(address, FIRELIGHT_VAULT_ABI, this.provider);
    return this.signer ? contract.connect(this.signer) : contract;
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
    return this.signer ? contract.connect(this.signer) : contract;
  }

  // Utility methods
  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async waitForTransaction(txHash: string, confirmations: number = 1) {
    const receipt = await this.provider.waitForTransaction(txHash, confirmations);
    return receipt;
  }
}
