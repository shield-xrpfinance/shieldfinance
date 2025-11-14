import { expect } from "chai";
import { network } from "hardhat";
import type { ShXRPVault } from "../../types/ethers-contracts";

describe("Firelight Integration (Mainnet Fork)", function () {
  let ethers: any;

  before(async function () {
    if (network.name !== "hardhat") {
      this.skip();
    }
    const hre = await network.connect({ network: "hardhat" });
    ethers = hre.ethers;
  });

  it("Should integrate with Firelight vault on mainnet", async function () {
    this.skip();
  });
});
