/* @refresh reset */
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import type UniversalProvider from "@walletconnect/universal-provider";
import type { PaymentRequest } from "@shared/schema";
import { Buffer } from "buffer";

// Store WalletConnect init promise globally to survive HMR reloads
declare global {
  interface Window {
    _wcInitPromise?: Promise<any> | null;
  }
}

const getWCInitPromise = () => (window._wcInitPromise as Promise<any> | null | undefined) || null;
const setWCInitPromise = (p: Promise<any> | null) => { window._wcInitPromise = p; };

interface PaymentRequestResult {
  success: boolean;
  payloadUuid?: string;
  qrUrl?: string;
  deepLink?: string;
  txHash?: string;
  error?: string;
}

type WalletProviderType = "xaman" | "walletconnect" | "reown" | null;

interface WalletContextType {
  address: string | null; // XRPL address (r...)
  evmAddress: string | null; // EVM address (0x...) for Flare Network
  provider: WalletProviderType;
  walletType: "xrpl" | "evm" | null; // Derived from connected addresses
  isConnected: boolean;
  isEvmConnected: boolean;
  walletConnectProvider: UniversalProvider | null;
  connect: (xrplAddress: string | null, provider: WalletProviderType, evmAddr?: string | null, wcProvider?: UniversalProvider) => void;
  disconnect: () => void;
  disconnectReown?: () => void; // For Reown AppKit disconnect callback
  setDisconnectReown: (fn: (() => void) | undefined) => void;
  requestPayment: (paymentRequest: PaymentRequest) => Promise<PaymentRequestResult>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  evmAddress: null,
  provider: null,
  walletType: null,
  isConnected: false,
  isEvmConnected: false,
  walletConnectProvider: null,
  connect: () => {},
  disconnect: async () => {},
  disconnectReown: undefined,
  setDisconnectReown: () => {},
  requestPayment: async () => ({ success: false, error: "Not initialized" }),
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null); // XRPL address
  const [evmAddress, setEvmAddress] = useState<string | null>(null); // EVM address
  const [provider, setProvider] = useState<WalletProviderType>(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState<UniversalProvider | null>(null);
  const [disconnectReownFn, setDisconnectReownFn] = useState<(() => void) | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  const initRef = useRef(false);

  // Restore wallet connection from localStorage on mount
  useEffect(() => {
    // Prevent double initialization (e.g., in React StrictMode)
    if (initRef.current) return;
    initRef.current = true;

    const restoreConnection = async () => {
      // PRIORITY 1: Check for xApp OTT (One-Time Token) parameters
      // This happens when app is loaded from Xaman as xApp (e.g., https://xumm.app/detect/xapp:...)
      const urlParams = new URLSearchParams(window.location.search);
      
      const ott = urlParams.get('xAppToken') || urlParams.get('ott') || urlParams.get('xApp');
      
      if (ott) {
        
        try {
          // Call backend to resolve OTT to wallet address
          const response = await fetch('/api/wallet/xaman/xapp-signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ott }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('xApp OTT resolution failed:', errorData.error);
            throw new Error(errorData.error || 'Failed to resolve OTT');
          }

          const data = await response.json();
          
          if (data.success && data.address) {
            // Auto-connect the wallet
            setAddress(data.address);
            setProvider('xaman');
            localStorage.setItem('walletAddress', data.address);
            localStorage.setItem('walletProvider', 'xaman');
            
            // Clean up URL by removing OTT parameter
            urlParams.delete('xAppToken');
            urlParams.delete('ott');
            urlParams.delete('xApp');
            const newUrl = urlParams.toString() 
              ? `${window.location.pathname}?${urlParams.toString()}`
              : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            
            // Skip localStorage restoration since we just connected
            setIsInitialized(true);
            return;
          } else {
            console.error('xApp OTT response missing address:', data);
          }
        } catch (error) {
          console.error('xApp auto-signin error:', error);
          // Fall through to normal localStorage restoration
        }
      }

      // PRIORITY 2: Restore from localStorage (normal flow)
      const savedAddress = localStorage.getItem("walletAddress");
      const savedEvmAddress = localStorage.getItem("evmAddress");
      const savedProvider = localStorage.getItem("walletProvider");

      if ((savedAddress || savedEvmAddress) && savedProvider) {
        if (savedProvider === "xaman") {
          setAddress(savedAddress);
          setProvider(savedProvider);
        } else if (savedProvider === "reown") {
          if (savedEvmAddress) {
            setEvmAddress(savedEvmAddress);
            setProvider("reown");
          } else {
            localStorage.removeItem("evmAddress");
            localStorage.removeItem("walletProvider");
          }
        } else if (savedProvider === "walletconnect") {
          const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
          if (!projectId || projectId === "demo-project-id") {
            // Clear and skip - WC not configured
            localStorage.removeItem("walletAddress");
            localStorage.removeItem("walletProvider");
          } else {
            // Lazy load WalletConnect SDK only when needed (with singleton pattern)
            let timeoutId: NodeJS.Timeout | undefined;
            try {
              // Dynamic import with timeout to prevent blocking
              const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("WalletConnect initialization timeout")), 5000);
              });
              
              const loadWC = async () => {
                // Prevent double initialization using global singleton (survives HMR)
                const existingPromise = getWCInitPromise();
                if (existingPromise) {
                  console.log("✅ WalletConnect: Reusing existing init promise");
                  return existingPromise;
                }
                
                const { default: UniversalProvider } = await import("@walletconnect/universal-provider");
                
                // Check if already initialized to prevent "already initialized" errors
                if ((UniversalProvider as any).instance) {
                  console.log("✅ WalletConnect: Reusing existing instance");
                  const promise = Promise.resolve((UniversalProvider as any).instance);
                  setWCInitPromise(promise);
                  return promise;
                }
                
                console.log("🔄 WalletConnect: Initializing new instance...");
                const initPromise = UniversalProvider.init({
                  projectId,
                  metadata: {
                    name: "XRP Liquid Staking Protocol",
                    description: "Earn yield on your XRP",
                    url: window.location.origin,
                    icons: [window.location.origin + "/favicon.ico"],
                  },
                });
                
                setWCInitPromise(initPromise);
                return initPromise;
              };
              
              // Race between loading and timeout
              const wcProvider = await Promise.race([loadWC(), timeout]) as any;
              
              // Check if session exists (auto-persisted in IndexedDB)
              if (wcProvider?.session) {
                console.log("✅ WalletConnect: Restoring session from storage");
                // Try to restore XRPL address
                const xrplAccounts = wcProvider.session.namespaces?.xrpl?.accounts || [];
                const evmAccounts = wcProvider.session.namespaces?.eip155?.accounts || [];
                
                let restoredXrplAddress: string | null = null;
                let restoredEvmAddress: string | null = null;
                
                if (xrplAccounts.length > 0) {
                  // Extract address from CAIP-10 format "xrpl:0:rAddress..." or "xrpl:1:rAddress..."
                  restoredXrplAddress = xrplAccounts[0].split(":")[2];
                }
                
                if (evmAccounts.length > 0) {
                  // Extract address from CAIP-10 format "eip155:14:0x..." or "eip155:114:0x..."
                  restoredEvmAddress = evmAccounts[0].split(":")[2];
                }
                
                // Restore if at least one address matches
                if (restoredXrplAddress === savedAddress || restoredEvmAddress === savedEvmAddress) {
                  setAddress(restoredXrplAddress);
                  setEvmAddress(restoredEvmAddress);
                  setProvider("walletconnect");
                  setWalletConnectProvider(wcProvider);
                } else {
                  // Address mismatch - clear localStorage
                  localStorage.removeItem("walletAddress");
                  localStorage.removeItem("evmAddress");
                  localStorage.removeItem("walletProvider");
                }
              } else {
                // No active session - clear localStorage
                localStorage.removeItem("walletAddress");
                localStorage.removeItem("evmAddress");
                localStorage.removeItem("walletProvider");
              }
            } catch (error) {
              console.error("WalletConnect restoration error:", error);
              localStorage.removeItem("walletAddress");
              localStorage.removeItem("evmAddress");
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

  const connect = (xrplAddress: string | null, walletProvider: WalletProviderType, evmAddr?: string | null, wcProvider?: UniversalProvider) => {
    setAddress(xrplAddress);
    setEvmAddress(evmAddr || null);
    setProvider(walletProvider);
    if (wcProvider) {
      setWalletConnectProvider(wcProvider);
    }
    // Save to localStorage (only save non-null values)
    if (xrplAddress) {
      localStorage.setItem("walletAddress", xrplAddress);
    } else {
      localStorage.removeItem("walletAddress");
    }
    if (evmAddr) {
      localStorage.setItem("evmAddress", evmAddr);
    } else {
      localStorage.removeItem("evmAddress");
    }
    if (walletProvider) {
      localStorage.setItem("walletProvider", walletProvider);
    }
  };

  const setDisconnectReown = (fn: (() => void) | undefined) => {
    setDisconnectReownFn(() => fn);
  };

  const disconnect = async () => {
    // If Reown/AppKit, disconnect via the callback
    if (provider === "reown" && disconnectReownFn) {
      try {
        disconnectReownFn();
      } catch (error) {
        console.error("Error disconnecting Reown:", error);
      }
    }
    
    // If WalletConnect, disconnect the session properly
    if (walletConnectProvider) {
      try {
        await walletConnectProvider.disconnect();
      } catch (error) {
        console.error("Error disconnecting WalletConnect:", error);
      }
    }
    
    setAddress(null);
    setEvmAddress(null);
    setProvider(null);
    setWalletConnectProvider(null);
    setDisconnectReownFn(undefined);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("evmAddress");
    localStorage.removeItem("walletProvider");
  };

  const requestPayment = async (paymentRequest: PaymentRequest): Promise<PaymentRequestResult> => {
    if (!provider) {
      console.error("requestPayment: No provider");
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
            account: address,
            destination: paymentRequest.destination,
            amountDrops: paymentRequest.amountDrops,
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
          console.error("WalletConnect not initialized:", {
            walletConnectProviderExists: !!walletConnectProvider,
            addressExists: !!address,
          });
          return {
            success: false,
            error: "WalletConnect not properly initialized",
          };
        }

        // Check if WalletConnect has an active session
        const hasActiveSession = walletConnectProvider.session !== null && walletConnectProvider.session !== undefined;
        if (!hasActiveSession) {
          console.error("❌ WalletConnect: No active session found");
          return {
            success: false,
            error: "WalletConnect session disconnected. Please reconnect your wallet.",
          };
        }

        console.log("✅ WalletConnect session active:", {
          namespaces: Object.keys(walletConnectProvider.session?.namespaces || {}),
          hasXrpl: !!walletConnectProvider.session?.namespaces?.xrpl,
        });

        try {
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

          console.log("🔗 WalletConnect: Sending transaction request to wallet...", {
            method: "xrpl_signAndSubmit",
            account: address,
            destination: paymentRequest.destination,
            amount: paymentRequest.amountDrops,
          });

          // Try xrpl_signAndSubmit first with longer timeout to allow manual entry
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("WalletConnect request timeout - BiFrost may not support automatic signing. Please send manually via your wallet app.")), 25000)
            );

            const requestPromise = walletConnectProvider.request({
              method: "xrpl_signAndSubmit",
              params: {
                tx_json: tx,
              },
            } as any);

            const result = (await Promise.race([requestPromise, timeoutPromise])) as any;

            console.log("✅ WalletConnect: Transaction signed successfully", {
              hash: result?.tx_json?.hash || result?.hash || "pending",
            });

            return {
              success: true,
              txHash: result?.tx_json?.hash || result?.hash || "pending",
            };
          } catch (firstAttemptError) {
            // If that fails, try xrpl_sign method  
            const firstError = firstAttemptError instanceof Error ? firstAttemptError.message : String(firstAttemptError);
            console.log("⚠️  xrpl_signAndSubmit failed:", firstError, "trying xrpl_sign...");
            
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("WalletConnect request timeout")), 20000)
            );

            const requestPromise = walletConnectProvider.request({
              method: "xrpl_sign",
              params: {
                tx_json: tx,
                autofill: true,
              },
            } as any);

            const result = (await Promise.race([requestPromise, timeoutPromise])) as any;

            console.log("✅ WalletConnect: Transaction signed with xrpl_sign", {
              signedTx: result?.tx_json ? "yes" : "no",
            });

            return {
              success: true,
              txHash: result?.tx_json?.hash || "pending",
            };
          }
        } catch (wcError) {
          const errorMessage = wcError instanceof Error ? wcError.message : "Unknown WalletConnect error";
          console.error("❌ WalletConnect: Transaction signing failed:", errorMessage);

          return {
            success: false,
            error: errorMessage.includes("timeout")
              ? "Wallet didn't respond. Make sure your Bifrost wallet app is open and the WalletConnect session is active. Check your phone now."
              : errorMessage.includes("rejected")
              ? "You rejected the transaction in your wallet."
              : errorMessage.includes("Please call connect()")
              ? "WalletConnect session lost. Please disconnect and reconnect your wallet, then try again."
              : `Wallet error: ${errorMessage}`,
          };
        }
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

  const isConnected = address !== null || evmAddress !== null;
  const isEvmConnected = evmAddress !== null;
  
  // Derive walletType from connected addresses, not just provider
  // EVM address takes priority for wallet type determination
  const walletType = evmAddress !== null ? "evm" : address !== null ? "xrpl" : null;

  return (
    <WalletContext.Provider value={{ address, evmAddress, provider, walletType, isConnected, isEvmConnected, walletConnectProvider, connect, disconnect, disconnectReown: disconnectReownFn, setDisconnectReown, requestPayment }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
