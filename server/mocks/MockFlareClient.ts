/**
 * Mock FlareClient for demo mode testing.
 * Prevents real blockchain transactions when running in demo mode.
 */

import type { FlareClient } from "../clients/FlareClient";

export class MockFlareClient {
  private initialized = false;
  
  async initialize(): Promise<void> {
    console.log("🎭 MockFlareClient initialized (no real blockchain calls)");
    this.initialized = true;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  getAddress(): string {
    return "0x0000000000000000000000000000000000000000"; // Mock address
  }
  
  async sendTransaction(params: any): Promise<{ hash: string; wait: () => Promise<any> }> {
    console.log("🎭 MOCK: sendTransaction called", params);
    return {
      hash: "0xMOCK_TX_HASH_" + Date.now(),
      wait: async () => ({ status: 1, hash: "0xMOCK_TX_HASH_" + Date.now() }),
    };
  }
  
  // Prevent type errors by matching FlareClient interface
  [key: string]: any;
}

/**
 * Type guard to check if a client is a mock or real FlareClient.
 */
export function isRealFlareClient(client: any): client is FlareClient {
  return client && typeof client.initialize === "function" && !(client instanceof MockFlareClient);
}
