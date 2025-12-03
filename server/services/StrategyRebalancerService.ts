import { ethers } from "ethers";
import type { FlareClient } from "../utils/flare-client";
import type { IStorage } from "../storage";
import { VAULT_CONTROLLER_ABI, SHXRP_VAULT_STRATEGY_ABI } from "@shared/flare-abis";
import { getCurrentNetwork, isFirelightEnabled, getNetworkConfig } from "../config/network-config";
import fs from "fs";
import path from "path";

export interface StrategyRebalancerConfig {
  flareClient: FlareClient;
  storage: IStorage;
  vaultAddress?: string;
  vaultControllerAddress?: string;
}

export interface AllocationInfo {
  bufferAmount: string;
  kineticAmount: string;
  firelightAmount: string;
  totalAssets: string;
  bufferPercent: number;
  kineticPercent: number;
  firelightPercent: number;
}

export interface TargetAllocationInfo {
  bufferTarget: string;
  kineticTarget: string;
  firelightTarget: string;
  bufferTargetBps: number;
  kineticTargetBps: number;
  firelightTargetBps: number;
}

export interface StrategyInfo {
  address: string;
  name: string;
  targetBps: number;
  status: string;
  totalDeployed: string;
  lastReportTimestamp: number;
}

export interface StrategyStatus {
  network: string;
  vaultAddress: string;
  vaultControllerAddress: string;
  firelightEnabled: boolean;
  currentAllocation: AllocationInfo;
  targetAllocation: TargetAllocationInfo;
  strategies: StrategyInfo[];
  needsRebalancing: boolean;
  rebalanceThresholdBps: number;
}

export interface RebalanceResult {
  success: boolean;
  txHash?: string;
  error?: string;
  simulated?: boolean;
  message?: string;
}

const STRATEGY_STATUS_MAP: Record<number, string> = {
  0: "Inactive",
  1: "Active",
  2: "Deprecated",
  3: "Paused"
};

const FXRP_DECIMALS = 6;
const DEFAULT_REBALANCE_THRESHOLD_BPS = 500;

export class StrategyRebalancerService {
  private config: StrategyRebalancerConfig;
  private vaultAddress: string = "";
  private vaultControllerAddress: string = "";
  private vaultContract: ethers.Contract | null = null;
  private vaultControllerContract: ethers.Contract | null = null;
  private ready: boolean = false;

  constructor(config: StrategyRebalancerConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log("🎯 Initializing StrategyRebalancerService...");

      this.vaultAddress = this.config.vaultAddress || this.getVaultAddressFromDeployment();
      this.vaultControllerAddress = this.config.vaultControllerAddress || this.getVaultControllerAddressFromDeployment();

      console.log(`   Vault: ${this.vaultAddress}`);
      console.log(`   VaultController: ${this.vaultControllerAddress}`);
      console.log(`   Network: ${getCurrentNetwork()}`);
      console.log(`   Firelight: ${isFirelightEnabled() ? "✅ Enabled" : "❌ Disabled (testnet)"}`);

      const provider = this.config.flareClient.getProvider();

      this.vaultContract = new ethers.Contract(
        this.vaultAddress,
        SHXRP_VAULT_STRATEGY_ABI,
        provider
      );

      this.vaultControllerContract = new ethers.Contract(
        this.vaultControllerAddress,
        VAULT_CONTROLLER_ABI,
        provider
      );

      const [totalAssets, strategyCount] = await Promise.all([
        this.vaultContract.totalAssets().catch(() => BigInt(0)),
        this.vaultControllerContract.getStrategyCount().catch(() => BigInt(0))
      ]);

      console.log(`   Total Assets: ${ethers.formatUnits(totalAssets, FXRP_DECIMALS)} FXRP`);
      console.log(`   Registered Strategies: ${strategyCount.toString()}`);

      this.ready = true;
      console.log("✅ StrategyRebalancerService initialized");
    } catch (error) {
      console.error("❌ StrategyRebalancerService initialization failed:", error);
      this.ready = false;
      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private getVaultAddressFromDeployment(): string {
    let vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;

    if (!vaultAddress || vaultAddress === "0x...") {
      try {
        const deploymentsDir = path.join(process.cwd(), "deployments");
        const latestFile = path.join(deploymentsDir, "coston2-latest.json");
        
        if (fs.existsSync(latestFile)) {
          const deployment = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
          vaultAddress = deployment.contracts?.ShXRPVault?.address;
        }

        if (!vaultAddress || vaultAddress === "0x...") {
          const files = fs.readdirSync(deploymentsDir)
            .filter(f => /coston2-\d+\.json/.test(f))
            .sort()
            .reverse();

          if (files.length > 0) {
            const deployment = JSON.parse(
              fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
            );
            vaultAddress = deployment.contracts?.ShXRPVault?.address;
          }
        }
      } catch (error) {
        console.warn("Failed to read vault address from deployments:", error);
      }
    }

    if (!vaultAddress || vaultAddress === "0x...") {
      throw new Error("ShXRP Vault address not configured");
    }

    return vaultAddress;
  }

  private getVaultControllerAddressFromDeployment(): string {
    let controllerAddress = process.env.VAULT_CONTROLLER_ADDRESS;

    if (!controllerAddress || controllerAddress === "0x...") {
      try {
        const deploymentsDir = path.join(process.cwd(), "deployments");
        
        const files = fs.readdirSync(deploymentsDir)
          .filter(f => /coston2-\d+\.json/.test(f))
          .sort()
          .reverse();

        for (const file of files) {
          const deployment = JSON.parse(
            fs.readFileSync(path.join(deploymentsDir, file), "utf-8")
          );
          if (deployment.contracts?.VaultController?.address) {
            controllerAddress = deployment.contracts.VaultController.address;
            break;
          }
        }
      } catch (error) {
        console.warn("Failed to read VaultController address from deployments:", error);
      }
    }

    if (!controllerAddress || controllerAddress === "0x...") {
      throw new Error("VaultController address not configured");
    }

    return controllerAddress;
  }

  async getCurrentAllocation(): Promise<AllocationInfo> {
    if (!this.vaultContract) {
      throw new Error("Service not initialized");
    }

    try {
      let bufferAmount = BigInt(0);
      let kineticAmount = BigInt(0);
      let firelightAmount = BigInt(0);
      let totalAssets = BigInt(0);

      try {
        if (this.vaultControllerContract) {
          const result = await this.vaultControllerContract.getCurrentAllocation(this.vaultAddress);
          bufferAmount = BigInt(result[0]);
          kineticAmount = BigInt(result[1]);
          firelightAmount = BigInt(result[2]);
          totalAssets = BigInt(result[3]);
        }
      } catch (controllerError) {
        console.warn("VaultController.getCurrentAllocation not available, falling back to vault queries");
        
        totalAssets = await this.vaultContract.totalAssets();
        
        const asset = await this.vaultContract.asset();
        const provider = this.config.flareClient.getProvider();
        const fxrpContract = new ethers.Contract(asset, ["function balanceOf(address) view returns (uint256)"], provider);
        bufferAmount = await fxrpContract.balanceOf(this.vaultAddress);
        
        const strategyCount = await this.vaultControllerContract?.getStrategyCount().catch(() => BigInt(0)) || BigInt(0);
        
        if (strategyCount > 0) {
          for (let i = 0; i < Number(strategyCount); i++) {
            try {
              const stratAddress = await this.vaultControllerContract!.strategyList(i);
              const stratName = await this.vaultControllerContract!.strategyNames(stratAddress).catch(() => "");
              const stratInfo = await this.vaultContract.strategies(stratAddress).catch(() => null);
              
              if (stratInfo) {
                const deployed = BigInt(stratInfo.totalDeployed || 0);
                if (stratName.toLowerCase().includes("kinetic")) {
                  kineticAmount = deployed;
                } else if (stratName.toLowerCase().includes("firelight")) {
                  firelightAmount = deployed;
                }
              }
            } catch (e) {
            }
          }
        }
      }

      const total = totalAssets;
      const buffer = bufferAmount;
      const kinetic = kineticAmount;
      const firelight = firelightAmount;

      const bufferPercent = total > 0 ? Number((buffer * BigInt(10000)) / total) / 100 : 100;
      const kineticPercent = total > 0 ? Number((kinetic * BigInt(10000)) / total) / 100 : 0;
      const firelightPercent = total > 0 ? Number((firelight * BigInt(10000)) / total) / 100 : 0;

      return {
        bufferAmount: ethers.formatUnits(buffer, FXRP_DECIMALS),
        kineticAmount: ethers.formatUnits(kinetic, FXRP_DECIMALS),
        firelightAmount: ethers.formatUnits(firelight, FXRP_DECIMALS),
        totalAssets: ethers.formatUnits(total, FXRP_DECIMALS),
        bufferPercent,
        kineticPercent,
        firelightPercent
      };
    } catch (error) {
      console.error("Failed to get current allocation:", error);
      throw error;
    }
  }

  async getTargetAllocation(): Promise<TargetAllocationInfo> {
    if (!this.vaultContract) {
      throw new Error("Service not initialized");
    }

    try {
      let bufferBps = 1000;
      let kineticBps = 4000;
      let firelightBps = 5000;

      try {
        if (this.vaultControllerContract) {
          const [bBuffer, bKinetic, bFirelight] = await Promise.all([
            this.vaultControllerContract.BUFFER_TARGET_BPS().catch(() => null),
            this.vaultControllerContract.KINETIC_TARGET_BPS().catch(() => null),
            this.vaultControllerContract.FIRELIGHT_TARGET_BPS().catch(() => null)
          ]);

          if (bBuffer !== null) bufferBps = Number(bBuffer);
          if (bKinetic !== null) kineticBps = Number(bKinetic);
          if (bFirelight !== null) firelightBps = Number(bFirelight);
        }
      } catch (controllerError) {
        console.warn("VaultController target allocation not available, using defaults (10%/40%/50%)");
      }

      const totalAssets = await this.vaultContract.totalAssets();

      const bufferTarget = (BigInt(totalAssets) * BigInt(bufferBps)) / BigInt(10000);
      const kineticTarget = (BigInt(totalAssets) * BigInt(kineticBps)) / BigInt(10000);
      const firelightTarget = (BigInt(totalAssets) * BigInt(firelightBps)) / BigInt(10000);

      return {
        bufferTarget: ethers.formatUnits(bufferTarget, FXRP_DECIMALS),
        kineticTarget: ethers.formatUnits(kineticTarget, FXRP_DECIMALS),
        firelightTarget: ethers.formatUnits(firelightTarget, FXRP_DECIMALS),
        bufferTargetBps: bufferBps,
        kineticTargetBps: kineticBps,
        firelightTargetBps: firelightBps
      };
    } catch (error) {
      console.error("Failed to get target allocation:", error);
      throw error;
    }
  }

  async checkRebalanceNeeded(thresholdBps: number = DEFAULT_REBALANCE_THRESHOLD_BPS): Promise<boolean> {
    if (!this.vaultContract) {
      throw new Error("Service not initialized");
    }

    try {
      const currentAllocation = await this.getCurrentAllocation();
      const targetAllocation = await this.getTargetAllocation();

      const bufferDiffBps = Math.abs(
        (currentAllocation.bufferPercent * 100) - targetAllocation.bufferTargetBps
      );

      const kineticDiffBps = Math.abs(
        (currentAllocation.kineticPercent * 100) - targetAllocation.kineticTargetBps
      );

      const firelightDiffBps = Math.abs(
        (currentAllocation.firelightPercent * 100) - targetAllocation.firelightTargetBps
      );

      return bufferDiffBps > thresholdBps || kineticDiffBps > thresholdBps || firelightDiffBps > thresholdBps;
    } catch (error) {
      console.error("Failed to check rebalance needed:", error);
      return false;
    }
  }

  async triggerRebalance(): Promise<RebalanceResult> {
    if (!this.vaultControllerContract) {
      throw new Error("Service not initialized");
    }

    const network = getCurrentNetwork();
    const firelightEnabled = isFirelightEnabled();

    try {
      const needsRebalancing = await this.checkRebalanceNeeded();
      if (!needsRebalancing) {
        return {
          success: true,
          simulated: false,
          message: "No rebalancing needed - allocations within threshold"
        };
      }

      if (!firelightEnabled) {
        const currentAllocation = await this.getCurrentAllocation();
        console.log(`📊 [SIMULATION] Rebalance triggered on ${network}`);
        console.log(`   Current buffer: ${currentAllocation.bufferPercent.toFixed(2)}%`);
        console.log(`   Firelight disabled on testnet - simulating only`);

        return {
          success: true,
          simulated: true,
          message: `Simulated rebalance on ${network} (Firelight disabled). Current buffer: ${currentAllocation.bufferPercent.toFixed(2)}%`
        };
      }

      const signer = await this.config.flareClient.getContractSigner();
      const controllerWithSigner = this.vaultControllerContract.connect(signer);

      console.log(`🔄 Triggering vault rebalance on ${network}...`);

      const tx = await controllerWithSigner.rebalanceVault(this.vaultAddress);
      console.log(`   TX submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Rebalance complete (block: ${receipt.blockNumber})`);

      return {
        success: true,
        txHash: tx.hash,
        message: "Vault rebalanced successfully"
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Rebalance failed:", errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  async deployToStrategies(amount?: string): Promise<RebalanceResult> {
    if (!this.vaultControllerContract) {
      throw new Error("Service not initialized");
    }

    const network = getCurrentNetwork();
    const firelightEnabled = isFirelightEnabled();

    try {
      let deployAmount: bigint;

      if (amount) {
        deployAmount = ethers.parseUnits(amount, FXRP_DECIMALS);
      } else {
        const currentAllocation = await this.getCurrentAllocation();
        const targetAllocation = await this.getTargetAllocation();

        const currentBuffer = ethers.parseUnits(currentAllocation.bufferAmount, FXRP_DECIMALS);
        const targetBuffer = ethers.parseUnits(targetAllocation.bufferTarget, FXRP_DECIMALS);

        if (currentBuffer <= targetBuffer) {
          return {
            success: true,
            message: "No excess buffer to deploy"
          };
        }

        deployAmount = currentBuffer - targetBuffer;
      }

      if (!firelightEnabled) {
        console.log(`📊 [SIMULATION] Deploy ${ethers.formatUnits(deployAmount, FXRP_DECIMALS)} FXRP to strategies on ${network}`);
        console.log(`   Firelight disabled on testnet - simulating only`);

        return {
          success: true,
          simulated: true,
          message: `Simulated deploy of ${ethers.formatUnits(deployAmount, FXRP_DECIMALS)} FXRP on ${network}`
        };
      }

      const signer = await this.config.flareClient.getContractSigner();
      const controllerWithSigner = this.vaultControllerContract.connect(signer);

      console.log(`📤 Deploying ${ethers.formatUnits(deployAmount, FXRP_DECIMALS)} FXRP to strategies...`);

      const tx = await controllerWithSigner.deployToStrategies(this.vaultAddress, deployAmount);
      console.log(`   TX submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Deploy complete (block: ${receipt.blockNumber})`);

      return {
        success: true,
        txHash: tx.hash,
        message: `Deployed ${ethers.formatUnits(deployAmount, FXRP_DECIMALS)} FXRP to strategies`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Deploy failed:", errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  async withdrawFromStrategies(amount: string): Promise<RebalanceResult> {
    if (!this.vaultControllerContract) {
      throw new Error("Service not initialized");
    }

    const network = getCurrentNetwork();
    const firelightEnabled = isFirelightEnabled();

    try {
      const withdrawAmount = ethers.parseUnits(amount, FXRP_DECIMALS);

      if (!firelightEnabled) {
        console.log(`📊 [SIMULATION] Withdraw ${amount} FXRP from strategies on ${network}`);
        console.log(`   Firelight disabled on testnet - simulating only`);

        return {
          success: true,
          simulated: true,
          message: `Simulated withdrawal of ${amount} FXRP on ${network}`
        };
      }

      const signer = await this.config.flareClient.getContractSigner();
      const controllerWithSigner = this.vaultControllerContract.connect(signer);

      console.log(`📥 Withdrawing ${amount} FXRP from strategies...`);

      const tx = await controllerWithSigner.withdrawFromStrategies(this.vaultAddress, withdrawAmount);
      console.log(`   TX submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`✅ Withdrawal complete (block: ${receipt.blockNumber})`);

      return {
        success: true,
        txHash: tx.hash,
        message: `Withdrew ${amount} FXRP from strategies`
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Withdrawal failed:", errorMsg);

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  async getStrategyStatus(thresholdBps: number = DEFAULT_REBALANCE_THRESHOLD_BPS): Promise<StrategyStatus> {
    if (!this.vaultContract) {
      throw new Error("Service not initialized");
    }

    try {
      const [currentAllocation, targetAllocation] = await Promise.all([
        this.getCurrentAllocation(),
        this.getTargetAllocation()
      ]);

      let strategyCount = 0;
      try {
        if (this.vaultControllerContract) {
          strategyCount = Number(await this.vaultControllerContract.getStrategyCount().catch(() => 0));
        }
      } catch (e) {
        console.warn("Could not get strategy count from VaultController");
      }

      const strategies: StrategyInfo[] = [];

      for (let i = 0; i < strategyCount; i++) {
        try {
          const strategyAddress = await this.vaultControllerContract!.strategyList(i);
          const strategyName = await this.vaultControllerContract!.strategyNames(strategyAddress).catch(() => `Strategy ${i}`);

          const strategyInfo = await this.vaultContract.strategies(strategyAddress).catch(() => null);

          if (strategyInfo) {
            strategies.push({
              address: strategyAddress,
              name: strategyName || `Strategy ${i}`,
              targetBps: Number(strategyInfo.targetBps || 0),
              status: STRATEGY_STATUS_MAP[Number(strategyInfo.status || 0)] || "Unknown",
              totalDeployed: ethers.formatUnits(strategyInfo.totalDeployed || 0, FXRP_DECIMALS),
              lastReportTimestamp: Number(strategyInfo.lastReportTimestamp || 0)
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch strategy ${i}:`, error);
        }
      }

      const needsRebalancing = await this.checkRebalanceNeeded(thresholdBps);

      return {
        network: getCurrentNetwork(),
        vaultAddress: this.vaultAddress,
        vaultControllerAddress: this.vaultControllerAddress,
        firelightEnabled: isFirelightEnabled(),
        currentAllocation,
        targetAllocation,
        strategies,
        needsRebalancing,
        rebalanceThresholdBps: thresholdBps
      };
    } catch (error) {
      console.error("Failed to get strategy status:", error);
      throw error;
    }
  }

  getVaultAddress(): string {
    return this.vaultAddress;
  }

  getVaultControllerAddress(): string {
    return this.vaultControllerAddress;
  }
}

let strategyRebalancerInstance: StrategyRebalancerService | null = null;

export function setStrategyRebalancerService(service: StrategyRebalancerService): void {
  strategyRebalancerInstance = service;
}

export function getStrategyRebalancerService(): StrategyRebalancerService | null {
  return strategyRebalancerInstance;
}
