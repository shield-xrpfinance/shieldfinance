import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FlareContractsModule = buildModule("FlareContractsModule", (m) => {
  // Get treasury address from environment or use deployer
  const treasuryAddress = m.getParameter(
    "treasuryAddress",
    process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000"
  );

  // Deploy ShieldToken
  const shieldToken = m.contract("ShieldToken", [treasuryAddress]);

  // Deploy ShXRPVault (shXRP)
  const shXRPVault = m.contract("ShXRPVault");

  return { shieldToken, shXRPVault };
});

export default FlareContractsModule;
