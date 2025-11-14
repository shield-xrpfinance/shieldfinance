import { expect } from "chai";
import { network } from "hardhat";
import type { VaultController } from "../types/ethers-contracts";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VaultController", function () {
  let controller: VaultController;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let compounder: SignerWithAddress;
  let user: SignerWithAddress;
  let ethers: any;

  before(async function () {
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  beforeEach(async function () {
    [owner, operator, compounder, user] = await ethers.getSigners();

    const VaultControllerFactory = await ethers.getContractFactory("VaultController");
    controller = await VaultControllerFactory.deploy();
  });

  describe("Role Management", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await controller.DEFAULT_ADMIN_ROLE();
      expect(await controller.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should allow admin to add operators", async function () {
      await controller.addOperator(operator.address);
      const OPERATOR_ROLE = await controller.OPERATOR_ROLE();
      expect(await controller.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
    });

    it("Should allow admin to add compounders", async function () {
      await controller.addCompounder(compounder.address);
      const COMPOUNDER_ROLE = await controller.COMPOUNDER_ROLE();
      expect(await controller.hasRole(COMPOUNDER_ROLE, compounder.address)).to.be.true;
    });

    it("Should reject non-admin from adding operators", async function () {
      await expect(
        controller.connect(user).addOperator(operator.address)
      ).to.be.reverted;
    });
  });

  describe("Vault Registration", function () {
    it("Should allow admin to register vaults", async function () {
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      await controller.registerVault(vaultAddress);
      expect(await controller.registeredVaults(vaultAddress)).to.be.true;
    });

    it("Should reject duplicate vault registration", async function () {
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      await controller.registerVault(vaultAddress);
      await expect(
        controller.registerVault(vaultAddress)
      ).to.be.revertedWith("Vault already registered");
    });

    it("Should allow admin to deregister vaults", async function () {
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      await controller.registerVault(vaultAddress);
      await controller.deregisterVault(vaultAddress);
      expect(await controller.registeredVaults(vaultAddress)).to.be.false;
    });
  });

  describe("Bridge Request Management", function () {
    beforeEach(async function () {
      await controller.addOperator(operator.address);
    });

    it("Should allow operators to create bridge requests", async function () {
      const userAddress = user.address;
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      const xrpAmount = ethers.parseEther("100");
      const xrplTxHash = "ABC123";

      const requestId = await controller.connect(operator).createBridgeRequest.staticCall(
        userAddress,
        vaultAddress,
        xrpAmount,
        xrplTxHash
      );

      await controller.connect(operator).createBridgeRequest(
        userAddress,
        vaultAddress,
        xrpAmount,
        xrplTxHash
      );

      const request = await controller.getBridgeRequest(requestId);
      expect(request.user).to.equal(userAddress);
      expect(request.xrpAmount).to.equal(xrpAmount);
      expect(request.status).to.equal(0);
    });

    it("Should allow operators to update bridge status", async function () {
      const userAddress = user.address;
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      const xrpAmount = ethers.parseEther("100");
      const xrplTxHash = "ABC123";

      const requestId = await controller.connect(operator).createBridgeRequest.staticCall(
        userAddress,
        vaultAddress,
        xrpAmount,
        xrplTxHash
      );

      await controller.connect(operator).createBridgeRequest(
        userAddress,
        vaultAddress,
        xrpAmount,
        xrplTxHash
      );

      await controller.connect(operator).updateBridgeStatus(
        requestId,
        4,
        "0xFLARE123"
      );

      const request = await controller.getBridgeRequest(requestId);
      expect(request.status).to.equal(4);
      expect(request.flareTxHash).to.equal("0xFLARE123");
    });

    it("Should reject non-operators from creating bridge requests", async function () {
      await expect(
        controller.connect(user).createBridgeRequest(
          user.address,
          "0x1234567890123456789012345678901234567890",
          ethers.parseEther("100"),
          "ABC123"
        )
      ).to.be.reverted;
    });
  });

  describe("Compounding", function () {
    beforeEach(async function () {
      await controller.addCompounder(compounder.address);
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      await controller.registerVault(vaultAddress);
    });

    it("Should allow compounders to execute compound", async function () {
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      await controller.connect(compounder).executeCompound(vaultAddress);
      
      const lastCompound = await controller.lastCompoundTime(vaultAddress);
      expect(lastCompound).to.be.gt(0);
    });

    it("Should enforce minimum compound interval", async function () {
      const vaultAddress = "0x1234567890123456789012345678901234567890";
      
      await controller.connect(compounder).executeCompound(vaultAddress);
      
      await expect(
        controller.connect(compounder).executeCompound(vaultAddress)
      ).to.be.revertedWith("Compound interval not reached");
    });

    it("Should allow admin to update compound interval", async function () {
      const newInterval = 7200;
      await controller.setMinCompoundInterval(newInterval);
      expect(await controller.minCompoundInterval()).to.equal(newInterval);
    });
  });
});
