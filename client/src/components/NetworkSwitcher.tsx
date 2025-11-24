import { useNetwork } from "@/lib/networkContext";
import { useWallet } from "@/lib/walletContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NetworkSwitcher() {
  const { ecosystem, setEcosystem } = useNetwork();
  const { isConnected } = useWallet();

  const disabledTooltip = "Disconnect your wallet to switch ecosystems";

  return (
    <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1" data-testid="network-switcher">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant={ecosystem === "xrpl" ? "default" : "ghost"}
              size="sm"
              onClick={() => setEcosystem("xrpl")}
              disabled={isConnected}
              className="gap-2"
              data-testid="button-ecosystem-xrpl"
            >
              <span className="text-sm font-mono">XRPL</span>
            </Button>
          </span>
        </TooltipTrigger>
        {isConnected && (
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant={ecosystem === "flare" ? "default" : "ghost"}
              size="sm"
              onClick={() => setEcosystem("flare")}
              disabled={isConnected}
              className="gap-2"
              data-testid="button-ecosystem-flare"
            >
              <span className="text-sm font-mono">Flare</span>
            </Button>
          </span>
        </TooltipTrigger>
        {isConnected && (
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
