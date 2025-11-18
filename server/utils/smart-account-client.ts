import { PrimeSdk, EtherspotBundler } from '@etherspot/prime-sdk';
import { ethers } from 'ethers';

export interface SmartAccountConfig {
  chainId: number;
  privateKey: string;
  bundlerApiKey?: string;
  rpcUrl: string;
  enablePaymaster?: boolean;
}

export class SmartAccountClient {
  private primeSdk: PrimeSdk | null = null;
  private config: SmartAccountConfig;
  private smartAccountAddress: string | null = null;

  constructor(config: SmartAccountConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔐 Initializing Flare Smart Account...');
      console.log(`   Chain ID: ${this.config.chainId}`);
      
      if (!this.config.bundlerApiKey) {
        throw new Error('Bundler API key is required for smart account initialization');
      }

      // Ensure private key has 0x prefix (required by Etherspot)
      const privateKey = this.config.privateKey.startsWith('0x') 
        ? this.config.privateKey 
        : `0x${this.config.privateKey}`;

      const bundlerProvider = new EtherspotBundler(
        this.config.chainId, 
        this.config.bundlerApiKey
      );

      const sdkConfig: any = {
        chainId: this.config.chainId,
        bundlerProvider: bundlerProvider,
      };

      if (this.config.enablePaymaster) {
        sdkConfig.paymaster = {
          url: `https://arka.etherspot.io?apiKey=${this.config.bundlerApiKey}&chainId=${this.config.chainId}`,
        };
        console.log('   ⛽ Paymaster enabled for gasless transactions');
      }

      this.primeSdk = new PrimeSdk(
        { privateKey: privateKey },
        sdkConfig
      );

      this.smartAccountAddress = await this.primeSdk.getCounterFactualAddress();
      
      console.log(`✅ Smart Account initialized`);
      console.log(`   Address: ${this.smartAccountAddress}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize smart account:', error);
      throw error;
    }
  }

  getAddress(): string {
    if (!this.smartAccountAddress) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }
    return this.smartAccountAddress;
  }

  /**
   * Check if an error is retryable (bundler rejection that can be fixed with fee bumping)
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || error?.error?.toLowerCase() || '';
    const retryablePatterns = [
      'user op cannot be replaced',
      'fee too low',
      'insufficient fee',
      'replacement transaction underpriced',
      'nonce too low',
    ];
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Send transaction with automatic retry and fee bumping
   * Implements exponential backoff (1s, 2s, 4s, 8s, 16s) and 20% fee increase per retry
   */
  async sendTransaction(tx: {
    to: string;
    value?: bigint | string;
    data?: string;
  }): Promise<string> {
    if (!this.primeSdk) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    const MAX_RETRIES = 5;
    const FEE_BUMP_MULTIPLIER = 1.2; // Increase fees by 20% each retry
    const INITIAL_BACKOFF_MS = 1000;

    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.primeSdk.clearUserOpsFromBatch();

        const txData: any = {
          to: tx.to,
        };

        if (tx.value) {
          txData.value = typeof tx.value === 'string' 
            ? BigInt(tx.value)
            : tx.value;
        }

        if (tx.data) {
          txData.data = tx.data;
        }

        await this.primeSdk.addUserOpsToBatch(txData);

        let userOp = await this.primeSdk.estimate();
        
        // Apply fee bumping on retries
        if (attempt > 0) {
          const feeMultiplier = Math.pow(FEE_BUMP_MULTIPLIER, attempt);
          
          if (userOp.maxFeePerGas) {
            const originalMaxFee = BigInt(userOp.maxFeePerGas.toString());
            userOp.maxFeePerGas = BigInt(Math.floor(Number(originalMaxFee) * feeMultiplier));
          }
          
          if (userOp.maxPriorityFeePerGas) {
            const originalPriorityFee = BigInt(userOp.maxPriorityFeePerGas.toString());
            userOp.maxPriorityFeePerGas = BigInt(Math.floor(Number(originalPriorityFee) * feeMultiplier));
          }
          
          console.log(`🔄 Retry ${attempt}/${MAX_RETRIES - 1} with ${(feeMultiplier * 100).toFixed(0)}% fees`);
        }

        console.log('📊 Estimated UserOp:', {
          sender: userOp.sender,
          nonce: userOp.nonce,
          callGasLimit: userOp.callGasLimit?.toString(),
          maxFeePerGas: userOp.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: userOp.maxPriorityFeePerGas?.toString(),
        });

        const userOpHash = await this.primeSdk.send(userOp);
        console.log(`✅ UserOp sent: ${userOpHash}`);

        return userOpHash;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.error('❌ Non-retryable error:', error);
          throw error;
        }

        // If this was the last attempt, throw
        if (attempt === MAX_RETRIES - 1) {
          console.error(`❌ Failed after ${MAX_RETRIES} attempts:`, error);
          throw error;
        }

        // Calculate exponential backoff
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        const errorMsg = (error as any)?.error || (error as any)?.message || String(error);
        console.warn(`⚠️ Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}):`, errorMsg);
        console.log(`⏳ Waiting ${backoffMs}ms before retry...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Should never reach here, but TypeScript wants it
    throw lastError;
  }

  async sendBatchTransactions(txs: Array<{
    to: string;
    value?: bigint | string;
    data?: string;
  }>): Promise<string> {
    if (!this.primeSdk) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    try {
      await this.primeSdk.clearUserOpsFromBatch();

      for (const tx of txs) {
        const txData: any = {
          to: tx.to,
        };

        if (tx.value) {
          txData.value = typeof tx.value === 'string' 
            ? BigInt(tx.value)
            : tx.value;
        }

        if (tx.data) {
          txData.data = tx.data;
        }

        await this.primeSdk.addUserOpsToBatch(txData);
      }

      console.log(`📦 Batching ${txs.length} transactions...`);
      
      const userOp = await this.primeSdk.estimate();
      const userOpHash = await this.primeSdk.send(userOp);
      
      console.log(`✅ Batch UserOp sent: ${userOpHash}`);

      return userOpHash;
    } catch (error) {
      console.error('❌ Failed to send batch transaction:', error);
      throw error;
    }
  }

  async waitForUserOpReceipt(userOpHash: string, maxRetries = 30): Promise<any> {
    if (!this.primeSdk) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    console.log(`⏳ Waiting for UserOp receipt: ${userOpHash}`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        const receipt = await this.primeSdk.getUserOpReceipt(userOpHash);
        
        if (receipt) {
          console.log(`✅ UserOp confirmed in transaction: ${receipt.receipt.transactionHash}`);
          return receipt;
        }
      } catch (error) {
        // Receipt not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`   Polling attempt ${i + 1}/${maxRetries}...`);
    }

    throw new Error(`UserOp receipt not found after ${maxRetries} attempts`);
  }

  getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(this.config.rpcUrl);
  }

  /**
   * @deprecated This method is deprecated and should not be used.
   * The system operates in smart-account-only mode. All transactions MUST go through ERC-4337.
   * Use getContractSigner() from FlareClient instead, which returns SmartAccountSigner.
   * 
   * This method will be removed in a future version.
   */
  getEOASigner(): never {
    throw new Error(
      'getEOASigner() is not supported in smart-account-only mode. ' +
      'All transactions must route through ERC-4337. ' +
      'Use FlareClient.getContractSigner() instead.'
    );
  }
}
