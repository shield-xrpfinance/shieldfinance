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
  private assetManagerAddress: string;

  constructor(config: FAssetsConfig) {
    this.config = config;
    
    // Get AssetManager address from environment
    const envKey = config.network === "mainnet"
      ? "FASSETS_ASSET_MANAGER_MAINNET"
      : "FASSETS_ASSET_MANAGER_COSTON2";
    
    this.assetManagerAddress = process.env[envKey] || "";
    
    if (!this.assetManagerAddress || this.assetManagerAddress === "0x...") {
      throw new Error(
        `AssetManager address not configured for ${config.network}. ` +
        `Set ${envKey} environment variable to the correct contract address. ` +
        `Get address from Flare Contract Registry: https://dev.flare.network/network/guides/flare-contracts-registry`
      );
    }
    
    console.log(`FAssetsClient initialized for ${config.network}`);
    console.log(`  AssetManager: ${this.assetManagerAddress}`);
  }

  private getAssetManager(): ethers.Contract {
    const AssetManagerABI = require("@flarenetwork/flare-periphery-contracts/artifacts/contracts/fasset/interfaces/IAssetManager.sol/IAssetManager.json");
    
    const contract = new ethers.Contract(
      this.assetManagerAddress,
      AssetManagerABI.abi,
      this.config.flareClient.signer || this.config.flareClient.provider
    );
    
    return contract;
  }

  async findBestAgent(lotsRequired: number): Promise<AgentInfo | null> {
    const assetManager = this.getAssetManager();
    
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
    const assetManager = this.getAssetManager();
    
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
    const assetManager = this.getAssetManager();
    
    const tx = await assetManager.executeMinting(proof, reservationId);
    const receipt = await tx.wait();
    
    console.log(`Minting executed: ${receipt.hash}`);
    return receipt.hash;
  }

  async calculateLots(xrpAmount: string): Promise<number> {
    const assetManager = this.getAssetManager();
    const lotSize = await assetManager.lotSize();
    const decimals = await assetManager.assetMintingDecimals();
    
    const amountUBA = ethers.parseUnits(xrpAmount, Number(decimals));
    const lots = Number(amountUBA / lotSize);
    
    return Math.ceil(lots);
  }

  async getAssetDecimals(): Promise<number> {
    const assetManager = this.getAssetManager();
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
