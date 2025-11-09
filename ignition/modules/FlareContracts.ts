import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FlareContractsModule = buildModule("FlareContractsModule", (m) => {
  // Get treasury address from environment or use deployer
  const treasuryAddress = m.getParameter(
    "treasuryAddress",
    process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000"
  );

  // Deploy ShieldToken
  const shieldToken = m.contract("ShieldToken", [treasuryAddress]);

  // Deploy StXRPVault
  const stXRPVault = m.contract("StXRPVault");

  return { shieldToken, stXRPVault };
});

export default FlareContractsModule;
