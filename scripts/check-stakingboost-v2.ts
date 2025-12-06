import { ethers } from "ethers";
import { fileURLToPath } from "url";
import path from "path";

import StakingBoostArtifact from "../artifacts/contracts/StakingBoost.sol/StakingBoost.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STAKING_BOOST_V2 = "0x9dF4C13fd100a8025c663B6aa2eB600193aE5FB3";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  const stakingBoost = new ethers.Contract(STAKING_BOOST_V2, StakingBoostArtifact.abi, provider);
  
  console.log("=== StakingBoost V2 Configuration Check ===\n");
  console.log("StakingBoost V2 Address:", STAKING_BOOST_V2);
  
  const vault = await stakingBoost.vault();
  console.log("vault():", vault);
  
  const owner = await stakingBoost.owner();
  console.log("owner():", owner);
  
  const bypassEnabled = await stakingBoost.testnetLockBypass();
  console.log("testnetLockBypass:", bypassEnabled);
}

main().catch(console.error);
