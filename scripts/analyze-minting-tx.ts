import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://coston2-api.flare.network/ext/C/rpc"
  );
  
  const mintingTxHash = "0x5123f27e093519920c2379ab3ca1ca900ffe6d07a36e125687d7e6802b9017cd";
  const smartAccount = "0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd";
  const fxrpAddress = "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3";
  
  console.log("\n═══════════════════════════════════════");
  console.log("Analyzing Minting Transaction");
  console.log("═══════════════════════════════════════");
  console.log("TX Hash:", mintingTxHash);
  console.log("Smart Account:", smartAccount);
  console.log("\n");
  
  // Get transaction receipt
  const receipt = await provider.getTransactionReceipt(mintingTxHash);
  
  if (!receipt) {
    console.error("❌ Transaction not found!");
    return;
  }
  
  console.log("✅ Transaction Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Block Number:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());
  
  // ERC20 Transfer event signature
  const transferEventSignature = ethers.id("Transfer(address,address,uint256)");
  
  console.log("\n📋 Analyzing Transfer Events:");
  console.log("═══════════════════════════════════════\n");
  
  let fxrpTransferFound = false;
  
  for (const log of receipt.logs) {
    if (log.topics[0] === transferEventSignature) {
      // Decode transfer event
      const from = ethers.getAddress("0x" + log.topics[1].slice(26));
      const to = ethers.getAddress("0x" + log.topics[2].slice(26));
      const value = BigInt(log.data);
      
      console.log("Transfer Event:");
      console.log("  Token:", log.address);
      console.log("  From:", from);
      console.log("  To:", to);
      console.log("  Amount:", ethers.formatEther(value));
      
      if (log.address.toLowerCase() === fxrpAddress.toLowerCase()) {
        fxrpTransferFound = true;
        console.log("  ✅ This is FXRP token!");
        
        if (to.toLowerCase() === smartAccount.toLowerCase()) {
          console.log("  ✅ FXRP minted to smart account!");
        } else {
          console.log("  ❌ FXRP minted to DIFFERENT address!");
          console.log("  Expected:", smartAccount);
          console.log("  Actual:", to);
        }
      }
      console.log("");
    }
  }
  
  if (!fxrpTransferFound) {
    console.log("❌ No FXRP Transfer event found in this transaction!");
  }
  
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
