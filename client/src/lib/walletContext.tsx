/* @refresh reset */
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  const initRef = useRef(false);

  // Restore wallet connection from localStorage on mount
  useEffect(() => {
    // Prevent double initialization (e.g., in React StrictMode)
    if (initRef.current) return;
    initRef.current = true;

    const restoreConnection = async () => {
      const savedAddress = localStorage.getItem("walletAddress");
      const savedProvider = localStorage.getItem("walletProvider");

      if (savedAddress && savedProvider) {
        if (savedProvider === "xaman" || savedProvider === "web3auth") {
          setAddress(savedAddress);
          setProvider(savedProvider as "xaman" | "web3auth");
          console.log(`Restored wallet connection: ${savedProvider} - ${savedAddress}`);
        } else if (savedProvider === "walletconnect") {
          const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
          if (!projectId || projectId === "demo-project-id") {
            // Clear and skip - WC not configured
            localStorage.removeItem("walletAddress");
            localStorage.removeItem("walletProvider");
            console.log("WalletConnect not configured - cleared saved connection");
          } else {
            // Lazy load WalletConnect SDK only when needed
            let timeoutId: NodeJS.Timeout | undefined;
            try {
              // Dynamic import with timeout to prevent blocking
              const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("WalletConnect initialization timeout")), 5000);
              });
              
              const loadWC = async () => {
                const { default: UniversalProvider } = await import("@walletconnect/universal-provider");
                return await UniversalProvider.init({
                  projectId,
                  metadata: {
                    name: "XRP Liquid Staking Protocol",
                    description: "Earn yield on your XRP",
                    url: window.location.origin,
                    icons: [window.location.origin + "/favicon.ico"],
                  },
                });
              };
              
              // Race between loading and timeout
              const wcProvider = await Promise.race([loadWC(), timeout]) as any;
              
              // Check if session exists (auto-persisted in IndexedDB)
              if (wcProvider?.session) {
                const accounts = wcProvider.session.namespaces?.xrpl?.accounts || [];
                if (accounts.length > 0) {
                  // Extract address from CAIP-10 format "xrpl:0:rAddress..." or "xrpl:1:rAddress..."
                  const restoredAddress = accounts[0].split(":")[2];
                  
                  if (restoredAddress === savedAddress) {
                    // Restore connection
                    setAddress(restoredAddress);
                    setProvider("walletconnect");
                    setWalletConnectProvider(wcProvider);
                    console.log("✅ WalletConnect session restored:", restoredAddress);
                  } else {
                    // Address mismatch - clear localStorage
                    localStorage.removeItem("walletAddress");
                    localStorage.removeItem("walletProvider");
                    console.log("WalletConnect address mismatch - cleared");
                  }
                } else {
                  // No accounts in session - clear localStorage
                  localStorage.removeItem("walletAddress");
                  localStorage.removeItem("walletProvider");
                  console.log("No accounts in WalletConnect session - cleared");
                }
              } else {
                // No active session - clear localStorage
                localStorage.removeItem("walletAddress");
                localStorage.removeItem("walletProvider");
                console.log("No WalletConnect session found - cleared");
              }
            } catch (error) {
              console.error("WalletConnect restoration error:", error);
              localStorage.removeItem("walletAddress");
              localStorage.removeItem("walletProvider");
            } finally {
              // Always clear timeout to prevent unhandled rejection
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            }
          }
        }
      }
      
      setIsInitialized(true);
    };
    
    restoreConnection();
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
    console.log("=== requestPayment CALLED ===", {
      provider,
      paymentRequest,
      address,
      walletConnectProviderExists: !!walletConnectProvider,
    });

    if (!provider) {
      console.error("❌ requestPayment: No provider");
      return {
        success: false,
        error: "No wallet connected",
      };
    }

    try {
      if (provider === "xaman") {
        console.log("📱 Routing to Xaman payment...");
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
        console.log("✅ Xaman payment payload created:", data);
        return {
          success: true,
          payloadUuid: data.uuid,
          qrUrl: data.qrUrl,
          deepLink: data.deepLink,
        };
      } else if (provider === "walletconnect") {
        console.log("🔗 Routing to WalletConnect payment...");
        
        if (!walletConnectProvider || !address) {
          console.error("❌ WalletConnect not initialized:", {
            walletConnectProviderExists: !!walletConnectProvider,
            addressExists: !!address,
          });
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

        console.log("📤 Sending WalletConnect transaction:", tx);

        const result = await walletConnectProvider.request({
          method: "xrpl_signAndSubmit",
          params: {
            tx_json: tx,
          },
        }) as any;

        console.log("✅ WalletConnect result:", result);

        return {
          success: true,
          txHash: result?.tx_json?.hash || "pending",
        };
      } else if (provider === "web3auth") {
        console.log("⚠️ Web3Auth payment not implemented");
        return {
          success: false,
          error: "Web3Auth payment requests not yet implemented",
        };
      }

      console.error("❌ Unknown provider:", provider);
      return {
        success: false,
        error: "Unknown provider",
      };
    } catch (error) {
      console.error("❌ Payment request error:", error);
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
