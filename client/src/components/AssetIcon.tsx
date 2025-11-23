import xrpLogo from "@assets/xrp.148c3b50_1762588566535.png";
import usdcLogo from "@assets/usdc-icon.5f31fb80_1762588566536.png";
import rlusdLogo from "@assets/rlusd-icon.d10ce925_1762588566536.png";
import flrLogo from "@assets/flr.svg";
import fxrpLogo from "@assets/fxrp-logo.png";
import { getAssetDisplayName, type AssetKey } from "@shared/assetConfig";
import { useNetwork } from "@/lib/networkContext";

type AssetType = AssetKey;

interface AssetIconProps {
  asset: AssetType;
  size?: number;
  className?: string;
  network?: "mainnet" | "testnet"; // Optional network override
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

export function AssetIcon({ asset, size = 24, className = "", network: networkOverride }: AssetIconProps) {
  const { network: contextNetwork } = useNetwork();
  const network = networkOverride || contextNetwork;
  
  // Get network-aware display name (e.g., "FXRP" on mainnet, "FTestXRP" on testnet)
  const displayName = getAssetDisplayName(asset, network);
  
  // Get logo with fallback for missing assets
  const logoSrc = assetLogos[asset] || "/shield-logo.png";
  
  return (
    <img
      src={logoSrc}
      alt={displayName}
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
