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
import { LayoutDashboard, Vault, Wallet, History, BarChart3, Coins, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/lib/walletContext";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { AssetIcon } from "@/components/AssetIcon";

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
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isConnected } = useWallet();
  const { balance, isLoading } = useWalletBalance();

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
      </SidebarContent>
      <SidebarFooter className="p-6">
        <div className="rounded-md border p-4 space-y-2" data-testid="wallet-balance-card">
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
      </SidebarFooter>
    </Sidebar>
  );
}
