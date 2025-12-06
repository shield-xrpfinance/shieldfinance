import { expect } from "chai";
import { network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * BuybackBurn Comprehensive Unit Tests
 * 
 * Tests cover:
 * - Deployment and initialization
 * - buyAndBurn functionality with slippage protection
 * - Owner controls (slippage, price updates)
 * - Emergency rescue function
 * - Receive FLR and wrap to wFLR
 */
describe("BuybackBurn", function () {
  let buybackBurn: any;
  let shieldToken: any;
  let wflr: any;
  let mockRouter: any;
  let otherToken: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let ethers: any;

  const INITIAL_SLIPPAGE_BPS = 500n; // 5%

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

    // Deploy MockWFLR
    const MockWFLR = await ethers.getContractFactory("MockWFLR");
    wflr = await MockWFLR.deploy();
    await wflr.waitForDeployment();

    // Deploy MockUniswapV3Router
    const MockUniswapV3Router = await ethers.getContractFactory("MockUniswapV3Router");
    mockRouter = await MockUniswapV3Router.deploy();
    await mockRouter.waitForDeployment();

    // Deploy another token for rescue tests
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    otherToken = await MockERC20.deploy("Other Token", "OTHER", 18);
    await otherToken.waitForDeployment();

    // Deploy BuybackBurn
    const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
    const initialPrice = ethers.parseEther("0.1"); // 0.1 wFLR per SHIELD
    buybackBurn = await BuybackBurn.deploy(
      await shieldToken.getAddress(),
      await wflr.getAddress(),
      await mockRouter.getAddress(),
      INITIAL_SLIPPAGE_BPS,
      initialPrice
    );
    await buybackBurn.waitForDeployment();

    // Setup mock router to return SHIELD when swapping
    await shieldToken.mint(await mockRouter.getAddress(), ethers.parseEther("1000000"));
    await mockRouter.setOutputToken(await shieldToken.getAddress());
  });

  // ============================================
  // DEPLOYMENT TESTS
  // ============================================
  describe("Deployment", function () {
    it("should deploy with correct parameters", async function () {
      expect(await buybackBurn.shieldToken()).to.equal(await shieldToken.getAddress());
      expect(await buybackBurn.wflr()).to.equal(await wflr.getAddress());
      expect(await buybackBurn.router()).to.equal(await mockRouter.getAddress());
      expect(await buybackBurn.maxSlippageBps()).to.equal(INITIAL_SLIPPAGE_BPS);
      expect(await buybackBurn.lastKnownPrice()).to.equal(ethers.parseEther("0.1"));
    });

    it("should reject zero SHIELD address", async function () {
      const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
      await expect(
        BuybackBurn.deploy(
          ethers.ZeroAddress,
          await wflr.getAddress(),
          await mockRouter.getAddress(),
          500n,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid SHIELD address");
    });

    it("should reject zero wFLR address", async function () {
      const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
      await expect(
        BuybackBurn.deploy(
          await shieldToken.getAddress(),
          ethers.ZeroAddress,
          await mockRouter.getAddress(),
          500n,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid wFLR address");
    });

    it("should reject zero router address", async function () {
      const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
      await expect(
        BuybackBurn.deploy(
          await shieldToken.getAddress(),
          await wflr.getAddress(),
          ethers.ZeroAddress,
          500n,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Invalid router address");
    });

    it("should reject slippage > 20%", async function () {
      const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
      await expect(
        BuybackBurn.deploy(
          await shieldToken.getAddress(),
          await wflr.getAddress(),
          await mockRouter.getAddress(),
          2001n, // > 20%
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Slippage too high");
    });

    it("should reject zero initial price", async function () {
      const BuybackBurn = await ethers.getContractFactory("BuybackBurn");
      await expect(
        BuybackBurn.deploy(
          await shieldToken.getAddress(),
          await wflr.getAddress(),
          await mockRouter.getAddress(),
          500n,
          0n
        )
      ).to.be.revertedWith("Invalid initial price");
    });
  });

  // ============================================
  // BUYBACK AND BURN TESTS
  // ============================================
  describe("buyAndBurn", function () {
    it("should revert if no wFLR balance", async function () {
      await expect(buybackBurn.buyAndBurn())
        .to.be.revertedWithCustomError(buybackBurn, "NoWFLRToSwap");
    });

    it("should swap wFLR to SHIELD and burn", async function () {
      const wflrAmount = ethers.parseEther("10");
      
      // Send wFLR to buybackBurn
      await wflr.deposit({ value: wflrAmount });
      await wflr.transfer(await buybackBurn.getAddress(), wflrAmount);

      // Configure mock router to return 100 SHIELD for 10 wFLR (0.1 wFLR per SHIELD)
      const shieldAmount = ethers.parseEther("100");
      await mockRouter.setAmountOut(shieldAmount);

      const shieldSupplyBefore = await shieldToken.totalSupply();
      
      await expect(buybackBurn.buyAndBurn())
        .to.emit(buybackBurn, "BuybackAndBurn")
        .withArgs(wflrAmount, shieldAmount);

      // Verify SHIELD was burned
      const shieldSupplyAfter = await shieldToken.totalSupply();
      expect(shieldSupplyBefore - shieldSupplyAfter).to.equal(shieldAmount);

      // Verify wFLR balance is zero
      expect(await wflr.balanceOf(await buybackBurn.getAddress())).to.equal(0n);
    });

    it("should update lastKnownPrice after swap", async function () {
      const wflrAmount = ethers.parseEther("10");
      
      await wflr.deposit({ value: wflrAmount });
      await wflr.transfer(await buybackBurn.getAddress(), wflrAmount);

      // Return 100 SHIELD for 10 wFLR first (matches initial price expectation of 0.1)
      // This ensures we pass slippage check (expected 100, min 95)
      const shieldAmount = ethers.parseEther("100");
      await mockRouter.setAmountOut(shieldAmount);

      const priceBefore = await buybackBurn.lastKnownPrice();
      
      await expect(buybackBurn.buyAndBurn())
        .to.emit(buybackBurn, "PriceUpdated");

      const priceAfter = await buybackBurn.lastKnownPrice();
      // New price = 10e18 * 1e18 / 100e18 = 0.1e18
      expect(priceAfter).to.equal(ethers.parseEther("0.1"));
    });

    it("should use slippage protection in swap params", async function () {
      const wflrAmount = ethers.parseEther("10");
      
      await wflr.deposit({ value: wflrAmount });
      await wflr.transfer(await buybackBurn.getAddress(), wflrAmount);

      // With lastKnownPrice = 0.1 wFLR/SHIELD, expected = 100 SHIELD
      // With 5% slippage, min = 95 SHIELD
      const shieldAmount = ethers.parseEther("100");
      await mockRouter.setAmountOut(shieldAmount);

      // The mock router will check amountOutMinimum, we verify it was called with correct params
      await buybackBurn.buyAndBurn();
      
      // Check the last swap params from mock router
      const lastParams = await mockRouter.lastSwapParams();
      expect(lastParams.amountOutMinimum).to.equal(ethers.parseEther("95")); // 100 * 0.95
    });
  });

  // ============================================
  // OWNER CONTROLS
  // ============================================
  describe("Owner Controls", function () {
    describe("setMaxSlippage", function () {
      it("should allow owner to update slippage", async function () {
        await expect(buybackBurn.setMaxSlippage(1000n))
          .to.emit(buybackBurn, "SlippageUpdated")
          .withArgs(INITIAL_SLIPPAGE_BPS, 1000n);

        expect(await buybackBurn.maxSlippageBps()).to.equal(1000n);
      });

      it("should reject slippage > 20%", async function () {
        await expect(buybackBurn.setMaxSlippage(2001n))
          .to.be.revertedWithCustomError(buybackBurn, "InvalidSlippage");
      });

      it("should reject non-owner", async function () {
        await expect(buybackBurn.connect(user1).setMaxSlippage(1000n))
          .to.be.revertedWithCustomError(buybackBurn, "OwnableUnauthorizedAccount");
      });
    });

    describe("setLastKnownPrice", function () {
      it("should allow owner to update price", async function () {
        const newPrice = ethers.parseEther("0.2");
        
        await expect(buybackBurn.setLastKnownPrice(newPrice))
          .to.emit(buybackBurn, "PriceUpdated")
          .withArgs(ethers.parseEther("0.1"), newPrice);

        expect(await buybackBurn.lastKnownPrice()).to.equal(newPrice);
      });

      it("should reject zero price", async function () {
        await expect(buybackBurn.setLastKnownPrice(0n))
          .to.be.revertedWithCustomError(buybackBurn, "InvalidPrice");
      });

      it("should reject non-owner", async function () {
        await expect(buybackBurn.connect(user1).setLastKnownPrice(ethers.parseEther("0.2")))
          .to.be.revertedWithCustomError(buybackBurn, "OwnableUnauthorizedAccount");
      });
    });
  });

  // ============================================
  // RESCUE FUNCTION
  // ============================================
  describe("rescueTokens", function () {
    it("should allow owner to rescue other tokens", async function () {
      const amount = ethers.parseEther("100");
      await otherToken.mint(await buybackBurn.getAddress(), amount);

      await expect(buybackBurn.rescueTokens(
        await otherToken.getAddress(),
        owner.address,
        amount
      ))
        .to.emit(buybackBurn, "TokensRescued")
        .withArgs(await otherToken.getAddress(), owner.address, amount);

      expect(await otherToken.balanceOf(owner.address)).to.equal(amount);
    });

    it("should reject rescuing wFLR", async function () {
      await expect(
        buybackBurn.rescueTokens(await wflr.getAddress(), owner.address, 100n)
      ).to.be.revertedWithCustomError(buybackBurn, "CannotRescueWFLR");
    });

    it("should reject rescuing SHIELD", async function () {
      await expect(
        buybackBurn.rescueTokens(await shieldToken.getAddress(), owner.address, 100n)
      ).to.be.revertedWithCustomError(buybackBurn, "CannotRescueSHIELD");
    });

    it("should reject non-owner", async function () {
      await expect(
        buybackBurn.connect(user1).rescueTokens(await otherToken.getAddress(), user1.address, 100n)
      ).to.be.revertedWithCustomError(buybackBurn, "OwnableUnauthorizedAccount");
    });
  });

  // ============================================
  // RECEIVE FLR
  // ============================================
  describe("receive", function () {
    it("should accept FLR and wrap to wFLR", async function () {
      const amount = ethers.parseEther("5");
      
      await owner.sendTransaction({
        to: await buybackBurn.getAddress(),
        value: amount
      });

      expect(await wflr.balanceOf(await buybackBurn.getAddress())).to.equal(amount);
    });
  });
});
