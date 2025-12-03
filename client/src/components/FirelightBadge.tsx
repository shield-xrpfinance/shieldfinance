import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Flame, ExternalLink } from "lucide-react";

interface FirelightBadgeProps {
  className?: string;
  showLink?: boolean;
  variant?: "default" | "small" | "inline";
}

export default function FirelightBadge({ 
  className = "", 
  showLink = true,
  variant = "default"
}: FirelightBadgeProps) {
  const content = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`
              gap-1 border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400
              ${variant === "small" ? "text-xs py-0 px-1.5" : ""}
              ${variant === "inline" ? "text-xs py-0 px-1" : ""}
              ${className}
            `}
            data-testid="badge-firelight"
          >
            <Flame className={variant === "small" || variant === "inline" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            <span>Powered by Firelight</span>
            {showLink && (
              <ExternalLink className={variant === "small" || variant === "inline" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Yield generated via Firelight stXRP staking</p>
          <p className="text-xs text-muted-foreground">Phase 1: Liquidity Building</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (showLink) {
    return (
      <a 
        href="https://firelight.finance" 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return content;
}

export function FirelightYieldSource({ amount }: { amount?: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-orange-500/5 border border-orange-500/20">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-medium">Firelight stXRP</span>
      </div>
      <div className="flex items-center gap-2">
        {amount && (
          <span className="text-sm text-muted-foreground">
            {amount} FXRP deployed
          </span>
        )}
        <a 
          href="https://firelight.finance" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-orange-500 hover:text-orange-400"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
