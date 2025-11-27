import { ethers } from "ethers";

async function verify() {
  const vaultAddress = "0x1CE23bAEC4bb9709F827082d24a83d8Bc8865249";
  const expectedFXRP = "0x0b6A3645c240605887a5532109323A3E12273dc7";
  
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  const vaultAbi = ["function asset() external view returns (address)"];
  const vault = new ethers.Contract(vaultAddress, vaultAbi, provider);
  
  console.log("🔍 Verifying vault deployment...\n");
  console.log(`Vault Address: ${vaultAddress}`);
  console.log(`Expected FXRP: ${expectedFXRP}\n`);
  
  const actualFXRP = await vault.asset();
  console.log(`Actual FXRP from vault.asset(): ${actualFXRP}\n`);
  
  if (actualFXRP.toLowerCase() === expectedFXRP.toLowerCase()) {
    console.log("✅ SUCCESS: Vault is using the correct FXRP token address!");
    console.log("✅ Deployment verification complete!");
  } else {
    console.log("❌ ERROR: FXRP address mismatch!");
    console.log(`   Expected: ${expectedFXRP}`);
    console.log(`   Actual:   ${actualFXRP}`);
    process.exit(1);
  }
}

verify().catch(console.error);
