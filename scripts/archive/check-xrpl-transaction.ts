import { Client } from 'xrpl';

async function checkTransaction() {
  const client = new Client('wss://s.altnet.rippletest.net:51233');
  
  try {
    await client.connect();
    
    const txHash = '223E61DE5AD7005A16B863DB74EED55709C43A707E6B9729E76CDF9AD299C3D0';
    
    const response = await client.request({
      command: 'tx',
      transaction: txHash,
    });
    
    console.log('\n=== Transaction Details ===');
    console.log('Hash:', response.result.hash);
    console.log('Account:', response.result.Account);
    console.log('Destination:', response.result.Destination);
    console.log('Amount:', response.result.Amount, 'drops =', parseInt(response.result.Amount as string) / 1_000_000, 'XRP');
    
    if (response.result.Memos && response.result.Memos.length > 0) {
      console.log('\n=== MEMO Data ===');
      const memoData = response.result.Memos[0]?.Memo?.MemoData;
      if (memoData) {
        console.log('MemoData (hex):', memoData);
        console.log('MemoData (decoded):', Buffer.from(memoData, 'hex').toString('utf-8'));
      } else {
        console.log('⚠️  No MemoData found in transaction!');
      }
    } else {
      console.log('\n⚠️  No Memos found in transaction!');
    }
    
    console.log('\n=== Full Transaction ===');
    console.log(JSON.stringify(response.result, null, 2));
    
  } catch (error) {
    console.error('Error fetching transaction:', error);
  } finally {
    await client.disconnect();
  }
}

checkTransaction();
