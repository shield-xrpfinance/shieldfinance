import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("=".repeat(60));
  console.log("🪙 DEPLOYING MOCK USDC FOR PRESALE TESTING");
  console.log("=".repeat(60) + "\n");

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }

  const COSTON2_RPC = process.env.FLARE_COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC, { chainId: 114, name: "coston2" });
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  console.log("Deployer:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "FLR\n");

  // Load contract artifact
  const artifactPath = path.join(__dirname, "../artifacts/contracts/mocks/MockERC20.sol/MockERC20.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  console.log("📦 Deploying MockERC20...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const mockUSDC = await factory.deploy("Mock USDC", "USDC", 6);
  await mockUSDC.waitForDeployment();
  
  const address = await mockUSDC.getAddress();
  console.log("");
  console.log("=".repeat(60));
  console.log("✅ MockERC20 deployed to:", address);
  console.log("=".repeat(60));
  console.log("");
  console.log("Update the following files with this address:");
  console.log("- shared/layerzero-config.ts: PAYMENT_TOKENS.testnets.coston2");
  console.log("- client/src/pages/Presale.tsx: PAYMENT_TOKENS[114]");
  console.log("- deployments/coston2/presale.json: paymentToken");
}

main().catch(console.error);
