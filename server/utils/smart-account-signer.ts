import { ethers } from "ethers";
import type { SmartAccountClient } from "./smart-account-client";

export class SmartAccountSigner implements ethers.Signer {
  private smartAccountClient: SmartAccountClient;
  provider: ethers.Provider;

  constructor(smartAccountClient: SmartAccountClient, provider: ethers.Provider) {
    this.smartAccountClient = smartAccountClient;
    this.provider = provider;
  }

  async getAddress(): Promise<string> {
    return this.smartAccountClient.getAddress();
  }

  async signTransaction(transaction: ethers.TransactionRequest): Promise<string> {
    throw new Error(
      'SmartAccountSigner does not support signTransaction. ' +
      'Use sendTransaction instead, which routes through ERC-4337 bundler.'
    );
  }

  async getNonce(blockTag?: ethers.BlockTag): Promise<number> {
    const address = await this.getAddress();
    return this.provider.getTransactionCount(address, blockTag);
  }

  async populateCall(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.populateCall(tx);
  }

  async populateTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionLike<string>> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.populateTransaction(tx);
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

  async sendUncheckedTransaction(tx: ethers.TransactionRequest): Promise<string> {
    throw new Error('SmartAccountSigner does not support sendUncheckedTransaction');
  }

  async populateAuthorization(auth: ethers.AuthorizationTuple): Promise<ethers.AddressLike> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.populateAuthorization(auth);
  }

  async authorize(auth: ethers.AuthorizationTuple): Promise<ethers.Signature> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.authorize(auth);
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.signMessage(message);
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    const eoaSigner = this.smartAccountClient.getEOASigner();
    return eoaSigner.signTypedData(domain, types, value);
  }

  async sendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    console.log('🔐 SmartAccountSigner: Routing transaction through ERC-4337 bundler');
    
    const tx = {
      to: transaction.to as string,
      value: transaction.value ? BigInt(transaction.value.toString()) : undefined,
      data: transaction.data as string | undefined,
    };

    const txHash = await this.smartAccountClient.sendTransaction(tx);
    
    const receipt = await this.smartAccountClient.waitForUserOpReceipt(txHash);
    
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
