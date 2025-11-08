import { Client } from 'xrpl';

async function checkTransaction() {
  const client = new Client('wss://xrplcluster.com');
  await client.connect();
  
  try {
    const response = await client.request({
      command: 'tx',
      transaction: '27C556FCB2360F629813F630F7C80FBC2312F40AB34FA84C763298697C1A5592',
    });
    
    console.log('\n=== Transaction Status ===');
    console.log('Hash:', response.result.hash);
    console.log('Result:', response.result.meta?.TransactionResult);
    console.log('Validated:', response.result.validated);
    console.log('Amount delivered:', response.result.meta?.delivered_amount);
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await client.disconnect();
  }
}

checkTransaction();
