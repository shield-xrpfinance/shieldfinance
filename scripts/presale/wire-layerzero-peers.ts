/**
 * LayerZero OFT Peer Wiring Script
 * 
 * Connects all deployed OFT contracts across chains by setting their peers.
 * Must be run after deploying contracts on all 4 chains.
 * 
 * Usage:
 *   1. Deploy to all 4 testnets first
 *   2. Run: npx hardhat run scripts/presale/wire-layerzero-peers.ts --network coston2
 *   3. Run on each other network to complete wiring
 */

import hre from "hardhat";
import { ethers } from "ethers";
import { LZ_EID } from "../../shared/layerzero-config";

// After deployment, update these with actual addresses
const DEPLOYED_CONTRACTS = {
  testnets: {
    coston2: {
      shieldOFTAdapter: "", // ShieldOFTAdapter on Flare (home chain)
    },
    baseSepolia: {
      shieldOFT: "", // ShieldOFT on Base
    },
    arbitrumSepolia: {
      shieldOFT: "", // ShieldOFT on Arbitrum  
    },
    sepolia: {
      shieldOFT: "", // ShieldOFT on Ethereum
    },
  },
  mainnets: {
    flare: {
      shieldOFTAdapter: "",
    },
    base: {
      shieldOFT: "",
    },
    arbitrum: {
      shieldOFT: "",
    },
    mainnet: {
      shieldOFT: "",
    },
  },
};

interface PeerConfig {
  network: string;
  eid: number;
  address: string;
}

function addressToBytes32(address: string): string {
  return ethers.zeroPadValue(address, 32);
}

function validateDeployedAddresses(contracts: any, isTestnet: boolean): void {
  const errors: string[] = [];
  
  if (isTestnet) {
    if (!contracts.coston2?.shieldOFTAdapter) errors.push("coston2.shieldOFTAdapter");
    if (!contracts.baseSepolia?.shieldOFT) errors.push("baseSepolia.shieldOFT");
    if (!contracts.arbitrumSepolia?.shieldOFT) errors.push("arbitrumSepolia.shieldOFT");
    if (!contracts.sepolia?.shieldOFT) errors.push("sepolia.shieldOFT");
  } else {
    if (!contracts.flare?.shieldOFTAdapter) errors.push("flare.shieldOFTAdapter");
    if (!contracts.base?.shieldOFT) errors.push("base.shieldOFT");
    if (!contracts.arbitrum?.shieldOFT) errors.push("arbitrum.shieldOFT");
    if (!contracts.mainnet?.shieldOFT) errors.push("mainnet.shieldOFT");
  }

  if (errors.length > 0) {
    const allowPartial = process.argv.includes("--allow-partial");
    const message = `Missing deployed contract addresses: ${errors.join(", ")}`;
    
    if (allowPartial) {
      console.warn(`⚠️  WARNING: ${message}`);
      console.warn("   Continuing with --allow-partial flag. Peer wiring will be incomplete.\n");
    } else {
      console.error(`❌ ERROR: ${message}`);
      console.error("   Deploy contracts to all chains first, then update DEPLOYED_CONTRACTS.");
      console.error("   Or use --allow-partial flag to wire only available peers.\n");
      process.exit(1);
    }
  }
}

async function main() {
  const network = hre.network.name;
  const isTestnet = ["coston2", "baseSepolia", "arbitrumSepolia", "sepolia"].includes(network);
  
  console.log(`\n🔗 Wiring LayerZero Peers on ${network}...\n`);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const contracts = isTestnet ? DEPLOYED_CONTRACTS.testnets : DEPLOYED_CONTRACTS.mainnets;
  const eids = isTestnet ? LZ_EID.testnets : LZ_EID.mainnets;

  validateDeployedAddresses(contracts, isTestnet);

  // Get the local contract address based on network
  let localContractAddress: string;
  let localContractType: "adapter" | "oft";
  
  if (network === "coston2" || network === "flare") {
    localContractAddress = isTestnet 
      ? contracts.coston2.shieldOFTAdapter 
      : contracts.flare.shieldOFTAdapter;
    localContractType = "adapter";
  } else {
    const networkKey = network as keyof typeof contracts;
    localContractAddress = (contracts[networkKey] as any).shieldOFT;
    localContractType = "oft";
  }

  if (!localContractAddress) {
    throw new Error(`No contract address found for ${network}. Please update DEPLOYED_CONTRACTS first.`);
  }

  console.log(`Local contract: ${localContractAddress} (${localContractType})`);

  // Get contract instance
  const contractName = localContractType === "adapter" ? "ShieldOFTAdapter" : "ShieldOFT";
  const localContract = await hre.ethers.getContractAt(contractName, localContractAddress);

  // Build list of peers to set (all other chains)
  const peers: PeerConfig[] = [];
  
  if (isTestnet) {
    if (network !== "coston2") {
      peers.push({
        network: "coston2",
        eid: eids.coston2,
        address: contracts.coston2.shieldOFTAdapter,
      });
    }
    if (network !== "baseSepolia") {
      peers.push({
        network: "baseSepolia",
        eid: eids.baseSepolia,
        address: contracts.baseSepolia.shieldOFT,
      });
    }
    if (network !== "arbitrumSepolia") {
      peers.push({
        network: "arbitrumSepolia",
        eid: eids.arbitrumSepolia,
        address: contracts.arbitrumSepolia.shieldOFT,
      });
    }
    if (network !== "sepolia") {
      peers.push({
        network: "sepolia",
        eid: eids.sepolia,
        address: contracts.sepolia.shieldOFT,
      });
    }
  } else {
    // Mainnet peers
    if (network !== "flare") {
      peers.push({
        network: "flare",
        eid: eids.flare,
        address: contracts.flare.shieldOFTAdapter,
      });
    }
    if (network !== "base") {
      peers.push({
        network: "base",
        eid: eids.base,
        address: contracts.base.shieldOFT,
      });
    }
    if (network !== "arbitrum") {
      peers.push({
        network: "arbitrum",
        eid: eids.arbitrum,
        address: contracts.arbitrum.shieldOFT,
      });
    }
    if (network !== "mainnet") {
      peers.push({
        network: "mainnet",
        eid: eids.mainnet,
        address: contracts.mainnet.shieldOFT,
      });
    }
  }

  console.log(`\nSetting ${peers.length} peers...`);

  for (const peer of peers) {
    if (!peer.address) {
      console.log(`⚠️  Skipping ${peer.network}: No address configured`);
      continue;
    }

    const peerBytes32 = addressToBytes32(peer.address);
    
    try {
      // Check if already set
      const existingPeer = await localContract.peers(peer.eid);
      if (existingPeer === peerBytes32) {
        console.log(`✓ ${peer.network} (EID ${peer.eid}): Already set`);
        continue;
      }

      console.log(`Setting peer for ${peer.network} (EID ${peer.eid})...`);
      const tx = await localContract.setPeer(peer.eid, peerBytes32);
      await tx.wait();
      console.log(`✓ ${peer.network} (EID ${peer.eid}): ${peer.address}`);
    } catch (error: any) {
      console.error(`✗ ${peer.network}: ${error.message}`);
    }
  }

  console.log("\n✅ Peer wiring complete!");
  
  // Print verification commands
  console.log("\n📝 Verification Commands:");
  for (const peer of peers) {
    if (peer.address) {
      console.log(`   await contract.peers(${peer.eid}) // Should return ${addressToBytes32(peer.address)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
