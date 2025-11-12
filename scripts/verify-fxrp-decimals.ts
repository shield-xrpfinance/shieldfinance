import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  console.log("\n═══════════════════════════════════════");
  console.log("FXRP Decimal Verification");
  console.log("═══════════════════════════════════════\n");
  
  // Get AssetManager address from Flare Contract Registry
  const assetManagerAddress = await nameToAddress(
    "AssetManagerFXRP",
    "coston2",
    provider
  );
  
  console.log("AssetManager Address:", assetManagerAddress);
  
  // Get FXRP address from AssetManager
  const assetManagerAbi = [
    "function fAsset() view returns (address)",
    "function assetMintingDecimals() view returns (uint8)"
  ];
  const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, provider);
  const fxrpAddress = await assetManager.fAsset();
  
  console.log("FXRP Token Address:", fxrpAddress);
  
  // Get decimals from FXRP token contract
  const fxrpAbi = ["function decimals() view returns (uint8)"];
  const fxrp = new ethers.Contract(fxrpAddress, fxrpAbi, provider);
  const tokenDecimals = await fxrp.decimals();
  
  console.log("FXRP.decimals() (on-chain):", tokenDecimals.toString());
  
  // Get decimals from AssetManager
  const mintingDecimals = await assetManager.assetMintingDecimals();
  
  console.log("AssetManager.assetMintingDecimals():", mintingDecimals.toString());
  
  console.log("\n═══════════════════════════════════════");
  console.log("VERDICT:");
  console.log("═══════════════════════════════════════");
  if (tokenDecimals === 18n) {
    console.log("✅ FXRP token uses 18 decimals on-chain");
    console.log("✅ We should use parseUnits(amount, 18) and formatUnits(balance, 18)");
  } else {
    console.log(`⚠️  FXRP token uses ${tokenDecimals} decimals`);
  }
  
  if (mintingDecimals !== tokenDecimals) {
    console.log(`⚠️  Mismatch: AssetManager reports ${mintingDecimals} but token reports ${tokenDecimals}`);
    console.log("⚠️  We should use the token's decimals (18) for all operations");
  }
  
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
