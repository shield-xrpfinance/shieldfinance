import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface WalletContextType {
  address: string | null;
  provider: "xaman" | "walletconnect" | null;
  isConnected: boolean;
  connect: (address: string, provider: "xaman" | "walletconnect") => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<"xaman" | "walletconnect" | null>(null);
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

  const connect = (walletAddress: string, walletProvider: "xaman" | "walletconnect") => {
    setAddress(walletAddress);
    setProvider(walletProvider);
    localStorage.setItem("walletAddress", walletAddress);
    localStorage.setItem("walletProvider", walletProvider);
  };

  const disconnect = () => {
    setAddress(null);
    setProvider(null);
    localStorage.removeItem("walletAddress");
    localStorage.removeItem("walletProvider");
  };

  const isConnected = address !== null;

  return (
    <WalletContext.Provider value={{ address, provider, isConnected, connect, disconnect }}>
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
