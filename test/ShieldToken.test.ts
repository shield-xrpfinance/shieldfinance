import { expect } from "chai";
import { network } from "hardhat";
import { ShieldToken } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShieldToken", function () {
  let shieldToken: ShieldToken;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let ethers: any;

  const EXPECTED_TOTAL_SUPPLY = 10000000n * 10n**18n; // 10M SHIELD

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    const ShieldTokenFactory = await ethers.getContractFactory("ShieldToken");
    shieldToken = await ShieldTokenFactory.deploy();
    await shieldToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should mint exactly 10,000,000 SHIELD tokens", async function () {
      const totalSupply = await shieldToken.totalSupply();
      expect(totalSupply).to.equal(EXPECTED_TOTAL_SUPPLY);
    });

    it("Should have correct total supply constant", async function () {
      const TOTAL_SUPPLY = await shieldToken.TOTAL_SUPPLY();
      expect(TOTAL_SUPPLY).to.equal(EXPECTED_TOTAL_SUPPLY);
    });

    it("Should mint all tokens to deployer", async function () {
      const deployerBalance = await shieldToken.balanceOf(owner.address);
      expect(deployerBalance).to.equal(EXPECTED_TOTAL_SUPPLY);
    });

    it("Should have 18 decimals", async function () {
      const decimals = await shieldToken.decimals();
      expect(decimals).to.equal(18);
    });

    it("Should have correct name and symbol", async function () {
      expect(await shieldToken.name()).to.equal("ShieldToken");
      expect(await shieldToken.symbol()).to.equal("SHIELD");
    });

    it("Should set deployer as owner", async function () {
      expect(await shieldToken.owner()).to.equal(owner.address);
    });
  });

  describe("Token Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("1000");
      
      await shieldToken.transfer(user1.address, transferAmount);
      expect(await shieldToken.balanceOf(user1.address)).to.equal(transferAmount);
      
      const ownerBalance = await shieldToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(EXPECTED_TOTAL_SUPPLY - transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await shieldToken.balanceOf(owner.address);
      
      await expect(
        shieldToken.connect(user1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientBalance");
      
      expect(await shieldToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("50");
      
      await shieldToken.transfer(user1.address, amount1);
      await shieldToken.transfer(user2.address, amount2);
      
      expect(await shieldToken.balanceOf(user1.address)).to.equal(amount1);
      expect(await shieldToken.balanceOf(user2.address)).to.equal(amount2);
      
      const ownerBalance = await shieldToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(EXPECTED_TOTAL_SUPPLY - amount1 - amount2);
    });
  });

  describe("Burning", function () {
    it("Should allow token holders to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialSupply = await shieldToken.totalSupply();
      
      await shieldToken.burn(burnAmount);
      
      expect(await shieldToken.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await shieldToken.balanceOf(owner.address)).to.equal(
        EXPECTED_TOTAL_SUPPLY - burnAmount
      );
    });

    it("Should reduce total supply when tokens are burned", async function () {
      const burnAmount1 = ethers.parseEther("500");
      const burnAmount2 = ethers.parseEther("300");
      
      await shieldToken.burn(burnAmount1);
      const supplyAfterFirst = await shieldToken.totalSupply();
      expect(supplyAfterFirst).to.equal(EXPECTED_TOTAL_SUPPLY - burnAmount1);
      
      await shieldToken.burn(burnAmount2);
      const supplyAfterSecond = await shieldToken.totalSupply();
      expect(supplyAfterSecond).to.equal(EXPECTED_TOTAL_SUPPLY - burnAmount1 - burnAmount2);
    });

    it("Should allow burning from allowance", async function () {
      const approveAmount = ethers.parseEther("1000");
      const burnAmount = ethers.parseEther("500");
      
      await shieldToken.transfer(user1.address, approveAmount);
      await shieldToken.connect(user1).approve(owner.address, approveAmount);
      
      const initialSupply = await shieldToken.totalSupply();
      await shieldToken.burnFrom(user1.address, burnAmount);
      
      expect(await shieldToken.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await shieldToken.balanceOf(user1.address)).to.equal(approveAmount - burnAmount);
    });

    it("Should fail to burn more than balance", async function () {
      const userBalance = ethers.parseEther("100");
      await shieldToken.transfer(user1.address, userBalance);
      
      await expect(
        shieldToken.connect(user1).burn(userBalance + 1n)
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientBalance");
    });
  });

  describe("Approval and Allowance", function () {
    it("Should approve tokens for delegated transfer", async function () {
      const approveAmount = ethers.parseEther("1000");
      
      await shieldToken.approve(user1.address, approveAmount);
      expect(await shieldToken.allowance(owner.address, user1.address)).to.equal(approveAmount);
    });

    it("Should allow transferFrom with proper allowance", async function () {
      const approveAmount = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("200");
      
      await shieldToken.approve(user1.address, approveAmount);
      await shieldToken.connect(user1).transferFrom(owner.address, user2.address, transferAmount);
      
      expect(await shieldToken.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await shieldToken.allowance(owner.address, user1.address)).to.equal(
        approveAmount - transferAmount
      );
    });

    it("Should fail transferFrom without allowance", async function () {
      await expect(
        shieldToken.connect(user1).transferFrom(owner.address, user2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientAllowance");
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await shieldToken.transferOwnership(user1.address);
      expect(await shieldToken.owner()).to.equal(user1.address);
    });

    it("Should fail to transfer ownership from non-owner", async function () {
      await expect(
        shieldToken.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWithCustomError(shieldToken, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to renounce ownership", async function () {
      await shieldToken.renounceOwnership();
      expect(await shieldToken.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Fair Launch Compliance", function () {
    it("Should have no taxes or restrictions on transfers", async function () {
      const transferAmount = ethers.parseEther("1000");
      
      // Transfer to user1
      await shieldToken.transfer(user1.address, transferAmount);
      expect(await shieldToken.balanceOf(user1.address)).to.equal(transferAmount);
      
      // User1 transfers to user2 (no tax deduction)
      await shieldToken.connect(user1).transfer(user2.address, transferAmount);
      expect(await shieldToken.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await shieldToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should be a pure ERC20 token (no additional restrictions)", async function () {
      // Verify token follows standard ERC20 behavior
      const amount = ethers.parseEther("5000");
      
      await shieldToken.transfer(user1.address, amount);
      await shieldToken.connect(user1).approve(user2.address, amount);
      await shieldToken.connect(user2).transferFrom(user1.address, treasury.address, amount);
      
      expect(await shieldToken.balanceOf(treasury.address)).to.equal(amount);
    });
  });
});
