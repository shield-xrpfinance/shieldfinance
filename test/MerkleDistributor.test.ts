import { expect } from "chai";
import { network } from "hardhat";
import type { MerkleDistributor, ShieldToken } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MerkleTree } from "merkletreejs";

describe("MerkleDistributor", function () {
  let ethers: any;
  let merkleDistributor: MerkleDistributor;
  let shieldToken: ShieldToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let AIRDROP_AMOUNT: bigint;
  let airdropList: Array<{ address: string; amount: bigint }>;

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
    
    AIRDROP_AMOUNT = ethers.parseEther("2000000"); // 2M SHIELD for airdrop
    
    // Airdrop allocation
    airdropList = [
      { address: "", amount: ethers.parseEther("100000") }, // user1: 100k SHIELD
      { address: "", amount: ethers.parseEther("50000") },  // user2: 50k SHIELD
      { address: "", amount: ethers.parseEther("25000") },  // user3: 25k SHIELD
    ];
  });

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Setup airdrop list with actual addresses
    airdropList[0].address = user1.address;
    airdropList[1].address = user2.address;
    airdropList[2].address = user3.address;
    
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

  describe("Deployment", function () {
    it("Should set correct SHIELD token address", async function () {
      expect(await merkleDistributor.token()).to.equal(await shieldToken.getAddress());
    });

    it("Should set correct merkle root", async function () {
      expect(await merkleDistributor.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should set deployer as owner", async function () {
      expect(await merkleDistributor.owner()).to.equal(owner.address);
    });

    it("Should have zero total claimed initially", async function () {
      expect(await merkleDistributor.totalClaimed()).to.equal(0);
    });

    it("Should fail deployment with zero address token", async function () {
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      
      await expect(
        MerkleDistributorFactory.deploy(ethers.ZeroAddress, merkleRoot)
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should fail deployment with zero merkle root", async function () {
      const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
      
      await expect(
        MerkleDistributorFactory.deploy(await shieldToken.getAddress(), ethers.ZeroHash)
      ).to.be.revertedWith("Invalid merkle root");
    });
  });

  describe("Claiming Tokens", function () {
    it("Should allow user to claim with valid proof", async function () {
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, proof)
      ).to.emit(merkleDistributor, "Claimed")
        .withArgs(user1.address, claimAmount);
      
      expect(await shieldToken.balanceOf(user1.address)).to.equal(claimAmount);
      expect(await merkleDistributor.hasClaimed(user1.address)).to.be.true;
      expect(await merkleDistributor.totalClaimed()).to.equal(claimAmount);
    });

    it("Should allow multiple users to claim", async function () {
      // User1 claims
      const claim1 = airdropList[0].amount;
      const leaf1 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claim1]);
      const proof1 = merkleTree.getHexProof(leaf1);
      await merkleDistributor.connect(user1).claim(claim1, proof1);
      
      // User2 claims
      const claim2 = airdropList[1].amount;
      const leaf2 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user2.address, claim2]);
      const proof2 = merkleTree.getHexProof(leaf2);
      await merkleDistributor.connect(user2).claim(claim2, proof2);
      
      // User3 claims
      const claim3 = airdropList[2].amount;
      const leaf3 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user3.address, claim3]);
      const proof3 = merkleTree.getHexProof(leaf3);
      await merkleDistributor.connect(user3).claim(claim3, proof3);
      
      expect(await shieldToken.balanceOf(user1.address)).to.equal(claim1);
      expect(await shieldToken.balanceOf(user2.address)).to.equal(claim2);
      expect(await shieldToken.balanceOf(user3.address)).to.equal(claim3);
      expect(await merkleDistributor.totalClaimed()).to.equal(claim1 + claim2 + claim3);
    });

    it("Should fail to claim with invalid proof", async function () {
      const claimAmount = ethers.parseEther("999999");
      const fakeLeaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const fakeProof = merkleTree.getHexProof(fakeLeaf);
      
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, fakeProof)
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should fail to claim twice (double-claim prevention)", async function () {
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      // First claim succeeds
      await merkleDistributor.connect(user1).claim(claimAmount, proof);
      
      // Second claim fails
      await expect(
        merkleDistributor.connect(user1).claim(claimAmount, proof)
      ).to.be.revertedWith("Already claimed");
    });

    it("Should fail to claim zero amount", async function () {
      const proof: string[] = [];
      
      await expect(
        merkleDistributor.connect(user1).claim(0, proof)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("Immutable Merkle Root Security", function () {
    it("Should NOT have updateMerkleRoot function (security design)", async function () {
      // Verify updateMerkleRoot does not exist
      expect((merkleDistributor as any).updateMerkleRoot).to.be.undefined;
    });

    it("Should verify merkle root cannot be changed", async function () {
      const initialRoot = await merkleDistributor.merkleRoot();
      
      // Merkle root should remain constant throughout contract lifetime
      expect(initialRoot).to.equal(merkleRoot);
      
      // No way to change it (function doesn't exist)
      const iface = merkleDistributor.interface;
      const functionNames = iface.fragments
        .filter(f => f.type === 'function')
        .map(f => f.name);
      
      expect(functionNames).to.not.include('updateMerkleRoot');
    });
  });

  describe("View Functions", function () {
    it("Should correctly report claim status", async function () {
      expect(await merkleDistributor.isClaimed(user1.address)).to.be.false;
      
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      await merkleDistributor.connect(user1).claim(claimAmount, proof);
      
      expect(await merkleDistributor.isClaimed(user1.address)).to.be.true;
    });
  });

  describe("Withdraw Unclaimed Tokens", function () {
    it("Should allow owner to withdraw unclaimed tokens", async function () {
      const contractBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      const ownerBalanceBefore = await shieldToken.balanceOf(owner.address);
      
      await expect(
        merkleDistributor.withdraw(owner.address, contractBalance)
      ).to.emit(merkleDistributor, "Withdrawn")
        .withArgs(owner.address, contractBalance);
      
      expect(await shieldToken.balanceOf(owner.address)).to.equal(
        ownerBalanceBefore + contractBalance
      );
      expect(await shieldToken.balanceOf(await merkleDistributor.getAddress())).to.equal(0);
    });

    it("Should fail to withdraw to zero address", async function () {
      const contractBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      await expect(
        merkleDistributor.withdraw(ethers.ZeroAddress, contractBalance)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should fail to withdraw zero amount", async function () {
      await expect(
        merkleDistributor.withdraw(owner.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("Should fail to withdraw from non-owner", async function () {
      const contractBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      
      await expect(
        merkleDistributor.connect(user1).withdraw(user1.address, contractBalance)
      ).to.be.revertedWithCustomError(merkleDistributor, "OwnableUnauthorizedAccount");
    });

    it("Should only withdraw remaining tokens after some claims", async function () {
      // User1 claims their allocation
      const claim1 = airdropList[0].amount;
      const leaf1 = ethers.solidityPackedKeccak256(['address', 'uint256'], [user1.address, claim1]);
      const proof1 = merkleTree.getHexProof(leaf1);
      await merkleDistributor.connect(user1).claim(claim1, proof1);
      
      const remainingBalance = AIRDROP_AMOUNT - claim1;
      const ownerBalanceBefore = await shieldToken.balanceOf(owner.address);
      
      await merkleDistributor.withdraw(owner.address, remainingBalance);
      
      expect(await shieldToken.balanceOf(owner.address)).to.equal(
        ownerBalanceBefore + remainingBalance
      );
    });
  });

  describe("Fair Launch Integration", function () {
    it("Should support 2M SHIELD airdrop for fair launch", async function () {
      const distributorBalance = await shieldToken.balanceOf(await merkleDistributor.getAddress());
      expect(distributorBalance).to.equal(AIRDROP_AMOUNT);
    });

    it("Should use standard OpenZeppelin Merkle proof verification", async function () {
      // Verify using standard keccak256(abi.encodePacked(address, amount)) pattern
      const claimAmount = airdropList[0].amount;
      const leaf = ethers.solidityPackedKeccak256(
        ['address', 'uint256'],
        [user1.address, claimAmount]
      );
      const proof = merkleTree.getHexProof(leaf);
      
      // Should succeed with correct proof
      await merkleDistributor.connect(user1).claim(claimAmount, proof);
    });
  });
});
