import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║  FAssets Collateral Reservation Diagnostic                ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  // Step 1: Get AssetManager address from registry
  console.log("Step 1: Retrieving AssetManager from Contract Registry");
  console.log("─".repeat(60));
  
  const assetManagerAddress = await nameToAddress("AssetManagerFXRP", "coston2", provider);
  console.log(`✅ Registry Key: "AssetManagerFXRP"`);
  console.log(`✅ AssetManager Address: ${assetManagerAddress}`);
  console.log(`   Expected: 0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA`);
  
  const isCorrectAddress = assetManagerAddress.toLowerCase() === "0xc1Ca88b937d0b528842F95d5731ffB586f4fbDFA".toLowerCase();
  console.log(`   ${isCorrectAddress ? '✅ CORRECT' : '❌ WRONG'} address!`);
  
  // Step 2: Load AssetManager ABI
  console.log("\nStep 2: Loading AssetManager ABI");
  console.log("─".repeat(60));
  
  const artifactPath = join(
    process.cwd(),
    "node_modules",
    "@flarenetwork",
    "flare-periphery-contract-artifacts",
    "coston2",
    "artifacts",
    "contracts",
    "IAssetManager.sol",
    "IAssetManager.json"
  );
  
  const abiJson = readFileSync(artifactPath, "utf8");
  const AssetManagerABI = JSON.parse(abiJson);
  console.log(`✅ Loaded ABI from: ${artifactPath}`);
  
  // Check for CollateralReserved event in ABI
  const hasReserveMethod = AssetManagerABI.some((item: any) => item.name === "reserveCollateral");
  const hasReservedEvent = AssetManagerABI.some((item: any) => item.name === "CollateralReserved");
  console.log(`   reserveCollateral method: ${hasReserveMethod ? '✅ Found' : '❌ Missing'}`);
  console.log(`   CollateralReserved event: ${hasReservedEvent ? '✅ Found' : '❌ Missing'}`);
  
  // Step 3: Check AssetManager contract state
  console.log("\nStep 3: Checking AssetManager Contract");
  console.log("─".repeat(60));
  
  const assetManager = new ethers.Contract(assetManagerAddress, AssetManagerABI, provider);
  
  try {
    const fxrpAddress = await assetManager.fAsset();
    console.log(`✅ FXRP Token: ${fxrpAddress}`);
    console.log(`   Expected: 0x0b6A3645c240605887a5532109323A3E12273dc7`);
    
    const lotSize = await assetManager.lotSize();
    console.log(`✅ Lot Size: ${ethers.formatUnits(lotSize, 6)} XRP`);
    
    const collateralReservationFeeBIPS = await assetManager.collateralReservationFeeBIPS();
    console.log(`✅ Reservation Fee: ${collateralReservationFeeBIPS} BIPS (${Number(collateralReservationFeeBIPS) / 100}%)`);
  } catch (error: any) {
    console.log(`❌ Failed to read contract: ${error.message}`);
    console.log("   This might indicate a wrong contract or ABI mismatch!");
  }
  
  // Step 4: Get available agents
  console.log("\nStep 4: Checking Available Agents");
  console.log("─".repeat(60));
  
  try {
    const { _agents: agents } = await assetManager.getAvailableAgentsDetailedList(0, 10);
    console.log(`✅ Found ${agents.length} available agent(s)`);
    
    if (agents.length > 0) {
      const bestAgent = agents[0];
      console.log(`\n   Best Agent:`);
      console.log(`   - Vault: ${bestAgent.agentVault}`);
      console.log(`   - Free Lots: ${bestAgent.freeCollateralLots.toString()}`);
      console.log(`   - Fee BIPS: ${bestAgent.feeBIPS.toString()}`);
      
      // Get agent info
      const agentInfo = await assetManager.getAgentInfo(bestAgent.agentVault);
      console.log(`   - Underlying Address: ${agentInfo.underlyingAddress}`);
      console.log(`   - Status: ${agentInfo.status.toString()} (0=NORMAL, 1=PAUSED)`);
    } else {
      console.log(`❌ No agents available for collateral reservation!`);
      console.log("   This will cause reserveCollateral to fail.");
    }
  } catch (error: any) {
    console.log(`❌ Failed to get agents: ${error.message}`);
  }
  
  // Step 5: Show what needs to be fixed
  console.log("\n" + "═".repeat(60));
  console.log("📋 Summary");
  console.log("═".repeat(60));
  
  if (!isCorrectAddress) {
    console.log("\n❌ PROBLEM DETECTED:");
    console.log("   The registry is returning the wrong AssetManager address!");
    console.log("   This could be due to:");
    console.log("   1. Using wrong network (mainnet vs coston2)");
    console.log("   2. Wrong registry key");
    console.log("   3. Stale contract registry cache");
  } else {
    console.log("\n✅ AssetManager address is correct");
    console.log("   The 'CollateralReserved event not found' error might be due to:");
    console.log("   1. No agents available (check Step 4 above)");
    console.log("   2. Smart account not funded (needs CFLR for gas)");
    console.log("   3. Paymaster/bundler issue (Etherspot specific)");
    console.log("   4. Wrong executor address in reserveCollateral call");
  }
  
  console.log("\n💡 Next Steps:");
  console.log("   Run: npx tsx scripts/check-smart-account-cflr.ts");
  console.log("   to verify your smart account has gas funds");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
