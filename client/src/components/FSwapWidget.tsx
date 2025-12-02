import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

export interface FSwapWidgetProps {
  className?: string;
  style?: React.CSSProperties;
  sourceChainId?: string | number;
  destChainId?: string | number;
  onSwapComplete?: (params: { txHash: string }) => void;
  apiKey?: string;
}

const CHAIN_ID_MAP: Record<string, string> = {
  xrpl: "xrpl:mainnet",
  flare: "eip155:14",
  ethereum: "eip155:1",
  base: "eip155:8453",
  arbitrum: "eip155:42161",
  optimism: "eip155:10",
  polygon: "eip155:137",
};

const DEFAULT_API_KEY = import.meta.env.VITE_FSWAP_API_KEY || "";

export function FSwapWidget({
  className,
  style,
  sourceChainId,
  destChainId,
  onSwapComplete,
  apiKey,
}: FSwapWidgetProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);
  
  const url = new URL("https://fswap.luminite.app");
  url.searchParams.set("theme", theme === "dark" ? "dark" : "light");
  url.searchParams.set("type", "widget");

  if (sourceChainId) {
    const mappedSource = typeof sourceChainId === "string" && CHAIN_ID_MAP[sourceChainId]
      ? CHAIN_ID_MAP[sourceChainId]
      : sourceChainId.toString();
    url.searchParams.set("sourceChainId", mappedSource);
  }
  
  if (destChainId) {
    const mappedDest = typeof destChainId === "string" && CHAIN_ID_MAP[destChainId]
      ? CHAIN_ID_MAP[destChainId]
      : destChainId.toString();
    url.searchParams.set("destChainId", mappedDest);
  }
  
  url.searchParams.set("apiKey", apiKey || DEFAULT_API_KEY);

  useEffect(() => {
    if (!onSwapComplete) return;

    const allowedOrigin = url.origin;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin) return;

      const data = event.data as { name?: string; txHash?: string };
      if (data && typeof data === "object" && data.name === "swapComplete") {
        const { name: _, ...rest } = data;
        onSwapComplete(rest as { txHash: string });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onSwapComplete, url.origin]);

  return (
    <div className={className} style={style}>
      <iframe
        src={url.toString()}
        className="w-full rounded-lg border-0"
        style={{
          height: "640px",
          minHeight: "640px",
          ...style,
        }}
        title="FSwap Multi-Chain Bridge"
        allow="publickey-credentials-get *; publickey-credentials-create *; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        data-testid="iframe-fswap-widget"
      />
    </div>
  );
}

export function FSwapWidgetCard({
  onSwapComplete,
}: {
  onSwapComplete?: (params: { txHash: string }) => void;
}) {
  return (
    <Card data-testid="card-fswap-widget">
      <CardContent className="p-0 overflow-hidden rounded-lg">
        <FSwapWidget
          sourceChainId="xrpl"
          destChainId="flare"
          onSwapComplete={onSwapComplete}
        />
      </CardContent>
    </Card>
  );
}
