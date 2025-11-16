import { Client, TransactionStream } from "xrpl";
import type { IStorage } from "../storage";

export interface XRPLDepositListenerConfig {
  network: "testnet" | "mainnet";
  vaultAddress?: string;
  storage: IStorage;
  onDeposit?: (deposit: DetectedDeposit) => Promise<void>;
  onAgentPayment?: (payment: AgentPayment) => Promise<void>;
  onRedemptionPayment?: (payment: RedemptionPayment) => Promise<void>;
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

export interface RedemptionPayment {
  redemptionId: string;
  userAddress: string;  // User's XRPL address (destination)
  agentAddress: string; // Agent's XRPL address (source)
  amount: string;       // XRP amount
  txHash: string;
  memo?: string;
}

export interface PendingRedemption {
  redemptionId: string;
  userAddress: string;
  expectedAmount: string;
  agentAddress: string;
  deadline: number; // Unix timestamp
}

export class XRPLDepositListener {
  private client: Client;
  private config: XRPLDepositListenerConfig;
  private isRunning: boolean = false;
  private monitoredAgentAddresses: Set<string> = new Set();
  private monitoredUserAddresses: Set<string> = new Set();
  private agentPaymentHandlerSet: boolean = false;
  private redemptionPaymentHandlerSet: boolean = false;

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

  /**
   * Register redemption payment handler after construction (two-phase initialization).
   * This allows creating the listener without callbacks that reference not-yet-created services.
   */
  setRedemptionPaymentHandler(handler: (payment: RedemptionPayment) => Promise<void>): void {
    if (this.redemptionPaymentHandlerSet) {
      throw new Error("Redemption payment handler already set. Cannot set handler multiple times.");
    }
    this.config.onRedemptionPayment = handler;
    this.redemptionPaymentHandlerSet = true;
    console.log("✅ Redemption payment handler registered with XRPL listener");
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

    // Load pending redemptions from database and subscribe user addresses
    await this.loadPendingRedemptions();

    // Listen for transactions
    this.client.on("transaction", async (tx: any) => {
      await this.handleTransaction(tx);
    });
  }

  /**
   * Load all pending redemptions from database and subscribe user addresses.
   * Called on startup to restore state after process restart.
   */
  private async loadPendingRedemptions(): Promise<void> {
    try {
      console.log("🔄 Loading pending redemptions from database...");
      
      const pendingRedemptions = await this.config.storage.getAllPendingRedemptions();
      
      if (pendingRedemptions.length === 0) {
        console.log("✅ No pending redemptions to monitor");
        return;
      }

      console.log(`📋 Found ${pendingRedemptions.length} pending redemption(s) awaiting proof`);

      for (const redemption of pendingRedemptions) {
        // Only subscribe if we have a user address (XRPL wallet)
        if (!redemption.walletAddress) {
          console.warn(`⚠️  Redemption ${redemption.id} missing wallet address, skipping`);
          continue;
        }

        // Subscribe to user address to monitor for incoming payments
        await this.subscribeUserForRedemption(redemption.walletAddress);
        
        console.log(`✅ Registered redemption ${redemption.id} for monitoring`, {
          userAddress: redemption.walletAddress,
          agentAddress: redemption.agentUnderlyingAddress || 'unknown',
          xrpSent: redemption.xrpSent || 'pending',
        });
      }

      console.log(`✅ Loaded ${pendingRedemptions.length} pending redemption(s) from database`);
    } catch (error) {
      console.error("❌ Error loading pending redemptions:", error);
      // Don't throw - allow listener to continue even if loading fails
    }
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

  /**
   * Subscribe user address for redemption payment monitoring.
   * This monitors for incoming XRP payments from the FAssets agent to the user.
   * 
   * @param userAddress - User's XRPL address (destination for redemption payment)
   */
  async subscribeUserForRedemption(userAddress: string): Promise<void> {
    if (this.monitoredUserAddresses.has(userAddress)) {
      console.log(`User address ${userAddress} already monitored for redemptions`);
      return;
    }

    this.monitoredUserAddresses.add(userAddress);
    
    if (this.isRunning) {
      await this.client.request({
        command: "subscribe",
        accounts: [userAddress],
      });
      console.log(`🔔 Now monitoring user for redemption payments: ${userAddress}`);
      
      // Check for recent transactions that may have been made before subscription
      await this.checkRecentTransactionsForUser(userAddress);
    }
  }

  /**
   * Unsubscribe user address when redemption is completed or failed.
   * 
   * @param userAddress - User's XRPL address to stop monitoring
   */
  async unsubscribeUserAddress(userAddress: string): Promise<void> {
    if (!this.monitoredUserAddresses.has(userAddress)) {
      return;
    }

    this.monitoredUserAddresses.delete(userAddress);
    
    if (this.isRunning) {
      await this.client.request({
        command: "unsubscribe",
        accounts: [userAddress],
      });
      console.log(`🔕 Stopped monitoring user for redemptions: ${userAddress}`);
    }
  }

  /**
   * Find a matching redemption from the database.
   * Uses exact matching on destination, source, and amount.
   * 
   * @param destination - User's XRPL address (payment destination)
   * @param source - Agent's XRPL address (payment source)
   * @param amountDrops - XRP amount in drops (formatted as decimal string)
   * @returns Matching redemption or null
   */
  private async findMatchingRedemption(
    destination: string,
    source: string,
    amountDrops: string
  ): Promise<any | null> {
    try {
      return await this.config.storage.getRedemptionByMatch(
        destination,
        source,
        amountDrops
      );
    } catch (error) {
      console.error("Error finding matching redemption:", error);
      return null;
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
    const source = transaction.Account;
    const isVaultPayment = this.config.vaultAddress && destination === this.config.vaultAddress;
    const isAgentPayment = this.monitoredAgentAddresses.has(destination);
    const isUserPayment = this.monitoredUserAddresses.has(destination);

    console.log("=== Matching Transaction Against Monitored Addresses ===", {
      destination,
      source,
      vaultAddress: this.config.vaultAddress,
      isVaultPayment,
      monitoredAgentAddresses: Array.from(this.monitoredAgentAddresses),
      isAgentPayment,
      monitoredUserAddresses: Array.from(this.monitoredUserAddresses),
      isUserPayment,
    });

    if (!isVaultPayment && !isAgentPayment && !isUserPayment) {
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
    } else if (isUserPayment && this.config.onRedemptionPayment) {
      // Check if this is a redemption payment (agent → user)
      console.log(`🔍 Checking if payment to user is a redemption payment...`, {
        destination,
        source,
        amount: amountDrops,
      });

      const matchingRedemption = await this.findMatchingRedemption(
        destination,
        source,
        amountDrops
      );

      if (matchingRedemption) {
        const payment: RedemptionPayment = {
          redemptionId: matchingRedemption.id,
          userAddress: destination,
          agentAddress: source,
          amount: amountDrops,
          txHash: txHash,
          memo: memo,
        };

        console.log(`\n💸 ================================`);
        console.log(`💸 XRP Redemption Payment Detected!`);
        console.log(`💸 ================================`);
        console.log(`   ✅ Matched redemption: ${matchingRedemption.id}`);
        console.log(`   📍 User address: ${destination}`);
        console.log(`   📍 Agent address: ${source}`);
        console.log(`   💰 Amount: ${amountDrops} XRP`);
        console.log(`   🔗 TX Hash: ${txHash}`);
        console.log(`   📝 Memo: ${memo || '(none)'}`);
        console.log(`   🔄 Triggering redemption completion flow...`);

        try {
          await this.config.onRedemptionPayment(payment);
          console.log(`   ✅ Redemption payment handler completed successfully`);
        } catch (error) {
          console.error(`   ❌ Error handling redemption payment:`, error);
          console.error(`   📊 Payment details:`, payment);
        }
      } else {
        console.log(`\nℹ️  Payment to monitored user but no matching redemption found`);
        console.log(`   Destination: ${destination}`);
        console.log(`   Source: ${source}`);
        console.log(`   Amount: ${amountDrops} XRP`);
        console.log(`   TX Hash: ${txHash}`);
        console.log(`   This might be a regular payment, not a redemption`);
      }
    } else {
      console.log("⚠️  No handler configured for this payment type:", {
        isVaultPayment,
        hasDepositHandler: !!this.config.onDeposit,
        isAgentPayment,
        hasAgentHandler: !!this.config.onAgentPayment,
        isUserPayment,
        hasRedemptionHandler: !!this.config.onRedemptionPayment,
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

  /**
   * Check for recent incoming transactions to user address for redemption payments.
   * This helps catch redemption payments made before the user address was subscribed.
   */
  private async checkRecentTransactionsForUser(userAddress: string): Promise<void> {
    console.log(`🔍 Checking recent transactions for user ${userAddress}...`);
    
    try {
      const response = await this.client.request({
        command: "account_tx",
        account: userAddress,
        limit: 100, // Check last 100 transactions
      });

      if (!response.result?.transactions || response.result.transactions.length === 0) {
        console.log(`No recent transactions found for user ${userAddress}`);
        return;
      }

      console.log(`Found ${response.result.transactions.length} recent transactions for user ${userAddress}`);

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
        if (tx.Destination !== userAddress) {
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
        const source = tx.Account;

        console.log(`📋 Processing historical transaction for user:`, {
          from: source,
          to: tx.Destination,
          amount,
          memo,
          txHash: tx.hash,
          date: txTime ? new Date((txTime + 946684800) * 1000).toISOString() : 'unknown',
        });

        // Check if this matches a pending redemption
        const matchingRedemption = await this.findMatchingRedemption(
          userAddress,
          source,
          amount
        );

        if (matchingRedemption && this.config.onRedemptionPayment) {
          const payment: RedemptionPayment = {
            redemptionId: matchingRedemption.id,
            userAddress: userAddress,
            agentAddress: source,
            amount: amount,
            txHash: tx.hash,
            memo: memo,
          };

          try {
            await this.config.onRedemptionPayment(payment);
            processedCount++;
          } catch (error) {
            console.error(`❌ Error processing historical redemption payment:`, error);
          }
        }
      }

      console.log(`✅ Processed ${processedCount} historical redemption transaction(s) for user ${userAddress}`);
    } catch (error) {
      console.error(`❌ Error checking recent transactions for user ${userAddress}:`, error);
    }
  }

  private extractMemo(memos: any[]): string | undefined {
    if (!memos || memos.length === 0) return undefined;
    
    try {
      const memoData = memos[0]?.Memo?.MemoData;
      if (!memoData) return undefined;
      
      // Validate that memoData is a valid hex string
      if (typeof memoData !== 'string') {
        console.log("⚠️  Memo data is not a string, skipping");
        return undefined;
      }
      
      // Check if it's valid hex (only 0-9, a-f, A-F characters)
      if (!/^[0-9a-fA-F]+$/.test(memoData)) {
        console.log(`⚠️  Invalid hex memo data: ${memoData}`);
        return undefined;
      }
      
      // Return canonical uppercase hex string (matches FAssets payment references)
      return memoData.toUpperCase();
    } catch (error) {
      console.log("⚠️  Error extracting memo:", error);
      return undefined;
    }
  }
}
