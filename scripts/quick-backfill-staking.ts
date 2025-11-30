/**
 * Quick backfill for StakingBoost events from recent blocks
 */

import { db } from "../server/db";
import { onChainEvents } from "../shared/schema";
import { sql } from "drizzle-orm";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";
const STAKING_BOOST_ADDRESS = "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4";
const MAX_BLOCKS_PER_QUERY = 29;
const RPC_DELAY_MS = 50;

const EVENT_TOPICS = {
  Staked: '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d',
  Unstaked: '0x0f5bb82176feb1b5e747e28471aa92156a04d9f3ab9f45f28e2d704232b93f75',
  RewardPaid: '0xe2403640ba68fed3a2f88b7557551d1993f84b99bb10ff833f0cf8db0c5e0486',
};

async function queryRawLogs(address: string, fromBlock: number, toBlock: number) {
  const results: any[] = [];
  let currentFrom = fromBlock;
  
  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + MAX_BLOCKS_PER_QUERY - 1, toBlock);
    
    try {
      const response = await fetch(COSTON2_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{
            fromBlock: '0x' + currentFrom.toString(16),
            toBlock: '0x' + currentTo.toString(16),
            address: address,
          }],
          id: 1,
        }),
      });
      
      const text = await response.text();
      if (!text.startsWith('<')) {
        const data = JSON.parse(text);
        if (data.result && Array.isArray(data.result)) {
          for (const log of data.result) {
            results.push({
              topics: log.topics,
              data: log.data,
              blockNumber: parseInt(log.blockNumber, 16),
              transactionHash: log.transactionHash,
              logIndex: parseInt(log.logIndex, 16),
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error querying blocks ${currentFrom}-${currentTo}`);
    }
    
    currentFrom = currentTo + 1;
    await new Promise(resolve => setTimeout(resolve, RPC_DELAY_MS));
  }
  
  return results;
}

async function main() {
  console.log("=== Quick StakingBoost Backfill ===");
  
  const response = await fetch(COSTON2_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1,
    }),
  });
  const data = await response.json();
  const currentBlock = parseInt(data.result, 16);
  
  const startBlock = 24548000;
  console.log(`Scanning blocks ${startBlock} to ${currentBlock}`);
  
  const logs = await queryRawLogs(STAKING_BOOST_ADDRESS, startBlock, currentBlock);
  console.log(`Found ${logs.length} logs`);
  
  let inserted = 0;
  for (const log of logs) {
    const topic0 = log.topics[0];
    let eventName = '';
    let args: Record<string, any> = {};
    
    if (topic0 === EVENT_TOPICS.Staked) {
      eventName = 'Staked';
      const user = '0x' + log.topics[1].slice(26);
      const amount = BigInt(log.data);
      args = { user, amount: amount.toString() };
    } else if (topic0 === EVENT_TOPICS.Unstaked) {
      eventName = 'Unstaked';
      const user = '0x' + log.topics[1].slice(26);
      const amount = BigInt(log.data);
      args = { user, amount: amount.toString() };
    } else if (topic0 === EVENT_TOPICS.RewardPaid) {
      eventName = 'RewardPaid';
      const user = '0x' + log.topics[1].slice(26);
      const reward = BigInt(log.data);
      args = { user, reward: reward.toString() };
    } else {
      continue;
    }
    
    const existing = await db.select()
      .from(onChainEvents)
      .where(sql`${onChainEvents.transactionHash} = ${log.transactionHash} AND ${onChainEvents.logIndex} = ${log.logIndex}`)
      .limit(1);
    
    if (existing.length > 0) continue;
    
    await db.insert(onChainEvents).values({
      contractName: 'StakingBoost',
      contractAddress: STAKING_BOOST_ADDRESS,
      eventName,
      severity: eventName === 'RewardPaid' ? 'warning' : 'info',
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      args,
      notified: true,
    });
    
    console.log(`  ✅ Inserted ${eventName} at block ${log.blockNumber}`);
    inserted++;
  }
  
  console.log(`\n✅ Done! Inserted ${inserted} events`);
}

main().catch(console.error);
