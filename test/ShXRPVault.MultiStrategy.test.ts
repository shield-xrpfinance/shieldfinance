import { expect } from "chai";
import { network } from "hardhat";
import type { ShXRPVault, VaultController, MockERC20 } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShXRPVault - Multi-Strategy & Buffer-Aware Withdrawals", function () {
  let vault: ShXRPVault;
  let vaultController: VaultController;
  let fxrpToken: MockERC20;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let mockStrategy1: any;
  let mockStrategy2: any;
  let ethers: any;

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy mock FXRP token (6 decimals - matches production)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    fxrpToken = await MockERC20.deploy("Flare XRP", "FXRP", 6);

    // Deploy VaultController (required for proper vault operation)
    const VaultControllerFactory = await ethers.getContractFactory("VaultController");
    vaultController = await VaultControllerFactory.deploy();

    // Deploy ShXRPVault
    const ShXRPVaultFactory = await ethers.getContractFactory("ShXRPVault");
    vault = await ShXRPVaultFactory.deploy(
      await fxrpToken.getAddress(),
      "Shield XRP",
      "shXRP"
    );

    // Grant operator role
    const OPERATOR_ROLE = await vaultController.OPERATOR_ROLE();
    await vaultController.grantRole(OPERATOR_ROLE, operator.address);

    // Register vault with controller
    await vaultController.registerVault(await vault.getAddress());

    // Add owner as operator in vault (needed for strategy management)
    await vault.addOperator(owner.address);

    // Deploy mock strategies
    const MockStrategy = await ethers.getContractFactory("MockStrategy");
    mockStrategy1 = await MockStrategy.deploy(await fxrpToken.getAddress(), "Mock Strategy 1");
    mockStrategy2 = await MockStrategy.deploy(await fxrpToken.getAddress(), "Mock Strategy 2");

    // Mint FXRP to users and strategies for testing (6 decimals)
    await fxrpToken.mint(user1.address, ethers.parseUnits("10000", 6));
    await fxrpToken.mint(user2.address, ethers.parseUnits("10000", 6));
    await fxrpToken.mint(await mockStrategy1.getAddress(), ethers.parseUnits("5000", 6));
    await fxrpToken.mint(await mockStrategy2.getAddress(), ethers.parseUnits("5000", 6));
  });

  describe("Strategy Management", function () {
    it("Should add strategy with correct parameters", async function () {
      await vault.addStrategy(
        await mockStrategy1.getAddress(),
        5000 // 50% target
      );

      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.targetBps).to.equal(5000);
      expect(info.totalDeployed).to.equal(0);
      expect(info.status).to.equal(0); // Inactive
    });

    it("Should reject duplicate strategy addresses", async function () {
      await vault.addStrategy(await mockStrategy1.getAddress(), 5000);
      
      await expect(
        vault.addStrategy(await mockStrategy1.getAddress(), 3000)
      ).to.be.revertedWith("Strategy already exists");
    });

    it("Should enforce aggregate target validation (max 100%)", async function () {
      await vault.addStrategy(await mockStrategy1.getAddress(), 6000); // 60%
      
      // Adding 50% should fail (total would be 110% with 10% buffer)
      await expect(
        vault.addStrategy(await mockStrategy2.getAddress(), 5000)
      ).to.be.revertedWith("Total targets exceed 100%");
    });

    it("Should allow updating strategy target within limits", async function () {
      await vault.addStrategy(await mockStrategy1.getAddress(), 4000); // 40%
      await vault.addStrategy(await mockStrategy2.getAddress(), 4000); // 40%

      // Update strategy 1 to 5000 bps (50%) - total 90% + 10% buffer = 100%
      await vault.updateAllocation(await mockStrategy1.getAddress(), 5000);
      
      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.targetBps).to.equal(5000);
    });

    it("Should reject target updates that exceed 100%", async function () {
      await vault.addStrategy(await mockStrategy1.getAddress(), 4000); // 40%
      await vault.addStrategy(await mockStrategy2.getAddress(), 5000); // 50%

      // Trying to increase strategy 1 to 60% (total 110% with buffer) should fail
      await expect(
        vault.updateAllocation(await mockStrategy1.getAddress(), 6000)
      ).to.be.revertedWith("Total targets exceed 100%");
    });
  });

  describe("Deploy to Strategy (Pull-Based)", function () {
    beforeEach(async function () {
      // User deposits into vault
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      // Add and activate strategy
      await vault.addStrategy(await mockStrategy1.getAddress(), 5000);
      await vault.activateStrategy(await mockStrategy1.getAddress());
    });

    it("Should deploy funds using pull-based pattern", async function () {
      const deployAmount = ethers.parseUnits("500", 6);
      
      // Vault approves strategy and deploys (approval handled internally)
      await vault.deployToStrategy(await mockStrategy1.getAddress(), deployAmount);
      
      // Verify strategy received funds
      const strategyBalance = await fxrpToken.balanceOf(await mockStrategy1.getAddress());
      expect(strategyBalance).to.be.gte(deployAmount);
      
      // Verify tracking updated
      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.totalDeployed).to.equal(deployAmount);
    });

    it("Should prevent deploying more than vault buffer", async function () {
      const tooMuch = ethers.parseUnits("2000", 6); // More than vault has
      
      await expect(
        vault.deployToStrategy(await mockStrategy1.getAddress(), tooMuch)
      ).to.be.revertedWith("Insufficient vault balance");
    });

    it("Should handle multiple deployments correctly", async function () {
      const deploy1 = ethers.parseUnits("300", 6);
      const deploy2 = ethers.parseUnits("200", 6);
      
      await vault.deployToStrategy(await mockStrategy1.getAddress(), deploy1);
      await vault.deployToStrategy(await mockStrategy1.getAddress(), deploy2);
      
      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.totalDeployed).to.equal(deploy1 + deploy2);
    });
  });

  describe("Buffer-Aware Withdrawals - Edge Cases", function () {
    beforeEach(async function () {
      // User deposits 1000 FXRP
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      // Add and activate two strategies with equal targets
      await vault.addStrategy(await mockStrategy1.getAddress(), 4000); // 40%
      await vault.addStrategy(await mockStrategy2.getAddress(), 4000); // 40%
      await vault.activateStrategy(await mockStrategy1.getAddress());
      await vault.activateStrategy(await mockStrategy2.getAddress());
    });

    it("Should withdraw from buffer when sufficient (instant)", async function () {
      const withdrawAmount = ethers.parseUnits("100", 6);
      
      const balanceBefore = await fxrpToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      const balanceAfter = await fxrpToken.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });

    it("Should handle ODD withdrawal amounts without rounding loss", async function () {
      // Deploy to both strategies equally
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("400", 6));
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("400", 6));
      
      // Buffer now has 200 FXRP, strategies have 800 FXRP total
      
      // Withdraw 291 FXRP (odd number that causes rounding)
      // Shortfall: 291 - 200 = 91
      // Strategy 1 (50%): should get ~45
      // Strategy 2 (50%): should get remainder ~46 (no loss!)
      const oddAmount = ethers.parseUnits("291", 6);
      
      const balanceBefore = await fxrpToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(oddAmount, user1.address, user1.address);
      const balanceAfter = await fxrpToken.balanceOf(user1.address);
      
      // User should receive EXACTLY 291 FXRP (no rounding loss)
      expect(balanceAfter - balanceBefore).to.equal(oddAmount);
    });

    it("Should handle strategy OVER-DELIVERY without underflow", async function () {
      // Deploy to strategy
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
      
      // Configure mock strategy to return MORE than requested (e.g., yield rebate)
      await mockStrategy1.setOverDeliveryAmount(ethers.parseUnits("10", 6));
      
      // Withdraw amount that triggers strategy pull
      const withdrawAmount = ethers.parseUnits("600", 6);
      
      // Should NOT underflow despite strategy returning more
      const balanceBefore = await fxrpToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      const balanceAfter = await fxrpToken.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });

    it("Should CAP requests at strategy totalDeployed", async function () {
      // Deploy small amount to strategy 1
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("100", 6));
      
      // Deploy larger amount to strategy 2
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("700", 6));
      
      // Buffer: 200, Strategy1: 100, Strategy2: 700
      
      // Withdraw 850 (shortfall 650)
      // Proportional would ask Strategy1 for (100/800)*650 = 81.25
      // But last strategy should get remainder, which would be 650 - 81 = 569
      // This should be capped at 700 (strategy2's totalDeployed)
      const withdrawAmount = ethers.parseUnits("850", 6);
      
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      
      // Both strategies should have been drained appropriately
      const info1 = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      const info2 = await vault.getStrategyInfo(await mockStrategy2.getAddress());
      
      expect(info1.totalDeployed).to.be.lte(ethers.parseUnits("100", 6));
      expect(info2.totalDeployed).to.be.lte(ethers.parseUnits("700", 6));
    });

    it("Should handle STRATEGY FAILURE gracefully (partial success)", async function () {
      // Deploy to both strategies
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("400", 6));
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("400", 6));
      
      // Configure strategy 1 to fail withdrawals
      await mockStrategy1.setShouldFailWithdraw(true);
      
      // Withdraw amount that requires both strategies
      // Shortfall calculation: 600 - 200 buffer = 400 needed from strategies
      // Strategy 1 fails, so only strategy 2 can provide
      const withdrawAmount = ethers.parseUnits("600", 6);
      
      // Should pull from strategy 2 despite strategy 1 failure
      const balanceBefore = await fxrpToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      const balanceAfter = await fxrpToken.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });

    it("Should REVERT when aggregate liquidity insufficient", async function () {
      // Deploy ALL funds to strategies
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("500", 6));
      
      // Buffer: 0, Strategies: 1000
      
      // Configure both strategies to fail
      await mockStrategy1.setShouldFailWithdraw(true);
      await mockStrategy2.setShouldFailWithdraw(true);
      
      // Try to withdraw - should revert
      await expect(
        vault.connect(user1).withdraw(ethers.parseUnits("100", 6), user1.address, user1.address)
      ).to.be.revertedWith("Insufficient liquidity in vault and strategies");
    });

    it("Should handle PROPORTIONAL withdrawal from multiple strategies", async function () {
      // Deploy to both strategies
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("300", 6)); // 37.5% of deployed
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("500", 6)); // 62.5% of deployed
      
      // Buffer: 200, Strategy1: 300, Strategy2: 500
      // Total deployed: 800
      
      // Withdraw 600 (shortfall 400)
      // Strategy 1 should provide: (300/800)*400 = 150
      // Strategy 2 should provide: remainder = 250
      const withdrawAmount = ethers.parseUnits("600", 6);
      
      const strategy1Before = (await vault.getStrategyInfo(await mockStrategy1.getAddress())).totalDeployed;
      const strategy2Before = (await vault.getStrategyInfo(await mockStrategy2.getAddress())).totalDeployed;
      
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      
      const strategy1After = (await vault.getStrategyInfo(await mockStrategy1.getAddress())).totalDeployed;
      const strategy2After = (await vault.getStrategyInfo(await mockStrategy2.getAddress())).totalDeployed;
      
      const strategy1Withdrawn = strategy1Before - strategy1After;
      const strategy2Withdrawn = strategy2Before - strategy2After;
      
      // Verify total withdrawn equals shortfall
      expect(strategy1Withdrawn + strategy2Withdrawn).to.equal(ethers.parseUnits("400", 6));
      
      // Verify roughly proportional (within 1% due to rounding)
      const ratio = (strategy1Withdrawn * 10000n) / (strategy1Withdrawn + strategy2Withdrawn);
      expect(ratio).to.be.closeTo(3750n, 100n); // 37.5% ± 1%
    });

    it("Should handle ZERO buffer scenario", async function () {
      // Deploy ALL funds to strategies
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("500", 6));
      
      // Buffer: 0, must pull 100% from strategies
      const withdrawAmount = ethers.parseUnits("200", 6);
      
      const balanceBefore = await fxrpToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      const balanceAfter = await fxrpToken.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
    });
  });

  describe("TotalAssets with Multi-Strategy", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      await vault.addStrategy(await mockStrategy1.getAddress(), 4000);
      await vault.addStrategy(await mockStrategy2.getAddress(), 4000);
      await vault.activateStrategy(await mockStrategy1.getAddress());
      await vault.activateStrategy(await mockStrategy2.getAddress());
    });

    it("Should calculate totalAssets = buffer + all strategies", async function () {
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("300", 6));
      await vault.deployToStrategy(await mockStrategy2.getAddress(), ethers.parseUnits("200", 6));
      
      // Buffer: 500, Strategy1: 300, Strategy2: 200
      const totalAssets = await vault.totalAssets();
      expect(totalAssets).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should include strategy yield in totalAssets", async function () {
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
      
      // Simulate yield: strategy reports more assets
      await mockStrategy1.setYieldAmount(ethers.parseUnits("50", 6)); // 10% yield
      
      const totalAssets = await vault.totalAssets();
      expect(totalAssets).to.equal(ethers.parseUnits("1050", 6)); // 500 buffer + 550 strategy
    });
  });

  describe("Withdraw from Strategy (Manual)", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      await vault.addStrategy(await mockStrategy1.getAddress(), 5000);
      await vault.activateStrategy(await mockStrategy1.getAddress());
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
    });

    it("Should withdraw from strategy back to buffer", async function () {
      const withdrawAmount = ethers.parseUnits("200", 6);
      const bufferBefore = await fxrpToken.balanceOf(await vault.getAddress());
      
      await vault.withdrawFromStrategy(await mockStrategy1.getAddress(), withdrawAmount);
      
      const bufferAfter = await fxrpToken.balanceOf(await vault.getAddress());
      expect(bufferAfter - bufferBefore).to.equal(withdrawAmount);
      
      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.totalDeployed).to.equal(ethers.parseUnits("300", 6));
    });

    it("Should prevent withdrawing more than deployed", async function () {
      const tooMuch = ethers.parseUnits("600", 6); // More than deployed
      
      await expect(
        vault.withdrawFromStrategy(await mockStrategy1.getAddress(), tooMuch)
      ).to.be.revertedWith("Withdraw exceeds deployed");
    });
  });

  describe("Strategy Status Management", function () {
    beforeEach(async function () {
      await vault.addStrategy(await mockStrategy1.getAddress(), 5000);
    });

    it("Should activate, pause and resume strategy", async function () {
      // Start as Inactive (0)
      let info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.status).to.equal(0); // Inactive

      // Activate strategy
      await vault.activateStrategy(await mockStrategy1.getAddress());
      info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.status).to.equal(1); // Active

      // Pause strategy
      await vault.pauseStrategy(await mockStrategy1.getAddress());
      info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.status).to.equal(2); // Paused

      // Resume strategy
      await vault.resumeStrategy(await mockStrategy1.getAddress());
      info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.status).to.equal(1); // Active
    });

    it("Should prevent deploying to inactive or paused strategy", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      // Try to deploy to inactive strategy
      await expect(
        vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Strategy not active");

      // Activate then pause
      await vault.activateStrategy(await mockStrategy1.getAddress());
      await vault.pauseStrategy(await mockStrategy1.getAddress());
      
      // Try to deploy to paused strategy
      await expect(
        vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Strategy not active");
    });

    it("Should allow withdrawing from paused strategy", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);

      // Activate and deploy
      await vault.activateStrategy(await mockStrategy1.getAddress());
      await vault.deployToStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("500", 6));
      
      // Pause strategy
      await vault.pauseStrategy(await mockStrategy1.getAddress());
      
      // Should still be able to withdraw (for emergency recovery)
      await vault.withdrawFromStrategy(await mockStrategy1.getAddress(), ethers.parseUnits("100", 6));
      
      const info = await vault.getStrategyInfo(await mockStrategy1.getAddress());
      expect(info.totalDeployed).to.equal(ethers.parseUnits("400", 6));
    });
  });
});
