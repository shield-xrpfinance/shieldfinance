import { Client } from 'xrpl';

async function checkTransaction() {
  const client = new Client('wss://xrplcluster.com');
  await client.connect();
  
  try {
    const response = await client.request({
      command: 'tx',
      transaction: 'E61247EA15E60643FB19CCBFA096ADEEB444575804270DAED62AE360BEAA3EE3',
    });
    
    console.log('\n=== Transaction Status ===');
    console.log('Hash:', response.result.hash);
    console.log('Result:', response.result.meta?.TransactionResult);
    console.log('Validated:', response.result.validated);
    console.log('Amount:', response.result.Amount);
    console.log('From:', response.result.Account);
    console.log('To:', response.result.Destination);
    console.log('\n=== Full Response ===');
    console.log(JSON.stringify(response.result, null, 2));
  } catch (error: any) {
    console.error('Error checking transaction:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.disconnect();
  }
}

checkTransaction();
