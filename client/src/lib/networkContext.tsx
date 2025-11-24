/* @refresh reset */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Network = "mainnet" | "testnet";
type Ecosystem = "xrpl" | "flare";

interface NetworkContextType {
  network: Network;
  isTestnet: boolean;
  toggleNetwork: () => void;
  setNetwork: (network: Network) => void;
  ecosystem: Ecosystem;
  setEcosystem: (ecosystem: Ecosystem) => void;
}

const NetworkContext = createContext<NetworkContextType>({
  network: "mainnet",
  isTestnet: false,
  toggleNetwork: () => {},
  setNetwork: () => {},
  ecosystem: "xrpl",
  setEcosystem: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    const saved = localStorage.getItem("xrp-network");
    return (saved === "testnet" ? "testnet" : "mainnet") as Network;
  });

  const [ecosystem, setEcosystemState] = useState<Ecosystem>(() => {
    const saved = localStorage.getItem("xrp-ecosystem");
    return (saved === "flare" ? "flare" : "xrpl") as Ecosystem;
  });

  useEffect(() => {
    localStorage.setItem("xrp-network", network);
  }, [network]);

  useEffect(() => {
    localStorage.setItem("xrp-ecosystem", ecosystem);
  }, [ecosystem]);

  const toggleNetwork = () => {
    setNetworkState(prev => prev === "mainnet" ? "testnet" : "mainnet");
  };

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
  };

  const setEcosystem = (newEcosystem: Ecosystem) => {
    setEcosystemState(newEcosystem);
  };

  const value = {
    network,
    isTestnet: network === "testnet",
    toggleNetwork,
    setNetwork,
    ecosystem,
    setEcosystem,
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
