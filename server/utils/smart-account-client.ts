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

  async sendTransaction(tx: {
    to: string;
    value?: bigint | string;
    data?: string;
  }): Promise<string> {
    if (!this.primeSdk) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

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

      const userOp = await this.primeSdk.estimate();
      console.log('📊 Estimated UserOp:', {
        sender: userOp.sender,
        nonce: userOp.nonce,
        callGasLimit: userOp.callGasLimit?.toString(),
      });

      const userOpHash = await this.primeSdk.send(userOp);
      console.log(`✅ UserOp sent: ${userOpHash}`);

      return userOpHash;
    } catch (error) {
      console.error('❌ Failed to send transaction:', error);
      throw error;
    }
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
   * Check gas availability before withdrawal to prevent burning user's shXRP with insufficient gas.
   * 
   * Checks:
   * 1. Smart Account FLR balance for self-paying gas
   * 2. Paymaster API for sponsorship availability
   * 
   * @returns Object with gasAvailable flag and details for monitoring
   */
  async checkGasAvailability(): Promise<{
    gasAvailable: boolean;
    flrBalance: string;
    paymasterAvailable: boolean;
    estimatedGasCost: string;
    errorMessage?: string;
  }> {
    if (!this.smartAccountAddress) {
      throw new Error('Smart account not initialized. Call initialize() first.');
    }

    try {
      const provider = this.getProvider();

      // 1. Check Smart Account FLR balance
      const flrBalanceWei = await provider.getBalance(this.smartAccountAddress);
      const flrBalance = ethers.formatEther(flrBalanceWei);

      console.log(`📊 Gas Preflight Check:`);
      console.log(`   Smart Account: ${this.smartAccountAddress}`);
      console.log(`   FLR Balance: ${flrBalance} FLR`);

      // 2. Estimate gas cost for typical redemption confirmation transaction
      // Rough estimate: 500,000 gas units * 25 gwei = 0.0125 FLR
      const estimatedGasUnits = 500000n;
      const gasPrice = await provider.getFeeData();
      const gasPriceWei = gasPrice.gasPrice || 25000000000n; // Default 25 gwei if null
      const estimatedGasCostWei = estimatedGasUnits * gasPriceWei;
      const estimatedGasCost = ethers.formatEther(estimatedGasCostWei);

      console.log(`   Estimated Gas: ${estimatedGasUnits.toString()} units`);
      console.log(`   Gas Price: ${ethers.formatUnits(gasPriceWei, 'gwei')} gwei`);
      console.log(`   Estimated Cost: ${estimatedGasCost} FLR`);

      // 3. Check if paymaster is configured
      const paymasterAvailable = this.config.enablePaymaster === true;
      console.log(`   Paymaster: ${paymasterAvailable ? 'Enabled' : 'Disabled'}`);

      // 4. Determine gas availability
      const hasSufficientBalance = flrBalanceWei >= estimatedGasCostWei;
      const gasAvailable = hasSufficientBalance || paymasterAvailable;

      if (!gasAvailable) {
        const errorMessage = paymasterAvailable
          ? `Paymaster enabled but smart account has insufficient FLR (${flrBalance} FLR < ${estimatedGasCost} FLR estimated)`
          : `Insufficient FLR for gas (${flrBalance} FLR < ${estimatedGasCost} FLR estimated). Enable paymaster or fund smart account.`;
        
        console.warn(`⚠️  Gas Check Failed: ${errorMessage}`);

        return {
          gasAvailable: false,
          flrBalance,
          paymasterAvailable,
          estimatedGasCost,
          errorMessage,
        };
      }

      console.log(`✅ Gas Check Passed: ${hasSufficientBalance ? 'Sufficient FLR balance' : 'Paymaster enabled'}`);

      return {
        gasAvailable: true,
        flrBalance,
        paymasterAvailable,
        estimatedGasCost,
      };
    } catch (error) {
      console.error('❌ Gas availability check failed:', error);
      
      return {
        gasAvailable: false,
        flrBalance: '0',
        paymasterAvailable: false,
        estimatedGasCost: '0',
        errorMessage: error instanceof Error ? error.message : 'Unknown error during gas check',
      };
    }
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
