import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Vault, Wallet, History, BarChart3, Coins, Loader2, HelpCircle, ArrowRight, BookOpen, Shield, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { AssetIcon } from "@/components/AssetIcon";
import { SiX, SiLinkedin, SiDiscord } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Vaults",
    url: "/vaults",
    icon: Vault,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Wallet,
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: History,
  },
  {
    title: "Bridge Tracking",
    url: "/bridge-tracking",
    icon: Activity,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Admin",
    url: "/admin",
    icon: Shield,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isConnected } = useWallet();
  const { balance, isLoading } = useWalletBalance();
  const { network, isTestnet, toggleNetwork } = useNetwork();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary p-2">
            <Coins className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">XRP Stake</h2>
            <p className="text-xs text-muted-foreground">Liquid Protocol</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="flex items-center justify-center gap-2 bg-muted px-3 py-2 rounded-md mx-2" data-testid="network-toggle">
              <span className="text-xs font-medium text-muted-foreground">Mainnet</span>
              <Switch
                checked={isTestnet}
                onCheckedChange={toggleNetwork}
                data-testid="switch-network-toggle"
              />
              <span className={`text-xs font-medium ${isTestnet ? 'text-orange-500' : 'text-muted-foreground'}`}>
                Testnet
              </span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <div className="rounded-lg border bg-card p-4 space-y-2" data-testid="wallet-balance-card">
              <p className="text-xs font-medium text-muted-foreground">Your Balance</p>
              {!isConnected ? (
                <p className="text-sm text-muted-foreground" data-testid="text-connect-wallet-message">Connect your wallet to view balance</p>
              ) : isLoading ? (
                <div className="flex items-center gap-2" data-testid="loading-balance">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading balance...</p>
                </div>
              ) : balance ? (
                <>
                  <div className="flex items-center gap-2">
                    <AssetIcon asset="XRP" size={24} />
                    <div>
                      <p className="text-2xl font-bold font-mono tabular-nums" data-testid="text-balance-xrp">
                        {Number(balance.balanceXRP).toLocaleString()} XRP
                      </p>
                      <p className="text-xs text-muted-foreground" data-testid="text-balance-usd">
                        ≈ ${Number(balance.balanceUSD).toLocaleString()} USD
                      </p>
                    </div>
                  </div>
                  {balance.error && (
                    <p className="text-xs text-destructive" data-testid="text-balance-error">{balance.error}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="text-balance-unavailable">Balance unavailable</p>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-6">
        <div className="relative rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 overflow-hidden" data-testid="help-card">
          <div className="absolute top-4 left-4 rounded-lg bg-primary/20 p-3 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/30 blur-xl" />
              <HelpCircle className="relative h-6 w-6 text-primary" />
            </div>
          </div>
          
          <div className="mt-16 space-y-3">
            <div>
              <h3 className="font-semibold text-base" data-testid="text-help-title">Need help?</h3>
              <p className="text-xs text-muted-foreground" data-testid="text-help-subtitle">Please check our docs</p>
            </div>
            
            <Button 
              variant="secondary" 
              className="w-full justify-between group"
              asChild
              data-testid="button-documentation"
            >
              <a 
                href="https://shield-finance.gitbook.io/shield-finance-docs/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Documentation
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>

            <div className="flex items-center justify-center gap-3 pt-2">
              <a 
                href="https://twitter.com/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-twitter"
              >
                <SiX className="h-4 w-4" />
              </a>
              <a 
                href="https://linkedin.com/company/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-linkedin"
              >
                <SiLinkedin className="h-4 w-4" />
              </a>
              <a 
                href="https://discord.gg/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-discord"
              >
                <SiDiscord className="h-4 w-4" />
              </a>
              <a 
                href="https://shield-finance.gitbook.io/shield-finance-docs/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-gitbook"
              >
                <BookOpen className="h-4 w-4" />
              </a>
            </div>

            <p className="text-center text-[10px] text-muted-foreground pt-2" data-testid="text-copyright">
              Copyright© 2025 Shield Yield Vaults Ltd. - All Rights Reserved
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
