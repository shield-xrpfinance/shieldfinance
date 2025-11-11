import { ethers } from "ethers";
import type { FlareClient } from "./flare-client";

export interface FAssetsConfig {
  network: "mainnet" | "coston2";
  flareClient: FlareClient;
}

export interface AgentInfo {
  vaultAddress: string;
  underlyingAddress: string;
  feeBIPS: bigint;
  freeCollateralLots: bigint;
  status: bigint;
}

export interface CollateralReservation {
  reservationId: bigint;
  reservationTxHash: string;
  agentVault: string;
  agentUnderlyingAddress: string;
  feeBIPS: bigint;  // Agent's fee in basis points (e.g., 100 = 1%)
  valueUBA: bigint;
  feeUBA: bigint;   // Calculated fee amount in underlying base amount
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
}

export class FAssetsClient {
  private config: FAssetsConfig;
  private assetManagerAddress: string | null = null;

  constructor(config: FAssetsConfig) {
    this.config = config;
    console.log(`FAssetsClient initializing for ${config.network}...`);
  }

  /**
   * Get AssetManager address from Flare Contract Registry
   * The Contract Registry dynamically provides deployed contract addresses
   */
  private async getAssetManagerAddress(): Promise<string> {
    if (this.assetManagerAddress) {
      return this.assetManagerAddress;
    }

    try {
      // Flare Contract Registry address (same on all networks)
      const CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
      
      // Contract Registry ABI (minimal)
      const registryABI = [
        "function getContractAddressByName(string memory _name) external view returns (address)"
      ];

      const registry = new ethers.Contract(
        CONTRACT_REGISTRY_ADDRESS,
        registryABI,
        this.config.flareClient.provider
      );

      // Get AssetManager address for FXRP
      const address = await registry.getContractAddressByName("AssetManager");
      this.assetManagerAddress = address;
      
      console.log(`✅ Retrieved AssetManager from Contract Registry`);
      console.log(`   Network: ${this.config.network}`);
      console.log(`   AssetManager: ${address}`);
      
      return address;
    } catch (error) {
      console.error("Failed to get AssetManager from Contract Registry:", error);
      throw new Error(
        `Failed to retrieve AssetManager address from Flare Contract Registry for ${this.config.network}. ` +
        `Ensure you're connected to the correct network and the Contract Registry is accessible.`
      );
    }
  }

  private async getAssetManager(): Promise<ethers.Contract> {
    const assetManagerAddress = await this.getAssetManagerAddress();
    const AssetManagerABI = require("@flarenetwork/flare-periphery-contracts/artifacts/contracts/fasset/interfaces/IAssetManager.sol/IAssetManager.json");
    
    const contract = new ethers.Contract(
      assetManagerAddress,
      AssetManagerABI.abi,
      this.config.flareClient.signer || this.config.flareClient.provider
    );
    
    return contract;
  }

  async findBestAgent(lotsRequired: number): Promise<AgentInfo | null> {
    const assetManager = await this.getAssetManager();
    
    const { _agents: agents } = await assetManager.getAvailableAgentsDetailedList(0, 100);
    
    const agentsWithLots = agents.filter(
      (agent: any) => Number(agent.freeCollateralLots) >= lotsRequired
    );
    
    if (agentsWithLots.length === 0) {
      return null;
    }
    
    agentsWithLots.sort((a: any, b: any) => Number(a.feeBIPS) - Number(b.feeBIPS));
    
    for (const agent of agentsWithLots) {
      const info = await assetManager.getAgentInfo(agent.agentVault);
      
      if (Number(info.status) === 0) {
        return {
          vaultAddress: agent.agentVault,
          underlyingAddress: info.underlyingAddress,
          feeBIPS: info.feeBIPS,
          freeCollateralLots: agent.freeCollateralLots,
          status: info.status,
        };
      }
    }
    
    return null;
  }

  async reserveCollateral(
    lotsToMint: number
  ): Promise<CollateralReservation> {
    const assetManager = await this.getAssetManager();
    
    const agent = await this.findBestAgent(lotsToMint);
    if (!agent) {
      throw new Error("No suitable agent found with enough free collateral");
    }
    
    console.log(`Selected agent: ${agent.vaultAddress}`);
    console.log(`  Fee: ${agent.feeBIPS} BIPS`);
    console.log(`  Free lots: ${agent.freeCollateralLots}`);
    
    const collateralReservationFee = await assetManager.collateralReservationFee(lotsToMint);
    console.log(`Collateral reservation fee: ${ethers.formatEther(collateralReservationFee)} FLR`);
    
    const tx = await assetManager.reserveCollateral(
      agent.vaultAddress,
      lotsToMint,
      agent.feeBIPS,
      ethers.ZeroAddress,
      { value: collateralReservationFee }
    );
    
    const receipt = await tx.wait();
    console.log(`Collateral reserved: ${receipt.hash}`);
    
    const reservationEvent = this.parseCollateralReservedEvent(receipt);
    
    return {
      reservationId: reservationEvent.collateralReservationId,
      reservationTxHash: receipt.hash,
      agentVault: agent.vaultAddress,
      agentUnderlyingAddress: reservationEvent.paymentAddress,
      feeBIPS: agent.feeBIPS,  // Agent's fee rate in basis points
      valueUBA: reservationEvent.valueUBA,
      feeUBA: reservationEvent.feeUBA,  // Calculated fee amount
      lastUnderlyingBlock: reservationEvent.lastUnderlyingBlock,
      lastUnderlyingTimestamp: reservationEvent.lastUnderlyingTimestamp,
    };
  }

  async executeMinting(
    proof: any,
    reservationId: bigint
  ): Promise<string> {
    const assetManager = await this.getAssetManager();
    
    const tx = await assetManager.executeMinting(proof, reservationId);
    const receipt = await tx.wait();
    
    console.log(`Minting executed: ${receipt.hash}`);
    return receipt.hash;
  }

  async calculateLots(xrpAmount: string): Promise<number> {
    const assetManager = await this.getAssetManager();
    const lotSize = await assetManager.lotSize();
    const decimals = await assetManager.assetMintingDecimals();
    
    const amountUBA = ethers.parseUnits(xrpAmount, Number(decimals));
    const lots = Number(amountUBA / lotSize);
    
    return Math.ceil(lots);
  }

  async getAssetDecimals(): Promise<number> {
    const assetManager = await this.getAssetManager();
    return Number(await assetManager.assetMintingDecimals());
  }

  private parseCollateralReservedEvent(receipt: any): any {
    const AssetManagerABI = require("@flarenetwork/flare-periphery-contracts/artifacts/contracts/fasset/interfaces/IAssetManager.sol/IAssetManager.json");
    const iface = new ethers.Interface(AssetManagerABI.abi);
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "CollateralReserved") {
          return parsed.args;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("CollateralReserved event not found in transaction");
  }
}
