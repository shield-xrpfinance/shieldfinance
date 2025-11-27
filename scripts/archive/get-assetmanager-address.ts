import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

const RPC_ENDPOINTS = {
  flare: "https://flare-api.flare.network/ext/C/rpc",
  coston2: "https://coston2-api.flare.network/ext/C/rpc"
};

const REGISTRY_KEYS_TO_TRY = [
  "AssetManager.FXRP",
  "AssetManagerFXRP",
  "FAssetManager.FXRP",
  "IAssetManager.FXRP",
  "AssetManager",
  "FXRP.AssetManager"
];

async function getAssetManagerAddress(network: "flare" | "coston2") {
  console.log(`\n🔍 Looking up AssetManager address on ${network}...`);
  
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[network]);
  
  for (const contractName of REGISTRY_KEYS_TO_TRY) {
    console.log(`   Trying "${contractName}"...`);
    
    try {
      const address = await nameToAddress(contractName, network, provider);
      
      if (!address || address === ethers.ZeroAddress) {
        console.log(`   ⚠️  Zero address - trying next variation...`);
        continue;
      }
      
      console.log(`   ✅ Found! AssetManager Address: ${address}`);
      
      const AssetManagerABI = [
        "function fAsset() external view returns (address)"
      ];
      const assetManager = new ethers.Contract(address, AssetManagerABI, provider);
      
      try {
        const fxrpAddress = await assetManager.fAsset();
        console.log(`   ✅ FXRP Token Address: ${fxrpAddress}`);
        return { address, fxrpAddress, contractName };
      } catch (error) {
        console.log(`   ⚠️  Could not verify fAsset() method`);
        return { address, fxrpAddress: null, contractName };
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error: ${error.message.substring(0, 60)}...`);
      continue;
    }
  }
  
  console.error(`\n   ❌ None of the registry keys worked for ${network}`);
  console.log(`   Tried: ${REGISTRY_KEYS_TO_TRY.join(", ")}`);
  return null;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Flare Contract Registry - AssetManager Lookup             ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  
  const mainnetResult = await getAssetManagerAddress("flare");
  const coston2Result = await getAssetManagerAddress("coston2");
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 Summary");
  console.log("=".repeat(60));
  
  if (mainnetResult) {
    console.log(`\nFlare Mainnet:`);
    console.log(`  Registry Key: "${mainnetResult.contractName}"`);
    console.log(`  AssetManager: ${mainnetResult.address}`);
    if (mainnetResult.fxrpAddress) {
      console.log(`  FXRP Token:   ${mainnetResult.fxrpAddress}`);
    }
  }
  
  if (coston2Result) {
    console.log(`\nCoston2 Testnet:`);
    console.log(`  Registry Key: "${coston2Result.contractName}"`);
    console.log(`  AssetManager: ${coston2Result.address}`);
    if (coston2Result.fxrpAddress) {
      console.log(`  FXRP Token:   ${coston2Result.fxrpAddress}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("💡 Next Steps:");
  console.log("   Your FAssetsClient will automatically use the correct");
  console.log("   registry key to retrieve AssetManager addresses.");
  console.log("   No environment variables needed!");
  console.log("");
}

main().catch(console.error);
