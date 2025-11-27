import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  // Get AssetManager address
  const assetManagerAddress = await nameToAddress(
    "AssetManagerFXRP",
    "coston2",
    provider
  );
  
  console.log("\n═══════════════════════════════════════");
  console.log("AssetManager:", assetManagerAddress);
  console.log("═══════════════════════════════════════\n");
  
  const abi = [
    "function fAsset() external view returns (address)",
    "function assetMintingDecimals() external view returns (uint256)",
    "function lotSize() external view returns (uint256)",
  ];
  
  const assetManager = new ethers.Contract(assetManagerAddress, abi, provider);
  
  // Get FXRP token address
  const fxrpAddress = await assetManager.fAsset();
  console.log("FXRP Token Address:", fxrpAddress);
  
  // Get minting decimals
  const mintingDecimals = await assetManager.assetMintingDecimals();
  console.log("Asset Minting Decimals:", mintingDecimals.toString());
  
  // Get lot size
  const lotSize = await assetManager.lotSize();
  console.log("Lot Size (in UBA):", lotSize.toString());
  console.log("Lot Size (formatted):", ethers.formatUnits(lotSize, Number(mintingDecimals)));
  
  // Get FXRP token decimals
  const fxrpAbi = ["function decimals() view returns (uint8)"];
  const fxrp = new ethers.Contract(fxrpAddress, fxrpAbi, provider);
  const fxrpDecimals = await fxrp.decimals();
  console.log("\nFXRP Token Decimals:", fxrpDecimals.toString());
  
  console.log("\n═══════════════════════════════════════");
  console.log("ANALYSIS:");
  console.log("═══════════════════════════════════════");
  console.log("XRP (underlying) decimals: 6 (1 XRP = 1,000,000 drops)");
  console.log("AssetManager minting decimals:", mintingDecimals.toString());
  console.log("FXRP (ERC20) decimals:", fxrpDecimals.toString());
  
  if (Number(mintingDecimals) !== 6) {
    console.log("\n⚠️  WARNING: Minting decimals do not match XRP's 6 decimals!");
    console.log("   This causes conversion issues!");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
