# FAssets Integration Guide

## Overview

This guide provides detailed instructions for integrating the FAssets protocol to enable real XRP → FXRP bridging in the ShieldXRP liquid staking platform.

**Current Status:** Demo mode enabled (simulated bridging)  
**Target:** Production FAssets SDK integration

## What is FAssets?

FAssets is a trustless, over-collateralized bridge connecting non-smart contract networks (like XRPL) to Flare Network. It enables wrapped tokens (FXRP) that can participate in DeFi while being redeemable for their original assets.

**Key Features:**
- Over-collateralized by agents (stablecoin/ETH + FLR collateral)
- Verified by Flare Data Connector (FDC) - proof of XRPL transactions
- Decentralized price feeds via FTSO (Flare Time Series Oracle)

## Architecture

```
User deposits XRP → Agent holds XRP → FDC verifies → FXRP minted on Flare
```

### Key Participants

1. **Agents** - Manage infrastructure, hold underlying XRP, provide collateral
2. **Users (Minters)** - Deposit XRP to mint FXRP
3. **AssetManager Contract** - Orchestrates minting/redemption on Flare
4. **FDC (Flare Data Connector)** - Verifies XRPL transactions

## Integration Steps

### Phase 1: Install FAssets SDK

**Option A: NPM Package (Recommended)**
```bash
npm install @flarenetwork/flare-periphery-contracts
```

**Option B: Clone Repository**
```bash
git clone https://github.com/flare-foundation/fassets
cd fassets
yarn install
```

### Phase 2: Update BridgeService

Replace the demo implementation in `server/services/BridgeService.ts` with real FAssets integration:

#### 2.1 Import FAssets Contracts

```typescript
import { ethers } from "ethers";
import type { IAssetManager } from "@flarenetwork/flare-periphery-contracts/typechain-types";

// Import ABI (adjust path based on installation method)
import AssetManagerABI from "@flarenetwork/flare-periphery-contracts/artifacts/contracts/interfaces/IAssetManager.sol/IAssetManager.json";
```

#### 2.2 Get AssetManager Contract

```typescript
private async getAssetManager(): Promise<IAssetManager> {
  // AssetManager contract address for FXRP
  // Coston2: Get from Flare Contract Registry
  // Mainnet: Get from Flare Contract Registry
  
  const assetManagerAddress = this.config.network === "mainnet"
    ? "0x..." // TODO: Get from registry
    : "0x..."; // TODO: Get from registry
  
  const contract = new ethers.Contract(
    assetManagerAddress,
    AssetManagerABI.abi,
    this.config.flareClient.provider
  ) as unknown as IAssetManager;
  
  return contract;
}
```

#### 2.3 Implement Real Minting Flow

Replace `executeFAssetsMinting()` with:

```typescript
private async executeFAssetsMinting(bridge: SelectXrpToFxrpBridge): Promise<void> {
  console.log("⏳ Executing FAssets minting...");
  
  try {
    const assetManager = await this.getAssetManager();
    
    // Step 1: Find best agent with enough free collateral
    const agentVaultAddress = await this.findBestAgent(assetManager, 1); // 1 lot
    if (!agentVaultAddress) {
      throw new Error("No suitable agent found with enough free collateral");
    }
    
    // Step 2: Get agent info and calculate fees
    const agentInfo = await assetManager.getAgentInfo(agentVaultAddress);
    const lotsToMint = this.calculateLots(bridge.xrpAmount);
    const collateralReservationFee = await assetManager.collateralReservationFee(lotsToMint);
    
    // Step 3: Reserve collateral
    const reserveTx = await assetManager.reserveCollateral(
      agentVaultAddress,
      lotsToMint,
      agentInfo.feeBIPS,
      ethers.ZeroAddress, // No executor
      { value: collateralReservationFee }
    );
    
    const receipt = await reserveTx.wait();
    
    // Step 4: Parse CollateralReserved event
    const reservationEvent = this.parseCollateralReservedEvent(receipt);
    const { collateralReservationId, paymentAddress, valueUBA, feeUBA } = reservationEvent;
    
    // Step 5: Calculate total XRP payment needed
    const decimals = await assetManager.assetMintingDecimals();
    const totalUBA = BigInt(valueUBA) + BigInt(feeUBA);
    const totalXRP = Number(totalUBA) / (10 ** Number(decimals));
    
    // Step 6: Update bridge record with payment details
    await this.config.storage.updateBridge(bridge.id, {
      collateralReservationId: collateralReservationId.toString(),
      agentAddress: paymentAddress,
      fxrpExpected: (Number(valueUBA) / (10 ** Number(decimals))).toString(),
      mintingFee: (Number(feeUBA) / (10 ** Number(decimals))).toString(),
    });
    
    // Step 7: Wait for user to send XRP payment
    // This is handled by XRPLDepositListener which will detect the payment
    // and call executeMintingWithProof() below
    
    console.log(`✅ Collateral reserved. User needs to send ${totalXRP} XRP to ${paymentAddress}`);
    console.log(`   Payment reference: ${bridge.paymentReference}`);
    
  } catch (error) {
    console.error("FAssets minting error:", error);
    throw error;
  }
}
```

#### 2.4 Implement Minting Execution (After Payment Proof)

Add new method to execute minting after XRP payment is verified:

```typescript
async executeMintingWithProof(
  bridgeId: string,
  xrplTxHash: string
): Promise<void> {
  const bridge = await this.config.storage.getBridgeById(bridgeId);
  if (!bridge) throw new Error("Bridge not found");
  
  console.log("⏳ Executing minting with payment proof...");
  
  try {
    const assetManager = await this.getAssetManager();
    
    // Step 1: Generate FDC proof of XRPL payment
    const proof = await this.generateFDCProof(xrplTxHash);
    
    // Step 2: Execute minting with proof
    const mintTx = await assetManager.executeMinting(
      proof,
      bridge.collateralReservationId
    );
    
    const receipt = await mintTx.wait();
    
    // Step 3: Update bridge status
    await this.config.storage.updateBridgeStatus(bridgeId, "completed", {
      flareTxHash: receipt.hash,
      fxrpReceived: bridge.fxrpExpected,
      fxrpReceivedAt: new Date(),
      completedAt: new Date(),
    });
    
    console.log(`✅ Minting completed! FXRP received: ${bridge.fxrpExpected}`);
    
  } catch (error) {
    console.error("Minting execution error:", error);
    throw error;
  }
}
```

#### 2.5 Helper Methods

```typescript
// Find best agent with lowest fees
private async findBestAgent(
  assetManager: IAssetManager,
  minLotsRequired: number
): Promise<string | undefined> {
  // Get available agents (max 100)
  const { _agents: agents } = await assetManager.getAvailableAgentsDetailedList(0, 100);
  
  // Filter agents with enough free collateral lots
  const agentsWithLots = agents.filter(
    agent => Number(agent.freeCollateralLots) >= minLotsRequired
  );
  
  if (agentsWithLots.length === 0) return undefined;
  
  // Sort by lowest fee
  agentsWithLots.sort((a, b) => Number(a.feeBIPS) - Number(b.feeBIPS));
  
  // Find agent with lowest fee and NORMAL status (0)
  for (const agent of agentsWithLots) {
    const info = await assetManager.getAgentInfo(agent.agentVault);
    if (Number(info.status) === 0) { // NORMAL status
      return agent.agentVault;
    }
  }
  
  return undefined;
}

// Calculate lots needed for XRP amount
private calculateLots(xrpAmount: string): number {
  // 1 lot = typically 1 XRP for FXRP
  // Adjust based on actual lot size from assetManager.lotSize()
  return Math.ceil(parseFloat(xrpAmount));
}

// Parse CollateralReserved event from transaction receipt
private parseCollateralReservedEvent(receipt: any) {
  const iface = new ethers.Interface(AssetManagerABI.abi);
  
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "CollateralReserved") {
        return parsed.args;
      }
    } catch (e) {
      continue;
    }
  }
  
  throw new Error("CollateralReserved event not found");
}

// Generate FDC proof of XRPL payment
private async generateFDCProof(xrplTxHash: string): Promise<any> {
  // TODO: Integrate with Flare Data Connector
  // This requires calling FDC attestation provider
  // See: https://dev.flare.network/fdc/overview
  
  throw new Error("FDC proof generation not yet implemented");
}
```

### Phase 3: FDC Integration (Proof Generation)

The Flare Data Connector (FDC) is used to prove that an XRPL payment occurred.

**Integration Options:**

1. **Use Public Attestation Provider** (Recommended)
   - Flare provides public attestation providers
   - Submit XRPL transaction hash
   - Receive cryptographic proof

2. **Run Your Own Attestation Provider**
   - More control, higher reliability
   - Requires infrastructure setup
   - See: https://dev.flare.network/fdc/guides/attestation-client

**Basic Proof Request:**
```typescript
async function getFDCProof(xrplTxHash: string) {
  // Call public attestation provider
  const response = await fetch("https://attestation-coston.flare.network/verifier/xrp/Payment/prepareResponse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attestationType: "0x5061796d656e74", // "Payment" in hex
      sourceId: "0x...", // XRPL source ID
      requestBody: {
        transactionId: xrplTxHash,
        inUtxo: "0",
        utxo: "0"
      }
    })
  });
  
  return await response.json();
}
```

### Phase 4: Update Database Schema

Add fields to track FAssets-specific data:

```typescript
// In shared/schema.ts, update xrpToFxrpBridges table:

export const xrpToFxrpBridges = pgTable("xrp_to_fxrp_bridges", {
  // ... existing fields ...
  
  // FAssets-specific fields
  collateralReservationId: varchar("collateral_reservation_id"),
  agentVaultAddress: varchar("agent_vault_address"),
  agentUnderlyingAddress: varchar("agent_underlying_address"),
  mintingFee: varchar("minting_fee"),
  collateralReservationFee: varchar("collateral_reservation_fee"),
  fdcProofHash: varchar("fdc_proof_hash"),
  lastUnderlyingBlock: varchar("last_underlying_block"),
  lastUnderlyingTimestamp: timestamp("last_underlying_timestamp"),
});
```

### Phase 5: Testing

**Testnet Testing (Coston2):**
1. Get testnet FLR from faucet: https://faucet.flare.network/
2. Get testnet XRP from XRPL faucet: https://xrpl.org/xrp-testnet-faucet.html
3. Test full minting flow
4. Monitor transactions on Coston2 explorer

**Production Checklist:**
- [ ] Set `demoMode: false` in BridgeService
- [ ] Configure mainnet AssetManager contract address
- [ ] Set up FDC attestation provider
- [ ] Test with small amounts first
- [ ] Monitor agent collateral levels
- [ ] Set up error handling and retry logic

## Contract Addresses

### Coston2 Testnet
- **FXRP Token:** `0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3`
- **AssetManager:** Get from Flare Contract Registry

### Flare Mainnet
- **FXRP Token:** `0xAf7278D382323A865734f93B687b300005B8b60E`
- **AssetManager:** Get from Flare Contract Registry

## Resources

- **Documentation:** https://dev.flare.network/fassets/overview/
- **GitHub Repository:** https://github.com/flare-foundation/fassets
- **Minting Guide:** https://dev.flare.network/fassets/developer-guides/fassets-mint
- **FDC Overview:** https://dev.flare.network/fdc/overview
- **Discord Support:** https://discord.com/invite/flarenetwork

## Common Issues

### 1. "No suitable agent found"
**Cause:** All agents are at capacity or in non-normal status  
**Solution:** Wait for agent availability or increase search limit

### 2. "Payment proof generation failed"
**Cause:** XRPL transaction not confirmed or FDC provider issue  
**Solution:** Wait for XRPL confirmation (5+ ledgers), check FDC provider status

### 3. "Collateral reservation expired"
**Cause:** User didn't send XRP within required timeframe  
**Solution:** Start new reservation, ensure payment is sent quickly

### 4. "Minting execution reverted"
**Cause:** Invalid proof or reservation already used  
**Solution:** Verify proof validity, check reservation hasn't expired

## Timeline

- **Now:** Demo mode enabled for Coston2 testing
- **December 2025:** Flare Smart Accounts available (simplifies user flow)
- **Q1 2026:** Production FAssets integration complete
- **Q1 2026:** Mainnet deployment

## Next Steps

1. Deploy contracts to Coston2 testnet
2. Test full deposit flow in demo mode
3. Integrate FAssets SDK when ready
4. Set up FDC attestation provider
5. Test on Coston2 with real FAssets minting
6. Deploy to Flare mainnet after successful testnet validation
