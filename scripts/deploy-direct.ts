import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import ShXRPVaultArtifact from "../artifacts/contracts/ShXRPVault.sol/ShXRPVault.json";
import VaultControllerArtifact from "../artifacts/contracts/VaultController.sol/VaultController.json";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const network = process.env.DEPLOY_NETWORK || "coston2";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  console.log(`\n🚀 Deploying to ${network}...\n`);

  const networks: Record<string, { rpc: string; chainId: number; explorer: string }> = {
    coston2: {
      rpc: "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      explorer: "https://coston2-explorer.flare.network",
    },
    flare: {
      rpc: "https://flare-api.flare.network/ext/C/rpc",
      chainId: 14,
      explorer: "https://flare-explorer.flare.network",
    },
  };

  const networkConfig = networks[network];
  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}`);
  }

  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deployer address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} FLR\n`);

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Please fund the account.");
  }

  const fxrpAddress = network === "flare" 
    ? "0xAf7278D382323A865734f93B687b300005B8b60E" 
    : "0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3";

  console.log(`Using FXRP token: ${fxrpAddress}\n`);

  console.log("📋 Deploying VaultController...");
  const VaultController = new ethers.ContractFactory(
    VaultControllerArtifact.abi,
    VaultControllerArtifact.bytecode,
    wallet
  );
  const vaultController = await VaultController.deploy();
  await vaultController.waitForDeployment();
  const vaultControllerAddress = await vaultController.getAddress();
  console.log(`✅ VaultController deployed: ${vaultControllerAddress}`);
  console.log(`   View: ${networkConfig.explorer}/address/${vaultControllerAddress}\n`);

  console.log("🏦 Deploying ShXRPVault...");
  const ShXRPVault = new ethers.ContractFactory(
    ShXRPVaultArtifact.abi,
    ShXRPVaultArtifact.bytecode,
    wallet
  );
  const shxrpVault = await ShXRPVault.deploy(
    fxrpAddress,
    "Shield XRP",
    "shXRP"
  );
  await shxrpVault.waitForDeployment();
  const shxrpVaultAddress = await shxrpVault.getAddress();
  console.log(`✅ ShXRPVault deployed: ${shxrpVaultAddress}`);
  console.log(`   View: ${networkConfig.explorer}/address/${shxrpVaultAddress}\n`);

  console.log("🔗 Registering vault in controller...");
  const registerTx = await vaultController.registerVault(shxrpVaultAddress);
  await registerTx.wait();
  console.log("✅ Vault registered in VaultController\n");

  const deploymentInfo = {
    network,
    chainId: networkConfig.chainId,
    timestamp: new Date().toISOString(),
    deployer: wallet.address,
    contracts: {
      VaultController: {
        address: vaultControllerAddress,
        explorerUrl: `${networkConfig.explorer}/address/${vaultControllerAddress}`,
      },
      ShXRPVault: {
        address: shxrpVaultAddress,
        explorerUrl: `${networkConfig.explorer}/address/${shxrpVaultAddress}`,
      },
      FXRP: {
        address: fxrpAddress,
        explorerUrl: `${networkConfig.explorer}/address/${fxrpAddress}`,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n📝 Deployment info saved to: ${filepath}\n`);
  console.log("═".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`\nVaultController: ${vaultControllerAddress}`);
  console.log(`ShXRPVault:      ${shxrpVaultAddress}`);
  console.log(`FXRP Token:      ${fxrpAddress}`);
  console.log("\nNext steps:");
  console.log("1. Update .env with contract addresses");
  console.log("2. Fund VaultController with FXRP for operations");
  console.log("3. Test deposit flow on testnet");
  console.log("4. Configure Firelight vault address");
  console.log("═".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
