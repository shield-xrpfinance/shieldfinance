import { expect } from "chai";
import { network } from "hardhat";
import type { ShXRPVault, VaultController, MockERC20 } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ShXRPVault (ERC-4626)", function () {
  let vault: ShXRPVault;
  let vaultController: VaultController;
  let fxrpToken: MockERC20;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let ethers: any;

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy mock FXRP token (ERC-20)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    fxrpToken = await MockERC20.deploy("Flare XRP", "FXRP", 18);

    // Deploy VaultController
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

    // Register vault
    await vaultController.registerVault(await vault.getAddress());

    // Mint FXRP to users for testing
    await fxrpToken.mint(user1.address, ethers.parseEther("1000"));
    await fxrpToken.mint(user2.address, ethers.parseEther("1000"));
  });

  describe("ERC-4626 Standard Compliance", function () {
    it("Should have correct name and symbol", async function () {
      expect(await vault.name()).to.equal("Shield XRP");
      expect(await vault.symbol()).to.equal("shXRP");
    });

    it("Should have FXRP as underlying asset", async function () {
      expect(await vault.asset()).to.equal(await fxrpToken.getAddress());
    });

    it("Should start with 1:1 exchange rate", async function () {
      const assets = ethers.parseEther("100");
      const shares = await vault.convertToShares(assets);
      expect(shares).to.equal(assets);
    });

    it("Should allow deposits and mint shares", async function () {
      const depositAmount = ethers.parseEther("100");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);
      
      expect(await vault.balanceOf(user1.address)).to.equal(depositAmount);
      expect(await vault.totalAssets()).to.equal(depositAmount);
    });

    it("Should allow withdrawals and burn shares", async function () {
      const depositAmount = ethers.parseEther("100");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);
      
      const withdrawAmount = ethers.parseEther("50");
      await vault.connect(user1).withdraw(withdrawAmount, user1.address, user1.address);
      
      expect(await vault.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
      expect(await fxrpToken.balanceOf(user1.address)).to.equal(ethers.parseEther("950"));
    });

    it("Should handle multiple depositors correctly", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), amount1);
      await vault.connect(user1).deposit(amount1, user1.address);
      
      await fxrpToken.connect(user2).approve(await vault.getAddress(), amount2);
      await vault.connect(user2).deposit(amount2, user2.address);
      
      expect(await vault.totalAssets()).to.equal(ethers.parseEther("300"));
      expect(await vault.balanceOf(user1.address)).to.equal(amount1);
      expect(await vault.balanceOf(user2.address)).to.equal(amount2);
    });
  });

  describe("Firelight Integration", function () {
    it("Should return correct totalAssets including Firelight positions", async function () {
      const depositAmount = ethers.parseEther("100");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      await vault.connect(user1).deposit(depositAmount, user1.address);
      
      const totalAssets = await vault.totalAssets();
      expect(totalAssets).to.equal(depositAmount);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to update Firelight vault address", async function () {
      const newFirelightAddress = "0x1234567890123456789012345678901234567890";
      await vault.setFirelightVault(newFirelightAddress);
      expect(await vault.firelightVault()).to.equal(newFirelightAddress);
    });

    it("Should reject non-owner Firelight vault updates", async function () {
      const newFirelightAddress = "0x1234567890123456789012345678901234567890";
      await expect(
        vault.connect(user1).setFirelightVault(newFirelightAddress)
      ).to.be.reverted;
    });
  });

  describe("Minimum Deposit", function () {
    it("Should enforce minimum deposit amount", async function () {
      const tooSmall = ethers.parseEther("0.001");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), tooSmall);
      await expect(
        vault.connect(user1).deposit(tooSmall, user1.address)
      ).to.be.revertedWith("Below minimum deposit");
    });

    it("Should accept deposits above minimum", async function () {
      const validAmount = ethers.parseEther("0.02");
      
      await fxrpToken.connect(user1).approve(await vault.getAddress(), validAmount);
      await vault.connect(user1).deposit(validAmount, user1.address);
      
      expect(await vault.balanceOf(user1.address)).to.equal(validAmount);
    });
  });
});
