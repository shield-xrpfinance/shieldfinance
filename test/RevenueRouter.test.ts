import { expect } from "chai";
import { network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * RevenueRouter Comprehensive Unit Tests
 * 
 * Tests cover:
 * - Deployment and initialization
 * - Revenue distribution (FXRP → SHIELD burn + StakingBoost)
 * - Slippage protection
 * - Owner controls (allocations, thresholds, price)
 * - Reserve withdrawal
 * - Emergency rescue function
 */
describe("RevenueRouter", function () {
  let revenueRouter: any;
  let shieldToken: any;
  let fxrpToken: any;
  let mockRouter: any;
  let mockStakingBoost: any;
  let otherToken: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let ethers: any;

  const FXRP_DECIMALS = 6;

  function toFxrp(amount: number): bigint {
    return BigInt(Math.floor(amount * 10 ** FXRP_DECIMALS));
  }

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    // Deploy MockShieldToken (burnable ERC20)
    const MockShieldToken = await ethers.getContractFactory("MockShieldToken");
    shieldToken = await MockShieldToken.deploy("SHIELD Token", "SHIELD");
    await shieldToken.waitForDeployment();

    // Deploy FXRP token (6 decimals)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    fxrpToken = await MockERC20.deploy("Flare XRP", "FXRP", 6);
    await fxrpToken.waitForDeployment();

    // Deploy another token for rescue tests
    otherToken = await MockERC20.deploy("Other Token", "OTHER", 18);
    await otherToken.waitForDeployment();

    // Deploy MockUniswapV3Router
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    mockRouter = await MockUniswapV3Router.deploy();
    await mockRouter.waitForDeployment();

    // Deploy MockStakingBoostDistributor
    const MockStakingBoostDistributor = await ethers.getContractFactory("MockStakingBoostDistributor");
    mockStakingBoost = await MockStakingBoostDistributor.deploy();
    await mockStakingBoost.waitForDeployment();

    // Deploy RevenueRouter
    const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
    const initialPrice = ethers.parseEther("0.0001"); // 0.0001 FXRP per SHIELD
    revenueRouter = await RevenueRouter.deploy(
      await shieldToken.getAddress(),
      await fxrpToken.getAddress(),
      await mockRouter.getAddress(),
      initialPrice
    );
    await revenueRouter.waitForDeployment();

    // Configure StakingBoost
    await revenueRouter.setStakingBoost(await mockStakingBoost.getAddress());
    await mockStakingBoost.setFxrpToken(await fxrpToken.getAddress());

    // Setup mock router to return SHIELD when swapping
    await shieldToken.mint(await mockRouter.getAddress(), ethers.parseEther("1000000"));
    await mockRouter.setOutputToken(await shieldToken.getAddress());
  });

  // ============================================
  // DEPLOYMENT TESTS
  // ============================================
  describe("Deployment", function () {
    it("should deploy with correct parameters", async function () {
      expect(await revenueRouter.shieldToken()).to.equal(await shieldToken.getAddress());
      expect(await revenueRouter.fxrpToken()).to.equal(await fxrpToken.getAddress());
      expect(await revenueRouter.router()).to.equal(await mockRouter.getAddress());
      expect(await revenueRouter.burnAllocationBps()).to.equal(5000n); // 50%
      expect(await revenueRouter.boostAllocationBps()).to.equal(4000n); // 40%
    });

    it("should reject zero SHIELD address", async function () {
      const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
      await expect(
        RevenueRouter.deploy(
          ethers.ZeroAddress,
          await fxrpToken.getAddress(),
          await mockRouter.getAddress(),
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid SHIELD address");
    });

    it("should reject zero FXRP address", async function () {
      const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
      await expect(
        RevenueRouter.deploy(
          await shieldToken.getAddress(),
          ethers.ZeroAddress,
          await mockRouter.getAddress(),
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid FXRP address");
    });

    it("should reject zero router address", async function () {
      const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
      await expect(
        RevenueRouter.deploy(
          await shieldToken.getAddress(),
          await fxrpToken.getAddress(),
          ethers.ZeroAddress,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid router address");
    });

    it("should reject zero initial price", async function () {
      const RevenueRouter = await ethers.getContractFactory("RevenueRouter");
      await expect(
        RevenueRouter.deploy(
          await shieldToken.getAddress(),
          await fxrpToken.getAddress(),
          await mockRouter.getAddress(),
          0n
        )
      ).to.be.revertedWith("Invalid initial price");
    });
  });

  // ============================================
  // DISTRIBUTION TESTS
  // ============================================
  describe("distribute", function () {
    it("should revert if below distribution threshold", async function () {
      // Default threshold is 0.1 FXRP = 100000
      await fxrpToken.mint(await revenueRouter.getAddress(), toFxrp(0.05));
      
      await expect(revenueRouter.distribute())
        .to.be.revertedWithCustomError(revenueRouter, "BelowDistributionThreshold");
    });

    it("should distribute: swap FXRP to SHIELD and burn", async function () {
      const fxrpAmount = toFxrp(1000); // 1000 FXRP
      await fxrpToken.mint(await revenueRouter.getAddress(), fxrpAmount);

      // Mock router returns 5000 SHIELD for 500 FXRP (50% burn allocation)
      const shieldAmount = ethers.parseEther("5000");
      await mockRouter.setAmountOut(shieldAmount);

      const shieldSupplyBefore = await shieldToken.totalSupply();
      
      await expect(revenueRouter.distribute())
        .to.emit(revenueRouter, "RevenueDistributed");

      // Verify SHIELD was burned
      const shieldSupplyAfter = await shieldToken.totalSupply();
      expect(shieldSupplyBefore - shieldSupplyAfter).to.equal(shieldAmount);
    });

    it("should distribute FXRP directly to StakingBoost", async function () {
      const fxrpAmount = toFxrp(1000); // 1000 FXRP
      await fxrpToken.mint(await revenueRouter.getAddress(), fxrpAmount);

      // Mock router returns SHIELD
      await mockRouter.setAmountOut(ethers.parseEther("5000"));

      await revenueRouter.distribute();

      // 40% of 1000 = 400 FXRP should go to StakingBoost
      // Check distributeBoost was called with correct amount
      const lastAmount = await mockStakingBoost.lastDistributionAmount();
      expect(lastAmount).to.equal(toFxrp(400));
    });

    it("should keep reserves after distribution", async function () {
      const fxrpAmount = toFxrp(1000); // 1000 FXRP
      await fxrpToken.mint(await revenueRouter.getAddress(), fxrpAmount);

      await mockRouter.setAmountOut(ethers.parseEther("5000"));

      await revenueRouter.distribute();

      // 10% of 1000 = 100 FXRP should remain as reserves
      const routerBalance = await fxrpToken.balanceOf(await revenueRouter.getAddress());
      expect(routerBalance).to.equal(toFxrp(100));
    });

    it("should allow anyone to call distribute", async function () {
      const fxrpAmount = toFxrp(1000);
      await fxrpToken.mint(await revenueRouter.getAddress(), fxrpAmount);
      await mockRouter.setAmountOut(ethers.parseEther("5000"));

      // user1 (not owner) can call distribute
      await expect(revenueRouter.connect(user1).distribute())
        .to.emit(revenueRouter, "RevenueDistributed");
    });
  });

  // ============================================
  // OWNER CONTROLS
  // ============================================
  describe("Owner Controls", function () {
    describe("setBurnAllocation", function () {
      it("should allow owner to update burn allocation", async function () {
        await expect(revenueRouter.setBurnAllocation(6000n))
          .to.emit(revenueRouter, "BurnAllocationUpdated")
          .withArgs(5000n, 6000n);

        expect(await revenueRouter.burnAllocationBps()).to.equal(6000n);
      });

      it("should reject allocation > 80%", async function () {
        await expect(revenueRouter.setBurnAllocation(8001n))
          .to.be.revertedWithCustomError(revenueRouter, "AllocationTooHigh");
      });

      it("should reject if total exceeds 100%", async function () {
        // Current boost is 40%, trying to set burn to 70% = 110%
        await expect(revenueRouter.setBurnAllocation(7000n))
          .to.be.revertedWithCustomError(revenueRouter, "TotalAllocationExceeds100");
      });

      it("should reject non-owner", async function () {
        await expect(revenueRouter.connect(user1).setBurnAllocation(6000n))
          .to.be.revertedWithCustomError(revenueRouter, "OwnableUnauthorizedAccount");
      });
    });

    describe("setBoostAllocation", function () {
      it("should allow owner to update boost allocation", async function () {
        await expect(revenueRouter.setBoostAllocation(3000n))
          .to.emit(revenueRouter, "BoostAllocationUpdated")
          .withArgs(4000n, 3000n);

        expect(await revenueRouter.boostAllocationBps()).to.equal(3000n);
      });

      it("should reject allocation > 80%", async function () {
        await expect(revenueRouter.setBoostAllocation(8001n))
          .to.be.revertedWithCustomError(revenueRouter, "AllocationTooHigh");
      });

      it("should reject non-owner", async function () {
        await expect(revenueRouter.connect(user1).setBoostAllocation(3000n))
          .to.be.revertedWithCustomError(revenueRouter, "OwnableUnauthorizedAccount");
      });
    });

    describe("setMaxSlippage", function () {
      it("should allow owner to update slippage", async function () {
        await expect(revenueRouter.setMaxSlippage(1000n))
          .to.emit(revenueRouter, "SlippageUpdated")
          .withArgs(500n, 1000n);

        expect(await revenueRouter.maxSlippageBps()).to.equal(1000n);
      });

      it("should reject slippage > 20%", async function () {
        await expect(revenueRouter.setMaxSlippage(2001n))
          .to.be.revertedWithCustomError(revenueRouter, "InvalidSlippage");
      });
    });

    describe("setLastKnownPrice", function () {
      it("should allow owner to update price", async function () {
        const newPrice = ethers.parseEther("0.2");
        
        await expect(revenueRouter.setLastKnownPrice(newPrice))
          .to.emit(revenueRouter, "PriceUpdated");

        expect(await revenueRouter.lastKnownPrice()).to.equal(newPrice);
      });

      it("should reject zero price", async function () {
        await expect(revenueRouter.setLastKnownPrice(0n))
          .to.be.revertedWithCustomError(revenueRouter, "InvalidPrice");
      });
    });
  });

  // ============================================
  // RESERVE WITHDRAWAL
  // ============================================
  describe("withdrawReserves", function () {
    it("should allow owner to withdraw reserves", async function () {
      const amount = toFxrp(100);
      await fxrpToken.mint(await revenueRouter.getAddress(), amount);

      await expect(revenueRouter.withdrawReserves(owner.address, amount))
        .to.emit(revenueRouter, "ReservesWithdrawn")
        .withArgs(owner.address, amount);

      expect(await fxrpToken.balanceOf(owner.address)).to.equal(amount);
    });

    it("should reject zero recipient", async function () {
      await expect(revenueRouter.withdrawReserves(ethers.ZeroAddress, 100n))
        .to.be.revertedWithCustomError(revenueRouter, "InvalidRecipient");
    });

    it("should reject non-owner", async function () {
      await expect(revenueRouter.connect(user1).withdrawReserves(user1.address, 100n))
        .to.be.revertedWithCustomError(revenueRouter, "OwnableUnauthorizedAccount");
    });
  });

  // ============================================
  // RESCUE FUNCTION
  // ============================================
  describe("rescueTokens", function () {
    it("should allow owner to rescue other tokens", async function () {
      const amount = ethers.parseEther("100");
      await otherToken.mint(await revenueRouter.getAddress(), amount);

      await expect(revenueRouter.rescueTokens(
        await otherToken.getAddress(),
        owner.address,
        amount
      ))
        .to.emit(revenueRouter, "TokensRescued")
        .withArgs(await otherToken.getAddress(), owner.address, amount);

      expect(await otherToken.balanceOf(owner.address)).to.equal(amount);
    });

    it("should reject rescuing FXRP", async function () {
      await expect(
        revenueRouter.rescueTokens(await fxrpToken.getAddress(), owner.address, 100n)
      ).to.be.revertedWithCustomError(revenueRouter, "CannotRescueFXRP");
    });

    it("should reject zero recipient", async function () {
      await expect(
        revenueRouter.rescueTokens(await otherToken.getAddress(), ethers.ZeroAddress, 100n)
      ).to.be.revertedWithCustomError(revenueRouter, "InvalidRecipient");
    });

    it("should reject non-owner", async function () {
      await expect(
        revenueRouter.connect(user1).rescueTokens(await otherToken.getAddress(), user1.address, 100n)
      ).to.be.revertedWithCustomError(revenueRouter, "OwnableUnauthorizedAccount");
    });
  });

  // ============================================
  // VIEW FUNCTIONS
  // ============================================
  describe("getRevenueStatus", function () {
    it("should return correct status", async function () {
      const amount = toFxrp(200);
      await fxrpToken.mint(await revenueRouter.getAddress(), amount);

      const status = await revenueRouter.getRevenueStatus();
      
      expect(status.fxrpBalance).to.equal(amount);
      expect(status.burnAlloc).to.equal(5000n);
      expect(status.boostAlloc).to.equal(4000n);
      expect(status.reserveAlloc).to.equal(1000n);
      expect(status.canDistribute).to.equal(true); // 200 >= 0.1
    });

    it("should return canDistribute false when below threshold", async function () {
      const amount = toFxrp(0.05); // Below 0.1 threshold
      await fxrpToken.mint(await revenueRouter.getAddress(), amount);

      const status = await revenueRouter.getRevenueStatus();
      expect(status.canDistribute).to.equal(false);
    });
  });
});
