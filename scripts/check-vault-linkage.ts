import { ethers } from "ethers";
import { fileURLToPath } from "url";
import path from "path";

import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAULT_ADDRESS = process.env.VITE_SHXRP_VAULT_ADDRESS || "0x1CE23bAEC4bb9709F827082d24a83d8Bc8865249";
const EXPECTED_STAKING_BOOST = process.env.VITE_STAKING_BOOST_ADDRESS || "0x9dF4C13fd100a8025c663B6aa2eB600193aE5FB3";

async function main() {
  console.log("=== ShXRPVault Linkage Check (Coston2) ===\n");
  
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  const vault = new ethers.Contract(VAULT_ADDRESS, ShXRPVaultArtifact.abi, provider);
  
  console.log("Vault Address:", VAULT_ADDRESS);
  console.log("Expected StakingBoost:", EXPECTED_STAKING_BOOST);
  
  const currentBoost = await vault.stakingBoost();
  console.log("Current stakingBoost():", currentBoost);
  
  const owner = await vault.owner();
  console.log("Vault Owner:", owner);
  
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  
  if (currentBoost === zeroAddr) {
    console.log("\n❌ StakingBoost NOT linked - needs setStakingBoost() call");
    console.log("\nTo fix, run: npx tsx scripts/link-staking-boost.ts");
  } else if (currentBoost.toLowerCase() === EXPECTED_STAKING_BOOST.toLowerCase()) {
    console.log("\n✅ StakingBoost correctly linked!");
  } else {
    console.log("\n⚠️ StakingBoost linked to DIFFERENT address:", currentBoost);
    console.log("   Expected:", EXPECTED_STAKING_BOOST);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
