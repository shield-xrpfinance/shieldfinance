import { Client, TransactionStream } from "xrpl";
import type { IStorage } from "../storage";

export interface XRPLDepositListenerConfig {
  network: "testnet" | "mainnet";
  vaultAddress: string;
  storage: IStorage;
  onDeposit: (deposit: DetectedDeposit) => Promise<void>;
  onAgentPayment?: (payment: AgentPayment) => Promise<void>;
}

export interface DetectedDeposit {
  walletAddress: string;
  amount: string;
  txHash: string;
  memo?: string;
}

export interface AgentPayment {
  agentAddress: string;
  walletAddress: string;
  amount: string;
  txHash: string;
  memo?: string;
}

export class XRPLDepositListener {
  private client: Client;
  private config: XRPLDepositListenerConfig;
  private isRunning: boolean = false;
  private monitoredAgentAddresses: Set<string> = new Set();

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

  async addAgentAddress(agentAddress: string): Promise<void> {
    if (this.monitoredAgentAddresses.has(agentAddress)) {
      console.log(`Agent address ${agentAddress} already monitored`);
      return;
    }

    this.monitoredAgentAddresses.add(agentAddress);
    
    if (this.isRunning) {
      await this.client.request({
        command: "subscribe",
        accounts: [agentAddress],
      });
      console.log(`🔔 Now monitoring FAssets agent: ${agentAddress}`);
    }
  }

  async removeAgentAddress(agentAddress: string): Promise<void> {
    if (!this.monitoredAgentAddresses.has(agentAddress)) {
      return;
    }

    this.monitoredAgentAddresses.delete(agentAddress);
    
    if (this.isRunning) {
      await this.client.request({
        command: "unsubscribe",
        accounts: [agentAddress],
      });
      console.log(`🔕 Stopped monitoring FAssets agent: ${agentAddress}`);
    }
  }

  private async handleTransaction(tx: any) {
    if (tx.transaction.TransactionType !== "Payment") return;
    if (typeof tx.transaction.Amount !== "string") return;

    const destination = tx.transaction.Destination;
    const isVaultPayment = destination === this.config.vaultAddress;
    const isAgentPayment = this.monitoredAgentAddresses.has(destination);

    if (!isVaultPayment && !isAgentPayment) return;

    const amount = (parseInt(tx.transaction.Amount) / 1_000_000).toString();
    const memo = this.extractMemo(tx.transaction.Memos);

    if (isVaultPayment) {
      const deposit: DetectedDeposit = {
        walletAddress: tx.transaction.Account,
        amount: amount,
        txHash: tx.transaction.hash,
        memo: memo,
      };

      console.log(`💰 XRP Deposit to vault detected:`, deposit);

      try {
        await this.config.onDeposit(deposit);
      } catch (error) {
        console.error("Error handling deposit:", error);
      }
    } else if (isAgentPayment && this.config.onAgentPayment) {
      const payment: AgentPayment = {
        agentAddress: destination,
        walletAddress: tx.transaction.Account,
        amount: amount,
        txHash: tx.transaction.hash,
        memo: memo,
      };

      console.log(`🔗 XRP Payment to FAssets agent detected:`, payment);

      try {
        await this.config.onAgentPayment(payment);
      } catch (error) {
        console.error("Error handling agent payment:", error);
      }
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
