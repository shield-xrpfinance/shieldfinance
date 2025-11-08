import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletProvider, useWallet } from "@/lib/walletContext";
import ConnectWalletModal from "@/components/ConnectWalletModal";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";
import Dashboard from "@/pages/Dashboard";
import Vaults from "@/pages/Vaults";
import Portfolio from "@/pages/Portfolio";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/vaults" component={Vaults} />
      <Route path="/portfolio" component={Portfolio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Header() {
  const { address, isConnected, disconnect } = useWallet();
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-2">
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            <div className="text-sm font-mono bg-muted px-3 py-1.5 rounded-md">
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
        <WalletProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <Header />
                <main className="flex-1 overflow-auto p-8">
                  <div className="max-w-7xl mx-auto">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return <AppContent />;
}
