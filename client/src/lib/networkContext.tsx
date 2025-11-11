/* @refresh reset */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Network = "mainnet" | "testnet";

interface NetworkContextType {
  network: Network;
  isTestnet: boolean;
  toggleNetwork: () => void;
  setNetwork: (network: Network) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  network: "mainnet",
  isTestnet: false,
  toggleNetwork: () => {},
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    const saved = localStorage.getItem("xrp-network");
    return (saved === "testnet" ? "testnet" : "mainnet") as Network;
  });

  useEffect(() => {
    localStorage.setItem("xrp-network", network);
  }, [network]);

  const toggleNetwork = () => {
    setNetworkState(prev => prev === "mainnet" ? "testnet" : "mainnet");
  };

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
  };

  const value = {
    network,
    isTestnet: network === "testnet",
    toggleNetwork,
    setNetwork,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
