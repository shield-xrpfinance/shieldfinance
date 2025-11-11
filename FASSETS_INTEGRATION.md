# FAssets Integration Guide

This document explains how to transition from demo mode to production mode with real FAssets integration.

## Demo Mode (Default)

By default, the bridge service runs in **demo mode** which simulates the entire FAssets bridging process without requiring real FAssets SDK integration. This is perfect for:
- Testing the UI/UX flow
- Development and debugging
- Demonstrations

### Demo Mode Behavior
- Automatically progresses through all 4 bridge steps with realistic delays
- Generates mock agent addresses and transaction hashes
- Marks all transactions with `DEMO-` prefix
- Completes bridges in 6-10 seconds

## Production Mode Setup

To enable real FAssets integration for production use:

### 1. Environment Variables

Add the following to your `.env` file or Replit Secrets:

```bash
# Required: Disable demo mode
DEMO_MODE=false

# Required: Operator private key (for executing minting transactions)
OPERATOR_PRIVATE_KEY=0x...  # Your operator wallet private key
```

**That's it!** AssetManager addresses are now automatically retrieved from the **Flare Contract Registry** at runtime, so you don't need to configure them manually.

### 2. Verify Contract Registry Lookup (Optional)

Run the helper script to verify that AssetManager addresses can be retrieved correctly:

```bash
npx tsx scripts/get-assetmanager-address.ts
```

This will show you:
- AssetManager address on Flare Mainnet
- AssetManager address on Coston2 Testnet  
- FXRP token addresses for both networks

The script verifies that the Contract Registry is accessible and returns valid addresses.

### 3. FAssets SDK Integration

The current implementation uses placeholder code for FAssets SDK integration. To integrate properly:

1. **Install FAssets SDK** (when available):
```bash
npm install @flarenetwork/fassets-sdk
```

2. **Update `server/utils/fassets-client.ts`**:
   - Replace placeholder code with actual FAssets SDK calls
   - Implement proper collateral reservation
   - Implement FDC proof generation
   - Implement minting execution

3. **Key Methods to Implement**:

```typescript
// Reserve collateral with an agent
async reserveCollateral(lots: number): Promise<ReservationResult> {
  // Use FAssets SDK to:
  // 1. Find available agent
  // 2. Reserve collateral for specified lots
  // 3. Return agent details and reservation ID
}

// Execute minting after payment received
async executeMinting(
  reservationId: string,
  xrplTxHash: string,
  fdcProof: string
): Promise<string> {
  // Use FAssets SDK to:
  // 1. Submit FDC proof
  // 2. Execute minting transaction
  // 3. Return Flare transaction hash
}
```

### 4. Bridge Flow in Production

When `DEMO_MODE=false`, the bridge follows this flow:

1. **Reserve Collateral** (Step 1)
   - Call FAssets SDK to reserve collateral
   - Store agent vault address and underlying payment address
   - Bridge status: `pending` → `awaiting_payment`

2. **User Sends Payment** (Step 2)
   - User sends XRP to agent's underlying address
   - XRPL listener detects payment
   - Bridge status: `awaiting_payment` → `xrpl_confirmed`

3. **Generate FDC Proof** (Step 3)
   - System generates Flare Data Connector proof
   - Proof verifies XRPL payment on Flare Network
   - Bridge status: `xrpl_confirmed` → `fdc_proof_generated`

4. **Execute Minting** (Step 4)
   - Submit proof to AssetManager contract
   - Receive FXRP tokens on Flare Network
   - Deposit FXRP into ShXRPVault
   - User receives shXRP vault shares
   - Bridge status: `fdc_proof_generated` → `completed`

## Testing Production Mode

### On Coston2 Testnet

1. Set environment variables:
```bash
DEMO_MODE=false
OPERATOR_PRIVATE_KEY=0x[your-test-key]
```

2. (Optional) Verify Contract Registry lookup:
```bash
npx tsx scripts/get-assetmanager-address.ts
```

3. Restart the application

4. Check that FAssetsClient initialized successfully:
```bash
# Server logs should show:
✅ Retrieved AssetManager from Contract Registry
   Network: coston2
   AssetManager: 0x...
✅ BridgeService initialized (PRODUCTION MODE)
```

5. Initiate a small test bridge (1-10 XRP)

6. Monitor logs for each step:
```bash
⏳ Executing FAssets collateral reservation...
✅ Collateral reserved with agent: 0x...
⏳ Waiting for XRP payment to agent address...
```

7. Send XRP to the provided agent address

8. Watch the bridge progress through all 4 steps

### Common Issues

#### Bridge Stuck at "Awaiting Payment"
- Verify you sent the exact amount to the correct agent address
- Check XRPL transaction was confirmed
- Ensure XRPL listener is running

#### "Failed to retrieve AssetManager address from Contract Registry"
- Check your internet connection and RPC endpoint accessibility
- Run `npx tsx scripts/get-assetmanager-address.ts` to diagnose the issue
- Verify you're connected to the correct Flare network (Mainnet vs Coston2)
- Check Flare Contract Registry status at https://dev.flare.network/

#### "FAssetsClient not initialized"
- Ensure `DEMO_MODE=false` is set
- Check `OPERATOR_PRIVATE_KEY` is configured
- Verify the operator wallet has sufficient FLR for transaction fees

## Security Considerations

⚠️ **IMPORTANT**: 
- Never commit private keys to version control
- Use Replit Secrets for all sensitive values
- Test thoroughly on Coston2 before mainnet deployment
- Monitor operator wallet balance for transaction fees
- Implement rate limiting for bridge requests

## Monitoring and Maintenance

### Recommended Monitoring
1. Bridge success/failure rates
2. Average bridge completion time
3. Operator wallet balance
4. Agent collateral availability
5. Failed FDC proofs

### Maintenance Tasks
- Monitor operator wallet balance
- Track agent performance
- Update FAssets SDK to latest version
- Review and optimize gas costs

## Support

For FAssets SDK documentation and support:
- [Flare Network Documentation](https://docs.flare.network/)
- [FAssets GitHub](https://github.com/flare-foundation/fassets)
- [Flare Discord](https://discord.com/invite/flarenetwork)
