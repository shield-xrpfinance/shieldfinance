import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  console.log("\n═══════════════════════════════════════");
  console.log("Checking NEW Vault Configuration");
  console.log("═══════════════════════════════════════");
  console.log("Vault Address:", vaultAddress);
  console.log("Smart Account:", smartAccount);
  console.log("═══════════════════════════════════════\n");
  
  const vaultAbi = [
    "function minDeposit() view returns (uint256)",
    "function asset() view returns (address)",
    "function totalAssets() view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(vaultAddress!, vaultAbi, provider);
  
  // Check vault configuration
  const minDep = await vault.minDeposit();
  const asset = await vault.asset();
  const totalAssets = await vault.totalAssets();
  
  console.log("Vault Configuration:");
  console.log("  minDeposit (raw):", minDep.toString());
  console.log("  minDeposit (FXRP):", ethers.formatUnits(minDep, 6));
  console.log("  asset (FXRP Token):", asset);
  console.log("  totalAssets:", ethers.formatUnits(totalAssets, 6), "FXRP");
  
  // Check FXRP balance and allowance
  const fxrpAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  const fxrp = new ethers.Contract(asset, fxrpAbi, provider);
  
  const balance = await fxrp.balanceOf(smartAccount);
  const allowance = await fxrp.allowance(smartAccount, vaultAddress!);
  const decimals = await fxrp.decimals();
  
  console.log("\nSmart Account FXRP:");
  console.log("  Token:", asset);
  console.log("  Decimals:", decimals.toString());
  console.log("  Balance (raw):", balance.toString());
  console.log("  Balance (FXRP):", ethers.formatUnits(balance, decimals));
  console.log("  Allowance to vault (raw):", allowance.toString());
  console.log("  Allowance (FXRP):", ethers.formatUnits(allowance, decimals));
  
  // Check if everything is ready for deposit
  const depositAmount = 20000000n; // 20 FXRP with 6 decimals
  console.log("\n═══════════════════════════════════════");
  console.log("Deposit Readiness Check (20 FXRP):");
  console.log("═══════════════════════════════════════");
  console.log("✓ Correct FXRP token?", asset.toLowerCase() === "0x0b6a3645c240605887a5532109323a3e12273dc7" ? "✅ YES" : "❌ NO");
  console.log("✓ Sufficient balance?", balance >= depositAmount ? `✅ YES (${ethers.formatUnits(balance, decimals)} FXRP)` : `❌ NO (only ${ethers.formatUnits(balance, decimals)} FXRP)`);
  console.log("✓ Sufficient allowance?", allowance >= depositAmount ? `✅ YES (${ethers.formatUnits(allowance, decimals)} FXRP)` : `❌ NO (only ${ethers.formatUnits(allowance, decimals)} FXRP)`);
  console.log("✓ Above minDeposit?", depositAmount >= minDep ? "✅ YES" : "❌ NO");
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
