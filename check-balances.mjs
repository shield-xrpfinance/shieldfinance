import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const COSTON2_RPC = 'https://coston2-api.flare.network/ext/C/rpc';
const SMART_ACCOUNT = '0x0C2b9f0a5A61173324bC08Fb9C1Ef91a791a4DDd';

async function checkBalances() {
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC);
  
  // Find the latest vault deployment
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith('coston2-') && f.endsWith('.json') && f !== 'coston2-deployment.json' && f !== 'coston2-latest.json')
    .sort()
    .reverse();
  
  if (files.length === 0) throw new Error('No deployment files found');
  
  const deploymentFile = path.join(deploymentsDir, files[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
  const vaultAddress = deployment.contracts.ShXRPVault.address;
  
  console.log(`\n📊 Checking balances for Smart Account: ${SMART_ACCOUNT}`);
  console.log(`   Vault Address: ${vaultAddress}\n`);
  
  // Check CFLR balance
  const cflrBalance = await provider.getBalance(SMART_ACCOUNT);
  console.log(`💰 CFLR Balance: ${ethers.formatEther(cflrBalance)} CFLR`);
  
  // Check shXRP balance
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ];
  const vaultContract = new ethers.Contract(vaultAddress, erc20Abi, provider);
  
  const shxrpBalance = await vaultContract.balanceOf(SMART_ACCOUNT);
  const decimals = await vaultContract.decimals();
  const totalSupply = await vaultContract.totalSupply();
  
  console.log(`🪙 shXRP Balance: ${ethers.formatUnits(shxrpBalance, decimals)} shXRP`);
  console.log(`📈 Total shXRP Supply: ${ethers.formatUnits(totalSupply, decimals)} shXRP`);
  console.log(`🔢 Decimals: ${decimals}`);
  
  // Check if vault has any special constraints
  const vaultAbi = [
    'function minDeposit() view returns (uint256)',
    'function asset() view returns (address)',
    'function paused() view returns (bool)'
  ];
  const vaultWithConstraints = new ethers.Contract(vaultAddress, vaultAbi, provider);
  
  try {
    const minDeposit = await vaultWithConstraints.minDeposit();
    console.log(`\n⚠️  Minimum Deposit: ${ethers.formatUnits(minDeposit, decimals)} FXRP`);
  } catch {
    console.log(`\n✅ No minimum deposit constraint found`);
  }
  
  try {
    const paused = await vaultWithConstraints.paused();
    console.log(`🚦 Vault Paused: ${paused}`);
  } catch {
    console.log(`✅ Vault not pausable or not paused`);
  }
  
  const assetAddress = await vaultWithConstraints.asset();
  console.log(`\n🏦 Underlying Asset (FXRP): ${assetAddress}`);
  
  // Check FXRP balance
  const fxrpContract = new ethers.Contract(assetAddress, erc20Abi, provider);
  const fxrpBalance = await fxrpContract.balanceOf(SMART_ACCOUNT);
  const fxrpDecimals = await fxrpContract.decimals();
  console.log(`💵 FXRP Balance: ${ethers.formatUnits(fxrpBalance, fxrpDecimals)} FXRP`);
  
  // Check vault's FXRP balance (liquidity)
  const vaultFxrpBalance = await fxrpContract.balanceOf(vaultAddress);
  console.log(`🏦 Vault FXRP Liquidity: ${ethers.formatUnits(vaultFxrpBalance, fxrpDecimals)} FXRP`);
  
  console.log(`\n✅ Diagnostics complete`);
}

checkBalances().catch(console.error);
