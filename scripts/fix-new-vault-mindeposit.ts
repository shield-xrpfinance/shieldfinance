import { ethers } from "ethers";

const VAULT_ABI = [
  "function minDeposit() view returns (uint256)",
  "function setMinDeposit(uint256 newMinDeposit)",
  "function decimals() view returns (uint8)"
] as const;

async function main() {
  const vaultAddress = "0x8fe09217445e90DA692D29F30859dafA4eb281d1"; // NEW vault
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }

  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  const wallet = new ethers.Wallet(privateKey, provider);
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, wallet);

  console.log("\n═══════════════════════════════════════");
  console.log("Fixing NEW Vault MinDeposit");
  console.log("═══════════════════════════════════════");
  console.log("Vault:", vaultAddress);
  console.log("═══════════════════════════════════════\n");

  // Check current values
  const currentMinDeposit = await vault.minDeposit();
  const vaultDecimals = await vault.decimals();
  
  console.log("Current minDeposit (raw):", currentMinDeposit.toString());
  console.log("Current minDeposit:", ethers.formatUnits(currentMinDeposit, vaultDecimals), "FXRP");
  console.log("Vault decimals:", vaultDecimals.toString());
  
  // Set correct minDeposit: 10000 (0.01 FXRP with 6 decimals)
  const correctMinDeposit = 10000;
  console.log("\nSetting minDeposit to:", correctMinDeposit, "(0.01 FXRP with 6 decimals)");
  
  const tx = await vault.setMinDeposit(correctMinDeposit);
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");
  
  // Verify
  const newMinDeposit = await vault.minDeposit();
  console.log("\nNew minDeposit (raw):", newMinDeposit.toString());
  console.log("New minDeposit:", ethers.formatUnits(newMinDeposit, vaultDecimals), "FXRP");
  
  if (newMinDeposit.toString() === "10000") {
    console.log("\n✅ SUCCESS! MinDeposit now correct");
  } else {
    console.log("\n❌ FAILED! MinDeposit still wrong");
  }
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
