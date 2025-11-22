import { useState } from "react";
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
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { NetworkProvider, useNetwork } from "@/lib/networkContext";
import { CurrencyProvider } from "@/lib/currencyContext";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const { address, isConnected, disconnect } = useWallet();
  const { isTestnet, network } = useNetwork();
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {isTestnet && (
          <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4 gap-1" data-testid="badge-testnet-status">
            <Beaker className="h-3 w-3" />
            {network === "testnet" ? "XRPL Testnet" : "Coston2"}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isConnected && address ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={disconnect}
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setConnectModalOpen(true)}
            data-testid="button-connect-wallet"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </Button>
        )}
        <ThemeToggle />
      </div>
      <ConnectWalletModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        onConnect={(address, provider) => {
          // Connection is handled in the modal
        }}
      />
    </header>
  );
}

function DashboardLayout() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
    "--mobile-nav-height": "68px",
  };

  return (
    <NetworkProvider>
      <WalletProvider>
        <CurrencyProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <Header />
                <main className="flex-1 overflow-auto p-4 md:p-8 pb-[calc(var(--mobile-nav-height,68px)+1rem)] md:pb-8">
                  <div className="max-w-7xl mx-auto">
                    <TestnetBanner />
                    <DashboardRouter />
                  </div>
                </main>
              </div>
            </div>
            <MobileBottomNav />
          </SidebarProvider>
        </CurrencyProvider>
      </WalletProvider>
    </NetworkProvider>
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
