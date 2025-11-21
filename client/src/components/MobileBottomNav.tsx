import { Home, Vault, Wallet, ArrowLeftRight, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function MobileBottomNav() {
  const [location] = useLocation();
  const { toggleSidebar } = useSidebar();

  const navItems = [
    { icon: Home, label: "Dashboard", url: "/" },
    { icon: Vault, label: "Vaults", url: "/vaults" },
    { icon: Wallet, label: "Portfolio", url: "/portfolio" },
    { icon: ArrowLeftRight, label: "Swap", url: "/swap" },
  ];

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-primary/20 bg-background/90 backdrop-blur-md shadow-lg"
      style={{ height: 'var(--mobile-nav-height, 68px)' }}
    >
      <div className="flex items-center justify-around px-2 py-2.5 h-full safe-area-bottom">
        {navItems.map((item) => {
          const isActive = location === item.url;
          return (
            <Button
              key={item.url}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30 backdrop-blur-md"
                  : "text-muted-foreground"
              }`}
              asChild
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Link href={item.url}>
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            </Button>
          );
        })}
        
        {/* More button to open sidebar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-1 text-muted-foreground"
          data-testid="mobile-nav-more"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </Button>
      </div>
    </div>
  );
}
