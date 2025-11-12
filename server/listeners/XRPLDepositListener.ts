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
      
      // Check for recent transactions that may have been made before subscription
      await this.checkRecentTransactions(agentAddress);
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
    // XRPL WebSocket can send transaction data in either tx.transaction or tx.tx_json
    const transaction = tx.transaction || tx.tx_json;
    
    console.log("=== XRPL Transaction Received ===", {
      hasTransaction: !!transaction,
      type: transaction?.TransactionType,
      destination: transaction?.Destination,
      txHash: transaction?.hash || tx.hash,
    });

    // XRPL WebSocket sends various message types - only process ones with transaction data
    if (!transaction) {
      console.log("⏭️  Skipping - no transaction data");
      return;
    }
    
    if (transaction.TransactionType !== "Payment") {
      console.log(`⏭️  Skipping - not a Payment (type: ${transaction.TransactionType})`);
      return;
    }
    
    // Amount can be in either Amount or DeliverMax field
    const amount = transaction.Amount || transaction.DeliverMax;
    if (typeof amount !== "string") {
      console.log("⏭️  Skipping - Amount is not a string (possibly IOU/token)");
      return;
    }

    const destination = transaction.Destination;
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

    const amountDrops = (parseInt(amount) / 1_000_000).toString();
    const memo = this.extractMemo(transaction.Memos);
    const txHash = transaction.hash || tx.hash;

    console.log("=== Transaction Details ===", {
      from: transaction.Account,
      to: destination,
      amount: amountDrops,
      memo,
      txHash,
    });

    if (isVaultPayment && this.config.onDeposit) {
      const deposit: DetectedDeposit = {
        walletAddress: transaction.Account,
        amount: amountDrops,
        txHash: txHash,
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
        walletAddress: transaction.Account,
        amount: amountDrops,
        txHash: txHash,
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

  /**
   * Check for recent transactions that may have occurred before subscription.
   * This helps catch payments made in the brief window before the agent address was registered.
   */
  private async checkRecentTransactions(address: string): Promise<void> {
    console.log(`🔍 Checking recent transactions for ${address}...`);
    
    try {
      const response = await this.client.request({
        command: "account_tx",
        account: address,
        limit: 20,
      });

      if (!response.result?.transactions || response.result.transactions.length === 0) {
        console.log(`No recent transactions found for ${address}`);
        return;
      }

      console.log(`Found ${response.result.transactions.length} recent transactions for ${address}`);

      // Current time in seconds (XRPL uses Ripple Epoch: seconds since 2000-01-01)
      const currentTime = Math.floor(Date.now() / 1000) - 946684800; // Ripple epoch offset
      const fifteenMinutesAgo = currentTime - (15 * 60); // 15 minutes in seconds

      let processedCount = 0;

      for (const txWrapper of response.result.transactions) {
        const tx = txWrapper.tx as any;
        
        // Skip if transaction data is missing
        if (!tx) {
          continue;
        }
        
        // Only process Payment transactions
        if (tx.TransactionType !== "Payment") {
          continue;
        }

        // Only process incoming payments (where this address is the destination)
        if (tx.Destination !== address) {
          continue;
        }

        // Only process XRP payments (not IOUs/tokens)
        if (typeof tx.Amount !== "string") {
          continue;
        }

        // Check if transaction is within the last 15 minutes
        const txTime = tx.date;
        if (txTime && txTime < fifteenMinutesAgo) {
          console.log(`⏭️  Skipping old transaction from ${new Date((txTime + 946684800) * 1000).toISOString()}`);
          continue;
        }

        // Process this transaction
        const amount = (parseInt(tx.Amount) / 1_000_000).toString();
        const memo = this.extractMemo(tx.Memos);

        console.log(`📋 Processing historical transaction:`, {
          from: tx.Account,
          to: tx.Destination,
          amount,
          memo,
          txHash: tx.hash,
          date: txTime ? new Date((txTime + 946684800) * 1000).toISOString() : 'unknown',
        });

        // Handle as agent payment
        if (this.config.onAgentPayment) {
          const payment: AgentPayment = {
            agentAddress: address,
            walletAddress: tx.Account,
            amount: amount,
            txHash: tx.hash,
            memo: memo,
          };

          try {
            await this.config.onAgentPayment(payment);
            processedCount++;
          } catch (error) {
            console.error(`❌ Error processing historical payment:`, error);
          }
        }
      }

      console.log(`✅ Processed ${processedCount} historical transaction(s) for ${address}`);
    } catch (error) {
      console.error(`❌ Error checking recent transactions for ${address}:`, error);
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
