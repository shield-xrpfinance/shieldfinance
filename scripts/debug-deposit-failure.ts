import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  console.log("\n═══════════════════════════════════════");
  console.log("DEBUG: Vault Deposit Failure");
  console.log("═══════════════════════════════════════");
  console.log("Vault:", vaultAddress);
  console.log("Smart Account:", smartAccount);
  console.log("═══════════════════════════════════════\n");
  
  // Get FXRP address
  const assetManagerAddress = await nameToAddress("AssetManagerFXRP", "coston2", provider);
  const assetManagerAbi = ["function fAsset() view returns (address)"];
  const assetManager = new ethers.Contract(assetManagerAddress, assetManagerAbi, provider);
  const fxrpAddress = await assetManager.fAsset();
  
  console.log("Step 1: FXRP Token Verification");
  console.log("  Expected FXRP:", fxrpAddress);
  
  // Check vault configuration
  const vaultAbi = [
    "function asset() view returns (address)",
    "function minDeposit() view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function totalAssets() view returns (uint256)"
  ];
  const vault = new ethers.Contract(vaultAddress!, vaultAbi, provider);
  
  const vaultAsset = await vault.asset();
  const minDeposit = await vault.minDeposit();
  const vaultDecimals = await vault.decimals();
  const totalAssets = await vault.totalAssets();
  
  console.log("  Vault asset():", vaultAsset);
  console.log("  Match?", vaultAsset.toLowerCase() === fxrpAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  
  console.log("\nStep 2: Vault Configuration");
  console.log("  minDeposit (raw):", minDeposit.toString());
  console.log("  minDeposit (with 6 decimals):", ethers.formatUnits(minDeposit, 6), "FXRP");
  console.log("  vault decimals():", vaultDecimals.toString());
  console.log("  totalAssets:", ethers.formatUnits(totalAssets, 6), "FXRP");
  
  // Check FXRP token configuration
  const fxrpAbi = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address, address) view returns (uint256)"
  ];
  const fxrp = new ethers.Contract(fxrpAddress, fxrpAbi, provider);
  
  const fxrpDecimals = await fxrp.decimals();
  const balance = await fxrp.balanceOf(smartAccount);
  const allowance = await fxrp.allowance(smartAccount, vaultAddress!);
  
  console.log("\nStep 3: FXRP Token Configuration");
  console.log("  decimals():", fxrpDecimals.toString());
  console.log("  Smart Account balance (raw):", balance.toString());
  console.log("  Smart Account balance:", ethers.formatUnits(balance, fxrpDecimals), "FXRP");
  console.log("  Allowance to vault (raw):", allowance.toString());
  console.log("  Allowance:", ethers.formatUnits(allowance, fxrpDecimals), "FXRP");
  
  // Try to simulate a deposit
  const depositAmount = ethers.parseUnits("20", 6);
  console.log("\nStep 4: Deposit Simulation (20 FXRP)");
  console.log("  Deposit amount (raw):", depositAmount.toString());
  console.log("  Deposit amount:", ethers.formatUnits(depositAmount, 6), "FXRP");
  
  console.log("\n  Checks:");
  console.log("  ✓ Correct FXRP?", vaultAsset.toLowerCase() === fxrpAddress.toLowerCase() ? "✅" : "❌");
  console.log("  ✓ Sufficient balance?", balance >= depositAmount ? `✅ (${ethers.formatUnits(balance, 6)} FXRP)` : "❌");
  console.log("  ✓ Sufficient allowance?", allowance >= depositAmount ? `✅ (${ethers.formatUnits(allowance, 6)} FXRP)` : "❌");
  console.log("  ✓ Above minDeposit?", depositAmount >= minDeposit ? "✅" : `❌ (need ${ethers.formatUnits(minDeposit, 6)} FXRP)`);
  
  // Check if decimals match
  console.log("\nStep 5: Decimal Mismatch Check");
  console.log("  FXRP.decimals():", fxrpDecimals.toString());
  console.log("  Vault.decimals():", vaultDecimals.toString());
  console.log("  Match?", fxrpDecimals === vaultDecimals ? "✅ YES" : "❌ NO - THIS IS THE PROBLEM!");
  
  if (fxrpDecimals !== vaultDecimals) {
    console.log("\n⚠️  DECIMAL MISMATCH DETECTED:");
    console.log(`  - FXRP token has ${fxrpDecimals} decimals`);
    console.log(`  - Vault expects ${vaultDecimals} decimals`);
    console.log("  - This causes conversion errors in ERC4626 math");
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
