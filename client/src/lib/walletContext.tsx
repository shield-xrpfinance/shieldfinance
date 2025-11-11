/* @refresh reset */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type UniversalProvider from "@walletconnect/universal-provider";
import type { PaymentRequest } from "@shared/schema";
import { Buffer } from "buffer";

interface PaymentRequestResult {
  success: boolean;
  payloadUuid?: string;
  qrUrl?: string;
  deepLink?: string;
  txHash?: string;
  error?: string;
}

interface WalletContextType {
  address: string | null;
  provider: "xaman" | "walletconnect" | "web3auth" | null;
  isConnected: boolean;
  walletConnectProvider: UniversalProvider | null;
  connect: (address: string, provider: "xaman" | "walletconnect" | "web3auth", wcProvider?: UniversalProvider) => void;
  disconnect: () => void;
  requestPayment: (paymentRequest: PaymentRequest) => Promise<PaymentRequestResult>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  provider: null,
  isConnected: false,
  walletConnectProvider: null,
  connect: () => {},
  disconnect: async () => {},
  requestPayment: async () => ({ success: false, error: "Not initialized" }),
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<"xaman" | "walletconnect" | "web3auth" | null>(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState<UniversalProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore wallet connection from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress");
    const savedProvider = localStorage.getItem("walletProvider");

    if (savedAddress && savedProvider) {
      // Auto-restore Xaman and Web3Auth connections
      // WalletConnect requires active session and cannot be restored from localStorage alone
      if (savedProvider === "xaman" || savedProvider === "web3auth") {
        setAddress(savedAddress);
        setProvider(savedProvider as "xaman" | "web3auth");
        console.log(`Restored wallet connection: ${savedProvider} - ${savedAddress}`);
      } else if (savedProvider === "walletconnect") {
        // Clear WalletConnect connection - user needs to reconnect manually
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("walletProvider");
        console.log("WalletConnect session expired - please reconnect");
      }
    }
    
    setIsInitialized(true);
  }, []);

  const connect = (walletAddress: string, walletProvider: "xaman" | "walletconnect" | "web3auth", wcProvider?: UniversalProvider) => {
    setAddress(walletAddress);
    setProvider(walletProvider);
    if (wcProvider) {
      setWalletConnectProvider(wcProvider);
    }
    localStorage.setItem("walletAddress", walletAddress);
    localStorage.setItem("walletProvider", walletProvider);
  };

  const disconnect = async () => {
    // If WalletConnect, disconnect the session properly
    if (walletConnectProvider) {
      try {
        await walletConnectProvider.disconnect();
      } catch (error) {
        console.error("Error disconnecting WalletConnect:", error);
      }
    }
    
    setAddress(null);
    setProvider(null);
    setWalletConnectProvider(null);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletProvider");
  };

  const requestPayment = async (paymentRequest: PaymentRequest): Promise<PaymentRequestResult> => {
    if (!provider) {
      return {
        success: false,
        error: "No wallet connected",
      };
    }

    try {
      if (provider === "xaman") {
        const response = await fetch("/api/wallet/xaman/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination: paymentRequest.destination,
            amount: paymentRequest.amountDrops,
            memo: paymentRequest.memo,
            network: paymentRequest.network,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create Xaman payment request");
        }

        const data = await response.json();
        return {
          success: true,
          payloadUuid: data.uuid,
          qrUrl: data.qrUrl,
          deepLink: data.deepLink,
        };
      } else if (provider === "walletconnect") {
        if (!walletConnectProvider || !address) {
          return {
            success: false,
            error: "WalletConnect not properly initialized",
          };
        }

        const tx = {
          TransactionType: "Payment",
          Account: address,
          Destination: paymentRequest.destination,
          Amount: paymentRequest.amountDrops,
          Memos: [
            {
              Memo: {
                MemoData: Buffer.from(paymentRequest.memo).toString("hex").toUpperCase(),
              },
            },
          ],
        };

        const result = await walletConnectProvider.request({
          method: "xrpl_signAndSubmit",
          params: {
            tx_json: tx,
          },
        }) as any;

        return {
          success: true,
          txHash: result?.tx_json?.hash || "pending",
        };
      } else if (provider === "web3auth") {
        return {
          success: false,
          error: "Web3Auth payment requests not yet implemented",
        };
      }

      return {
        success: false,
        error: "Unknown provider",
      };
    } catch (error) {
      console.error("Payment request error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const isConnected = address !== null;

  return (
    <WalletContext.Provider value={{ address, provider, isConnected, walletConnectProvider, connect, disconnect, requestPayment }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
