import xrpLogo from "@assets/xrp.148c3b50_1762588566535.png";
import usdcLogo from "@assets/usdc-icon.5f31fb80_1762588566536.png";
import rlusdLogo from "@assets/rlusd-icon.d10ce925_1762588566536.png";
import flrLogo from "@assets/flr.svg";
import fxrpLogo from "@assets/fxrp-logo.png";

type AssetType = "XRP" | "RLUSD" | "USDC" | "FLR" | "WFLR" | "USDT" | "SHIELD" | "shXRP" | "FXRP";

interface AssetIconProps {
  asset: AssetType;
  size?: number;
  className?: string;
}

const assetLogos: Record<AssetType, string> = {
  XRP: xrpLogo,
  RLUSD: rlusdLogo,
  USDC: usdcLogo,
  FLR: flrLogo,
  WFLR: "https://res.cloudinary.com/sparkdex/image/upload/q_100/v1/website-assets/coins/wflr?_a=DATAiZAAZAA0",
  USDT: "https://res.cloudinary.com/metavault/image/upload/q_100/v1/website-assets/coins/usdt?_a=DATAiZAAZAA0",
  SHIELD: "/shield-logo.png",
  shXRP: xrpLogo,
  FXRP: fxrpLogo,
};

const assetNames: Record<AssetType, string> = {
  XRP: "XRP",
  RLUSD: "Ripple USD",
  USDC: "USD Coin",
  FLR: "Flare",
  WFLR: "Wrapped Flare",
  USDT: "Bridged USDT",
  SHIELD: "Shield",
  shXRP: "Liquid Staked XRP",
  FXRP: "Flare XRP",
};

export function AssetIcon({ asset, size = 24, className = "" }: AssetIconProps) {
  return (
    <img
      src={assetLogos[asset]}
      alt={assetNames[asset]}
      width={size}
      height={size}
      className={`inline-block rounded-full ${className}`}
      data-testid={`asset-icon-${asset.toLowerCase()}`}
    />
  );
}

interface MultiAssetIconProps {
  assets: string;
  size?: number;
  className?: string;
}

export function MultiAssetIcon({ assets, size = 24, className = "" }: MultiAssetIconProps) {
  const assetList = assets.split(",").map(a => a.trim() as AssetType);
  
  if (assetList.length === 1) {
    return <AssetIcon asset={assetList[0]} size={size} className={className} />;
  }
  
  return (
    <div className={`flex items-center ${className}`} data-testid="multi-asset-icons">
      {assetList.map((asset, index) => (
        <div
          key={asset}
          className="relative"
          style={{
            marginLeft: index > 0 ? `-${size * 0.3}px` : 0,
            zIndex: assetList.length - index,
          }}
        >
          <AssetIcon asset={asset} size={size} />
        </div>
      ))}
    </div>
  );
}
