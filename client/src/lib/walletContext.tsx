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
      // Validate provider value
      if (savedProvider === "xaman" || savedProvider === "walletconnect") {
        setAddress(savedAddress);
        setProvider(savedProvider);
        console.log(`Restored wallet connection: ${savedProvider} - ${savedAddress}`);
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

  const disconnect = () => {
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
