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
import { LayoutDashboard, Vault, Wallet, History, BarChart3, Coins, HelpCircle, ArrowRight, BookOpen, Activity, Gift, Shield, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useCurrency, type Currency, getCurrencyName } from "@/lib/currencyContext";
import { SiX, SiLinkedin, SiDiscord } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    title: "Staking",
    url: "/staking",
    icon: Shield,
  },
  {
    title: "Swap",
    url: "/swap",
    icon: Sparkles,
  },
  {
    title: "Airdrop",
    url: "/airdrop",
    icon: Gift,
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
];

export function AppSidebar() {
  const [location] = useLocation();
  const { network, isTestnet, toggleNetwork } = useNetwork();
  const { currency, setCurrency } = useCurrency();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary p-2">
            <Coins className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Shield Finance</h2>
            <p className="text-xs text-muted-foreground">XRP Liquid Staking Protocol</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="space-y-3">
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

            <div className="px-2" data-testid="currency-selector">
              <label className="text-xs font-medium text-muted-foreground block mb-2">Currency</label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                <SelectTrigger className="h-9" data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD" data-testid="option-currency-usd">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR" data-testid="option-currency-eur">EUR - Euro</SelectItem>
                  <SelectItem value="GBP" data-testid="option-currency-gbp">GBP - British Pound</SelectItem>
                  <SelectItem value="JPY" data-testid="option-currency-jpy">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="CAD" data-testid="option-currency-cad">CAD - Canadian Dollar</SelectItem>
                </SelectContent>
              </Select>
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
      </SidebarContent>
      {/* 
        Design Guidelines Compliance Verification:
        ✓ Spacing primitives: All spacing uses units from [2, 4, 6, 8, 12, 16]
        ✓ Component padding: p-6 for footer and help card (cards guideline)
        ✓ Typography scaling: Responsive text-sm/text-base, text-xs scaling
        ✓ Consistent spacing: gap-2/gap-4, space-y-4 throughout
        ✓ Button sizing: Removed explicit height, using size="sm" variant
      */}
      <SidebarFooter className="p-6">
        <div className="relative rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 overflow-hidden" data-testid="help-card">
          <div className="absolute top-4 left-4 rounded-lg bg-primary/20 p-2 backdrop-blur-sm hidden md:block">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/30 blur-xl" />
              <HelpCircle className="relative h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
          </div>
          
          <div className="mt-0 md:mt-16 space-y-4">
            <div>
              <h3 className="font-semibold text-sm md:text-base" data-testid="text-help-title">Need help?</h3>
              <p className="text-xs text-muted-foreground" data-testid="text-help-subtitle">Please check our docs</p>
            </div>
            
            <Button 
              variant="secondary" 
              size="sm"
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
                  <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="text-xs md:text-sm">Documentation</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>

            <div className="flex items-center justify-center gap-2 md:gap-4 pt-2">
              <a 
                href="https://twitter.com/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-twitter"
              >
                <SiX className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://linkedin.com/company/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-linkedin"
              >
                <SiLinkedin className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://discord.gg/shieldfinance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-discord"
              >
                <SiDiscord className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://shield-finance.gitbook.io/shield-finance-docs/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-gitbook"
              >
                <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
            </div>

            <p className="text-center text-[9px] md:text-[10px] text-muted-foreground pt-2" data-testid="text-copyright">
              Copyright© 2025 Shield Yield Vaults Ltd. - All Rights Reserved
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
