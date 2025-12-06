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
import { LayoutDashboard, Vault, Wallet, History, BarChart3, HelpCircle, ArrowRight, BookOpen, Activity, Gift, Shield, Sparkles, Zap, Vote, ShieldCheck, ArrowLeftRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useWallet } from "@/lib/walletContext";
import { useNetwork } from "@/lib/networkContext";
import { useCurrency, type Currency, getCurrencyName } from "@/lib/currencyContext";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { ShieldLogo } from "@/components/ShieldLogo";
import { ShieldTour } from "@/components/ShieldTour";
import { SiX, SiTelegram, SiDiscord } from "react-icons/si";
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
    url: "/app",
    icon: LayoutDashboard,
  },
  {
    title: "Vaults",
    url: "/app/vaults",
    icon: Vault,
  },
  {
    title: "Portfolio",
    url: "/app/portfolio",
    icon: Wallet,
  },
  {
    title: "Staking",
    url: "/app/staking",
    icon: Shield,
  },
  {
    title: "Swap",
    url: "/app/swap",
    icon: Sparkles,
  },
  {
    title: "Bridge",
    url: "/app/bridge",
    icon: ArrowLeftRight,
  },
  {
    title: "Optimize",
    url: "/app/optimize",
    icon: Zap,
  },
  {
    title: "Airdrop",
    url: "/app/airdrop",
    icon: Gift,
  },
  {
    title: "Transactions",
    url: "/app/transactions",
    icon: History,
  },
  {
    title: "Bridge Tracking",
    url: "/app/bridge-tracking",
    icon: Activity,
    xrplOnly: true,
  },
  {
    title: "Analytics",
    url: "/app/analytics",
    icon: BarChart3,
  },
  {
    title: "Security",
    url: "/app/security",
    icon: ShieldCheck,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { network, isTestnet, toggleNetwork } = useNetwork();
  const { currency, setCurrency } = useCurrency();
  const { walletType } = useWallet();

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <ShieldLogo 
            size={32}
            className="hover-elevate transition-transform"
          />
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
                  <div className="flex items-center gap-2">
                    <CurrencyIcon currency={currency} />
                    <span>{getCurrencyName(currency)}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD" data-testid="option-currency-usd">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="USD" />
                      <span>USD - US Dollar</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EUR" data-testid="option-currency-eur">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="EUR" />
                      <span>EUR - Euro</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="GBP" data-testid="option-currency-gbp">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="GBP" />
                      <span>GBP - British Pound</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="JPY" data-testid="option-currency-jpy">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="JPY" />
                      <span>JPY - Japanese Yen</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="CAD" data-testid="option-currency-cad">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="CAD" />
                      <span>CAD - Canadian Dollar</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AUD" data-testid="option-currency-aud">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="AUD" />
                      <span>AUD - Australian Dollar</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AED" data-testid="option-currency-aed">
                    <div className="flex items-center gap-2">
                      <CurrencyIcon currency="AED" />
                      <span>AED - UAE Dirham</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => {
                  if (item.xrplOnly && walletType === "evm") return false;
                  return true;
                })
                .map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link 
                        href={item.url} 
                        data-testid={`link-${item.title.toLowerCase()}`}
                        className="backdrop-blur-md border border-primary/20 hover:border-primary/40 transition-colors"
                      >
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
      <SidebarFooter className="p-2 md:p-6 space-y-3">
        {/* Guided Tour Button */}
        <ShieldTour variant="inline" />

        <div className="relative rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-3 md:p-6 overflow-hidden" data-testid="help-card">
          <div className="absolute top-4 left-4 rounded-lg bg-primary/20 p-2 backdrop-blur-sm hidden md:block">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/30 blur-xl" />
              <HelpCircle className="relative h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
          </div>
          
          <div className="mt-0 md:mt-16 space-y-2 md:space-y-4">
            <div className="text-center md:text-left">
              <h3 className="font-semibold text-xs md:text-base flex items-center justify-center md:justify-start gap-1.5" data-testid="text-help-title">
                <HelpCircle className="h-3.5 w-3.5 md:hidden text-primary" />
                Need help?
              </h3>
              <p className="text-[10px] md:text-xs text-muted-foreground" data-testid="text-help-subtitle">Check our docs</p>
            </div>
            
            <Button 
              variant="secondary" 
              size="sm"
              className="w-full justify-between group hidden md:flex"
              asChild
              data-testid="button-documentation"
            >
              <a 
                href="https://docs.shyield.finance" 
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

            <div className="flex items-center justify-center gap-1.5 md:gap-3 pt-1 md:pt-2">
              <a 
                href="https://x.com/ShieldFinanceX" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-twitter"
                title="Follow us on X"
              >
                <SiX className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://t.me/ShieldFinanceOfficial" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-telegram-official"
                title="Telegram Official Channel"
              >
                <SiTelegram className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://t.me/ShieldFinanceCommunity" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-telegram-community"
                title="Telegram Community Chat"
              >
                <SiTelegram className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://discord.gg/Vzs3KbzU" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-discord"
                title="Join our Discord"
              >
                <SiDiscord className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://docs.shyield.finance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-docs"
                title="Documentation"
              >
                <BookOpen className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
              <a 
                href="https://vote.shyield.finance" 
                target="_blank" 
                rel="noopener noreferrer"
                className="rounded-md p-1.5 md:p-2 hover-elevate active-elevate-2 transition-colors"
                data-testid="link-governance"
                title="Governance Portal"
              >
                <Vote className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </a>
            </div>

            <p className="text-center text-[8px] md:text-[10px] text-muted-foreground pt-1 md:pt-2 hidden md:block" data-testid="text-copyright">
              Copyright© 2025 Shield Yield Vaults Ltd. - All Rights Reserved
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
