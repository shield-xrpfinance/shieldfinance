import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssetIcon } from "@/components/AssetIcon";
import { ChevronDown } from "lucide-react";

export interface SwapAsset {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isNative: boolean;
}

interface AssetSelectorProps {
  selectedAsset: SwapAsset;
  availableAssets: SwapAsset[];
  balances: Record<string, string>;
  onSelectAsset: (asset: SwapAsset) => void;
  disabled?: boolean;
}

export function AssetSelector({
  selectedAsset,
  availableAssets,
  balances,
  onSelectAsset,
  disabled = false,
}: AssetSelectorProps) {
  const [open, setOpen] = useState(false);

  const formatBalance = (symbol: string): string => {
    if (!balances) return "...";
    const balance = balances[symbol.toLowerCase()];
    if (balance === undefined || balance === null) return "...";
    const parsed = parseFloat(balance);
    if (isNaN(parsed)) return "0.0000";
    return parsed.toFixed(4);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-2 hover-elevate"
          disabled={disabled}
          data-testid="button-select-asset"
        >
          <div className="flex items-center gap-2">
            <AssetIcon
              asset={selectedAsset.symbol as any}
              size={24}
            />
            <div className="flex flex-col items-start">
              <span className="font-semibold text-sm">{selectedAsset.symbol}</span>
              <span className="text-xs text-muted-foreground">
                {formatBalance(selectedAsset.symbol)}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {availableAssets.map((asset) => (
          <DropdownMenuItem
            key={asset.symbol}
            onClick={() => {
              onSelectAsset(asset);
              setOpen(false);
            }}
            className="cursor-pointer"
            data-testid={`option-asset-${asset.symbol.toLowerCase()}`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <AssetIcon asset={asset.symbol as any} size={20} />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{asset.symbol}</span>
                  <span className="text-xs text-muted-foreground">{asset.name}</span>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatBalance(asset.symbol)}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
