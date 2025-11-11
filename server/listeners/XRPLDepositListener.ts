import { Client, TransactionStream } from "xrpl";
import type { IStorage } from "../storage";

export interface XRPLDepositListenerConfig {
  network: "testnet" | "mainnet";
  vaultAddress: string; // XRPL address to monitor
  storage: IStorage;
  onDeposit: (deposit: DetectedDeposit) => Promise<void>;
}

export interface DetectedDeposit {
  walletAddress: string; // Sender address
  amount: string; // XRP amount
  txHash: string; // XRPL transaction hash
  memo?: string; // Optional memo with vault ID
}

export class XRPLDepositListener {
  private client: Client;
  private config: XRPLDepositListenerConfig;
  private isRunning: boolean = false;

  constructor(config: XRPLDepositListenerConfig) {
    this.config = config;
    
    const server = config.network === "testnet"
      ? "wss://s.altnet.rippletest.net:51233"
      : "wss://xrplcluster.com";
    
    this.client = new Client(server);
  }

  async start() {
    if (this.isRunning) {
      console.log("XRPL listener already running");
      return;
    }

    await this.client.connect();
    this.isRunning = true;

    console.log(`🎧 XRPL Deposit Listener started for ${this.config.vaultAddress}`);

    // Subscribe to account transactions
    await this.client.request({
      command: "subscribe",
      accounts: [this.config.vaultAddress],
    });

    // Listen for transactions
    this.client.on("transaction", async (tx: any) => {
      await this.handleTransaction(tx);
    });
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    await this.client.disconnect();
    console.log("XRPL Deposit Listener stopped");
  }

  private async handleTransaction(tx: any) {
    // Only process Payment transactions
    if (tx.transaction.TransactionType !== "Payment") return;

    // Only process incoming payments
    if (tx.transaction.Destination !== this.config.vaultAddress) return;

    // Only process XRP (not issued currencies)
    if (typeof tx.transaction.Amount !== "string") return;

    // Extract deposit details
    const deposit: DetectedDeposit = {
      walletAddress: tx.transaction.Account,
      amount: (parseInt(tx.transaction.Amount) / 1_000_000).toString(), // Convert drops to XRP
      txHash: tx.transaction.hash,
      memo: this.extractMemo(tx.transaction.Memos),
    };

    console.log(`💰 XRP Deposit detected:`, deposit);

    try {
      // Call the onDeposit callback
      await this.config.onDeposit(deposit);
    } catch (error) {
      console.error("Error handling deposit:", error);
    }
  }

  private extractMemo(memos: any[]): string | undefined {
    if (!memos || memos.length === 0) return undefined;
    
    try {
      const memoData = memos[0]?.Memo?.MemoData;
      if (!memoData) return undefined;
      
      // Convert hex to UTF-8
      return Buffer.from(memoData, "hex").toString("utf-8");
    } catch (error) {
      return undefined;
    }
  }
}
