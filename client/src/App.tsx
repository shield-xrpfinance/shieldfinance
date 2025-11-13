import { useState } from "react";
import { Switch as RouterSwitch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TestnetBanner } from "@/components/TestnetBanner";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import { NetworkProvider, useNetwork } from "@/lib/networkContext";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, LogOut, Loader2, Beaker } from "lucide-react";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import Dashboard from "@/pages/Dashboard";
import Vaults from "@/pages/Vaults";
import Portfolio from "@/pages/Portfolio";
import Transactions from "@/pages/Transactions";
import Analytics from "@/pages/Analytics";
import BridgeTracking from "@/pages/BridgeTracking";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <RouterSwitch>
      <Route path="/" component={Dashboard} />
      <Route path="/vaults" component={Vaults} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/bridge-tracking" component={BridgeTracking} />
      <Route component={NotFound} />
    </RouterSwitch>
  );
}

function Header() {
  const { address, isConnected, disconnect } = useWallet();
  const { balance, isLoading } = useWalletBalance();
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
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md" data-testid="header-loading-balance">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs text-muted-foreground">Loading...</span>
              </div>
            ) : balance ? (
              <div className="flex items-center gap-3 bg-muted px-3 py-1.5 rounded-md" data-testid="header-balance-display">
                <div className="text-sm font-mono font-bold" data-testid="text-header-balance-xrp">
                  {Number(balance.balanceXRP).toLocaleString()} XRP
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-xs text-muted-foreground" data-testid="text-header-balance-usd">
                  ${Number(balance.balanceUSD).toLocaleString()}
                </div>
              </div>
            ) : null}
            <div className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md" data-testid="text-wallet-address">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={disconnect}
              data-testid="button-disconnect-wallet"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
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

function AppContent() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NetworkProvider>
          <WalletProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1">
                  <Header />
                  <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto">
                      <TestnetBanner />
                      <Router />
                    </div>
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </WalletProvider>
        </NetworkProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return <AppContent />;
}
