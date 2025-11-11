import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";
import { readFileSync } from "fs";
import { join } from "path";
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
  private assetManagerABI: any = null;

  constructor(config: FAssetsConfig) {
    this.config = config;
    console.log(`FAssetsClient initializing for ${config.network}...`);
  }

  /**
   * Load AssetManager ABI (cached for reuse)
   * Uses fs.readFileSync for reliable JSON loading in Node.js environment
   */
  private getAssetManagerABI(): any {
    if (this.assetManagerABI) {
      return this.assetManagerABI;
    }

    try {
      // Use network-specific artifact path from flare-periphery-contract-artifacts package
      // The package has separate folders for each network: coston2, flare, etc.
      const networkFolder = this.config.network === "mainnet" ? "flare" : "coston2";
      const artifactPath = join(
        process.cwd(),
        "node_modules",
        "@flarenetwork",
        "flare-periphery-contract-artifacts",
        networkFolder,
        "artifacts",
        "contracts",
        "IAssetManager.sol",
        "IAssetManager.json"
      );
      
      // Read JSON file directly using fs.readFileSync (works reliably in Node.js)
      const abiJson = readFileSync(artifactPath, "utf8");
      this.assetManagerABI = JSON.parse(abiJson);
      
      console.log(`✅ Loaded AssetManager ABI for ${this.config.network}`);
      return this.assetManagerABI;
    } catch (error) {
      console.error(`Failed to load AssetManager ABI for ${this.config.network}:`, error);
      throw new Error(`Failed to load AssetManager ABI for network ${this.config.network}`);
    }
  }

  /**
   * Get AssetManager address from Flare Contract Registry
   * Uses the official nameToAddress() helper from @flarenetwork/flare-periphery-contract-artifacts
   */
  private async getAssetManagerAddress(): Promise<string> {
    if (this.assetManagerAddress) {
      return this.assetManagerAddress;
    }

    try {
      // Use official helper to get AssetManager address from Flare Contract Registry
      // Registry key is "AssetManagerFXRP" (verified via scripts/get-assetmanager-address.ts)
      const networkName = this.config.network === "mainnet" ? "flare" : "coston2";
      const address = await nameToAddress(
        "AssetManagerFXRP",
        networkName,
        this.config.flareClient.provider
      );
      
      // Validate that we got a real address, not the zero address
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(
          `Contract Registry returned zero address for "AssetManagerFXRP" on ${this.config.network}. ` +
          `This means AssetManager is not deployed or the registry is misconfigured.`
        );
      }
      
      this.assetManagerAddress = address;
      
      console.log(`✅ Retrieved AssetManager from Contract Registry`);
      console.log(`   Network: ${this.config.network}`);
      console.log(`   Registry Key: "AssetManagerFXRP"`);
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
    const AssetManagerABI = this.getAssetManagerABI();
    
    // The ABI file is directly an array, not an object with an 'abi' property
    const contract = new ethers.Contract(
      assetManagerAddress,
      AssetManagerABI,
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
    
    // Calculate lots using BigInt arithmetic to avoid precision loss
    // Formula: lots = ceil(amountUBA / lotSize)
    const lots = (amountUBA + lotSize - 1n) / lotSize; // Ceiling division for BigInt
    const lotsNumber = Number(lots);
    
    // Check minimum: FAssets requires at least 1 lot
    if (lotsNumber < 1) {
      const minAmount = ethers.formatUnits(lotSize, Number(decimals));
      throw new Error(
        `Amount too small. Minimum deposit is ${minAmount} XRP (1 lot). ` +
        `Please increase your deposit amount.`
      );
    }
    
    console.log(`Lot size: ${ethers.formatUnits(lotSize, Number(decimals))} XRP`);
    console.log(`Amount: ${xrpAmount} XRP = ${lotsNumber} lot(s)`);
    
    return lotsNumber;
  }

  async getAssetDecimals(): Promise<number> {
    const assetManager = await this.getAssetManager();
    return Number(await assetManager.assetMintingDecimals());
  }

  private parseCollateralReservedEvent(receipt: any): any {
    const AssetManagerABI = this.getAssetManagerABI();
    // The ABI file is directly an array, not an object with an 'abi' property
    const iface = new ethers.Interface(AssetManagerABI);
    
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
