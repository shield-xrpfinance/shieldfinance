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
  console.log("Finding Correct FXRP Token Address");
  console.log("═══════════════════════════════════════\n");
  console.log("AssetManager:", assetManagerAddress);
  
  // Query the fAsset (FXRP) token address from AssetManager
  const abi = [
    "function fAsset() external view returns (address)"
  ];
  
  const contract = new ethers.Contract(assetManagerAddress, abi, provider);
  const fxrpTokenAddress = await contract.fAsset();
  
  console.log("✅ FXRP Token Address from AssetManager:", fxrpTokenAddress);
  console.log("");
  console.log("🔍 Comparison:");
  console.log("  We've been using:", "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3");
  console.log("  Actual FXRP token:", fxrpTokenAddress);
  console.log("  Match:", fxrpTokenAddress.toLowerCase() === "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3".toLowerCase() ? "✅ YES" : "❌ NO - WRONG ADDRESS!");
  console.log("");
  
  // Check smart account balance of the CORRECT FXRP token
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
  const fxrpContract = new ethers.Contract(fxrpTokenAddress, erc20Abi, provider);
  const balance = await fxrpContract.balanceOf(smartAccount);
  
  console.log("Smart Account FXRP Balance (correct token):");
  console.log("  ", ethers.formatUnits(balance, 6), "FXRP");
  
  if (Number(ethers.formatUnits(balance, 6)) > 0) {
    console.log("  ✅ FOUND THE FXRP TOKENS!");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
