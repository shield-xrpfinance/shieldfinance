import { Client, TransactionStream } from "xrpl";
import type { IStorage } from "../storage";

export interface XRPLDepositListenerConfig {
  network: "testnet" | "mainnet";
  vaultAddress?: string;
  storage: IStorage;
  onDeposit?: (deposit: DetectedDeposit) => Promise<void>;
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
  private agentPaymentHandlerSet: boolean = false;

  constructor(config: XRPLDepositListenerConfig) {
    this.config = config;
    
    const server = config.network === "testnet"
      ? "wss://s.altnet.rippletest.net:51233"
      : "wss://xrplcluster.com";
    
    this.client = new Client(server);
  }

  /**
   * Register agent payment handler after construction (two-phase initialization).
   * This allows creating the listener without callbacks that reference not-yet-created services.
   */
  setAgentPaymentHandler(handler: (payment: AgentPayment) => Promise<void>): void {
    if (this.agentPaymentHandlerSet) {
      throw new Error("Agent payment handler already set. Cannot set handler multiple times.");
    }
    this.config.onAgentPayment = handler;
    this.agentPaymentHandlerSet = true;
    console.log("✅ Agent payment handler registered with XRPL listener");
  }

  async start() {
    if (this.isRunning) {
      console.log("XRPL listener already running");
      return;
    }

    await this.client.connect();
    this.isRunning = true;

    console.log(`🎧 XRPL Deposit Listener started${this.config.vaultAddress ? ` for ${this.config.vaultAddress}` : ''}`);

    // Subscribe to account transactions (if vault address provided)
    if (this.config.vaultAddress) {
      await this.client.request({
        command: "subscribe",
        accounts: [this.config.vaultAddress],
      });
    }

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
    console.log("=== XRPL Transaction Received ===", {
      hasTransaction: !!tx.transaction,
      type: tx.transaction?.TransactionType,
      destination: tx.transaction?.Destination,
    });

    // XRPL WebSocket sends various message types - only process ones with transaction data
    if (!tx.transaction) {
      console.log("⏭️  Skipping - no transaction data");
      return;
    }
    
    if (tx.transaction.TransactionType !== "Payment") {
      console.log(`⏭️  Skipping - not a Payment (type: ${tx.transaction.TransactionType})`);
      return;
    }
    
    if (typeof tx.transaction.Amount !== "string") {
      console.log("⏭️  Skipping - Amount is not a string (possibly IOU/token)");
      return;
    }

    const destination = tx.transaction.Destination;
    const isVaultPayment = this.config.vaultAddress && destination === this.config.vaultAddress;
    const isAgentPayment = this.monitoredAgentAddresses.has(destination);

    console.log("=== Matching Transaction Against Monitored Addresses ===", {
      destination,
      vaultAddress: this.config.vaultAddress,
      isVaultPayment,
      monitoredAgentAddresses: Array.from(this.monitoredAgentAddresses),
      isAgentPayment,
    });

    if (!isVaultPayment && !isAgentPayment) {
      console.log("⏭️  Skipping - destination not monitored");
      return;
    }

    const amount = (parseInt(tx.transaction.Amount) / 1_000_000).toString();
    const memo = this.extractMemo(tx.transaction.Memos);

    console.log("=== Transaction Details ===", {
      from: tx.transaction.Account,
      to: destination,
      amount,
      memo,
      txHash: tx.transaction.hash,
    });

    if (isVaultPayment && this.config.onDeposit) {
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
        console.error("❌ Error handling deposit:", error);
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
        console.error("❌ Error handling agent payment:", error);
      }
    } else {
      console.log("⚠️  No handler configured for this payment type:", {
        isVaultPayment,
        hasDepositHandler: !!this.config.onDeposit,
        isAgentPayment,
        hasAgentHandler: !!this.config.onAgentPayment,
      });
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
