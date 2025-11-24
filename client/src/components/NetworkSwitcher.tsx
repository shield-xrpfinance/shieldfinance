import { useNetwork } from "@/lib/networkContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function NetworkSwitcher() {
  const { ecosystem, setEcosystem } = useNetwork();

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1" data-testid="network-switcher">
      <Button
        variant={ecosystem === "xrpl" ? "default" : "ghost"}
        size="sm"
        onClick={() => setEcosystem("xrpl")}
        className="gap-2"
        data-testid="button-ecosystem-xrpl"
      >
        <span className="text-sm font-mono">XRPL</span>
      </Button>
      <Button
        variant={ecosystem === "flare" ? "default" : "ghost"}
        size="sm"
        onClick={() => setEcosystem("flare")}
        className="gap-2"
        data-testid="button-ecosystem-flare"
      >
        <span className="text-sm font-mono">Flare</span>
      </Button>
    </div>
  );
}
