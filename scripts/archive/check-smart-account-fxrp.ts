import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  // Dynamically fetch FXRP address from AssetManager
  const assetManagerAddress = await nameToAddress(
    "AssetManagerFXRP",
    "coston2",
    provider
  );
  
  const assetManagerAbi = ["function fAsset() external view returns (address)"];
  const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, provider);
  const fxrpAddress = await assetManager.fAsset();
  
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const contract = new ethers.Contract(fxrpAddress, abi, provider);
  
  const balance = await contract.balanceOf(smartAccount);
  console.log("\n═══════════════════════════════════════");
  console.log("Smart Account:", smartAccount);
  console.log("FXRP Token Address:", fxrpAddress);
  console.log("FXRP Balance:", ethers.formatUnits(balance, 6), "FXRP");
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
