import { MerkleTree } from "merkletreejs";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { desc } from "drizzle-orm";
import { TIER_CONFIG, type UserTier } from "../shared/schema";

/**
 * Points-Based Merkle Tree Generator for Shield Finance Airdrop
 * 
 * Generates a merkle tree for the 2M SHIELD airdrop based on testnet points.
 * 
 * Features:
 * - Reads user points from database
 * - Applies tier multipliers (Bronze 1x, Silver 1.5x, Gold 2x, Diamond 3x)
 * - Calculates proportional SHIELD allocation
 * - Generates merkle tree for on-chain verification
 * 
 * Usage:
 * 1. Ensure DATABASE_URL is set
 * 2. Run: npx tsx scripts/generate-points-airdrop.ts
 * 3. Set MERKLE_ROOT environment variable with generated root
 * 4. Deploy/update MerkleDistributor contract
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure neon for serverless
neonConfig.webSocketConstructor = ws;

// Total SHIELD tokens for airdrop
const TOTAL_AIRDROP_SHIELD = 2_000_000; // 2M SHIELD

// Minimum points to qualify for airdrop
const MIN_POINTS_THRESHOLD = 100;

interface UserPointsRow {
  wallet_address: string;
  total_points: number;
  tier: string;
  airdrop_multiplier: string;
  is_og: boolean;
}

interface AllocationEntry {
  address: string;
  amount: string;
  points: number;
  tier: string;
  multiplier: number;
  weightedPoints: number;
  sharePercent: number;
}

async function fetchUserPointsWithSnapshot(): Promise<{ users: UserPointsRow[]; snapshotId: string }> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("📡 Connecting to database...");
  
  const pool = new Pool({ connectionString: databaseUrl });
  const snapshotId = `airdrop_${Date.now()}`;
  
  try {
    // Use a transaction with REPEATABLE READ isolation to get a consistent snapshot
    const client = await pool.connect();
    
    try {
      console.log("🔒 Starting transactional snapshot...");
      
      // Begin transaction with REPEATABLE READ to ensure consistent snapshot
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      
      // Fetch users within the transaction
      const result = await client.query<UserPointsRow>(`
        SELECT 
          wallet_address,
          total_points,
          tier,
          airdrop_multiplier,
          is_og
        FROM user_points
        WHERE total_points >= $1
        ORDER BY total_points DESC
      `, [MIN_POINTS_THRESHOLD]);

      // Record snapshot in airdrop_snapshots table for audit trail
      await client.query(`
        INSERT INTO airdrop_snapshots (
          snapshot_id, 
          snapshot_type, 
          total_users,
          total_points,
          merkle_root,
          metadata
        ) VALUES ($1, 'testnet_points', $2, $3, $4, $5)
        ON CONFLICT (snapshot_id) DO NOTHING
      `, [
        snapshotId,
        result.rows.length,
        result.rows.reduce((sum, u) => sum + u.total_points, 0),
        '', // Will be updated after merkle tree generation
        JSON.stringify({
          minPointsThreshold: MIN_POINTS_THRESHOLD,
          totalAirdrop: TOTAL_AIRDROP_SHIELD,
          snapshotTimestamp: new Date().toISOString(),
        })
      ]);

      await client.query('COMMIT');
      
      console.log(`✅ Snapshot ${snapshotId} created with ${result.rows.length} qualifying users`);
      return { users: result.rows, snapshotId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function updateSnapshotMerkleRoot(snapshotId: string, merkleRoot: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    await pool.query(`
      UPDATE airdrop_snapshots 
      SET merkle_root = $1
      WHERE snapshot_id = $2
    `, [merkleRoot, snapshotId]);
    
    console.log(`✅ Snapshot ${snapshotId} updated with merkle root`);
  } finally {
    await pool.end();
  }
}

function calculateAllocations(users: UserPointsRow[]): AllocationEntry[] {
  console.log("\n📊 Calculating allocations...");

  // Calculate weighted points for each user
  let totalWeightedPoints = 0;
  const userWeights: { user: UserPointsRow; weightedPoints: number }[] = [];

  for (const user of users) {
    const multiplier = parseFloat(user.airdrop_multiplier) || TIER_CONFIG[user.tier as UserTier]?.multiplier || 1.0;
    const weightedPoints = user.total_points * multiplier;
    
    totalWeightedPoints += weightedPoints;
    userWeights.push({ user, weightedPoints });
  }

  console.log(`   Total weighted points: ${totalWeightedPoints.toLocaleString()}`);

  // Calculate SHIELD allocation for each user
  const allocations: AllocationEntry[] = [];
  let allocatedTotal = 0n;

  for (const { user, weightedPoints } of userWeights) {
    const sharePercent = (weightedPoints / totalWeightedPoints) * 100;
    const shieldAmount = (weightedPoints / totalWeightedPoints) * TOTAL_AIRDROP_SHIELD;
    
    // Round to 6 decimal places (SHIELD has 18 decimals)
    const shieldAmountStr = shieldAmount.toFixed(6);
    
    allocations.push({
      address: user.wallet_address,
      amount: shieldAmountStr,
      points: user.total_points,
      tier: user.tier,
      multiplier: parseFloat(user.airdrop_multiplier) || 1.0,
      weightedPoints,
      sharePercent,
    });

    allocatedTotal += ethers.parseEther(shieldAmountStr);
  }

  // Adjust for rounding errors by adding remainder to top earner
  const targetTotal = ethers.parseEther(TOTAL_AIRDROP_SHIELD.toString());
  const difference = targetTotal - allocatedTotal;
  
  if (difference !== 0n && allocations.length > 0) {
    const currentAmount = ethers.parseEther(allocations[0].amount);
    const adjustedAmount = currentAmount + difference;
    allocations[0].amount = ethers.formatEther(adjustedAmount);
    console.log(`   Adjusted top allocation by ${ethers.formatEther(difference)} SHIELD for rounding`);
  }

  return allocations;
}

function generateMerkleTree(allocations: AllocationEntry[]): {
  root: string;
  tree: MerkleTree;
  proofs: Map<string, string[]>;
} {
  // Create leaves from allocation entries
  const leaves = allocations.map((entry) => {
    const checksummed = ethers.getAddress(entry.address);
    const amount = ethers.parseEther(entry.amount);
    
    // Hash: keccak256(abi.encodePacked(address, uint256))
    return ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [checksummed, amount]
    );
  });

  // Create merkle tree
  const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });

  // Generate proofs for each address
  const proofs = new Map<string, string[]>();
  for (let i = 0; i < allocations.length; i++) {
    const checksummed = ethers.getAddress(allocations[i].address);
    const proof = tree.getHexProof(leaves[i]);
    proofs.set(checksummed, proof);
  }

  return {
    root: tree.getHexRoot(),
    tree,
    proofs,
  };
}

function printTierBreakdown(allocations: AllocationEntry[]): void {
  console.log("\n📊 TIER BREAKDOWN:");
  console.log("=".repeat(50));
  
  const tierStats: Record<string, { count: number; totalShield: number; totalPoints: number }> = {
    diamond: { count: 0, totalShield: 0, totalPoints: 0 },
    gold: { count: 0, totalShield: 0, totalPoints: 0 },
    silver: { count: 0, totalShield: 0, totalPoints: 0 },
    bronze: { count: 0, totalShield: 0, totalPoints: 0 },
  };

  for (const alloc of allocations) {
    const tier = alloc.tier.toLowerCase();
    if (tierStats[tier]) {
      tierStats[tier].count++;
      tierStats[tier].totalShield += parseFloat(alloc.amount);
      tierStats[tier].totalPoints += alloc.points;
    }
  }

  for (const [tier, stats] of Object.entries(tierStats)) {
    if (stats.count > 0) {
      const emoji = tier === 'diamond' ? '💎' : tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉';
      console.log(`${emoji} ${tier.toUpperCase().padEnd(8)} | ${stats.count.toString().padStart(5)} users | ${stats.totalShield.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(12)} SHIELD | ${stats.totalPoints.toLocaleString().padStart(10)} pts`);
    }
  }
}

function printTopAllocations(allocations: AllocationEntry[], count: number = 10): void {
  console.log(`\n🏆 TOP ${count} ALLOCATIONS:`);
  console.log("=".repeat(80));
  console.log("Rank | Address                                    | SHIELD      | Points    | Tier");
  console.log("-".repeat(80));

  for (let i = 0; i < Math.min(count, allocations.length); i++) {
    const alloc = allocations[i];
    const tierEmoji = alloc.tier === 'diamond' ? '💎' : alloc.tier === 'gold' ? '🥇' : alloc.tier === 'silver' ? '🥈' : '🥉';
    console.log(
      `${(i + 1).toString().padStart(4)} | ${alloc.address} | ${parseFloat(alloc.amount).toLocaleString(undefined, { maximumFractionDigits: 2 }).padStart(11)} | ${alloc.points.toLocaleString().padStart(9)} | ${tierEmoji} ${alloc.tier}`
    );
  }
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🌳 Shield Finance Points-Based Airdrop Generator");
  console.log("=".repeat(70));
  console.log(`\n📦 Total Airdrop Pool: ${TOTAL_AIRDROP_SHIELD.toLocaleString()} SHIELD`);
  console.log(`🎯 Minimum Points Threshold: ${MIN_POINTS_THRESHOLD} points`);

  // Fetch users from database with transactional snapshot
  const { users, snapshotId } = await fetchUserPointsWithSnapshot();

  if (users.length === 0) {
    console.error("\n❌ No qualifying users found!");
    console.log(`   Minimum points required: ${MIN_POINTS_THRESHOLD}`);
    console.log("   Please ensure testnet activities have been recorded.");
    process.exit(1);
  }

  // Calculate allocations
  const allocations = calculateAllocations(users);

  // Print statistics
  printTierBreakdown(allocations);
  printTopAllocations(allocations);

  // Generate merkle tree
  console.log("\n🌳 Generating merkle tree...");
  const { root, tree, proofs } = generateMerkleTree(allocations);

  // Update snapshot with merkle root
  await updateSnapshotMerkleRoot(snapshotId, root);

  // Verify total
  const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  console.log(`\n✅ Total SHIELD allocated: ${totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ MERKLE TREE GENERATED SUCCESSFULLY");
  console.log("=".repeat(70));
  console.log(`📷 Snapshot ID: ${snapshotId}`);

  // Print merkle root
  console.log(`\n📌 MERKLE ROOT:`);
  console.log(`   ${root}`);

  // Save outputs
  const outputDir = path.join(__dirname, "../data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save merkle root
  const rootFile = path.join(outputDir, "merkle-root-points.txt");
  fs.writeFileSync(rootFile, root);
  console.log(`\n💾 Merkle root saved to: ${rootFile}`);

  // Save full allocation data
  const allocationFile = path.join(outputDir, "airdrop-allocation-points.json");
  const allocationData = {
    snapshotId,
    generatedAt: new Date().toISOString(),
    merkleRoot: root,
    totalShield: TOTAL_AIRDROP_SHIELD,
    totalParticipants: allocations.length,
    minPointsThreshold: MIN_POINTS_THRESHOLD,
    allocations: allocations.map((alloc, index) => ({
      rank: index + 1,
      address: ethers.getAddress(alloc.address),
      shieldAmount: alloc.amount,
      points: alloc.points,
      tier: alloc.tier,
      multiplier: alloc.multiplier,
      sharePercent: alloc.sharePercent.toFixed(4),
      proof: proofs.get(ethers.getAddress(alloc.address)),
    })),
  };

  fs.writeFileSync(allocationFile, JSON.stringify(allocationData, null, 2));
  console.log(`💾 Full allocation data saved to: ${allocationFile}`);

  // Save merkle tree for contract
  const treeFile = path.join(outputDir, "merkle-tree-points.json");
  const treeData = {
    snapshotId,
    root,
    totalEntries: allocations.length,
    totalAmount: TOTAL_AIRDROP_SHIELD.toString(),
    timestamp: new Date().toISOString(),
    entries: allocations.map((alloc, index) => ({
      index,
      address: ethers.getAddress(alloc.address),
      amount: alloc.amount,
      proof: Array.from(proofs.get(ethers.getAddress(alloc.address))!),
    })),
  };

  fs.writeFileSync(treeFile, JSON.stringify(treeData, null, 2));
  console.log(`💾 Merkle tree data saved to: ${treeFile}`);

  // Next steps
  console.log("\n" + "=".repeat(70));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(70));
  console.log(`\n1. Set MERKLE_ROOT environment variable:`);
  console.log(`   export MERKLE_ROOT="${root}"`);
  console.log(`\n2. Deploy/Update MerkleDistributor with new root:`);
  console.log(`   npx hardhat run scripts/fund-merkle-distributor.ts --network flare`);
  console.log(`\n3. Users can claim using their proof from:`);
  console.log(`   ${allocationFile}`);
  console.log(`\n4. API endpoint to get user's proof:`);
  console.log(`   GET /api/airdrop/proof/:walletAddress`);

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Points-based airdrop generation complete!");
  console.log("=".repeat(70) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
