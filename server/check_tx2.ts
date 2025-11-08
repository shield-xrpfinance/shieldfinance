import { Client } from 'xrpl';

async function checkTransaction() {
  const client = new Client('wss://xrplcluster.com');
  await client.connect();
  
  try {
    const response = await client.request({
      command: 'tx',
      transaction: 'FC23DE7CCCA96528BF8021D83FC034C46E8827C0C638ED0353E80E0CEB87EFBC',
    });
    
    console.log('\n=== Transaction Status ===');
    console.log('Hash:', response.result.hash);
    console.log('Result:', response.result.meta?.TransactionResult);
    console.log('Validated:', response.result.validated);
    console.log('\nFull Result:', JSON.stringify(response.result, null, 2));
  } catch (error: any) {
    console.error('Error checking transaction:', error.message);
    console.error('Error data:', error.data);
  } finally {
    await client.disconnect();
  }
}

checkTransaction();
