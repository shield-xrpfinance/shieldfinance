import { expect } from "chai";
import { ethers, network } from "hardhat";
import type { ShXRPVault } from "../../types/ethers-contracts";

describe("Firelight Integration (Mainnet Fork)", function () {
  before(function () {
    if (network.name !== "hardhat") {
      this.skip();
    }
  });

  it("Should integrate with Firelight vault on mainnet", async function () {
    this.skip();
  });
});
