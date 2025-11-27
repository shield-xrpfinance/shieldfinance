import { ethers } from 'ethers';

async function checkOperatorBalance() {
  const operatorPrivateKey = process.env.OPERATOR_PRIVATE_KEY;
  
  if (!operatorPrivateKey) {
    console.error('❌ OPERATOR_PRIVATE_KEY not set');
    process.exit(1);
  }

  // Connect to Coston2 testnet
  const provider = new ethers.JsonRpcProvider('https://coston2-api.flare.network/ext/C/rpc');
  const wallet = new ethers.Wallet(operatorPrivateKey, provider);
  
  console.log('🔍 Checking operator wallet balance...\n');
  console.log(`Operator Address: ${wallet.address}`);
  
  // Check FLR balance
  const balance = await provider.getBalance(wallet.address);
  const balanceInFLR = ethers.formatEther(balance);
  
  console.log(`FLR Balance: ${balanceInFLR} FLR`);
  console.log(`\nRequired for collateral reservation: ~3.08 FLR`);
  
  if (parseFloat(balanceInFLR) < 3.08) {
    console.log('\n❌ INSUFFICIENT BALANCE!');
    console.log('The operator wallet needs at least 3.08 FLR to pay collateral reservation fees.');
    console.log('\nTo fix this:');
    console.log('1. Get Coston2 testnet FLR from: https://faucet.flare.network/');
    console.log(`2. Send to: ${wallet.address}`);
  } else {
    console.log('\n✅ Balance is sufficient');
  }
}

checkOperatorBalance().catch(console.error);
