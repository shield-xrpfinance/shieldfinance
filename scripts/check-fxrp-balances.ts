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
  
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const contract = new ethers.Contract(fxrpAddress, abi, provider);
  
  const addresses = [
    { name: "Smart Account", addr: "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd" },
    { name: "EntryPoint (ERC-4337)", addr: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" },
    { name: "Deployer EOA", addr: "0xb19Eb9DB58173c003BB1b60A7a1658E7ABf234ad" },
    { name: "Agent Address from TX", addr: "0x6B7FAbF2313373F78Ca5948CDa28dF255f1d6b24" },
  ];
  
  console.log("\n═══════════════════════════════════════");
  console.log("FXRP Balance Check");
  console.log("FXRP Token Address:", fxrpAddress);
  console.log("═══════════════════════════════════════\n");
  
  for (const { name, addr } of addresses) {
    const balance = await contract.balanceOf(addr);
    const formatted = ethers.formatUnits(balance, 6);
    console.log(`${name}:`);
    console.log(`  Address: ${addr}`);
    console.log(`  Balance: ${formatted} FXRP`);
    if (Number(formatted) > 0) {
      console.log(`  ✅ HAS FXRP!`);
    }
    console.log("");
  }
  
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
