/**
 * Recovery Script: Deposit stuck FXRP into vault to mint shXRP
 * 
 * Situation: Smart account has 225 FXRP but 0 shXRP because minting failed
 * Fix: Manually deposit FXRP into vault to mint the missing shXRP shares
 */

import { FlareClient } from '../server/utils/flare-client';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

async function recoverStuckFXRP() {
  console.log('\n🔧 FXRP Recovery Script Starting...\n');
  
  // Initialize Flare client
  const flareClient = new FlareClient('coston2');
  await flareClient.initialize();
  const smartAccountAddress = flareClient.getSignerAddress();
  
  // Get latest vault deployment
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith('coston2-') && f.endsWith('.json') && f !== 'coston2-deployment.json' && f !== 'coston2-latest.json')
    .sort()
    .reverse();
  
  const deploymentFile = path.join(deploymentsDir, files[0]);
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf-8'));
  const vaultAddress = deployment.contracts.ShXRPVault.address;
  const fxrpAddress = deployment.contracts.FXRP.address;
  
  console.log(`📊 Smart Account: ${smartAccountAddress}`);
  console.log(`🏦 Vault Address: ${vaultAddress}`);
  console.log(`💵 FXRP Address: ${fxrpAddress}\n`);
  
  // Check current balances
  const provider = flareClient.getProvider();
  const fxrpContract = new ethers.Contract(
    fxrpAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  const fxrpBalance = await fxrpContract.balanceOf(smartAccountAddress);
  const fxrpFormatted = ethers.formatUnits(fxrpBalance, 6);
  
  console.log(`Current FXRP Balance: ${fxrpFormatted} FXRP`);
  
  if (fxrpBalance === 0n) {
    console.log('\n✅ No stuck FXRP found. Nothing to recover.');
    return;
  }
  
  console.log(`\n💡 Found ${fxrpFormatted} FXRP to deposit into vault`);
  console.log(`⏳ Approving FXRP for vault...`);
  
  // Approve vault to spend FXRP
  const fxrpWithSigner = flareClient.getFXRP() as any;
  const approveTx = await fxrpWithSigner.approve(vaultAddress, fxrpBalance);
  await approveTx.wait();
  console.log(`✅ FXRP approved: ${approveTx.hash}`);
  
  // Deposit into vault
  console.log(`\n⏳ Depositing ${fxrpFormatted} FXRP into vault...`);
  const vault = flareClient.getShXRPVault(vaultAddress) as any;
  const depositTx = await vault.deposit(fxrpBalance, smartAccountAddress);
  const receipt = await depositTx.wait();
  console.log(`✅ Deposited into vault: ${receipt.hash}`);
  
  // Parse Deposit event to get minted shares
  const depositEventSignature = ethers.id("Deposit(address,address,uint256,uint256)");
  
  for (const log of receipt.logs) {
    if (log.topics[0] === depositEventSignature) {
      const iface = new ethers.Interface([
        "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
      ]);
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      
      if (parsed) {
        const sharesMinted = ethers.formatUnits(parsed.args.shares, 6);
        console.log(`\n✅ Successfully minted ${sharesMinted} shXRP!`);
        console.log(`   FXRP deposited: ${ethers.formatUnits(parsed.args.assets, 6)}`);
      }
    }
  }
  
  console.log(`\n✅ Recovery complete!`);
}

recoverStuckFXRP().catch(console.error);
