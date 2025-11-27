import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  // Use deployer wallet (has permission)
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY!;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS!;
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  
  const vaultAbi = [
    "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
    "function minDeposit() view returns (uint256)",
    "function asset() view returns (address)",
    "function totalAssets() view returns (uint256)"
  ];
  
  const vault = new ethers.Contract(vaultAddress, vaultAbi, wallet);
  
  console.log("\n═══════════════════════════════════════");
  console.log("Testing Vault Deposit");
  console.log("═══════════════════════════════════════");
  console.log("Vault:", vaultAddress);
  console.log("Smart Account:", smartAccount);
  console.log("Deployer:", wallet.address);
  console.log("═══════════════════════════════════════\n");
  
  // Check vault state
  const minDep = await vault.minDeposit();
  const asset = await vault.asset();
  const totalAssets = await vault.totalAssets();
  
  console.log("Vault State:");
  console.log("  minDeposit:", ethers.formatUnits(minDep, 6), "FXRP");
  console.log("  asset (FXRP):", asset);
  console.log("  totalAssets:", ethers.formatUnits(totalAssets, 6), "FXRP");
  
  // Check FXRP balance and allowance
  const fxrpAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];
  const fxrp = new ethers.Contract(asset, fxrpAbi, provider);
  
  const balance = await fxrp.balanceOf(smartAccount);
  const allowance = await fxrp.allowance(smartAccount, vaultAddress);
  
  console.log("\nSmart Account FXRP:");
  console.log("  Balance:", ethers.formatUnits(balance, 6), "FXRP");
  console.log("  Allowance to vault:", ethers.formatUnits(allowance, 6), "FXRP");
  
  // Try to estimate gas for deposit (this will show the revert reason)
  const depositAmount = ethers.parseUnits("20", 6);
  console.log("\nAttempting deposit of", ethers.formatUnits(depositAmount, 6), "FXRP...");
  
  try {
    // Try to estimate gas - this will revert with the actual reason
    const gasEstimate = await vault.deposit.estimateGas(depositAmount, smartAccount);
    console.log("✅ Gas estimate succeeded:", gasEstimate.toString());
  } catch (error: any) {
    console.log("\n❌ Gas estimation failed!");
    console.log("Error:", error.message);
    if (error.data) {
      console.log("Error data:", error.data);
    }
    console.log("\nFull error:", JSON.stringify(error, null, 2));
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
