import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  const fxrpAddress = "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3"; // Coston2 FXRP
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const contract = new ethers.Contract(fxrpAddress, abi, provider);
  
  const balance = await contract.balanceOf(smartAccount);
  console.log("\n═══════════════════════════════════════");
  console.log("Smart Account:", smartAccount);
  console.log("FXRP Balance:", ethers.formatEther(balance), "FXRP");
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
