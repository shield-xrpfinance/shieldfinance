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
  private primeSdkWithPaymaster: PrimeSdk | null = null;
  private primeSdkWithoutPaymaster: PrimeSdk | null = null;
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

      // Create SDK without paymaster (for direct gas payment from Smart Account)
      const sdkConfigWithoutPaymaster: any = {
        chainId: this.config.chainId,
        bundlerProvider: bundlerProvider,
      };

      this.primeSdkWithoutPaymaster = new PrimeSdk(
        { privateKey: privateKey },
        sdkConfigWithoutPaymaster
      );

      console.log('   💳 SDK without paymaster initialized (for direct gas payment)');

      // Create SDK with paymaster if enabled (for gasless transactions)
      if (this.config.enablePaymaster) {
        const sdkConfigWithPaymaster: any = {
          chainId: this.config.chainId,
          bundlerProvider: bundlerProvider,
          paymaster: {
            url: `https://arka.etherspot.io?apiKey=${this.config.bundlerApiKey}&chainId=${this.config.chainId}`,
          },
        };

        this.primeSdkWithPaymaster = new PrimeSdk(
          { privateKey: privateKey },
          sdkConfigWithPaymaster
        );

        console.log('   ⛽ SDK with paymaster initialized (for gasless transactions)');
      } else {
        // If paymaster disabled, use same instance for both
        this.primeSdkWithPaymaster = this.primeSdkWithoutPaymaster;
      }

      this.smartAccountAddress = await this.primeSdkWithoutPaymaster.getCounterFactualAddress();
      
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
   * Get the Smart Account's native FLR balance
   * Returns balance in wei as a BigInt
   */
  async getNativeBalance(): Promise<bigint> {
    if (!this.smartAccountAddress) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    try {
      // Create a provider to check the balance
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const balance = await provider.getBalance(this.smartAccountAddress);
      
      console.log(`💰 Smart Account Balance: ${ethers.formatEther(balance)} FLR (${balance} wei)`);
      
      return balance;
    } catch (error) {
      console.error('❌ Failed to check Smart Account balance:', error);
      throw error;
    }
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
   * 
   * @param tx - Transaction to send
   * @param usePaymaster - Whether to use paymaster for gas sponsorship (default: true)
   *                       Set to false to pay gas directly from Smart Account's native FLR balance
   */
  async sendTransaction(tx: {
    to: string;
    value?: bigint | string;
    data?: string;
  }, usePaymaster: boolean = true): Promise<string> {
    if (!this.primeSdkWithPaymaster || !this.primeSdkWithoutPaymaster) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    const MAX_RETRIES = 5;
    const FEE_BUMP_MULTIPLIER = 1.2; // Increase fees by 20% each retry
    const INITIAL_BACKOFF_MS = 1000;

    // Select the appropriate SDK instance based on paymaster usage
    const selectedSdk = usePaymaster ? this.primeSdkWithPaymaster : this.primeSdkWithoutPaymaster;

    // Log paymaster usage
    if (!usePaymaster) {
      console.log('🔓 Bypassing paymaster - Smart Account paying gas directly');
      const balance = await this.getNativeBalance();
      console.log(`   Smart Account balance: ${ethers.formatEther(balance)} FLR`);
    }

    let lastError: any;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await selectedSdk.clearUserOpsFromBatch();

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

        await selectedSdk.addUserOpsToBatch(txData);

        // Estimate without any special parameters - the SDK instance already has correct configuration
        let userOp = await selectedSdk.estimate();
        
        // Apply fee bumping on retries using BigInt arithmetic to avoid overflow
        if (attempt > 0) {
          // Calculate multiplier: 1.2^attempt (expressed as ratio to avoid floats)
          // For 20% increase: multiply by 12 and divide by 10
          const multiplierNumerator = BigInt(12 ** attempt);
          const multiplierDenominator = BigInt(10 ** attempt);
          
          if (userOp.maxFeePerGas) {
            const originalMaxFee = BigInt(userOp.maxFeePerGas.toString());
            userOp.maxFeePerGas = (originalMaxFee * multiplierNumerator) / multiplierDenominator;
          }
          
          if (userOp.maxPriorityFeePerGas) {
            const originalPriorityFee = BigInt(userOp.maxPriorityFeePerGas.toString());
            userOp.maxPriorityFeePerGas = (originalPriorityFee * multiplierNumerator) / multiplierDenominator;
          }
          
          const percentIncrease = ((Number(multiplierNumerator) / Number(multiplierDenominator)) * 100).toFixed(0);
          console.log(`🔄 Retry ${attempt}/${MAX_RETRIES - 1} with ${percentIncrease}% fees`);
        }

        console.log('📊 Estimated UserOp:', {
          sender: userOp.sender,
          nonce: userOp.nonce,
          callGasLimit: userOp.callGasLimit?.toString(),
          maxFeePerGas: userOp.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: userOp.maxPriorityFeePerGas?.toString(),
        });

        const userOpHash = await selectedSdk.send(userOp);
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
    if (!this.primeSdkWithPaymaster) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    try {
      // Batch transactions always use paymaster for gasless execution
      await this.primeSdkWithPaymaster.clearUserOpsFromBatch();

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

        await this.primeSdkWithPaymaster.addUserOpsToBatch(txData);
      }

      console.log(`📦 Batching ${txs.length} transactions...`);
      
      const userOp = await this.primeSdkWithPaymaster.estimate();
      const userOpHash = await this.primeSdkWithPaymaster.send(userOp);
      
      console.log(`✅ Batch UserOp sent: ${userOpHash}`);

      return userOpHash;
    } catch (error) {
      console.error('❌ Failed to send batch transaction:', error);
      throw error;
    }
  }

  async waitForUserOpReceipt(userOpHash: string, maxRetries = 30): Promise<any> {
    if (!this.primeSdkWithPaymaster) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    console.log(`⏳ Waiting for UserOp receipt: ${userOpHash}`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Use primeSdkWithPaymaster to get receipt (works for both paymaster and non-paymaster transactions)
        const receipt = await this.primeSdkWithPaymaster.getUserOpReceipt(userOpHash);
        
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
