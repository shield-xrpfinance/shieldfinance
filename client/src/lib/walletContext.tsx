import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type UniversalProvider from "@walletconnect/universal-provider";

interface WalletContextType {
  address: string | null;
  provider: "xaman" | "walletconnect" | null;
  isConnected: boolean;
  walletConnectProvider: UniversalProvider | null;
  connect: (address: string, provider: "xaman" | "walletconnect", wcProvider?: UniversalProvider) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<"xaman" | "walletconnect" | null>(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState<UniversalProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore wallet connection from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress");
    const savedProvider = localStorage.getItem("walletProvider");

    if (savedAddress && savedProvider) {
      // Only auto-restore Xaman connections
      // WalletConnect requires active session and cannot be restored from localStorage alone
      if (savedProvider === "xaman") {
        setAddress(savedAddress);
        setProvider(savedProvider);
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

  const connect = (walletAddress: string, walletProvider: "xaman" | "walletconnect", wcProvider?: UniversalProvider) => {
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

  const isConnected = address !== null;

  return (
    <WalletContext.Provider value={{ address, provider, isConnected, walletConnectProvider, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
