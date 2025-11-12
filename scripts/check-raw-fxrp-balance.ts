import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  // Get AssetManager and FXRP address
  const assetManagerAddress = await nameToAddress(
    "AssetManagerFXRP",
    "coston2",
    provider
  );
  
  const assetManagerAbi = ["function fAsset() external view returns (address)"];
  const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, provider);
  const fxrpAddress = await assetManager.fAsset();
  
  console.log("\n═══════════════════════════════════════");
  console.log("Smart Account:", smartAccount);
  console.log("FXRP Token:", fxrpAddress);
  console.log("═══════════════════════════════════════\n");
  
  // Get balance
  const abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  const fxrp = new ethers.Contract(fxrpAddress, abi, provider);
  
  const rawBalance = await fxrp.balanceOf(smartAccount);
  const decimals = await fxrp.decimals();
  
  console.log("Raw Balance:", rawBalance.toString());
  console.log("Decimals:", decimals.toString());
  console.log("");
  console.log("✅ Correct formatting (using 6 decimals):", ethers.formatUnits(rawBalance, decimals), "FXRP");
  console.log("❌ Wrong formatting (using 18 decimals):", ethers.formatEther(rawBalance), "FXRP");
  console.log("");
  
  // Calculate expected amount for 20 XRP
  console.log("═══════════════════════════════════════");
  console.log("COMPARISON:");
  console.log("═══════════════════════════════════════");
  const expected20XRP = ethers.parseUnits("20", 6); // 20 FXRP with 6 decimals
  console.log("Expected for 20 XRP:", expected20XRP.toString(), "raw units");
  console.log("Actual balance:      ", rawBalance.toString(), "raw units");
  console.log("Match:", rawBalance.toString() === expected20XRP.toString() ? "✅ YES!" : "❌ NO");
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
