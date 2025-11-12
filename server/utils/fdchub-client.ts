import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";
import { readFileSync } from "fs";
import { join } from "path";
import type { FlareClient } from "./flare-client";

export interface FdcHubConfig {
  network: "mainnet" | "coston2";
  flareClient: FlareClient;
}

export interface AttestationSubmission {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number; // Unix timestamp from Flare blockchain
}

/**
 * FdcHubClient handles attestation request submissions to Flare Data Connector Hub
 * 
 * Attestation Flow:
 * 1. Get encoded attestation request from FDC verifier (prepareRequest)
 * 2. Submit to FdcHub on-chain (requestAttestation) - THIS CLASS
 * 3. Wait for voting round finalization (~90-180 seconds)
 * 4. Poll Data Availability Layer for proof
 * 5. Use proof in smart contract verification
 */
export class FdcHubClient {
  private config: FdcHubConfig;
  private fdcHubAddress: string | null = null;
  private fdcHubABI: any = null;
  private feeConfigAddress: string | null = null;
  private feeConfigABI: any = null;

  constructor(config: FdcHubConfig) {
    this.config = config;
    console.log(`FdcHubClient initializing for ${config.network}...`);
  }

  /**
   * Load FdcHub ABI from flare-periphery-contract-artifacts
   */
  private getFdcHubABI(): any {
    if (this.fdcHubABI) {
      return this.fdcHubABI;
    }

    try {
      const networkFolder = this.config.network === "mainnet" ? "flare" : "coston2";
      const artifactPath = join(
        process.cwd(),
        "node_modules",
        "@flarenetwork",
        "flare-periphery-contract-artifacts",
        networkFolder,
        "artifacts",
        "contracts",
        "IFdcHub.sol",
        "IFdcHub.json"
      );
      
      const abiJson = readFileSync(artifactPath, "utf8");
      this.fdcHubABI = JSON.parse(abiJson);
      
      console.log(`✅ Loaded FdcHub ABI for ${this.config.network}`);
      return this.fdcHubABI;
    } catch (error) {
      console.error(`Failed to load FdcHub ABI for ${this.config.network}:`, error);
      throw new Error(`Failed to load FdcHub ABI for network ${this.config.network}`);
    }
  }

  /**
   * Load FdcRequestFeeConfigurations ABI for fee queries
   */
  private getFeeConfigABI(): any {
    if (this.feeConfigABI) {
      return this.feeConfigABI;
    }

    try {
      const networkFolder = this.config.network === "mainnet" ? "flare" : "coston2";
      const artifactPath = join(
        process.cwd(),
        "node_modules",
        "@flarenetwork",
        "flare-periphery-contract-artifacts",
        networkFolder,
        "artifacts",
        "contracts",
        "IFdcRequestFeeConfigurations.sol",
        "IFdcRequestFeeConfigurations.json"
      );
      
      const abiJson = readFileSync(artifactPath, "utf8");
      this.feeConfigABI = JSON.parse(abiJson);
      
      console.log(`✅ Loaded FdcRequestFeeConfigurations ABI for ${this.config.network}`);
      return this.feeConfigABI;
    } catch (error) {
      console.error(`Failed to load FdcRequestFeeConfigurations ABI:`, error);
      throw new Error(`Failed to load FdcRequestFeeConfigurations ABI for network ${this.config.network}`);
    }
  }

  /**
   * Get FdcHub contract address from Flare Contract Registry
   */
  private async getFdcHubAddress(): Promise<string> {
    if (this.fdcHubAddress) {
      return this.fdcHubAddress;
    }

    try {
      const networkName = this.config.network === "mainnet" ? "flare" : "coston2";
      const address = await nameToAddress(
        "FdcHub",
        networkName,
        this.config.flareClient.provider
      );
      
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(
          `Contract Registry returned zero address for "FdcHub" on ${this.config.network}. ` +
          `This means FdcHub is not deployed or the registry is misconfigured.`
        );
      }
      
      this.fdcHubAddress = address;
      
      console.log(`✅ Retrieved FdcHub from Contract Registry`);
      console.log(`   Network: ${this.config.network}`);
      console.log(`   FdcHub: ${address}`);
      
      return address;
    } catch (error) {
      console.error("Failed to get FdcHub from Contract Registry:", error);
      throw new Error(
        `Failed to retrieve FdcHub address from Flare Contract Registry for ${this.config.network}`
      );
    }
  }

  /**
   * Get FdcRequestFeeConfigurations contract address
   */
  private async getFeeConfigAddress(): Promise<string> {
    if (this.feeConfigAddress) {
      return this.feeConfigAddress;
    }

    try {
      const networkName = this.config.network === "mainnet" ? "flare" : "coston2";
      const address = await nameToAddress(
        "FdcRequestFeeConfigurations",
        networkName,
        this.config.flareClient.provider
      );
      
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(
          `Contract Registry returned zero address for "FdcRequestFeeConfigurations"`
        );
      }
      
      this.feeConfigAddress = address;
      console.log(`✅ Retrieved FdcRequestFeeConfigurations: ${address}`);
      
      return address;
    } catch (error) {
      console.error("Failed to get FdcRequestFeeConfigurations:", error);
      throw new Error(
        `Failed to retrieve FdcRequestFeeConfigurations address for ${this.config.network}`
      );
    }
  }

  /**
   * Get attestation request fee for the given encoded attestation request
   * 
   * The fee is keyed by the full ABI-encoded attestation request payload,
   * which includes the attestation type and source ID.
   * 
   * @param abiEncodedRequest - The full ABI-encoded attestation request from prepareRequest
   */
  private async getAttestationRequestFee(abiEncodedRequest: string): Promise<bigint> {
    try {
      // Validate the encoded request format
      if (!abiEncodedRequest.startsWith('0x')) {
        throw new Error(`Invalid encoded request: must start with 0x, got: ${abiEncodedRequest.substring(0, 10)}...`);
      }
      if (abiEncodedRequest.length % 2 !== 0) {
        throw new Error(`Invalid encoded request: hex string must have even length, got: ${abiEncodedRequest.length}`);
      }
      
      const feeConfigAddress = await this.getFeeConfigAddress();
      const feeConfigABI = this.getFeeConfigABI();
      
      const signer = this.config.flareClient.getContractSigner();
      
      const feeConfig = new ethers.Contract(
        feeConfigAddress,
        feeConfigABI,
        signer
      );
      
      console.log(`🔍 Querying attestation request fee...`);
      console.log(`   Request Data: ${abiEncodedRequest.substring(0, 66)}...`);
      console.log(`   Request Data Length: ${abiEncodedRequest.length} chars (${(abiEncodedRequest.length - 2) / 2} bytes)`);
      
      // getRequestFee expects the full ABI-encoded request as bytes
      // Pass the hex string directly - ethers v6 will handle the conversion
      const fee = await feeConfig.getRequestFee(abiEncodedRequest);
      
      console.log(`✅ Attestation request fee: ${ethers.formatEther(fee)} FLR`);
      
      return fee;
    } catch (error) {
      console.error("Failed to get attestation request fee:", error);
      throw new Error(`Failed to get attestation request fee: ${error}`);
    }
  }

  /**
   * Submit attestation request to FdcHub on-chain
   * 
   * Returns the block timestamp which is used by generateFDCProof() to calculate
   * the voting round ID. FdcHub uses the Flare blockchain timestamp when processing
   * attestations, so we must use the same timestamp for correct round calculation.
   * 
   * @param abiEncodedRequest - Encoded attestation request from FDC verifier's prepareRequest
   * @returns Attestation submission details including tx hash, block number, and block timestamp
   */
  async submitAttestationRequest(abiEncodedRequest: string): Promise<AttestationSubmission> {
    console.log(`\n🚀 Submitting attestation request to FdcHub...`);
    
    try {
      const fdcHubAddress = await this.getFdcHubAddress();
      const fdcHubABI = this.getFdcHubABI();
      const requestFee = await this.getAttestationRequestFee(abiEncodedRequest);
      
      const signer = this.config.flareClient.getContractSigner();
      
      const fdcHub = new ethers.Contract(
        fdcHubAddress,
        fdcHubABI,
        signer
      );
      
      console.log(`📤 Calling FdcHub.requestAttestation()...`);
      console.log(`   FdcHub Address: ${fdcHubAddress}`);
      console.log(`   Request Fee: ${ethers.formatEther(requestFee)} FLR`);
      console.log(`   Encoded Request Length: ${abiEncodedRequest.length} chars`);
      
      // Submit attestation request with required fee
      const tx = await fdcHub.requestAttestation(abiEncodedRequest, {
        value: requestFee,
      });
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      
      // Fetch the block to get its timestamp - this is what FdcHub uses for round calculation
      const block = await this.config.flareClient.provider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new Error(`Failed to fetch block ${receipt.blockNumber}`);
      }
      
      console.log(`✅ Attestation request submitted on-chain`);
      console.log(`   Tx Hash: ${receipt.hash}`);
      console.log(`   Block Number: ${receipt.blockNumber}`);
      console.log(`   Block Timestamp: ${block.timestamp} (${new Date(block.timestamp * 1000).toISOString()})`);
      console.log(`   ⏰ Attestation will be processed in the calculated voting round`);
      console.log(`   ⏰ Round should finalize in ~90-180 seconds`);
      
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockTimestamp: block.timestamp,
      };
    } catch (error: any) {
      // Handle "already known" error - this means the attestation was already submitted
      // This can happen on server restarts or duplicate submissions
      if (error?.error?.code === -32000 && error?.error?.message === "already known") {
        console.log("⚠️  Attestation already submitted to FdcHub (transaction in mempool or recently mined)");
        console.log("   Polling for transaction to be mined and indexed...");
        
        const fdcHubAddress = await this.getFdcHubAddress();
        const maxAttempts = 12; // 12 attempts = 60 seconds (5s intervals)
        const pollInterval = 5000; // 5 seconds
        
        // Poll for the transaction over 60 seconds
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`\n🔍 Search attempt ${attempt}/${maxAttempts}...`);
          
          const currentBlock = await this.config.flareClient.provider.getBlock("latest");
          if (!currentBlock) {
            console.log(`   Failed to fetch current block, retrying...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          }
          
          console.log(`   Current block: ${currentBlock.number}, searching back 20 blocks...`);
          
          // Search last 20 blocks for the attestation transaction
          for (let i = 0; i < 20; i++) {
            const blockNum = currentBlock.number - i;
            const block = await this.config.flareClient.provider.getBlock(blockNum, false);
            if (!block) continue;
            
            // Check each transaction in the block
            for (const txHash of block.transactions) {
              const tx = await this.config.flareClient.provider.getTransaction(txHash);
              
              if (tx && tx.to?.toLowerCase() === fdcHubAddress.toLowerCase()) {
                // Check if this transaction contains our attestation request
                if (tx.data && tx.data.includes(abiEncodedRequest.slice(2))) {
                  console.log(`\n✅ Found attestation transaction!`);
                  console.log(`   Tx Hash: ${tx.hash}`);
                  console.log(`   Block Number: ${blockNum}`);
                  console.log(`   Block Timestamp: ${block.timestamp} (${new Date(block.timestamp * 1000).toISOString()})`);
                  
                  return {
                    txHash: tx.hash,
                    blockNumber: blockNum,
                    blockTimestamp: block.timestamp,
                  };
                }
              }
            }
          }
          
          // Not found yet, wait before next attempt
          if (attempt < maxAttempts) {
            console.log(`   Not found yet, waiting ${pollInterval/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
        
        // After exhausting all retries, throw error instead of using placeholder
        console.error(`\n❌ Could not find attestation transaction after ${maxAttempts} attempts (60 seconds)`);
        console.error(`   This suggests the transaction was not actually submitted or is stuck in mempool`);
        throw new Error(
          `Failed to locate attestation transaction after "already known" error. ` +
          `Searched ${maxAttempts} times over 60 seconds with no result. ` +
          `The transaction may be stuck in mempool or was never actually submitted.`
        );
      }
      
      // Other errors - throw
      console.error("❌ Failed to submit attestation request to FdcHub:", error);
      throw error;
    }
  }
}
