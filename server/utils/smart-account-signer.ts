import { ethers } from "ethers";
import type { SmartAccountClient } from "./smart-account-client";

/**
 * SmartAccountSigner implements the ethers.Signer interface to route
 * all transaction execution through ERC-4337 account abstraction via Etherspot Prime SDK.
 * 
 * This enables:
 * - Gasless transactions (paymaster sponsorship)
 * - Transaction batching
 * - Enhanced security features
 * 
 * Signing operations (messages, typed data) still use the EOA wallet,
 * but all transaction execution goes through the smart account bundler.
 */
export class SmartAccountSigner implements ethers.Signer {
  private smartAccountClient: SmartAccountClient;
  private eoaWallet: ethers.Wallet;
  provider: ethers.Provider;

  constructor(smartAccountClient: SmartAccountClient, provider: ethers.Provider) {
    this.smartAccountClient = smartAccountClient;
    this.provider = provider;
    // Keep EOA wallet for signing operations only (not for sending transactions)
    this.eoaWallet = new ethers.Wallet(smartAccountClient['config'].privateKey, provider);
  }

  async getAddress(): Promise<string> {
    return this.smartAccountClient.getAddress();
  }

  async getNonce(blockTag?: ethers.BlockTag): Promise<number> {
    const address = await this.getAddress();
    return this.provider.getTransactionCount(address, blockTag);
  }

  async populateCall(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    return this.eoaWallet.populateCall(tx);
  }

  async populateTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    return this.eoaWallet.populateTransaction(tx);
  }

  async estimateGas(tx: ethers.TransactionRequest): Promise<bigint> {
    return this.provider.estimateGas(tx);
  }

  async call(tx: ethers.TransactionRequest): Promise<string> {
    return this.provider.call(tx);
  }

  async resolveName(name: string): Promise<string | null> {
    return this.provider.resolveName(name);
  }

  async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    // Smart accounts don't sign transactions in the traditional way
    // They create UserOps that are signed by the bundler
    throw new Error(
      'SmartAccountSigner does not support signTransaction. ' +
      'Transactions are automatically signed and submitted via sendTransaction through the ERC-4337 bundler.'
    );
  }

  async sendUncheckedTransaction(tx: ethers.TransactionRequest): Promise<string> {
    // For smart accounts, there's no "unchecked" mode - all go through bundler
    throw new Error(
      'SmartAccountSigner does not support sendUncheckedTransaction. ' +
      'Use sendTransaction instead, which routes through the ERC-4337 bundler.'
    );
  }

  async populateAuthorization(auth: ethers.AuthorizationRequest): Promise<ethers.AuthorizationRequest> {
    return this.eoaWallet.populateAuthorization(auth);
  }

  async authorize(authorization: ethers.AuthorizationRequest): Promise<ethers.Authorization> {
    return this.eoaWallet.authorize(authorization);
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    // Message signing still uses EOA wallet
    return this.eoaWallet.signMessage(message);
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    // Typed data signing still uses EOA wallet
    return this.eoaWallet.signTypedData(domain, types, value);
  }

  /**
   * This is the critical method - routes all transaction execution through ERC-4337
   */
  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    console.log('🔐 SmartAccountSigner: Routing transaction through ERC-4337 bundler');
    
    const tx = {
      to: transaction.to as string,
      value: transaction.value ? BigInt(transaction.value.toString()) : undefined,
      data: transaction.data as string | undefined,
    };

    // Execute transaction through smart account (ERC-4337 UserOp)
    const userOpHash = await this.smartAccountClient.sendTransaction(tx);
    
    console.log('📦 UserOp submitted:', userOpHash);
    
    // Wait for UserOp to be executed and get receipt
    const receipt = await this.smartAccountClient.waitForUserOpReceipt(userOpHash);
    
    console.log('✅ Transaction executed:', receipt.receipt.transactionHash);
    
    // Get the actual transaction from the provider
    const response = await this.provider.getTransaction(receipt.receipt.transactionHash);
    
    if (!response) {
      throw new Error(`Transaction ${receipt.receipt.transactionHash} not found`);
    }

    return response;
  }

  connect(provider: ethers.Provider): ethers.Signer {
    return new SmartAccountSigner(this.smartAccountClient, provider);
  }
}
