import { useState, useEffect } from "react";
import { Moon, Sun, Wallet, LogOut, Beaker, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useNetwork } from "@/lib/networkContext";
import { useWallet } from "@/lib/walletContext";
import { Separator } from "@/components/ui/separator";

interface ControlCenterProps {
  onConnectWallet: () => void;
}

export function ControlCenter({ onConnectWallet }: ControlCenterProps) {
  const [open, setOpen] = useState(false);
  const { ecosystem, setEcosystem, isTestnet } = useNetwork();
  const { address, evmAddress, isConnected, disconnect, walletType } = useWallet();
  
  const displayAddress = address || evmAddress;
  const shortAddress = displayAddress 
    ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}`
    : null;
  
  const testnetName = walletType === "xrpl" ? "XRPL Testnet" : walletType === "evm" ? "Coston2" : "Testnet";
  
  // Theme state - sync with document on open
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // Sync theme when control center opens
  useEffect(() => {
    if (open) {
      const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      setTheme(currentTheme);
    }
  }, [open]);
  
  // Also sync on mount
  useEffect(() => {
    const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(currentTheme);
  }, []);
  
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setOpen(false);
  };

  const handleConnect = () => {
    setOpen(false);
    onConnectWallet();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        data-testid="button-control-center"
      >
        <ChevronDown className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent 
          side="top" 
          className="rounded-b-2xl bg-background/95 backdrop-blur-xl border-b border-primary/20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-sm sm:border-x sm:border-primary/20"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Control Center</SheetTitle>
            <SheetDescription>Quick settings and wallet controls</SheetDescription>
          </SheetHeader>
          
          <div className="space-y-5 pt-2">
            {/* Network Ecosystem Toggle */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Network</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={ecosystem === "xrpl" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    if (!isConnected) {
                      setEcosystem("xrpl");
                    }
                  }}
                  disabled={isConnected}
                  className="h-14 text-base font-medium"
                  data-testid="control-center-xrpl"
                >
                  XRPL
                </Button>
                <Button
                  variant={ecosystem === "flare" ? "default" : "outline"}
                  size="lg"
                  onClick={() => {
                    if (!isConnected) {
                      setEcosystem("flare");
                    }
                  }}
                  disabled={isConnected}
                  className="h-14 text-base font-medium"
                  data-testid="control-center-flare"
                >
                  Flare
                </Button>
              </div>
              {isConnected && (
                <p className="text-xs text-muted-foreground text-center">
                  Disconnect wallet to switch networks
                </p>
              )}
            </div>

            {/* Testnet Badge */}
            {isTestnet && (
              <div className="flex justify-center">
                <Badge 
                  variant="outline" 
                  className="bg-chart-4/10 text-chart-4 border-chart-4 gap-1 px-4 py-1.5"
                  data-testid="control-center-testnet-badge"
                >
                  <Beaker className="h-3.5 w-3.5" />
                  {testnetName}
                </Badge>
              </div>
            )}

            <Separator className="bg-border/50" />

            {/* Quick Toggles Grid */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Settings</span>
              <div className="grid grid-cols-2 gap-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/50 hover-elevate active-elevate-2 transition-all"
                  data-testid="control-center-theme"
                >
                  <div className={`p-3 rounded-full ${theme === "dark" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {theme === "dark" ? (
                      <Moon className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {theme === "dark" ? "Dark" : "Light"}
                  </span>
                </button>

                {/* Wallet Connection */}
                <button
                  onClick={isConnected ? handleDisconnect : handleConnect}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-muted/50 hover-elevate active-elevate-2 transition-all"
                  data-testid="control-center-wallet"
                >
                  <div className={`p-3 rounded-full ${isConnected ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {isConnected ? (
                      <LogOut className="h-5 w-5" />
                    ) : (
                      <Wallet className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {isConnected ? "Disconnect" : "Connect"}
                  </span>
                </button>
              </div>
            </div>

            {/* Connected Wallet Info */}
            {isConnected && shortAddress && (
              <>
                <Separator className="bg-border/50" />
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connected Wallet</span>
                  <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted/30">
                    <Badge variant="secondary" className="font-mono text-sm px-4 py-1.5">
                      {shortAddress}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
