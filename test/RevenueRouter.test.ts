import { expect } from "chai";
import { network } from "hardhat";
import type { RevenueRouter, ShieldToken } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RevenueRouter", function () {
  let ethers: any;
  let revenueRouter: RevenueRouter;
  let shieldToken: ShieldToken;
  let mockWFLR: any;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let vault: SignerWithAddress;
  let user: SignerWithAddress;

  const BURN_PERCENTAGE = 75n; // 75% to burn
  const TREASURY_PERCENTAGE = 25n; // 25% to treasury

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, treasury, vault, user] = await ethers.getSigners();

    // Deploy mock wFLR token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWFLR = await MockERC20.deploy("Wrapped Flare", "wFLR", 18);
    await mockWFLR.waitForDeployment();

    // Deploy ShieldToken
    const ShieldTokenFactory = await ethers.getContractFactory("ShieldToken");
    shieldToken = await ShieldTokenFactory.deploy();
    await shieldToken.waitForDeployment();

    // Deploy RevenueRouter
    const RevenueRouterFactory = await ethers.getContractFactory("RevenueRouter");
    revenueRouter = await RevenueRouterFactory.deploy(
      await shieldToken.getAddress(),
      treasury.address
    );
    await revenueRouter.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set correct SHIELD token address", async function () {
      expect(await revenueRouter.shieldToken()).to.equal(await shieldToken.getAddress());
    });

    it("Should set correct treasury address", async function () {
      expect(await revenueRouter.treasury()).to.equal(treasury.address);
    });

    it("Should set deployer as owner", async function () {
      expect(await revenueRouter.owner()).to.equal(owner.address);
    });

    it("Should have correct burn and treasury percentages", async function () {
      expect(await revenueRouter.BURN_PERCENTAGE()).to.equal(BURN_PERCENTAGE);
      expect(await revenueRouter.TREASURY_PERCENTAGE()).to.equal(TREASURY_PERCENTAGE);
    });
  });

  describe("Vault Registration", function () {
    it("Should allow owner to register vault", async function () {
      await revenueRouter.registerVault(vault.address);
      expect(await revenueRouter.registeredVaults(vault.address)).to.be.true;
    });

    it("Should emit VaultRegistered event", async function () {
      await expect(revenueRouter.registerVault(vault.address))
        .to.emit(revenueRouter, "VaultRegistered")
        .withArgs(vault.address);
    });

    it("Should fail to register vault from non-owner", async function () {
      await expect(
        revenueRouter.connect(user).registerVault(vault.address)
      ).to.be.reverted;
    });

    it("Should fail to register zero address", async function () {
      await expect(
        revenueRouter.registerVault(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid vault address");
    });

    it("Should fail to register already registered vault", async function () {
      await revenueRouter.registerVault(vault.address);
      await expect(
        revenueRouter.registerVault(vault.address)
      ).to.be.revertedWith("Vault already registered");
    });
  });

  describe("Revenue Distribution", function () {
    beforeEach(async function () {
      // Register vault
      await revenueRouter.registerVault(vault.address);
      
      // Setup: Mint SHIELD to RevenueRouter for buyback simulation
      // In real scenario, wFLR would be swapped for SHIELD on DEX
      const shieldAmount = ethers.parseEther("10000");
      await shieldToken.transfer(await revenueRouter.getAddress(), shieldAmount);
    });

    it("Should distribute 75% to burn and 25% to treasury", async function () {
      const routerBalance = await shieldToken.balanceOf(await revenueRouter.getAddress());
      const expectedBurn = (routerBalance * BURN_PERCENTAGE) / 100n;
      const expectedTreasury = (routerBalance * TREASURY_PERCENTAGE) / 100n;
      
      const initialSupply = await shieldToken.totalSupply();
      const initialTreasuryBalance = await shieldToken.balanceOf(treasury.address);
      
      await revenueRouter.connect(vault).distribute();
      
      const finalSupply = await shieldToken.totalSupply();
      const finalTreasuryBalance = await shieldToken.balanceOf(treasury.address);
      
      // Verify burn (total supply decreased)
      expect(initialSupply - finalSupply).to.equal(expectedBurn);
      
      // Verify treasury received 25%
      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedTreasury);
      
      // Verify router balance is now zero
      expect(await shieldToken.balanceOf(await revenueRouter.getAddress())).to.equal(0);
    });

    it("Should emit RevenueDistributed event with correct amounts", async function () {
      const routerBalance = await shieldToken.balanceOf(await revenueRouter.getAddress());
      const expectedBurn = (routerBalance * BURN_PERCENTAGE) / 100n;
      const expectedTreasury = (routerBalance * TREASURY_PERCENTAGE) / 100n;
      
      await expect(revenueRouter.connect(vault).distribute())
        .to.emit(revenueRouter, "RevenueDistributed")
        .withArgs(expectedBurn, expectedTreasury);
    });

    it("Should only allow registered vaults to call distribute", async function () {
      await expect(
        revenueRouter.connect(user).distribute()
      ).to.be.revertedWith("Only registered vaults");
    });

    it("Should handle multiple distributions correctly", async function () {
      // First distribution
      await revenueRouter.connect(vault).distribute();
      
      // Add more SHIELD for second distribution
      const secondAmount = ethers.parseEther("5000");
      await shieldToken.transfer(await revenueRouter.getAddress(), secondAmount);
      
      const expectedBurn = (secondAmount * BURN_PERCENTAGE) / 100n;
      const expectedTreasury = (secondAmount * TREASURY_PERCENTAGE) / 100n;
      
      const supplyBefore = await shieldToken.totalSupply();
      const treasuryBefore = await shieldToken.balanceOf(treasury.address);
      
      await revenueRouter.connect(vault).distribute();
      
      expect(await shieldToken.totalSupply()).to.equal(supplyBefore - expectedBurn);
      expect(await shieldToken.balanceOf(treasury.address)).to.equal(treasuryBefore + expectedTreasury);
    });

    it("Should handle zero balance gracefully", async function () {
      // Empty router balance
      await revenueRouter.connect(vault).distribute();
      
      // Try again with zero balance
      await expect(revenueRouter.connect(vault).distribute()).to.not.be.reverted;
    });
  });

  describe("Buyback and Burn Mechanics", function () {
    it("Should correctly calculate 75/25 split for various amounts", async function () {
      const testAmounts = [
        ethers.parseEther("1000"),
        ethers.parseEther("5353.451"), // Fair launch LP amount
        ethers.parseEther("100000"),
      ];
      
      for (const amount of testAmounts) {
        await shieldToken.transfer(await revenueRouter.getAddress(), amount);
        
        const expectedBurn = (amount * BURN_PERCENTAGE) / 100n;
        const expectedTreasury = (amount * TREASURY_PERCENTAGE) / 100n;
        
        const supplyBefore = await shieldToken.totalSupply();
        const treasuryBefore = await shieldToken.balanceOf(treasury.address);
        
        await revenueRouter.registerVault(vault.address);
        await revenueRouter.connect(vault).distribute();
        
        expect(await shieldToken.totalSupply()).to.equal(supplyBefore - expectedBurn);
        expect(await shieldToken.balanceOf(treasury.address)).to.equal(treasuryBefore + expectedTreasury);
        
        // Reset for next test
        await revenueRouter.connect(owner).updateTreasury(owner.address);
        await shieldToken.connect(owner).transfer(treasury.address, expectedTreasury);
        await revenueRouter.connect(owner).updateTreasury(treasury.address);
      }
    });
  });

  describe("Treasury Management", function () {
    it("Should allow owner to update treasury address", async function () {
      const newTreasury = user.address;
      
      await revenueRouter.updateTreasury(newTreasury);
      expect(await revenueRouter.treasury()).to.equal(newTreasury);
    });

    it("Should emit TreasuryUpdated event", async function () {
      const newTreasury = user.address;
      
      await expect(revenueRouter.updateTreasury(newTreasury))
        .to.emit(revenueRouter, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury);
    });

    it("Should fail to update treasury from non-owner", async function () {
      await expect(
        revenueRouter.connect(user).updateTreasury(user.address)
      ).to.be.reverted;
    });

    it("Should fail to set zero address as treasury", async function () {
      await expect(
        revenueRouter.updateTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury address");
    });
  });

  describe("Integration with Fair Launch", function () {
    it("Should support automated weekly burns from GitHub Actions", async function () {
      // Simulate GitHub Actions calling distribute() after wFLR threshold reached
      await revenueRouter.registerVault(vault.address);
      
      // Simulate buyback (transfer SHIELD to router)
      const weeklyRevenue = ethers.parseEther("5000");
      await shieldToken.transfer(await revenueRouter.getAddress(), weeklyRevenue);
      
      const expectedBurn = (weeklyRevenue * BURN_PERCENTAGE) / 100n;
      const supplyBefore = await shieldToken.totalSupply();
      
      await revenueRouter.connect(vault).distribute();
      
      // Verify deflationary mechanism
      expect(await shieldToken.totalSupply()).to.be.lt(supplyBefore);
      expect(supplyBefore - await shieldToken.totalSupply()).to.equal(expectedBurn);
    });
  });
});
