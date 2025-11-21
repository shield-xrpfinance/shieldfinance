import { MerkleTree } from "merkletreejs";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Merkle Tree Generation for Shield Finance Airdrop
 * 
 * Generates a merkle tree for the 2M SHIELD airdrop distribution.
 * 
 * Usage:
 * 1. Create or update data/airdrop-allocation.json with allocation list
 * 2. Run: npx ts-node scripts/generate-merkle-tree.ts
 * 3. Set MERKLE_ROOT environment variable with generated root
 * 4. Deploy contracts with MERKLE_ROOT
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AllocationEntry {
  address: string;
  amount: string; // Amount in SHIELD tokens (as string to preserve precision)
}

function validateAllocation(allocations: AllocationEntry[]): void {
  const seen = new Set<string>();
  let total = 0n;

  for (const entry of allocations) {
    // Validate address format
    if (!ethers.isAddress(entry.address)) {
      throw new Error(`Invalid address: ${entry.address}`);
    }

    // Prevent duplicates
    const checksummed = ethers.getAddress(entry.address);
    if (seen.has(checksummed)) {
      throw new Error(`Duplicate address: ${checksummed}`);
    }
    seen.add(checksummed);

    // Validate amount
    try {
      const amount = ethers.parseEther(entry.amount);
      if (amount <= 0n) {
        throw new Error(`Invalid amount for ${entry.address}: ${entry.amount}`);
      }
      total += amount;
    } catch (e) {
      throw new Error(`Failed to parse amount for ${entry.address}: ${entry.amount}`);
    }
  }

  // Verify total = 2M SHIELD
  const twoMillion = ethers.parseEther("2000000");
  if (total !== twoMillion) {
    throw new Error(
      `Total allocation mismatch! Expected 2,000,000 SHIELD, got ${ethers.formatEther(total)} SHIELD`
    );
  }
}

function generateMerkleTree(allocations: AllocationEntry[]): {
  root: string;
  tree: MerkleTree;
  leaves: string[];
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
    leaves: leaves.map((leaf) => leaf.toString()),
    proofs,
  };
}

async function main() {
  console.log("🌳 Shield Finance Merkle Tree Generator");
  console.log("=".repeat(60));

  // Read allocation file
  const allocationPath = path.join(__dirname, "../data/airdrop-allocation.json");

  if (!fs.existsSync(allocationPath)) {
    console.error(`\n❌ Error: Allocation file not found at ${allocationPath}`);
    console.log("\n📝 Create the file with the following format:");
    console.log(`
[
  { "address": "0x1234...abcd", "amount": "100" },
  { "address": "0x5678...efgh", "amount": "200" },
  ...
]

Total allocation must equal exactly 2,000,000 SHIELD.
    `);
    process.exit(1);
  }

  const allocationContent = fs.readFileSync(allocationPath, "utf-8");
  let allocations: AllocationEntry[];

  try {
    allocations = JSON.parse(allocationContent);
  } catch (e) {
    console.error(`\n❌ Error parsing allocation file: ${e}`);
    process.exit(1);
  }

  if (!Array.isArray(allocations)) {
    console.error("❌ Error: Allocation file must contain an array of entries");
    process.exit(1);
  }

  console.log(`\n📋 Loaded ${allocations.length} allocation entries`);

  // Validate allocations
  try {
    validateAllocation(allocations);
    console.log("✅ Allocations validated successfully");
  } catch (e) {
    console.error(`\n❌ Validation error: ${e}`);
    process.exit(1);
  }

  // Generate merkle tree
  console.log("\n🌳 Generating merkle tree...");
  const { root, tree, proofs } = generateMerkleTree(allocations);

  console.log("\n" + "=".repeat(60));
  console.log("✅ MERKLE TREE GENERATED SUCCESSFULLY");
  console.log("=".repeat(60));

  // Print merkle root
  console.log(`\n📌 MERKLE ROOT:`);
  console.log(`   ${root}`);

  // Verify root
  const verifyLeaf = ethers.solidityPackedKeccak256(
    ["address", "uint256"],
    [
      ethers.getAddress(allocations[0].address),
      ethers.parseEther(allocations[0].amount),
    ]
  );
  const verifyProof = proofs.get(ethers.getAddress(allocations[0].address))!;
  const verifiedRoot = tree.getHexRoot();

  console.log(`\n✅ Root verified with first entry`);

  // Save outputs
  const outputDir = path.join(__dirname, "../data");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save merkle root
  const rootFile = path.join(outputDir, "merkle-root.txt");
  fs.writeFileSync(rootFile, root);
  console.log(`\n💾 Merkle root saved to: ${rootFile}`);

  // Save merkle tree data
  const treeDataFile = path.join(outputDir, "merkle-tree.json");
  const treeData = {
    root,
    totalEntries: allocations.length,
    totalAmount: "2000000", // 2M SHIELD
    timestamp: new Date().toISOString(),
    entries: allocations.map((entry, index) => ({
      index,
      address: ethers.getAddress(entry.address),
      amount: entry.amount,
      proof: Array.from(proofs.get(ethers.getAddress(entry.address))!),
    })),
  };

  fs.writeFileSync(treeDataFile, JSON.stringify(treeData, null, 2));
  console.log(`💾 Merkle tree data saved to: ${treeDataFile}`);

  // Next steps
  console.log("\n" + "=".repeat(60));
  console.log("📝 NEXT STEPS:");
  console.log("=".repeat(60));
  console.log(`\n1. Set MERKLE_ROOT environment variable:`);
  console.log(`   export MERKLE_ROOT="${root}"`);
  console.log(`\n2. Deploy contracts with merkle root:`);
  console.log(
    `   DEPLOYER_PRIVATE_KEY=<key> MERKLE_ROOT="${root}" \\`
  );
  console.log(`   npx hardhat run scripts/deploy-shield-finance.ts --network flare`);
  console.log(`\n3. Users can generate proofs with:`);
  console.log(`   const allocation = require('./data/merkle-tree.json');`);
  console.log(`   const userEntry = allocation.entries.find(e => e.address === userAddress);`);
  console.log(`   const proof = userEntry.proof;`);
  console.log(`\n4. Users claim airdrop on-chain:`);
  console.log(`   merkleDistributor.claim(amount, proof);`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Merkle tree generation complete!");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
