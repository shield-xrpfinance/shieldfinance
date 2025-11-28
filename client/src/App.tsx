import { useState, useEffect } from "react";
import { Switch as RouterSwitch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TestnetBanner } from "@/components/TestnetBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { NetworkProvider, useNetwork } from "@/lib/networkContext";
import { CurrencyProvider } from "@/lib/currencyContext";
import { XAppProvider, useXApp } from "@/lib/xAppContext";
import { ReownProvider } from "@/lib/ReownProvider";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, LogOut, Beaker } from "lucide-react";
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

function Header() {
  const { address, evmAddress, isConnected, disconnect, walletType } = useWallet();
  const { isTestnet } = useNetwork();
  const { isXApp } = useXApp();
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Show wallet-aware testnet network name
  const testnetName = walletType === "xrpl" ? "XRPL Testnet" : walletType === "evm" ? "Coston2" : "Testnet";
  
  // Get the display address (either XRPL or EVM)
  const displayAddress = address || evmAddress;
  const shortAddress = displayAddress 
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : null;

  return (
    <header className="flex items-center justify-between gap-2 p-3 md:p-4 border-b min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-shrink">
        {!isXApp && <SidebarTrigger data-testid="button-sidebar-toggle" />}
        {!isXApp && <NetworkSwitcher />}
        {isTestnet && (
          <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4 gap-1 whitespace-nowrap text-xs" data-testid="badge-testnet-status">
            <Beaker className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">{testnetName}</span>
            <span className="sm:hidden">Test</span>
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {isConnected && displayAddress ? (
          <div className="flex items-center gap-1 md:gap-2">
            <Badge variant="secondary" className="font-mono text-xs max-w-[120px] truncate" data-testid="badge-wallet-address">
              {shortAddress}
            </Badge>
            {!isXApp && (
              <Button
                variant="ghost"
                size="icon"
                onClick={disconnect}
                title="Disconnect wallet"
                data-testid="button-disconnect-wallet"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : !isXApp && (
          <Button
            onClick={() => setConnectModalOpen(true)}
            size="sm"
            className="whitespace-nowrap"
            data-testid="button-connect-wallet"
          >
            <Wallet className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </Button>
        )}
        {!isXApp && <ThemeToggle />}
      </div>
      <ConnectWalletModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onConnect={(addr, provider) => {
          // Connection is handled in the modal
        }}
      />
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

function DashboardLayoutInner() {
  const { isXApp } = useXApp();
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
    "--mobile-nav-height": "68px",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        {!isXApp && <AppSidebar />}
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 overflow-auto p-3 md:p-8 pb-[calc(var(--mobile-nav-height,68px)+1rem)] md:pb-8">
            <div className="max-w-7xl mx-auto">
              <TestnetBanner />
              <DashboardRouter />
            </div>
          </main>
        </div>
      </div>
      {!isXApp && <MobileBottomNav />}
    </SidebarProvider>
  );
}

function DashboardLayout() {
  return (
    <XAppProvider>
      <ReownProvider>
        <NetworkProvider>
          <WalletProvider>
            <EcosystemSync />
            <WalletDisconnectHandler />
            <CurrencyProvider>
              <DashboardLayoutInner />
            </CurrencyProvider>
          </WalletProvider>
        </NetworkProvider>
      </ReownProvider>
    </XAppProvider>
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
