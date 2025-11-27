import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://coston2-api.flare.network/ext/C/rpc");
  
  // Latest approval tx from logs
  const txHash = "0x52799fd0f962789078e5bbdfd51879abc2c9ad4567b8e5c8a17928bffe294297";
  
  console.log("\n═══════════════════════════════════════");
  console.log("Analyzing Approval Transaction");
  console.log("═══════════════════════════════════════");
  console.log("TX Hash:", txHash);
  console.log("═══════════════════════════════════════\n");
  
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (!receipt) {
    console.log("❌ Transaction not found");
    return;
  }
  
  console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("\nLogs:", receipt.logs.length);
  
  // Parse Approval events
  const approvalSig = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
  
  for (const log of receipt.logs) {
    if (log.topics[0] === approvalSig) {
      const owner = "0x" + log.topics[1].slice(26);
      const spender = "0x" + log.topics[2].slice(26);
      const amount = BigInt(log.data);
      
      console.log("\n📝 Approval Event:");
      console.log("   Token:", log.address);
      console.log("   Owner:", owner);
      console.log("   Spender (Vault):", spender);
      console.log("   Amount (raw):", amount.toString());
      console.log("   Amount (FXRP, 6 decimals):", ethers.formatUnits(amount, 6));
      
      // Check if approved amount is sufficient for 20 FXRP deposit
      const depositAmount = 20000000n; // 20 FXRP with 6 decimals
      console.log("\n   Deposit amount needed:", depositAmount.toString(), "(20 FXRP)");
      console.log("   Approved >= Needed?", amount >= depositAmount ? "✅ YES" : "❌ NO");
    }
  }
  
  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
