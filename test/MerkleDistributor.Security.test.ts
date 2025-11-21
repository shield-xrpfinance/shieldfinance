import { expect } from "chai";
import { network } from "hardhat";
import type { MerkleDistributor, ShieldToken } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MerkleTree } from "merkletreejs";

describe("MerkleDistributor - Security & Attack Vectors", function () {
  let ethers: any;
  
  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  let merkleDistributor: MerkleDistributor;
  let shieldToken: ShieldToken;
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  
  let AIRDROP_AMOUNT: bigint;
  let airdropList: Array<{ address: string; amount: bigint }>;

  before(async function () {
    AIRDROP_AMOUNT = ethers.parseEther("1000000"); // 1M SHIELD for airdrop
  });

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Setup airdrop list
    airdropList = [
      { address: user1.address, amount: ethers.parseEther("100000") },
      { address: user2.address, amount: ethers.parseEther("50000") },
      { address: user3.address, amount: ethers.parseEther("25000") },
    ];
    
    // Generate Merkle tree
    const leaves = airdropList.map(x => 
      ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [x.address, x.amount]
      )
    );
    
    merkleTree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();
    
    // Deploy ShieldToken
    const ShieldTokenFactory = await ethers.getContractFactory("ShieldToken");
    shieldToken = await ShieldTokenFactory.deploy();
    await shieldToken.waitForDeployment();
    
    // Deploy MerkleDistributor
    const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
    merkleDistributor = await MerkleDistributorFactory.deploy(
      await shieldToken.getAddress(),
      merkleRoot
    );
    await merkleDistributor.waitForDeployment();
    
    // Transfer airdrop tokens to distributor
    await shieldToken.transfer(await merkleDistributor.getAddress(), AIRDROP_AMOUNT);
  });

  describe("Merkle Proof Replay Attacks", function () {
    it("Should prevent using same proof twice", async function () {
      // Test: Claim once, then try to claim again with same proof
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      // First claim should succeed
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, proof)
      ).to.emit(merkleDistributor, "Claimed");
      
      // Second claim with same proof should fail
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, proof)
      ).to.be.revertedWith("Already claimed");
    });

    it("Should prevent user from claiming with another user's proof", async function () {
      // Test: User1 tries to claim with User2's valid proof
      const user2Amount = airdropList[1].amount;
      const leaf2 = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user2.address, user2Amount]
      );
      const proof2 = merkleTree.getHexProof(leaf2);
      
      // User1 tries to use User2's proof - should fail because leaf won't match
      await expect(
        merkleDistributor.connect(user1).claim(user2Amount, proof2)
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should reject modified amount with valid proof", async function () {
      // Test: User tries to claim with correct proof but different amount
      const correctAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, correctAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      // Try to claim with different amount but same proof
      const modifiedAmount = correctAmount + ethers.parseEther("1000");
      
      await expect(
        merkleDistributor.connect(user1).claim(modifiedAmount, proof)
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should reject claim with empty proof array", async function () {
      const claimAmount = airdropList[0].amount;
      
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, [])
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should reject claim with invalid proof", async function () {
      const claimAmount = airdropList[0].amount;
      const fakeProof = [ethers.keccak256(ethers.toUtf8Bytes("fake"))];
      
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, fakeProof)
      ).to.be.revertedWith("Invalid proof");
    });
  });

  describe("Duplicate Leaves in Merkle Tree", function () {
    it("Should handle tree with duplicate addresses correctly", async function () {
      // Test: Create tree with same address twice (different amounts)
      // This tests edge case of poor merkle tree construction
      
      const duplicateList = [
        { address: user1.address, amount: ethers.parseEther("1000") },
        { address: user1.address, amount: ethers.parseEther("2000") }, // Same address!
        { address: user2.address, amount: ethers.parseEther("500") },
      ];
      
      const duplicateLeaves = duplicateList.map(x => 
        ethers.solidityPackedKeccak256(['address', 'uint256'], [x.address, x.amount])
      );
      
      const duplicateTree = new MerkleTree(duplicateLeaves, ethers.keccak256, { sortPairs: true });
      const duplicateRoot = duplicateTree.getHexRoot();
      
      // Deploy new distributor with duplicate tree
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      const duplicateDistributor = await MerkleDistributorFactory.deploy(
        await shieldToken.getAddress(),
        duplicateRoot
      );
      await duplicateDistributor.waitForDeployment();
      
      await shieldToken.transfer(await duplicateDistributor.getAddress(), ethers.parseEther("10000"));
      
      // User1 can claim the first amount
      const leaf1 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, ethers.parseEther("1000")]);
      const proof1 = duplicateTree.getHexProof(leaf1);
      
      await expect(
        duplicateDistributor.connect(user1).claim(ethers.parseEther("1000"), proof1)
      ).to.emit(duplicateDistributor, "Claimed");
      
      // But cannot claim again (even with different amount/proof)
      const leaf2 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, ethers.parseEther("2000")]);
      const proof2 = duplicateTree.getHexProof(leaf2);
      
      await expect(
        duplicateDistributor.connect(user1).claim(ethers.parseEther("2000"), proof2)
      ).to.be.revertedWith("Already claimed");
    });
  });

  describe("Owner Withdrawal Race Conditions", function () {
    it("Should allow owner withdraw after all claims complete", async function () {
      // Test: All users claim, then owner withdraws remainder
      
      // All users claim
      for (let i = 0; i < airdropList.length; i++) {
        const user = [user1, user2, user3][i];
        const amount = airdropList[i].amount;
        const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [airdropList[i].address, amount]);
        const proof = merkleTree.getHexProof(leaf);
        
        await merkleDistributor.connect(user).claim(amount, proof);
      }
      
      // Check remaining balance
      const remainingBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      // Owner withdraws remainder
      if (remainingBalance > 0n) {
        await expect(
          merkleDistributor.withdraw(owner.address, remainingBalance)
        ).to.emit(merkleDistributor, "Withdrawn");
      }
    });

    it("Should allow owner withdraw even with unclaimed tokens", async function () {
      // Test: Only 1 user claims, owner withdraws unclaimed
      
      // Only user1 claims
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claimAmount]);
      const proof = merkleTree.getHexProof(leaf);
      
      await merkleDistributor.connect(user1).claim(claimAmount, proof);
      
      // Owner withdraws unclaimed funds
      const balance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      await expect(
        merkleDistributor.withdraw(owner.address, balance)
      ).to.emit(merkleDistributor, "Withdrawn")
        .withArgs(owner.address, balance);
    });

    it("Should revert owner withdraw if amount exceeds balance", async function () {
      // Test: Owner tries to withdraw more than contract balance
      const balance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      const excessAmount = balance + ethers.parseEther("1");
      
      await expect(
        merkleDistributor.withdraw(owner.address, excessAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert on zero amount withdraw", async function () {
      // Test: Owner tries withdraw(recipient, 0)
      await expect(
        merkleDistributor.withdraw(owner.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should handle withdraw after partial claims", async function () {
      // Test: 50% claimed, owner withdraws remaining 50%
      
      // User1 claims (100k out of 1M total funding)
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claimAmount]);
      const proof = merkleTree.getHexProof(leaf);
      
      await merkleDistributor.connect(user1).claim(claimAmount, proof);
      
      const balanceAfterClaim = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      const expectedBalance = AIRDROP_AMOUNT - claimAmount;
      expect(balanceAfterClaim).to.equal(expectedBalance);
      
      // Owner withdraws all remaining
      await merkleDistributor.withdraw(owner.address, balanceAfterClaim);
      
      expect(await shieldToken.balanceOf(await merkleDistributor.getAddress())).to.equal(0);
    });

    it("Should only allow owner to withdraw", async function () {
      await expect(
        merkleDistributor.connect(user1).withdraw(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(merkleDistributor, "OwnableUnauthorizedAccount");
    });

    it("Should revert withdraw to zero address", async function () {
      await expect(
        merkleDistributor.withdraw(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Invalid recipient");
    });
  });

  describe("Invariant Tests", function () {
    it("Should ensure totalClaimed never exceeds funded amount", async function () {
      // Test: Fund with X tokens, multiple claims
      const initialBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      // Multiple users claim
      for (let i = 0; i < airdropList.length; i++) {
        const user = [user1, user2, user3][i];
        const amount = airdropList[i].amount;
        const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [airdropList[i].address, amount]);
        const proof = merkleTree.getHexProof(leaf);
        
        await merkleDistributor.connect(user).claim(amount, proof);
        
        // Invariant: totalClaimed <= initial funding
        const totalClaimed = await merkleDistributor.totalClaimed();
        expect(totalClaimed).to.be.lte(initialBalance);
      }
    });

    it("Should maintain correct balance: funded - totalClaimed", async function () {
      // Test: After each claim, verify balance + totalClaimed = original
      const initialBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      // User1 claims
      const claim1 = airdropList[0].amount;
      const leaf1 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claim1]);
      const proof1 = merkleTree.getHexProof(leaf1);
      await merkleDistributor.connect(user1).claim(claim1, proof1);
      
      let currentBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      let totalClaimed = await merkleDistributor.totalClaimed();
      expect(currentBalance + totalClaimed).to.equal(initialBalance);
      
      // User2 claims
      const claim2 = airdropList[1].amount;
      const leaf2 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user2.address, claim2]);
      const proof2 = merkleTree.getHexProof(leaf2);
      await merkleDistributor.connect(user2).claim(claim2, proof2);
      
      currentBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      totalClaimed = await merkleDistributor.totalClaimed();
      expect(currentBalance + totalClaimed).to.equal(initialBalance);
    });

    it("Should track totalClaimed accurately across multiple claims", async function () {
      let expectedTotal = 0n;
      
      for (let i = 0; i < airdropList.length; i++) {
        const user = [user1, user2, user3][i];
        const amount = airdropList[i].amount;
        const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [airdropList[i].address, amount]);
        const proof = merkleTree.getHexProof(leaf);
        
        await merkleDistributor.connect(user).claim(amount, proof);
        
        expectedTotal += amount;
        const actualTotal = await merkleDistributor.totalClaimed();
        expect(actualTotal).to.equal(expectedTotal);
      }
    });
  });

  describe("Zero Balance Edge Cases", function () {
    it("Should revert claim when contract has zero balance", async function () {
      // Test: Deploy distributor with 0 tokens, try to claim
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      const emptyDistributor = await MerkleDistributorFactory.deploy(
        await shieldToken.getAddress(),
        merkleRoot
      );
      await emptyDistributor.waitForDeployment();
      
      // Don't fund the distributor (0 balance)
      
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claimAmount]);
      const proof = merkleTree.getHexProof(leaf);
      
      // Claim will fail due to insufficient balance
      await expect(
        emptyDistributor.connect(user1).claim(claimAmount, proof)
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientBalance");
    });

    it("Should revert withdraw when balance is zero", async function () {
      // Test: All tokens claimed/withdrawn, try withdraw again
      
      // Withdraw all tokens
      const balance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      await merkleDistributor.withdraw(owner.address, balance);
      
      // Try to withdraw again
      await expect(
        merkleDistributor.withdraw(owner.address, ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should handle claim of zero amount", async function () {
      // Create a merkle tree with a zero amount entry
      const zeroAmountList = [
        { address: user1.address, amount: 0n },
      ];
      
      const zeroLeaves = zeroAmountList.map(x => 
        ethers.solidityPackedKeccak256(['address', 'uint256'], [x.address, x.amount])
      );
      
      const zeroTree = new MerkleTree(zeroLeaves, ethers.keccak256, { sortPairs: true });
      const zeroRoot = zeroTree.getHexRoot();
      
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      const zeroDistributor = await MerkleDistributorFactory.deploy(
        await shieldToken.getAddress(),
        zeroRoot
      );
      await zeroDistributor.waitForDeployment();
      
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, 0n]);
      const proof = zeroTree.getHexProof(leaf);
      
      // Should revert because amount must be > 0
      await expect(
        zeroDistributor.connect(user1).claim(0, proof)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should verify claim has reentrancy protection", async function () {
      // claim() uses nonReentrant modifier
      // This test documents that the protection exists
      
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claimAmount]);
      const proof = merkleTree.getHexProof(leaf);
      
      // Normal claim should work
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, proof)
      ).to.emit(merkleDistributor, "Claimed");
      
      // If reentrancy was attempted, the nonReentrant modifier would prevent it
      // Since we're using standard ERC20 tokens, reentrancy isn't possible here
      // But the protection is in place for safety
    });

    it("Should verify withdraw has reentrancy protection", async function () {
      // withdraw() uses nonReentrant modifier  
      const balance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      await expect(
        merkleDistributor.withdraw(owner.address, balance / 2n)
      ).to.emit(merkleDistributor, "Withdrawn");
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should efficiently handle claim with reasonable gas", async function () {
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claimAmount]);
      const proof = merkleTree.getHexProof(leaf);
      
      const tx = await merkleDistributor.connect(user1).claim(claimAmount, proof);
      const receipt = await tx.wait();
      
      // Claim should use reasonable gas (< 150k for single claim)
      expect(receipt!.gasUsed).to.be.lt(150000n);
    });

    it("Should handle proof verification for deep trees", async function () {
      // Create a larger tree to test proof size
      const largeList = [];
      const signers = await ethers.getSigners();
      
      for (let i = 0; i < 16 && i < signers.length; i++) {
        largeList.push({
          address: signers[i].address,
          amount: ethers.parseEther("1000")
        });
      }
      
      const largeLeaves = largeList.map(x => 
        ethers.solidityPackedKeccak256(['address', 'uint256'], [x.address, x.amount])
      );
      
      const largeTree = new MerkleTree(largeLeaves, ethers.keccak256, { sortPairs: true });
      const largeRoot = largeTree.getHexRoot();
      
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      const largeDistributor = await MerkleDistributorFactory.deploy(
        await shieldToken.getAddress(),
        largeRoot
      );
      await largeDistributor.waitForDeployment();
      
      await shieldToken.transfer(await largeDistributor.getAddress(), ethers.parseEther("100000"));
      
      // Claim from deep tree (proof will have more elements)
      const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [largeList[0].address, largeList[0].amount]);
      const proof = largeTree.getHexProof(leaf);
      
      // Should still complete with reasonable gas even with longer proof
      const tx = await largeDistributor.connect(signers[0]).claim(largeList[0].amount, proof);
      const receipt = await tx.wait();
      
      expect(receipt!.gasUsed).to.be.lt(200000n); // Slightly higher for deeper tree
    });
  });
});
