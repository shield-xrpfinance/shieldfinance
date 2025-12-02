import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "@/lib/walletContext";
import { 
  NetworkId, 
  BridgeTokenId, 
  DEFAULT_ENABLED_NETWORKS, 
  DEFAULT_ENABLED_TOKENS 
} from "@shared/bridgeConfig";

export interface UserSettingsState {
  id: string;
  walletAddress: string;
  theme: string;
  defaultNetwork: string | null;
}

export interface WalletState {
  id: string;
  walletType: "evm" | "xrpl";
  address: string;
  label: string | null;
  isPrimary: boolean;
}

interface SettingsContextType {
  settings: UserSettingsState | null;
  isLoading: boolean;
  error: string | null;
  
  wallets: WalletState[];
  addWallet: (wallet: { walletType: "evm" | "xrpl"; address: string; label?: string }) => Promise<void>;
  removeWallet: (walletId: string) => Promise<void>;
  updateWalletLabel: (walletId: string, label: string) => Promise<void>;
  setPrimaryWallet: (walletId: string) => Promise<void>;
  
  enabledNetworks: NetworkId[];
  toggleNetwork: (networkId: NetworkId, enabled: boolean) => Promise<void>;
  setCustomRpc: (networkId: NetworkId, rpcUrl: string | null) => Promise<void>;
  
  enabledTokens: Record<NetworkId, BridgeTokenId[]>;
  toggleToken: (networkId: NetworkId, tokenId: BridgeTokenId, enabled: boolean) => Promise<void>;
  
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { address, evmAddress } = useWallet();
  const queryClient = useQueryClient();
  
  const [theme, setThemeState] = useState<"light" | "dark">(getStoredTheme);
  const [wallets, setWallets] = useState<WalletState[]>([]);
  const [enabledNetworks, setEnabledNetworks] = useState<NetworkId[]>(DEFAULT_ENABLED_NETWORKS);
  const [enabledTokens, setEnabledTokens] = useState<Record<NetworkId, BridgeTokenId[]>>(DEFAULT_ENABLED_TOKENS);
  const [error, setError] = useState<string | null>(null);
  
  const walletAddress = address || evmAddress;
  
  const { 
    data: settingsData, 
    isLoading, 
    refetch: refetchSettings,
    error: queryError 
  } = useQuery<{ settings: UserSettingsState; wallets: WalletState[]; networks: NetworkId[]; tokens: Record<NetworkId, BridgeTokenId[]> } | null>({
    queryKey: ["/api/user/settings", walletAddress],
    queryFn: async () => {
      const res = await fetch(`/api/user/settings?walletAddress=${walletAddress}`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    enabled: !!walletAddress,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
  
  useEffect(() => {
    if (settingsData) {
      if (settingsData.wallets) {
        setWallets(settingsData.wallets);
      }
      if (settingsData.networks) {
        setEnabledNetworks(settingsData.networks);
      }
      if (settingsData.tokens) {
        setEnabledTokens(settingsData.tokens);
      }
      if (settingsData.settings?.theme) {
        const serverTheme = settingsData.settings.theme as "light" | "dark";
        if (serverTheme === "light" || serverTheme === "dark") {
          setThemeState(serverTheme);
          applyTheme(serverTheme);
          localStorage.setItem("theme", serverTheme);
        }
      }
    }
  }, [settingsData]);
  
  useEffect(() => {
    if (queryError) {
      console.error("Settings fetch error:", queryError);
      setError(queryError instanceof Error ? queryError.message : "Failed to load settings");
    } else {
      setError(null);
    }
  }, [queryError]);
  
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  
  useEffect(() => {
    const initialTheme = getStoredTheme();
    applyTheme(initialTheme);
  }, []);
  
  const addWalletMutation = useMutation({
    mutationFn: async (wallet: { walletType: "evm" | "xrpl"; address: string; label?: string }) => {
      if (!walletAddress) throw new Error("No wallet connected");
      const response = await apiRequest("POST", "/api/user/wallets", {
        walletAddress,
        walletType: wallet.walletType,
        address: wallet.address,
        label: wallet.label || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
    },
  });
  
  const removeWalletMutation = useMutation({
    mutationFn: async (walletId: string) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("DELETE", `/api/user/wallets/${walletId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to remove wallet");
    },
  });
  
  const updateWalletLabelMutation = useMutation({
    mutationFn: async ({ walletId, label }: { walletId: string; label: string }) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("PATCH", `/api/user/wallets/${walletId}`, { label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update wallet label");
    },
  });
  
  const setPrimaryWalletMutation = useMutation({
    mutationFn: async (walletId: string) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("PATCH", `/api/user/wallets/${walletId}`, { isPrimary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to set primary wallet");
    },
  });
  
  const toggleNetworkMutation = useMutation({
    mutationFn: async ({ networkId, enabled }: { networkId: NetworkId; enabled: boolean }) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("PUT", "/api/user/networks", {
        walletAddress,
        networkId,
        enabled,
      });
    },
    onSuccess: (_, variables) => {
      setEnabledNetworks(prev => {
        if (variables.enabled) {
          return prev.includes(variables.networkId) ? prev : [...prev, variables.networkId];
        } else {
          return prev.filter(n => n !== variables.networkId);
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to toggle network");
    },
  });
  
  const setCustomRpcMutation = useMutation({
    mutationFn: async ({ networkId, rpcUrl }: { networkId: NetworkId; rpcUrl: string | null }) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("PUT", "/api/user/networks", {
        walletAddress,
        networkId,
        enabled: true,
        customRpcUrl: rpcUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to set custom RPC");
    },
  });
  
  const toggleTokenMutation = useMutation({
    mutationFn: async ({ networkId, tokenId, enabled }: { networkId: NetworkId; tokenId: BridgeTokenId; enabled: boolean }) => {
      if (!walletAddress) throw new Error("No wallet connected");
      await apiRequest("PUT", "/api/user/tokens", {
        walletAddress,
        networkId,
        tokenId,
        enabled,
      });
    },
    onSuccess: (_, variables) => {
      setEnabledTokens(prev => {
        const networkTokens = prev[variables.networkId] || [];
        let updatedTokens: BridgeTokenId[];
        if (variables.enabled) {
          updatedTokens = networkTokens.includes(variables.tokenId) ? networkTokens : [...networkTokens, variables.tokenId];
        } else {
          updatedTokens = networkTokens.filter(t => t !== variables.tokenId);
        }
        return { ...prev, [variables.networkId]: updatedTokens };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings", walletAddress] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to toggle token");
    },
  });
  
  const addWallet = useCallback(async (wallet: { walletType: "evm" | "xrpl"; address: string; label?: string }) => {
    await addWalletMutation.mutateAsync(wallet);
  }, [addWalletMutation]);
  
  const removeWallet = useCallback(async (walletId: string) => {
    await removeWalletMutation.mutateAsync(walletId);
  }, [removeWalletMutation]);
  
  const updateWalletLabel = useCallback(async (walletId: string, label: string) => {
    await updateWalletLabelMutation.mutateAsync({ walletId, label });
  }, [updateWalletLabelMutation]);
  
  const setPrimaryWallet = useCallback(async (walletId: string) => {
    await setPrimaryWalletMutation.mutateAsync(walletId);
  }, [setPrimaryWalletMutation]);
  
  const toggleNetwork = useCallback(async (networkId: NetworkId, enabled: boolean) => {
    await toggleNetworkMutation.mutateAsync({ networkId, enabled });
  }, [toggleNetworkMutation]);
  
  const setCustomRpc = useCallback(async (networkId: NetworkId, rpcUrl: string | null) => {
    await setCustomRpcMutation.mutateAsync({ networkId, rpcUrl });
  }, [setCustomRpcMutation]);
  
  const toggleToken = useCallback(async (networkId: NetworkId, tokenId: BridgeTokenId, enabled: boolean) => {
    await toggleTokenMutation.mutateAsync({ networkId, tokenId, enabled });
  }, [toggleTokenMutation]);
  
  const setTheme = useCallback((newTheme: "light" | "dark") => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    if (walletAddress) {
      apiRequest("PATCH", "/api/user/settings", {
        walletAddress,
        theme: newTheme,
      }).catch(err => {
        console.error("Failed to persist theme to server:", err);
      });
    }
  }, [walletAddress]);
  
  const refreshSettings = useCallback(async () => {
    await refetchSettings();
  }, [refetchSettings]);
  
  const value: SettingsContextType = {
    settings: settingsData?.settings || null,
    isLoading,
    error,
    wallets,
    addWallet,
    removeWallet,
    updateWalletLabel,
    setPrimaryWallet,
    enabledNetworks,
    toggleNetwork,
    setCustomRpc,
    enabledTokens,
    toggleToken,
    theme,
    setTheme,
    refreshSettings,
  };
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export { SettingsContext };
