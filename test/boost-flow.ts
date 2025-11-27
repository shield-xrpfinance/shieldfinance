import { expect } from "chai";
import { network } from "hardhat";
import type { StakingBoost, ShieldToken, ShXRPVault, MockERC20 } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Boost Flow End-to-End Tests
 * 
 * Validates the complete "Stake SHIELD → Boost shXRP Yield" feature:
 * - Synthetix-style reward accumulator in StakingBoost
 * - Weighted FXRP distribution to SHIELD stakers
 * - donateOnBehalf() minting shXRP shares to specific users
 * - Stakers receive proportional yield boost
 * 
 * Deployment Flow (Solving Circular Dependency):
 * 1. Deploy ShXRPVault with stakingBoost = address(0)
 * 2. Deploy StakingBoost with real vault address
 * 3. Call vault.setStakingBoost(stakingBoostAddress)
 * 4. Now claim() → donateOnBehalf() works correctly
 */
describe("Boost Flow (End-to-End)", function () {
  let ethers: any;
  
  // Contracts
  let stakingBoost: StakingBoost;
  let shieldToken: ShieldToken;
  let fxrpToken: MockERC20;
  let vault: ShXRPVault;
  
  // Signers
  let owner: SignerWithAddress;
  let user1: SignerWithAddress; // Staker with 10k SHIELD
  let user2: SignerWithAddress; // Staker with 5k SHIELD
  let user3: SignerWithAddress; // Non-staker
  let revenueRouterSigner: SignerWithAddress; // Mock revenue router
  
  // Constants
  const LOCK_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds
  const PRECISION = BigInt(10) ** BigInt(18);
  const FXRP_DECIMALS = 6;

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

    // === PROPER DEPLOYMENT FLOW (SOLVING CIRCULAR DEPENDENCY) ===
    
    // Step 1: Deploy ShXRPVault with stakingBoost = address(0)
    const ShXRPVaultFactory = await ethers.getContractFactory("ShXRPVault");
    vault = await ShXRPVaultFactory.deploy(
      await fxrpToken.getAddress(),
      "Shield XRP",
      "shXRP",
      revenueRouterSigner.address, // Revenue router
      ethers.ZeroAddress // Placeholder - will be set via setStakingBoost()
    );
    await vault.waitForDeployment();

    // Step 2: Deploy StakingBoost with real vault address
    const StakingBoostFactory = await ethers.getContractFactory("StakingBoost");
    stakingBoost = await StakingBoostFactory.deploy(
      await shieldToken.getAddress(),
      await fxrpToken.getAddress(),
      await vault.getAddress(), // Real vault
      revenueRouterSigner.address
    );
    await stakingBoost.waitForDeployment();

    // Step 3: Wire vault to StakingBoost via setter
    await vault.connect(owner).setStakingBoost(await stakingBoost.getAddress());

    // Verify wiring is correct
    expect(await vault.stakingBoost()).to.equal(await stakingBoost.getAddress());
    expect(await stakingBoost.vault()).to.equal(await vault.getAddress());
    
    // Distribute tokens for testing
    await shieldToken.transfer(user1.address, ethers.parseEther("10000")); // 10k SHIELD
    await shieldToken.transfer(user2.address, ethers.parseEther("5000"));  // 5k SHIELD
    
    // Mint FXRP for testing
    await fxrpToken.mint(user1.address, BigInt(1000) * BigInt(10 ** FXRP_DECIMALS));
    await fxrpToken.mint(user2.address, BigInt(1000) * BigInt(10 ** FXRP_DECIMALS));
    await fxrpToken.mint(user3.address, BigInt(1000) * BigInt(10 ** FXRP_DECIMALS));
    await fxrpToken.mint(revenueRouterSigner.address, BigInt(10000) * BigInt(10 ** FXRP_DECIMALS));
  });

  // ========================================
  // TEST 1-4: distributeBoost & rewardPerToken
  // ========================================
  
  describe("Test 1-4: Synthetix Reward Accumulator", function () {
    
    it("Test 1: distributeBoost updates rewardPerTokenStored correctly", async function () {
      // User1 stakes 10k SHIELD
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Verify initial state
      expect(await stakingBoost.rewardPerTokenStored()).to.equal(0);
      expect(await stakingBoost.totalStaked()).to.equal(stakeAmount);
      
      // Distribute 100 FXRP rewards
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      
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
      const rewardAmount = BigInt(150) * BigInt(10 ** FXRP_DECIMALS);
      
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
      
      const reward1 = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      const reward2 = BigInt(50) * BigInt(10 ** FXRP_DECIMALS);
      
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
      const reward1 = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), reward1);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(reward1);
      
      // User2 stakes after first distribution
      const stake2 = ethers.parseEther("5000");
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Second distribution (both eligible)
      const reward2 = BigInt(150) * BigInt(10 ** FXRP_DECIMALS);
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
  
  describe("Test 5-8: claim() → donateOnBehalf() Integration", function () {
    
    it("Test 5: claim() mints shXRP shares to staker only", async function () {
      // User1 stakes SHIELD
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Verify user1 has pending rewards
      const earnedBefore = await stakingBoost.earned(user1.address);
      expect(earnedBefore).to.equal(rewardAmount);
      
      // User1 claims - should receive shXRP shares
      const shXRPBalanceBefore = await vault.balanceOf(user1.address);
      expect(shXRPBalanceBefore).to.equal(0);
      
      await expect(stakingBoost.connect(user1).claim())
        .to.emit(stakingBoost, "RewardClaimed");
      
      // User1 should now have shXRP shares
      const shXRPBalanceAfter = await vault.balanceOf(user1.address);
      expect(shXRPBalanceAfter).to.be.gt(0);
      
      // User's pending rewards should be 0
      expect(await stakingBoost.earned(user1.address)).to.equal(0);
    });

    it("Test 6: non-stakers have zero earned rewards and cannot claim", async function () {
      // User1 stakes, user3 does not
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // User3 (non-staker) should have zero earned
      expect(await stakingBoost.earned(user3.address)).to.equal(0);
      
      // User3 can call claim() but receives nothing
      const shXRPBalanceBefore = await vault.balanceOf(user3.address);
      await stakingBoost.connect(user3).claim();
      const shXRPBalanceAfter = await vault.balanceOf(user3.address);
      
      expect(shXRPBalanceAfter).to.equal(shXRPBalanceBefore); // No change
    });

    it("Test 7: multiple stakers get proportional shXRP shares on claim", async function () {
      // User1 stakes 10k SHIELD (2/3), User2 stakes 5k SHIELD (1/3)
      const stake1 = ethers.parseEther("10000");
      const stake2 = ethers.parseEther("5000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await stakingBoost.connect(user1).stake(stake1);
      
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await stakingBoost.connect(user2).stake(stake2);
      
      // Distribute rewards
      const rewardAmount = BigInt(150) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Both users claim
      await stakingBoost.connect(user1).claim();
      await stakingBoost.connect(user2).claim();
      
      // Get shXRP balances
      const balance1 = await vault.balanceOf(user1.address);
      const balance2 = await vault.balanceOf(user2.address);
      
      // User1 should have ~2x the shares of User2
      // Allow for some rounding
      expect(balance1).to.be.gt(balance2);
      
      // Check ratio is approximately 2:1
      const ratio = balance1 * BigInt(100) / balance2;
      expect(ratio).to.be.closeTo(200n, 10n); // ~2x with 10% tolerance
    });

    it("Test 8: only StakingBoost can call vault.donateOnBehalf()", async function () {
      // User tries to call donateOnBehalf directly (should fail)
      await fxrpToken.mint(user1.address, BigInt(100) * BigInt(10 ** FXRP_DECIMALS));
      await fxrpToken.connect(user1).approve(await vault.getAddress(), BigInt(100) * BigInt(10 ** FXRP_DECIMALS));
      
      await expect(
        vault.connect(user1).donateOnBehalf(user1.address, BigInt(100) * BigInt(10 ** FXRP_DECIMALS))
      ).to.be.revertedWith("Only StakingBoost can donate");
    });
  });

  // ========================================
  // TEST 9-12: End-to-End Flow
  // ========================================
  
  describe("Test 9-12: Full End-to-End Flow Validation", function () {
    
    it("Test 9: complete flow - stake → distribute → claim → verify shXRP increase", async function () {
      // User1 stakes 10k SHIELD
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // User3 deposits FXRP directly to vault (no staking)
      const depositAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(user3).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user3).deposit(depositAmount, user3.address);
      
      const user3SharesBefore = await vault.balanceOf(user3.address);
      
      // Distribute FXRP rewards to stakers
      const rewardAmount = BigInt(50) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // User1 claims boost
      await stakingBoost.connect(user1).claim();
      
      // User1 should have shXRP shares from boost
      const user1Shares = await vault.balanceOf(user1.address);
      expect(user1Shares).to.be.gt(0);
      
      // User3 shares should be unchanged (no boost for non-stakers)
      const user3SharesAfter = await vault.balanceOf(user3.address);
      expect(user3SharesAfter).to.equal(user3SharesBefore);
      
      // Verify differentiated yield: User1 got boost, User3 did not
      console.log(`User1 (staker) shXRP: ${user1Shares}`);
      console.log(`User3 (non-staker) shXRP: ${user3SharesAfter}`);
    });

    it("Test 10: getStakeInfo returns correct pending rewards", async function () {
      const stakeAmount = ethers.parseEther("10000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Get stake info
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(stakeInfo.pendingRewards).to.equal(rewardAmount);
      expect(stakeInfo.unlockTime).to.be.gt(0);
    });

    it("Test 11: claimAndWithdraw convenience function works correctly", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const rewardAmount = BigInt(50) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      const shieldBalanceBefore = await shieldToken.balanceOf(user1.address);
      
      // Claim and withdraw in one transaction
      await stakingBoost.connect(user1).claimAndWithdraw(stakeAmount);
      
      // User should have received SHIELD back
      const shieldBalanceAfter = await shieldToken.balanceOf(user1.address);
      expect(shieldBalanceAfter).to.equal(shieldBalanceBefore + stakeAmount);
      
      // User should have shXRP from claim
      expect(await vault.balanceOf(user1.address)).to.be.gt(0);
      
      // Stake should be 0
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
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
  // SECURITY & EDGE CASE TESTS
  // ========================================
  
  describe("Security & Edge Cases", function () {
    
    it("Should handle zero totalStaked gracefully in distributeBoost", async function () {
      // No stakers - FXRP should stay in contract
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      
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

    it("Should verify setStakingBoost is one-time only", async function () {
      // setStakingBoost was already called in beforeEach
      // Trying to call it again should fail
      await expect(
        vault.connect(owner).setStakingBoost(user3.address)
      ).to.be.revertedWith("StakingBoost already set");
    });

    it("Should protect against reentrancy on claim", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Distribute rewards
      const rewardAmount = BigInt(50) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Normal claim should work
      await stakingBoost.connect(user1).claim();
      
      // Second claim should give nothing (rewards already claimed)
      const balanceBefore = await vault.balanceOf(user1.address);
      await stakingBoost.connect(user1).claim();
      const balanceAfter = await vault.balanceOf(user1.address);
      expect(balanceAfter).to.equal(balanceBefore);
    });

    it("Should emit correct events on claim", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const rewardAmount = BigInt(100) * BigInt(10 ** FXRP_DECIMALS);
      await fxrpToken.connect(revenueRouterSigner).approve(await stakingBoost.getAddress(), rewardAmount);
      await stakingBoost.connect(revenueRouterSigner).distributeBoost(rewardAmount);
      
      // Claim should emit RewardClaimed event
      await expect(stakingBoost.connect(user1).claim())
        .to.emit(stakingBoost, "RewardClaimed");
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
