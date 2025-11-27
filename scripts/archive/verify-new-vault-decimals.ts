import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  const vaultAddress = "0x8fe09217445e90DA692D29F30859dafA4eb281d1"; // NEW vault
  const fxrpAddress = "0x0b6A3645c240605887a5532109323A3E12273dc7";
  
  console.log("\n═══════════════════════════════════════");
  console.log("NEW Vault Decimal Verification");
  console.log("═══════════════════════════════════════");
  console.log("Vault:", vaultAddress);
  console.log("FXRP:", fxrpAddress);
  console.log("═══════════════════════════════════════\n");
  
  const vaultAbi = [
    "function decimals() view returns (uint8)",
    "function asset() view returns (address)",
    "function minDeposit() view returns (uint256)"
  ];
  const vault = new ethers.Contract(vaultAddress, vaultAbi, provider);
  
  const fxrpAbi = ["function decimals() view returns (uint8)"];
  const fxrp = new ethers.Contract(fxrpAddress, fxrpAbi, provider);
  
  const vaultDecimals = await vault.decimals();
  const vaultAsset = await vault.asset();
  const minDeposit = await vault.minDeposit();
  const fxrpDecimals = await fxrp.decimals();
  
  console.log("FXRP.decimals():", fxrpDecimals.toString());
  console.log("Vault.asset():", vaultAsset);
  console.log("Vault.decimals():", vaultDecimals.toString());
  console.log("Vault.minDeposit() (raw):", minDeposit.toString());
  console.log("Vault.minDeposit():", ethers.formatUnits(minDeposit, vaultDecimals), `(with ${vaultDecimals} decimals)`);
  
  console.log("\n═══════════════════════════════════════");
  if (vaultDecimals === fxrpDecimals) {
    console.log("✅ Decimals match! Vault and FXRP both use", vaultDecimals.toString(), "decimals");
  } else {
    console.log("❌ Decimals mismatch:");
    console.log("  - FXRP:", fxrpDecimals.toString(), "decimals");
    console.log("  - Vault:", vaultDecimals.toString(), "decimals");
  }
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
