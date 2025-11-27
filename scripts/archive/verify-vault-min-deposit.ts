import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  const vaultAddress = process.env.VITE_SHXRP_VAULT_ADDRESS;

  const abi = ["function minDeposit() public view returns (uint256)"];
  const vault = new ethers.Contract(vaultAddress!, abi, provider);

  const minDep = await vault.minDeposit();

  console.log("\n═══════════════════════════════════════");
  console.log("Vault Address:", vaultAddress);
  console.log("═══════════════════════════════════════");
  console.log("minDeposit (raw):", minDep.toString());
  console.log("minDeposit (FXRP):", ethers.formatUnits(minDep, 6));
  console.log("\nDepositing 20 FXRP (20000000 units)");
  console.log("Minimum required:", minDep.toString(), "units");
  console.log("Comparison: 20000000 >", minDep.toString() + "?", 20000000 > Number(minDep));
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
