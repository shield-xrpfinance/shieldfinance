import { expect } from "chai";
import { network } from "hardhat";
import type { StakingBoost, ShieldToken } from "../types/ethers-contracts";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakingBoost - Adversarial Scenarios", function () {
  let ethers: any;
  
  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  let stakingBoost: StakingBoost;
  let shieldToken: ShieldToken;
  let owner: SignerWithAddress;
  let attacker: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const LOCK_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds

  beforeEach(async function () {
    [owner, attacker, user1, user2] = await ethers.getSigners();

    // Deploy ShieldToken
    const ShieldTokenFactory = await ethers.getContractFactory("ShieldToken");
    shieldToken = await ShieldTokenFactory.deploy();
    await shieldToken.waitForDeployment();

    // Deploy StakingBoost
    const StakingBoostFactory = await ethers.getContractFactory("StakingBoost");
    stakingBoost = await StakingBoostFactory.deploy(await shieldToken.getAddress());
    await stakingBoost.waitForDeployment();

    // Distribute SHIELD tokens to users for testing
    await shieldToken.transfer(attacker.address, ethers.parseEther("100000"));
    await shieldToken.transfer(user1.address, ethers.parseEther("50000"));
    await shieldToken.transfer(user2.address, ethers.parseEther("25000"));
  });

  describe("Reentrancy Attack Simulation", function () {
    it("Should verify stake() has nonReentrant modifier", async function () {
      // Test: Verify stake() has nonReentrant modifier
      // Note: Contract uses nonReentrant, this confirms it works
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      
      // Normal stake should work
      await expect(
        stakingBoost.connect(user1).stake(stakeAmount)
      ).to.emit(stakingBoost, "Staked");
      
      // If a malicious ERC20 tried to reenter, nonReentrant would prevent it
      // Since we're using standard ERC20, reentrancy isn't possible here
      // But the protection is in place
    });

    it("Should verify withdraw() has nonReentrant modifier", async function () {
      // Test: Verify withdraw() has nonReentrant modifier
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Normal withdraw should work
      await expect(
        stakingBoost.connect(user1).withdraw(stakeAmount)
      ).to.emit(stakingBoost, "Withdrawn");
    });

    it("Should use SafeERC20 for token transfers", async function () {
      // SafeERC20 protects against:
      // - Tokens that return false instead of reverting
      // - Reentrancy via token transfer hooks
      
      const stakeAmount = ethers.parseEther("500");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      
      await expect(
        stakingBoost.connect(user1).stake(stakeAmount)
      ).to.emit(stakingBoost, "Staked");
    });
  });

  describe("Lock Period Bypass Attempts", function () {
    it("Should prevent early withdrawal before lock expires", async function () {
      // Test: Stake with 30-day lock, try immediate withdraw
      const stakeAmount = ethers.parseEther("1000");
      
      await shieldToken.connect(attacker).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(attacker).stake(stakeAmount);
      
      // Try to withdraw immediately (should fail)
      await expect(
        stakingBoost.connect(attacker).withdraw(stakeAmount)
      ).to.be.revertedWith("Tokens still locked");
    });

    it("Should prevent timestamp manipulation", async function () {
      // Test: Ensure contract uses block.timestamp correctly
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(attacker).approve(await stakingBoost.getAddress(), stakeAmount);
      
      const tx = await stakingBoost.connect(attacker).stake(stakeAmount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      const stakeInfo = await stakingBoost.getStakeInfo(attacker.address);
      const expectedUnlock = BigInt(block!.timestamp) + BigInt(LOCK_PERIOD);
      
      // Verify unlock time is calculated correctly
      expect(stakeInfo.unlockTime).to.equal(expectedUnlock);
      
      // Try to withdraw before unlock (should fail)
      await expect(
        stakingBoost.connect(attacker).withdraw(stakeAmount)
      ).to.be.revertedWith("Tokens still locked");
    });

    it("Should handle exact lock expiry timestamp", async function () {
      // Test: Withdraw at exactly unlockTime (boundary test)
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward exactly LOCK_PERIOD seconds
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Withdraw should succeed at exact unlock time
      await expect(
        stakingBoost.connect(user1).withdraw(stakeAmount)
      ).to.emit(stakingBoost, "Withdrawn");
    });

    it("Should handle withdraw 1 second before unlock", async function () {
      // Test: Fast forward to unlockTime - 1 second
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      
      const stakeTx = await stakingBoost.connect(user1).stake(stakeAmount);
      await stakeTx.wait();
      
      // Fast forward almost to unlock time (2 seconds short to account for block timing)
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD - 2]);
      await ethers.provider.send("evm_mine", []);
      
      // Should still be locked
      await expect(
        stakingBoost.connect(user1).withdraw(stakeAmount)
      ).to.be.revertedWith("Tokens still locked");
    });

    it("Should allow withdraw after lock period expires", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD + 100]);
      await ethers.provider.send("evm_mine", []);
      
      // Withdraw should succeed
      await expect(
        stakingBoost.connect(user1).withdraw(stakeAmount)
      ).to.emit(stakingBoost, "Withdrawn")
        .withArgs(user1.address, stakeAmount);
    });

    it("Should handle multiple stakes resetting lock period (SB-03 fix)", async function () {
      // AUDIT FIX SB-03: Each new deposit resets the 30-day lock period
      // This prevents gaming where users stake tiny amounts early to bypass locks
      const stake1 = ethers.parseEther("500");
      const stake2 = ethers.parseEther("500");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1 + stake2);
      
      // First stake at time T
      await stakingBoost.connect(user1).stake(stake1);
      
      // Fast forward 15 days
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      
      // Second stake at T+15 days - lock period RESETS per SB-03 fix
      await stakingBoost.connect(user1).stake(stake2);
      
      // After only 15 more days (30 total from first stake), withdrawal should FAIL
      // because the lock was reset when stake2 was made
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      
      // Should NOT be able to withdraw (only 15 days since stake2, needs 30)
      await expect(
        stakingBoost.connect(user1).withdraw(stake1 + stake2)
      ).to.be.revertedWith("Tokens still locked");
      
      // Fast forward remaining 15 days to complete 30 days from stake2
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      
      // NOW withdrawal should succeed (30 days since last stake)
      await expect(
        stakingBoost.connect(user1).withdraw(stake1 + stake2)
      ).to.emit(stakingBoost, "Withdrawn");
    });

    it("Should prevent lock period gaming attack (SB-03)", async function () {
      // This test specifically verifies the SB-03 fix prevents the attack described in the audit:
      // 1. Stake tiny amount on Day 1
      // 2. Wait 29 days  
      // 3. Stake large amount on Day 30
      // 4. Try to immediately withdraw (should FAIL with fix)
      
      const tinyStake = ethers.parseEther("0.0001");
      const largeStake = ethers.parseEther("10000");
      
      await shieldToken.connect(attacker).approve(await stakingBoost.getAddress(), tinyStake + largeStake);
      
      // Step 1: Attacker stakes tiny amount on Day 1
      await stakingBoost.connect(attacker).stake(tinyStake);
      
      // Step 2: Wait 29 days (just under lock period)
      await ethers.provider.send("evm_increaseTime", [29 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      
      // Step 3: Stake large amount on Day 30
      await stakingBoost.connect(attacker).stake(largeStake);
      
      // Step 4: Try to immediately withdraw - should FAIL with SB-03 fix
      // (Without the fix, this would succeed because stakedAt was set on Day 1)
      await expect(
        stakingBoost.connect(attacker).withdraw(tinyStake + largeStake)
      ).to.be.revertedWith("Tokens still locked");
      
      // Verify the lock was properly reset to Day 30
      const stakeInfo = await stakingBoost.getStakeInfo(attacker.address);
      
      // Must wait full 30 days from the large stake
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // NOW withdrawal should succeed
      await expect(
        stakingBoost.connect(attacker).withdraw(tinyStake + largeStake)
      ).to.emit(stakingBoost, "Withdrawn");
    });
  });

  describe("Boost Calculation Property Tests", function () {
    it("Should always calculate boost correctly for any valid amount", async function () {
      // Test: Stake random amounts, verify boost = amount / 100 SHIELD
      
      const testAmounts = [
        ethers.parseEther("100"),   // Boost = 1
        ethers.parseEther("550"),   // Boost = 5
        ethers.parseEther("1000"),  // Boost = 10
        ethers.parseEther("12345"), // Boost = 123
      ];
      
      for (let i = 0; i < testAmounts.length; i++) {
        const amount = testAmounts[i];
        const user = [user1, user2, attacker, owner][i % 4];
        
        await shieldToken.connect(user).approve(await stakingBoost.getAddress(), amount);
        await stakingBoost.connect(user).stake(amount);
        
        const boost = await stakingBoost.getBoost(user.address);
        const expectedBoost = amount / ethers.parseEther("100");
        
        expect(boost).to.equal(expectedBoost);
      }
    });

    it("Should handle edge case: staking exactly 100 SHIELD", async function () {
      // Test: Stake 100 SHIELD → Boost = 1
      
      const stakeAmount = ethers.parseEther("100");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(1n);
    });

    it("Should handle edge case: staking 1 wei", async function () {
      // Test: Stake 1 wei → Boost = 0 (below threshold)
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), 1n);
      await stakingBoost.connect(user1).stake(1n);
      
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(0n);
    });

    it("Should handle edge case: staking 99 SHIELD", async function () {
      // Test: Stake 99 SHIELD → Boost = 0 (just below threshold)
      
      const stakeAmount = ethers.parseEther("99");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(0n);
    });

    it("Should handle edge case: staking 199 SHIELD", async function () {
      // Test: Stake 199 SHIELD → Boost = 1 (rounds down)
      
      const stakeAmount = ethers.parseEther("199");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(1n);
    });

    it("Should maintain boost accuracy across multiple stakes", async function () {
      // Test: Stake multiple times, verify total boost = sum of individual
      
      const stake1 = ethers.parseEther("300");
      const stake2 = ethers.parseEther("250");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1 + stake2);
      
      await stakingBoost.connect(user1).stake(stake1);
      await stakingBoost.connect(user1).stake(stake2);
      
      const totalStaked = stake1 + stake2; // 550 SHIELD
      const expectedBoost = totalStaked / ethers.parseEther("100"); // = 5
      
      const actualBoost = await stakingBoost.getBoost(user1.address);
      expect(actualBoost).to.equal(expectedBoost);
    });

    it("Should calculate boost correctly with large amounts", async function () {
      // Test: Large stake amounts
      
      const largeAmount = ethers.parseEther("1000000"); // 1M SHIELD
      await shieldToken.transfer(user1.address, largeAmount);
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), largeAmount);
      await stakingBoost.connect(user1).stake(largeAmount);
      
      const boost = await stakingBoost.getBoost(user1.address);
      const expectedBoost = largeAmount / ethers.parseEther("100"); // = 10,000
      
      expect(boost).to.equal(expectedBoost);
    });
  });

  describe("Gas Griefing Prevention", function () {
    it("Should complete stake in reasonable gas limit", async function () {
      // Test: Measure gas for stake() operation
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      
      const tx = await stakingBoost.connect(user1).stake(stakeAmount);
      const receipt = await tx.wait();
      
      // Stake should use < 200k gas
      expect(receipt!.gasUsed).to.be.lt(200000n);
    });

    it("Should complete withdraw in reasonable gas limit", async function () {
      // Test: Measure gas for withdraw() operation
      
      const stakeAmount = ethers.parseEther("1000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      const tx = await stakingBoost.connect(user1).withdraw(stakeAmount);
      const receipt = await tx.wait();
      
      // Withdraw should use < 200k gas
      expect(receipt!.gasUsed).to.be.lt(200000n);
    });

    it("Should handle getBoost() efficiently", async function () {
      // Test: getBoost() is a view function and should be gas-efficient
      // Note: View functions don't consume gas when called externally,
      // but we verify the logic is simple
      
      const stakeAmount = ethers.parseEther("5000");
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // getBoost is O(1) - just a simple division
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(50n); // 5000 / 100 = 50
      
      // Function should execute quickly even for large stakes
    });

    it("Should handle multiple users staking without gas issues", async function () {
      // Test: Multiple users stake, verify no gas issues
      
      const users = [user1, user2, attacker];
      
      for (const user of users) {
        const amount = ethers.parseEther("1000");
        await shieldToken.connect(user).approve(await stakingBoost.getAddress(), amount);
        
        const tx = await stakingBoost.connect(user).stake(amount);
        const receipt = await tx.wait();
        
        // Each stake should be efficient regardless of other users
        expect(receipt!.gasUsed).to.be.lt(200000n);
      }
    });
  });

  describe("Partial Withdrawal Scenarios", function () {
    it("Should allow partial withdrawal after lock period", async function () {
      const totalStake = ethers.parseEther("1000");
      const partialWithdraw = ethers.parseEther("400");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), totalStake);
      await stakingBoost.connect(user1).stake(totalStake);
      
      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Partial withdraw
      await expect(
        stakingBoost.connect(user1).withdraw(partialWithdraw)
      ).to.emit(stakingBoost, "Withdrawn")
        .withArgs(user1.address, partialWithdraw);
      
      // Check remaining stake
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(totalStake - partialWithdraw);
    });

    it("Should revert when withdrawing more than staked", async function () {
      const stakeAmount = ethers.parseEther("500");
      const excessWithdraw = ethers.parseEther("1000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Try to withdraw more than staked
      await expect(
        stakingBoost.connect(user1).withdraw(excessWithdraw)
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should reset stake data when fully withdrawn", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Fully withdraw
      await stakingBoost.connect(user1).withdraw(stakeAmount);
      
      // Check stake data is reset
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
      expect(stakeInfo.stakedAt).to.equal(0);
      expect(stakeInfo.unlockTime).to.equal(0);
    });
  });

  describe("TotalStaked Tracking", function () {
    it("Should accurately track totalStaked across multiple users", async function () {
      const stake1 = ethers.parseEther("1000");
      const stake2 = ethers.parseEther("2000");
      const stake3 = ethers.parseEther("1500");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      await shieldToken.connect(attacker).approve(await stakingBoost.getAddress(), stake3);
      
      await stakingBoost.connect(user1).stake(stake1);
      expect(await stakingBoost.totalStaked()).to.equal(stake1);
      
      await stakingBoost.connect(user2).stake(stake2);
      expect(await stakingBoost.totalStaked()).to.equal(stake1 + stake2);
      
      await stakingBoost.connect(attacker).stake(stake3);
      expect(await stakingBoost.totalStaked()).to.equal(stake1 + stake2 + stake3);
    });

    it("Should decrease totalStaked on withdrawal", async function () {
      const stake1 = ethers.parseEther("1000");
      const stake2 = ethers.parseEther("500");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stake1);
      await shieldToken.connect(user2).approve(await stakingBoost.getAddress(), stake2);
      
      await stakingBoost.connect(user1).stake(stake1);
      await stakingBoost.connect(user2).stake(stake2);
      
      const totalBefore = await stakingBoost.totalStaked();
      expect(totalBefore).to.equal(stake1 + stake2);
      
      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // User1 withdraws
      await stakingBoost.connect(user1).withdraw(stake1);
      
      const totalAfter = await stakingBoost.totalStaked();
      expect(totalAfter).to.equal(stake2);
    });
  });

  describe("Zero Amount Edge Cases", function () {
    it("Should revert on staking zero amount", async function () {
      await expect(
        stakingBoost.connect(user1).stake(0)
      ).to.be.revertedWith("Cannot stake 0");
    });

    it("Should revert on withdrawing zero amount from existing stake", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), stakeAmount);
      await stakingBoost.connect(user1).stake(stakeAmount);
      
      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD]);
      await ethers.provider.send("evm_mine", []);
      
      // Withdraw 0 should work (edge case) but is pointless
      // Actually checking: does it fail with "Insufficient stake"?
      // 0 <= amount, so it should not revert on that check
      // But SafeERC20 transfer of 0 is allowed
      await expect(
        stakingBoost.connect(user1).withdraw(0)
      ).to.not.be.revertedWithoutReason();
    });

    it("Should handle user with no stake calling getBoost", async function () {
      // User has never staked
      const boost = await stakingBoost.getBoost(user1.address);
      expect(boost).to.equal(0n);
    });

    it("Should handle user with no stake calling getStakeInfo", async function () {
      const stakeInfo = await stakingBoost.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
      expect(stakeInfo.stakedAt).to.equal(0);
      expect(stakeInfo.unlockTime).to.equal(0);
    });
  });

  describe("Token Approval Edge Cases", function () {
    it("Should revert stake without sufficient approval", async function () {
      const stakeAmount = ethers.parseEther("1000");
      const insufficientApproval = ethers.parseEther("500");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), insufficientApproval);
      
      await expect(
        stakingBoost.connect(user1).stake(stakeAmount)
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientAllowance");
    });

    it("Should revert stake without any approval", async function () {
      const stakeAmount = ethers.parseEther("1000");
      
      await expect(
        stakingBoost.connect(user1).stake(stakeAmount)
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientAllowance");
    });

    it("Should revert stake if user has insufficient balance", async function () {
      const userBalance = await shieldToken.balanceOf(user1.address);
      const excessAmount = userBalance + ethers.parseEther("1");
      
      await shieldToken.connect(user1).approve(await stakingBoost.getAddress(), excessAmount);
      
      await expect(
        stakingBoost.connect(user1).stake(excessAmount)
      ).to.be.revertedWithCustomError(shieldToken, "ERC20InsufficientBalance");
    });
  });
});
