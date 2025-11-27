import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  // Get AssetManager address from registry
  const assetManagerAddress = await nameToAddress(
    "AssetManagerFXRP",
    "coston2",
    provider
  );
  
  console.log("\n═══════════════════════════════════════");
  console.log("AssetManager:", assetManagerAddress);
  console.log("═══════════════════════════════════════\n");
  
  // Create contract instance
  const abi = [
    "function getCollateralReservationData(uint256 _collateralReservationId) external view returns (tuple(address minter, address agentVault, uint64 valueUBA, uint64 feeUBA, uint64 firstUnderlyingBlock, uint64 lastUnderlyingBlock, uint64 lastUnderlyingTimestamp, address payable executor, address payable executorFeeRecipient, bytes32 paymentReference, bytes20 paymentAddress))",
  ];
  
  const contract = new ethers.Contract(assetManagerAddress, abi, provider);
  
  const reservationId = 533991;
  
  try {
    const data = await contract.getCollateralReservationData(reservationId);
    console.log("✅ Reservation Data Found:");
    console.log("  Minter:", data[0]);
    console.log("  Agent Vault:", data[1]);
    console.log("  Value UBA:", data[2].toString());
    console.log("  Fee UBA:", data[3].toString());
    console.log("  Executor:", data[8]);
    console.log("  Payment Reference:", data[10]);
    console.log("");
    
    console.log("🔍 Analysis:");
    console.log("  Expected Smart Account: 0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd");
    console.log("  Actual Minter:", data[0]);
    console.log("  Match:", data[0].toLowerCase() === "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd".toLowerCase() ? "✅ YES" : "❌ NO");
    
  } catch (error: any) {
    console.error("❌ Error fetching reservation data:");
    console.error("  ", error.message);
    console.log("\n💡 This might mean the reservation was already used or expired.");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
