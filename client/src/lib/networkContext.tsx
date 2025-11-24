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
  setEcosystem: (ecosystem: Ecosystem, isManual?: boolean) => void;
  manualOverride: boolean;
  resetManualOverride: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
  network: "mainnet",
  isTestnet: false,
  toggleNetwork: () => {},
  setNetwork: () => {},
  ecosystem: "xrpl",
  setEcosystem: () => {},
  manualOverride: false,
  resetManualOverride: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(() => {
    const saved = localStorage.getItem("xrp-network");
    return (saved === "testnet" ? "testnet" : "mainnet") as Network;
  });

  const [ecosystem, setEcosystemState] = useState<Ecosystem>("xrpl");
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    localStorage.setItem("xrp-network", network);
  }, [network]);

  const toggleNetwork = () => {
    setNetworkState(prev => prev === "mainnet" ? "testnet" : "mainnet");
  };

  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
  };

  const setEcosystem = (newEcosystem: Ecosystem, isManual: boolean = true) => {
    setEcosystemState(newEcosystem);
    if (isManual) {
      setManualOverride(true);
    }
  };

  const resetManualOverride = () => {
    setManualOverride(false);
  };

  const value = {
    network,
    isTestnet: network === "testnet",
    toggleNetwork,
    setNetwork,
    ecosystem,
    setEcosystem,
    manualOverride,
    resetManualOverride,
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
