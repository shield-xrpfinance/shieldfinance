import { useState, useEffect } from "react";
import { Switch as RouterSwitch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TestnetBanner } from "@/components/TestnetBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ControlCenter } from "@/components/ControlCenter";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { NetworkProvider, useNetwork } from "@/lib/networkContext";
import { CurrencyProvider } from "@/lib/currencyContext";
import { ReownProvider } from "@/lib/ReownProvider";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Vaults from "@/pages/Vaults";
import Portfolio from "@/pages/Portfolio";
import Transactions from "@/pages/Transactions";
import Analytics from "@/pages/Analytics";
import BridgeTracking from "@/pages/BridgeTracking";
import Airdrop from "@/pages/Airdrop";
import Staking from "@/pages/Staking";
import Swap from "@/pages/Swap";
import NotFound from "@/pages/not-found";

function DashboardRouter() {
  return (
    <RouterSwitch>
      <Route path="/app" component={Dashboard} />
      <Route path="/app/vaults" component={Vaults} />
      <Route path="/app/portfolio" component={Portfolio} />
      <Route path="/app/transactions" component={Transactions} />
      <Route path="/app/analytics" component={Analytics} />
      <Route path="/app/bridge-tracking" component={BridgeTracking} />
      <Route path="/app/airdrop" component={Airdrop} />
      <Route path="/app/staking" component={Staking} />
      <Route path="/app/swap" component={Swap} />
      <Route component={NotFound} />
    </RouterSwitch>
  );
}

interface HeaderProps {
  onConnectWallet: () => void;
}

function Header({ onConnectWallet }: HeaderProps) {
  const { address, evmAddress, isConnected } = useWallet();
  
  // Get the display address (either XRPL or EVM)
  const displayAddress = address || evmAddress;
  const shortAddress = displayAddress 
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : null;

  return (
    <header className="flex items-center justify-between gap-2 p-3 md:p-4 border-b">
      {/* Left side - Sidebar trigger */}
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {/* Show connected wallet badge on larger screens */}
        {isConnected && shortAddress && (
          <Badge variant="secondary" className="font-mono text-xs hidden sm:flex" data-testid="badge-wallet-address">
            {shortAddress}
          </Badge>
        )}
      </div>

      {/* Right side - Control Center for all screen sizes */}
      <div className="flex items-center gap-2">
        <ControlCenter onConnectWallet={onConnectWallet} />
      </div>
    </header>
  );
}

function EcosystemSync() {
  const { walletType, isConnected } = useWallet();
  const { setEcosystem, ecosystem, manualOverride, resetManualOverride } = useNetwork();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected || !walletType) return;

    const targetEcosystem = walletType === "xrpl" ? "xrpl" : "flare";

    // Check for mismatch between wallet type and ecosystem
    if (manualOverride && ecosystem !== targetEcosystem) {
      // User manually selected incompatible ecosystem before connecting
      const walletName = walletType === "xrpl" ? "XRPL" : "EVM";
      const ecosystemName = targetEcosystem === "xrpl" ? "XRPL" : "Flare";
      
      toast({
        title: "Ecosystem Auto-Corrected",
        description: `Your ${walletName} wallet has been connected. Switching to ${ecosystemName} ecosystem to show compatible vaults.`,
      });

      // Auto-correct the ecosystem and clear manual override
      setEcosystem(targetEcosystem, false);
      resetManualOverride();
    } else if (!manualOverride && ecosystem !== targetEcosystem) {
      // Normal auto-sync when no manual override
      setEcosystem(targetEcosystem, false);
    }
  }, [walletType, isConnected, manualOverride, ecosystem, setEcosystem, resetManualOverride, toast]);

  return null;
}

function WalletDisconnectHandler() {
  const { isConnected } = useWallet();
  const { resetManualOverride } = useNetwork();

  useEffect(() => {
    // Reset manual override when wallet disconnects
    if (!isConnected) {
      resetManualOverride();
    }
  }, [isConnected, resetManualOverride]);

  return null;
}

function DashboardLayout() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
    "--mobile-nav-height": "68px",
  };

  return (
    <ReownProvider>
      <NetworkProvider>
        <WalletProvider>
          <EcosystemSync />
          <WalletDisconnectHandler />
          <CurrencyProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1">
                  <Header onConnectWallet={() => setConnectModalOpen(true)} />
                  <main className="flex-1 overflow-auto p-4 md:p-8 pb-[calc(var(--mobile-nav-height,68px)+1rem)] md:pb-8">
                    <div className="max-w-7xl mx-auto">
                      <TestnetBanner />
                      <DashboardRouter />
                    </div>
                  </main>
                </div>
              </div>
              <MobileBottomNav />
              <ConnectWalletModal
                open={connectModalOpen}
                onOpenChange={setConnectModalOpen}
                onConnect={() => {}}
              />
            </SidebarProvider>
          </CurrencyProvider>
        </WalletProvider>
      </NetworkProvider>
    </ReownProvider>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isDashboard = location.startsWith('/app');

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isDashboard ? (
          <DashboardLayout />
        ) : (
          <RouterSwitch>
            <Route path="/" component={Landing} />
            <Route component={NotFound} />
          </RouterSwitch>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return <AppContent />;
}
