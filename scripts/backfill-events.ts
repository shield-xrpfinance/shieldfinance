/**
 * Backfill historical events from contract deployment to current block
 * Populates the on_chain_events table with all historical activity
 */

import { ethers } from "ethers";
import { db } from "../server/db";
import { onChainEvents } from "../shared/schema";
import { sql } from "drizzle-orm";

const COSTON2_RPC = "https://coston2-api.flare.network/ext/C/rpc";

const CONTRACTS = {
  ShXRPVault: process.env.VITE_SHXRP_VAULT_ADDRESS || "0x82d74B5fb005F7469e479C224E446bB89031e17F",
  RevenueRouter: process.env.VITE_REVENUE_ROUTER_ADDRESS || "0x8e5C9933c08451a6a31635a3Ea1221c010DF158e",
  StakingBoost: process.env.VITE_STAKING_BOOST_ADDRESS || "0xC7C50b1871D33B2E761AD5eDa2241bb7C86252B4",
  ShieldToken: process.env.VITE_SHIELD_TOKEN_ADDRESS || "0x061Cf4B8fa61bAc17AeB6990002daB1A7C438616",
};

const DEPLOYMENT_BLOCK = 24500000;
const MAX_BLOCKS_PER_QUERY = 29;
const RPC_DELAY_MS = 50;
const FXRP_DECIMALS = 6;
const SHIELD_DECIMALS = 18;

const EVENT_TOPICS = {
  Staked: '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d',
  Unstaked: '0x0f5bb82176feb1b5e747e28471aa92156a04d9f3ab9f45f28e2d704232b93f75',
  RewardPaid: '0xe2403640ba68fed3a2f88b7557551d1993f84b99bb10ff833f0cf8db0c5e0486',
  Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  Deposit: '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7',
  Withdraw: '0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db',
  FeeTransferred: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
};

interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

async function queryRawLogs(
  address: string,
  fromBlock: number,
  toBlock: number
): Promise<RawLog[]> {
  const results: RawLog[] = [];
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
              address: log.address,
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
      console.error(`Error querying blocks ${currentFrom}-${currentTo}:`, error);
    }
    
    currentFrom = currentTo + 1;
    await new Promise(resolve => setTimeout(resolve, RPC_DELAY_MS));
  }
  
  return results;
}

function parseEventFromLog(log: RawLog, contractName: string): {
  eventName: string;
  severity: 'info' | 'warning' | 'critical';
  args: Record<string, any>;
} | null {
  const topic0 = log.topics[0];
  
  if (topic0 === EVENT_TOPICS.Deposit && contractName === 'ShXRPVault') {
    const sender = '0x' + log.topics[1].slice(26);
    const owner = '0x' + log.topics[2].slice(26);
    const assets = BigInt('0x' + log.data.slice(2, 66));
    const shares = BigInt('0x' + log.data.slice(66, 130));
    return {
      eventName: 'Deposit',
      severity: 'info',
      args: { sender, owner, assets: assets.toString(), shares: shares.toString() },
    };
  }
  
  if (topic0 === EVENT_TOPICS.Withdraw && contractName === 'ShXRPVault') {
    const sender = '0x' + log.topics[1].slice(26);
    const receiver = '0x' + log.topics[2].slice(26);
    const owner = '0x' + log.topics[3].slice(26);
    const assets = BigInt('0x' + log.data.slice(2, 66));
    const shares = BigInt('0x' + log.data.slice(66, 130));
    return {
      eventName: 'Withdraw',
      severity: 'info',
      args: { sender, receiver, owner, assets: assets.toString(), shares: shares.toString() },
    };
  }
  
  if (topic0 === EVENT_TOPICS.Staked && contractName === 'StakingBoost') {
    const user = '0x' + log.topics[1].slice(26);
    const amount = BigInt(log.data);
    return {
      eventName: 'Staked',
      severity: 'info',
      args: { user, amount: amount.toString() },
    };
  }
  
  if (topic0 === EVENT_TOPICS.Unstaked && contractName === 'StakingBoost') {
    const user = '0x' + log.topics[1].slice(26);
    const amount = BigInt(log.data);
    return {
      eventName: 'Unstaked',
      severity: 'info',
      args: { user, amount: amount.toString() },
    };
  }
  
  if (topic0 === EVENT_TOPICS.RewardPaid && contractName === 'StakingBoost') {
    const user = '0x' + log.topics[1].slice(26);
    const reward = BigInt(log.data);
    return {
      eventName: 'RewardPaid',
      severity: 'warning',
      args: { user, reward: reward.toString() },
    };
  }
  
  return null;
}

async function backfillContract(contractName: string, address: string, fromBlock: number, toBlock: number) {
  console.log(`\n📊 Backfilling ${contractName} (${address})`);
  console.log(`   Blocks: ${fromBlock} to ${toBlock} (~${toBlock - fromBlock} blocks)`);
  
  const logs = await queryRawLogs(address, fromBlock, toBlock);
  console.log(`   Found ${logs.length} raw logs`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const log of logs) {
    const parsed = parseEventFromLog(log, contractName);
    if (!parsed) {
      skipped++;
      continue;
    }
    
    try {
      const existing = await db.select()
        .from(onChainEvents)
        .where(sql`${onChainEvents.transactionHash} = ${log.transactionHash} AND ${onChainEvents.logIndex} = ${log.logIndex}`)
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      await db.insert(onChainEvents).values({
        contractName,
        contractAddress: address,
        eventName: parsed.eventName,
        severity: parsed.severity,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        args: parsed.args,
        notified: true,
      });
      
      inserted++;
    } catch (error) {
      console.error(`   Error inserting event:`, error);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} events, skipped ${skipped}`);
}

async function main() {
  console.log("=== Event Backfill Script ===");
  console.log(`Starting from deployment block: ${DEPLOYMENT_BLOCK}`);
  
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC);
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  
  for (const [contractName, address] of Object.entries(CONTRACTS)) {
    if (contractName === 'ShieldToken') continue;
    await backfillContract(contractName, address, DEPLOYMENT_BLOCK, currentBlock);
  }
  
  const totalEvents = await db.select({ count: sql<number>`count(*)::int` })
    .from(onChainEvents);
  
  console.log(`\n✅ Backfill complete!`);
  console.log(`   Total events in database: ${totalEvents[0]?.count || 0}`);
}

main().catch(console.error);
