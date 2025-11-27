import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  console.log("\n═══════════════════════════════════════");
  console.log("Smart Account:", smartAccount);
  console.log("═══════════════════════════════════════\n");
  
  // Get native CFLR balance
  const balance = await provider.getBalance(smartAccount);
  console.log("CFLR Balance (raw):", balance.toString());
  console.log("CFLR Balance:", ethers.formatEther(balance), "CFLR");
  
  if (balance === BigInt(0)) {
    console.log("\n⚠️  WARNING: Smart account has NO CFLR for gas fees!");
    console.log("   Solution: Send CFLR to the smart account");
    console.log("   Get testnet CFLR from: https://faucet.flare.network");
  } else if (balance < ethers.parseEther("0.1")) {
    console.log("\n⚠️  WARNING: Smart account has LOW CFLR!");
    console.log("   Consider topping up for more transactions");
  } else {
    console.log("\n✅ Smart account has sufficient CFLR for gas");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
