import { ethers } from "ethers";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const SHXRP_VAULT = "0x82d74B5fb005F7469e479C224E446bB89031e17F";
const FXRP_TOKEN = "0x0b6A3645c240605887a5532109323A3E12273dc7";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const VAULT_ABI = [
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function asset() view returns (address)",
  "function minDeposit() view returns (uint256)",
  "function maxDeposit(address) view returns (uint256)",
  "function totalAssets() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
];

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("DEPLOYER_PRIVATE_KEY not set");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("=== Test Vault Deposit ===");
  console.log("Wallet:", wallet.address);
  
  const fxrp = new ethers.Contract(FXRP_TOKEN, ERC20_ABI, wallet);
  const vault = new ethers.Contract(SHXRP_VAULT, VAULT_ABI, wallet);
  
  const [fxrpBalance, decimals, symbol, minDeposit, maxDeposit, totalAssets, vaultShares] = await Promise.all([
    fxrp.balanceOf(wallet.address),
    fxrp.decimals(),
    fxrp.symbol(),
    vault.minDeposit(),
    vault.maxDeposit(wallet.address),
    vault.totalAssets(),
    vault.balanceOf(wallet.address),
  ]);
  
  console.log("\n--- Current State ---");
  console.log(`FXRP Balance: ${ethers.formatUnits(fxrpBalance, decimals)} ${symbol}`);
  console.log(`Min Deposit: ${ethers.formatUnits(minDeposit, decimals)} FXRP`);
  console.log(`Max Deposit: ${ethers.formatUnits(maxDeposit, decimals)} FXRP`);
  console.log(`Vault Total Assets: ${ethers.formatUnits(totalAssets, decimals)} FXRP`);
  console.log(`Your Vault Shares: ${ethers.formatUnits(vaultShares, decimals)} shXRP`);
  
  if (fxrpBalance === 0n) {
    console.log("\n⚠️  No FXRP balance. Need to get testnet FXRP first.");
    console.log("You can bridge XRP to FXRP via the FAssets bridge on Coston2.");
    return;
  }
  
  const depositAmount = minDeposit > fxrpBalance ? fxrpBalance : minDeposit * 10n;
  
  if (depositAmount > fxrpBalance) {
    console.log(`\n⚠️  Not enough FXRP. Need at least ${ethers.formatUnits(minDeposit, decimals)} FXRP`);
    return;
  }
  
  if (depositAmount > maxDeposit) {
    console.log(`\n⚠️  Deposit exceeds max deposit limit of ${ethers.formatUnits(maxDeposit, decimals)} FXRP`);
    return;
  }
  
  console.log(`\n--- Depositing ${ethers.formatUnits(depositAmount, decimals)} FXRP ---`);
  
  const allowance = await fxrp.allowance(wallet.address, SHXRP_VAULT);
  if (allowance < depositAmount) {
    console.log("Approving vault to spend FXRP...");
    const approveTx = await fxrp.approve(SHXRP_VAULT, depositAmount);
    console.log("Approve tx:", approveTx.hash);
    await approveTx.wait();
    console.log("✅ Approved");
  }
  
  const expectedShares = await vault.previewDeposit(depositAmount);
  console.log(`Expected shares: ${ethers.formatUnits(expectedShares, decimals)} shXRP`);
  
  console.log("Executing deposit...");
  const depositTx = await vault.deposit(depositAmount, wallet.address);
  console.log("Deposit tx:", depositTx.hash);
  
  const receipt = await depositTx.wait();
  console.log("✅ Deposit successful!");
  console.log("Block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  
  const newBalance = await vault.balanceOf(wallet.address);
  console.log(`\nNew vault shares: ${ethers.formatUnits(newBalance, decimals)} shXRP`);
}

main().catch(console.error);
