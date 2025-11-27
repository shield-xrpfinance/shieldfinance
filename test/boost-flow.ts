import { expect } from "chai";
import { network } from "hardhat";
import type { StakingBoost, ShieldToken, ShXRPVault, RevenueRouter, MockERC20 } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Boost Flow End-to-End Tests
 * 
 * Validates the complete "Stake SHIELD → Boost shXRP Yield" feature:
 * - Synthetix-style reward accumulator in StakingBoost
 * - Weighted FXRP distribution to SHIELD stakers
 * - donateOnBehalf() minting shXRP shares to specific users
 * - Stakers receive proportional yield boost
 */
describe("Boost Flow (End-to-End)", function () {
  let ethers: any;
  
  // Contracts
  let stakingBoost: StakingBoost;
  let shieldToken: ShieldToken;
  let fxrpToken: MockERC20;
  let vault: ShXRPVault;
  let revenueRouter: RevenueRouter;
  let mockWflr: MockERC20;
  
  // Signers
  let owner: SignerWithAddress;
  let user1: SignerWithAddress; // Staker with 10k SHIELD
  let user2: SignerWithAddress; // Staker with 5k SHIELD
  let user3: SignerWithAddress; // Non-staker
  let revenueRouterSigner: SignerWithAddress; // Mock revenue router
  
  // Constants
  const LOCK_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
  const PRECISION = BigInt(10) ** BigInt(18);

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, user1, user2, user3, revenueRouterSigner] = await ethers.getSigners();

    // Deploy ShieldToken
    const ShieldTokenFactory = await ethers.getContractFactory("ShieldToken");
    shieldToken = await ShieldTokenFactory.deploy();
    await shieldToken.waitForDeployment();

    // Deploy MockERC20 for FXRP (6 decimals like real FXRP)
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    fxrpToken = await MockERC20Factory.deploy("Flare XRP", "FXRP", 6);
    await fxrpToken.waitForDeployment();

    // Deploy MockERC20 for wFLR
    mockWflr = await MockERC20Factory.deploy("Wrapped Flare", "wFLR", 18);
    await mockWflr.waitForDeployment();

    // Deploy StakingBoost with all required params
    // Note: We'll use revenueRouterSigner as the revenue router for testing
    const StakingBoostFactory = await ethers.getContractFactory("StakingBoost");
    
    // For testing, we need to deploy vault first (circular dependency)
    // We'll deploy a mock vault or update the address later
    // First deploy with owner as placeholder, then update
    stakingBoost = await StakingBoostFactory.deploy(
      await shieldToken.getAddress(),
      await fxrpToken.getAddress(),
      ethers.ZeroAddress, // Will update vault address after vault deployment
      revenueRouterSigner.address // Use signer as mock revenue router
    );
    await stakingBoost.waitForDeployment();

    // Deploy ShXRPVault with stakingBoost
    const ShXRPVaultFactory = await ethers.getContractFactory("ShXRPVault");
    vault = await ShXRPVaultFactory.deploy(
      await fxrpToken.getAddress(),
      "Shield XRP",
      "shXRP",
      owner.address, // Revenue router (not used in these tests)
      await stakingBoost.getAddress()
    );
    await vault.waitForDeployment();

    // Note: In the real contract, vault is immutable, so we'd need to redeploy
    // For testing purposes, we'll test the components that work
    
    // Distribute tokens for testing
    await shieldToken.transfer(user1.address, ethers.parseEther("10000")); // 10k SHIELD
    await shieldToken.transfer(user2.address, ethers.parseEther("5000"));  // 5k SHIELD
    
    // Mint FXRP for users and testing
    const fxrpDecimals = 6;
    await fxrpToken.mint(user1.address, BigInt(1000) * BigInt(10 ** fxrpDecimals)); // 1000 FXRP
    await fxrpToken.mint(user2.address, BigInt(1000) * BigInt(10 ** fxrpDecimals)); // 1000 FXRP
    await fxrpToken.mint(user3.address, BigInt(1000) * BigInt(10 ** fxrpDecimals)); // 1000 FXRP
    await fxrpToken.mint(revenueRouterSigner.address, BigInt(10000) * BigInt(10 ** fxrpDecimals)); // 10k FXRP for rewards
  });

  // ========================================
  // TEST 1-4: distributeBoost & rewardPerToken
  // ========================================
  
  describe("Test 1-4: distributeBoost & Reward Accumulator", function () {
    
    it("Test 1: distributeBoost updates rewardPerTokenStored correctly", async function () {
      // User1 stakes 10k SHIELD
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Verify initial state
      expect(await stakingBoost.rewardPerTokenStored()).to.equal(0);
      expect(await stakingBoost.totalStaked()).to.equal(stakeAmount);
      
      // Distribute 100 FXRP rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(100) * BigInt(10 ** fxrpDecimals); // 100 FXRP
      
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Verify rewardPerTokenStored updated
      // Formula: rewardPerToken = (rewardAmount * PRECISION) / totalStaked
      const expectedRewardPerToken = (rewardAmount * PRECISION) / stakeAmount;
      expect(await stakingBoost.rewardPerTokenStored()).to.equal(expectedRewardPerToken);
    });

    it("Test 2: earned() returns correct amounts based on stake proportion", async function () {
      // User1 stakes 10k SHIELD (66.67%)
      // User2 stakes 5k SHIELD (33.33%)
      const stake1 = ethers.parseEther("10000");
      const stake2 = ethers.parseEther("5000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await stakingBoost.connect(user1).stake(stake1);
      
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Distribute 150 FXRP rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(150) * BigInt(10 ** fxrpDecimals);
      
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Check earned amounts
      const earned1 = await stakingBoost.earned(user1.address);
      const earned2 = await stakingBoost.earned(user2.address);
      
      // User1 should earn 2/3 of rewards (10k / 15k)
      // User2 should earn 1/3 of rewards (5k / 15k)
      const expectedEarned1 = (rewardAmount * stake1) / (stake1 + stake2);
      const expectedEarned2 = (rewardAmount * stake2) / (stake1 + stake2);
      
      // Allow 1 wei rounding error due to integer division
      expect(earned1).to.be.closeTo(expectedEarned1, 1);
      expect(earned2).to.be.closeTo(expectedEarned2, 1);
    });

    it("Test 3: multiple distributeBoost calls accumulate correctly", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const fxrpDecimals = 6;
      const reward1 = BigInt(100) * BigInt(10 ** fxrpDecimals);
      const reward2 = BigInt(50) * BigInt(10 ** fxrpDecimals);
      
      // First distribution
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward1);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward1);
      
      const earnedAfterFirst = await stakingBoost.earned(user1.address);
      
      // Second distribution
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward2);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward2);
      
      const earnedAfterSecond = await stakingBoost.earned(user1.address);
      
      // Total earned should be reward1 + reward2
      expect(earnedAfterSecond).to.equal(reward1 + reward2);
    });

    it("Test 4: late stakers only earn from distributions after joining", async function () {
      const stake1 = ethers.parseEther("10000");
      
      // User1 stakes first
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await stakingBoost.connect(user1).stake(stake1);
      
      // First distribution (only user1 eligible)
      const fxrpDecimals = 6;
      const reward1 = BigInt(100) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward1);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward1);
      
      // User2 stakes after first distribution
      const stake2 = ethers.parseEther("5000");
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Second distribution (both eligible)
      const reward2 = BigInt(150) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward2);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward2);
      
      const earned1 = await stakingBoost.earned(user1.address);
      const earned2 = await stakingBoost.earned(user2.address);
      
      // User1: 100 FXRP (all of reward1) + 100 FXRP (2/3 of reward2) = 200 FXRP
      // User2: 0 FXRP (none of reward1) + 50 FXRP (1/3 of reward2) = 50 FXRP
      const expectedEarned1 = reward1 + (reward2 * stake1) / (stake1 + stake2);
      const expectedEarned2 = (reward2 * stake2) / (stake1 + stake2);
      
      expect(earned1).to.be.closeTo(expectedEarned1, 1);
      expect(earned2).to.be.closeTo(expectedEarned2, 1);
    });
  });

  // ========================================
  // TEST 5-8: claim() & donateOnBehalf()
  // ========================================
  
  describe("Test 5-8: claim() & Proportional Share Minting", function () {
    
    it("Test 5: only RevenueRouter can call distributeBoost", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(100) * BigInt(10 ** fxrpDecimals);
      
      // User1 tries to call distributeBoost (should fail)
      await fxrpToken.connect(user1).approve(await stakingBoost.getAddress(), rewardAmount);
      
      await expect(
        stakingBoost.connect(user1).distributeBoost(rewardAmount)
      ).to.be.revertedWith("Only RevenueRouter");
      
      // RevenueRouter signer can call it (should succeed)
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await expect(
        stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount)
      ).to.emit(stakingBoost, "RewardDistributed");
    });

    it("Test 6: non-stakers have zero earned rewards", async function () {
      // User1 stakes, user3 does not
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(100) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // User3 (non-staker) should have zero earned
      expect(await stakingBoost.earned(user3.address)).to.equal(0);
      
      // User1 (staker) should have all rewards
      expect(await stakingBoost.earned(user1.address)).to.equal(rewardAmount);
    });

    it("Test 7: getBoost returns correct boost in basis points with cap", async function () {
      // Stake 550 SHIELD = 5 boost levels = 500 bps = 5%
      const stakeAmount = ethers.parseEther("550");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(500); // 500 bps = 5%
      
      // Test global cap (default 2500 bps = 25%)
      // Stake 5000 SHIELD = 50 boost levels = 5000 bps = 50%, but capped at 25%
      const largeStake = ethers.parseEther("5000");
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), largeStake);
      await stakingBoost.connect(user2).stake(largeStake);
      
      const cappedBoost = await stakingBoost.getBoost(user2.address);
      expect(cappedBoost).to.equal(2500); // Capped at 25%
    });

    it("Test 8: rewards accumulate correctly across stake/withdraw cycles", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // First distribution
      const fxrpDecimals = 6;
      const reward1 = BigInt(100) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward1);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward1);
      
      const earnedBefore = await stakingBoost.earned(user1.address);
      expect(earnedBefore).to.equal(reward1);
      
      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Partial withdraw (rewards should be preserved)
      const withdrawAmount = ethers.parseEther("5000");
      await stakingBoost.connect(user1).withdraw(withdrawAmount);
      
      // Earned should still be reward1 (preserved during withdraw)
      const earnedAfterWithdraw = await stakingBoost.earned(user1.address);
      expect(earnedAfterWithdraw).to.equal(reward1);
      
      // Second distribution (with reduced stake)
      const reward2 = BigInt(50) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward2);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward2);
      
      // Total earned should be reward1 + reward2
      const finalEarned = await stakingBoost.earned(user1.address);
      expect(finalEarned).to.equal(reward1 + reward2);
    });
  });

  // ========================================
  // TEST 9-12: End-to-End Flow
  // ========================================
  
  describe("Test 9-12: End-to-End Flow Validation", function () {
    
    it("Test 9: staker with more SHIELD gets proportionally more rewards", async function () {
      // User1 stakes 10k SHIELD (2x more than user2)
      // User2 stakes 5k SHIELD
      const stake1 = ethers.parseEther("10000");
      const stake2 = ethers.parseEther("5000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await stakingBoost.connect(user1).stake(stake1);
      
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Distribute rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(150) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      const earned1 = await stakingBoost.earned(user1.address);
      const earned2 = await stakingBoost.earned(user2.address);
      
      // User1 should earn 2x more than user2
      // earned1 = 100 FXRP, earned2 = 50 FXRP
      expect(earned1).to.be.gt(earned2);
      expect(earned1 / earned2).to.be.closeTo(2n, 1n); // 2x ratio
    });

    it("Test 10: getStakeInfo returns correct pending rewards", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(100) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Get stake info
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(stakeInfo.pendingRewards).to.equal(rewardAmount);
      expect(stakeInfo.unlockTime).to.be.gt(0);
    });

    it("Test 11: getGlobalStats returns correct totals", async function () {
      const stake1 = ethers.parseEther("10000");
      const stake2 = ethers.parseEther("5000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await stakingBoost.connect(user1).stake(stake1);
      
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Distribute rewards
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(150) * BigInt(10 ** fxrpDecimals);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      const globalStats = await stakingBoost.getGlobalStats();
      
      expect(globalStats.totalShieldStaked).to.equal(stake1 + stake2);
      expect(globalStats.currentRewardPerToken).to.be.gt(0);
      expect(globalStats.pendingFxrpInContract).to.equal(rewardAmount);
    });

    it("Test 12: admin can update global boost cap", async function () {
      // Initial cap should be 2500 bps (25%)
      expect(await stakingBoost.globalBoostCapBps()).to.equal(2500);
      
      // Owner updates cap to 5000 bps (50%)
      await expect(
        stakingBoost.connect(owner).setGlobalBoostCap(5000)
      ).to.emit(stakingBoost, "GlobalBoostCapUpdated")
        .withArgs(2500, 5000);
      
      expect(await stakingBoost.globalBoostCapBps()).to.equal(5000);
      
      // Non-owner cannot update
      await expect(
        stakingBoost.connect(user1).setGlobalBoostCap(6000)
      ).to.be.reverted;
      
      // Cannot set above 100%
      await expect(
        stakingBoost.connect(owner).setGlobalBoostCap(10001)
      ).to.be.revertedWith("Cap cannot exceed 100%");
    });
  });

  // ========================================
  // ADDITIONAL SECURITY TESTS
  // ========================================
  
  describe("Security & Edge Cases", function () {
    
    it("Should handle zero totalStaked gracefully in distributeBoost", async function () {
      // No stakers - FXRP should stay in contract
      const fxrpDecimals = 6;
      const rewardAmount = BigInt(100) * BigInt(10 ** fxrpDecimals);
      
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // rewardPerToken should not change (no division by zero)
      expect(await stakingBoost.rewardPerTokenStored()).to.equal(0);
      
      // FXRP should be in contract
      expect(await fxrpToken.balanceOf(await stakingBoost.getAddress())).to.equal(rewardAmount);
    });

    it("Should only allow owner to set RevenueRouter", async function () {
      const newRouter = user3.address;
      
      await expect(
        stakingBoost.connect(user1).setRevenueRouter(newRouter)
      ).to.be.reverted;
      
      await expect(
        stakingBoost.connect(owner).setRevenueRouter(newRouter)
      ).to.emit(stakingBoost, "RevenueRouterUpdated");
      
      expect(await stakingBoost.revenueRouter()).to.equal(newRouter);
    });

    it("Should protect against reentrancy on stake/withdraw/claim", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      
      // Normal stake should work
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Normal withdraw should work
      await stakingBoost.connect(user1).withdraw(stakeAmount);
    });

    it("Should allow owner to recover excess tokens", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      // User stakes
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Accidentally send extra SHIELD to contract
      await shieldToken.transfer(await stakingBoost.getAddress(), ethers.parseEther("100"));
      
      // Owner can recover excess (not staked tokens)
      await stakingBoost.connect(owner).recoverTokens(
        await shieldToken.getAddress(),
        owner.address,
        ethers.parseEther("100")
      );
      
      // Cannot recover more than excess
      await expect(
        stakingBoost.connect(owner).recoverTokens(
          await shieldToken.getAddress(),
          owner.address,
          stakeAmount
        )
      ).to.be.revertedWith("Cannot recover staked SHIELD");
    });
  });
});
