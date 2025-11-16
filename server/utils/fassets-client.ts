import { ethers } from "ethers";
import { nameToAddress } from "@flarenetwork/flare-periphery-contract-artifacts";
import { readFileSync } from "fs";
import { join } from "path";
import type { FlareClient } from "./flare-client";

export interface FAssetsConfig {
  network: "mainnet" | "coston2";
  flareClient: FlareClient;
}

export interface AgentInfo {
  vaultAddress: string;
  underlyingAddress: string;
  feeBIPS: bigint;
  freeCollateralLots: bigint;
  status: bigint;
}

export interface CollateralReservation {
  reservationId: bigint;
  reservationTxHash: string;
  agentVault: string;
  agentUnderlyingAddress: string;
  paymentReference: string;  // Hex payment reference for XRPL memo
  feeBIPS: bigint;  // Agent's fee in basis points (e.g., 100 = 1%)
  valueUBA: bigint;
  feeUBA: bigint;   // Calculated fee amount in underlying base amount
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
}

export class FAssetsClient {
  private config: FAssetsConfig;
  private assetManagerAddress: string | null = null;
  private assetManagerABI: any = null;

  constructor(config: FAssetsConfig) {
    this.config = config;
    console.log(`FAssetsClient initializing for ${config.network}...`);
  }

  /**
   * Load AssetManager ABI (cached for reuse)
   * Uses fs.readFileSync for reliable JSON loading in Node.js environment
   */
  private getAssetManagerABI(): any {
    if (this.assetManagerABI) {
      return this.assetManagerABI;
    }

    try {
      // Use network-specific artifact path from flare-periphery-contract-artifacts package
      // The package has separate folders for each network: coston2, flare, etc.
      const networkFolder = this.config.network === "mainnet" ? "flare" : "coston2";
      const artifactPath = join(
        process.cwd(),
        "node_modules",
        "@flarenetwork",
        "flare-periphery-contract-artifacts",
        networkFolder,
        "artifacts",
        "contracts",
        "IAssetManager.sol",
        "IAssetManager.json"
      );
      
      // Read JSON file directly using fs.readFileSync (works reliably in Node.js)
      const abiJson = readFileSync(artifactPath, "utf8");
      this.assetManagerABI = JSON.parse(abiJson);
      
      console.log(`✅ Loaded AssetManager ABI for ${this.config.network}`);
      return this.assetManagerABI;
    } catch (error) {
      console.error(`Failed to load AssetManager ABI for ${this.config.network}:`, error);
      throw new Error(`Failed to load AssetManager ABI for network ${this.config.network}`);
    }
  }

  /**
   * Get AssetManager address from Flare Contract Registry
   * Uses the official nameToAddress() helper from @flarenetwork/flare-periphery-contract-artifacts
   */
  private async getAssetManagerAddress(): Promise<string> {
    if (this.assetManagerAddress) {
      return this.assetManagerAddress;
    }

    try {
      // Use official helper to get AssetManager address from Flare Contract Registry
      // Registry key is "AssetManagerFXRP" (verified via scripts/get-assetmanager-address.ts)
      const networkName = this.config.network === "mainnet" ? "flare" : "coston2";
      const address = await nameToAddress(
        "AssetManagerFXRP",
        networkName,
        this.config.flareClient.provider
      );
      
      // Validate that we got a real address, not the zero address
      if (!address || address === ethers.ZeroAddress) {
        throw new Error(
          `Contract Registry returned zero address for "AssetManagerFXRP" on ${this.config.network}. ` +
          `This means AssetManager is not deployed or the registry is misconfigured.`
        );
      }
      
      this.assetManagerAddress = address;
      
      console.log(`✅ Retrieved AssetManager from Contract Registry`);
      console.log(`   Network: ${this.config.network}`);
      console.log(`   Registry Key: "AssetManagerFXRP"`);
      console.log(`   AssetManager: ${address}`);
      
      return address;
    } catch (error) {
      console.error("Failed to get AssetManager from Contract Registry:", error);
      throw new Error(
        `Failed to retrieve AssetManager address from Flare Contract Registry for ${this.config.network}. ` +
        `Ensure you're connected to the correct network and the Contract Registry is accessible.`
      );
    }
  }

  private async getAssetManager(): Promise<ethers.Contract> {
    const assetManagerAddress = await this.getAssetManagerAddress();
    const AssetManagerABI = this.getAssetManagerABI();
    
    // Get signer - works with both EOA and smart account modes
    const signer = this.config.flareClient.getContractSigner();
    
    // The ABI file is directly an array, not an object with an 'abi' property
    const contract = new ethers.Contract(
      assetManagerAddress,
      AssetManagerABI,
      signer
    );
    
    console.log(`AssetManager contract created at ${assetManagerAddress}`);
    console.log(`Contract has reserveCollateral method: ${typeof contract.reserveCollateral === 'function'}`);
    
    return contract;
  }

  async findBestAgent(lotsRequired: number): Promise<AgentInfo | null> {
    const assetManager = await this.getAssetManager();
    
    const { _agents: agents } = await assetManager.getAvailableAgentsDetailedList(0, 100);
    
    const agentsWithLots = agents.filter(
      (agent: any) => Number(agent.freeCollateralLots) >= lotsRequired
    );
    
    if (agentsWithLots.length === 0) {
      return null;
    }
    
    agentsWithLots.sort((a: any, b: any) => Number(a.feeBIPS) - Number(b.feeBIPS));
    
    for (const agent of agentsWithLots) {
      const info = await assetManager.getAgentInfo(agent.agentVault);
      
      if (Number(info.status) === 0) {
        return {
          vaultAddress: agent.agentVault,
          underlyingAddress: info.underlyingAddress,
          feeBIPS: info.feeBIPS,
          freeCollateralLots: agent.freeCollateralLots,
          status: info.status,
        };
      }
    }
    
    return null;
  }

  async reserveCollateral(
    lotsToMint: number
  ): Promise<CollateralReservation> {
    const assetManager = await this.getAssetManager();
    
    const agent = await this.findBestAgent(lotsToMint);
    if (!agent) {
      throw new Error("No suitable agent found with enough free collateral");
    }
    
    console.log(`Selected agent: ${agent.vaultAddress}`);
    console.log(`  Fee: ${agent.feeBIPS} BIPS`);
    console.log(`  Free lots: ${agent.freeCollateralLots}`);
    
    const collateralReservationFee = await assetManager.collateralReservationFee(lotsToMint);
    console.log(`Collateral reservation fee: ${ethers.formatEther(collateralReservationFee)} FLR`);
    
    // Log parameters before calling
    console.log('\n🔍 Calling reserveCollateral with parameters:');
    console.log(`  agentVault: ${agent.vaultAddress} (type: ${typeof agent.vaultAddress})`);
    console.log(`  lots: ${lotsToMint} (type: ${typeof lotsToMint})`);
    console.log(`  maxMintingFeeBIPS: ${agent.feeBIPS} (type: ${typeof agent.feeBIPS})`);
    console.log(`  executor: ${ethers.ZeroAddress} (type: ${typeof ethers.ZeroAddress})`);
    console.log(`  value: ${collateralReservationFee} (${ethers.formatEther(collateralReservationFee)} FLR)`);
    
    // Ensure all parameters are correct types - feeBIPS might be BigInt from contract
    const maxMintingFeeBIPS = typeof agent.feeBIPS === 'bigint' 
      ? agent.feeBIPS 
      : BigInt(agent.feeBIPS);
    
    console.log(`  maxMintingFeeBIPS (converted): ${maxMintingFeeBIPS} (type: ${typeof maxMintingFeeBIPS})`);
    
    // Try to simulate the transaction first to get better error messages
    try {
      await assetManager.reserveCollateral.staticCall(
        agent.vaultAddress,
        lotsToMint,
        maxMintingFeeBIPS,
        ethers.ZeroAddress,
        { value: collateralReservationFee }
      );
      console.log('✅ Static call succeeded - transaction should work');
    } catch (staticError: any) {
      console.error('❌ Static call failed - transaction will likely revert:');
      console.error('  Reason:', staticError.message);
      console.error('  Code:', staticError.code);
      if (staticError.data) {
        console.error('  Data:', staticError.data);
      }
      throw new Error(`Contract will reject transaction: ${staticError.message}`);
    }
    
    const tx = await assetManager.reserveCollateral(
      agent.vaultAddress,
      lotsToMint,
      maxMintingFeeBIPS,
      ethers.ZeroAddress,
      { value: collateralReservationFee }
    );
    
    console.log(`✅ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Collateral reserved: ${receipt.hash}`);
    
    const reservationEvent = this.parseCollateralReservedEvent(receipt);
    
    // Convert paymentReference from bytes32 to hex string (remove 0x prefix for XRPL memo)
    const paymentReference = reservationEvent.paymentReference.replace(/^0x/, '');
    
    // Validate payment reference is not empty, zero hash, or malformed
    const isZeroHash = /^0+$/.test(paymentReference) || paymentReference === '';
    const isValidLength = paymentReference.length === 64; // bytes32 = 64 hex chars
    const isValidHex = /^[0-9a-fA-F]+$/.test(paymentReference);
    
    if (isZeroHash) {
      throw new Error(
        `Invalid payment reference from CollateralReserved event: zero hash. ` +
        `This indicates the FAssets contract did not generate a valid reference.`
      );
    }
    
    if (!isValidLength || !isValidHex) {
      throw new Error(
        `Malformed payment reference from CollateralReserved event: "${paymentReference}" ` +
        `(expected 64 hex characters, got ${paymentReference.length} characters). ` +
        `This indicates corrupted contract data.`
      );
    }
    
    console.log('\n📝 Collateral Reservation Details:');
    console.log(`   Reservation ID: ${reservationEvent.collateralReservationId}`);
    console.log(`   Payment Reference: ${paymentReference}`);
    console.log(`   Payment Address: ${reservationEvent.paymentAddress}`);
    console.log(`   Value UBA: ${reservationEvent.valueUBA}`);
    console.log(`   Fee UBA: ${reservationEvent.feeUBA}`);
    console.log(`   Total to pay: ${BigInt(reservationEvent.valueUBA) + BigInt(reservationEvent.feeUBA)} UBA`);
    
    return {
      reservationId: reservationEvent.collateralReservationId,
      reservationTxHash: receipt.hash,
      agentVault: agent.vaultAddress,
      agentUnderlyingAddress: reservationEvent.paymentAddress,
      paymentReference,
      feeBIPS: agent.feeBIPS,  // Agent's fee rate in basis points
      valueUBA: reservationEvent.valueUBA,
      feeUBA: reservationEvent.feeUBA,  // Calculated fee amount
      lastUnderlyingBlock: reservationEvent.lastUnderlyingBlock,
      lastUnderlyingTimestamp: reservationEvent.lastUnderlyingTimestamp,
    };
  }

  async executeMinting(
    proof: any,
    reservationId: bigint
  ): Promise<string> {
    const assetManager = await this.getAssetManager();
    
    const tx = await assetManager.executeMinting(proof, reservationId);
    const receipt = await tx.wait();
    
    console.log(`Minting executed: ${receipt.hash}`);
    return receipt.hash;
  }

  async requestRedemption(
    fxrpAmount: string,
    receiverUnderlyingAddress: string
  ): Promise<{ requestId: bigint; txHash: string; firstUnderlyingBlock: bigint; lastUnderlyingBlock: bigint; lastUnderlyingTimestamp: bigint }> {
    const assetManager = await this.getAssetManager();
    
    // Calculate lots based on FXRP amount
    const lots = await this.calculateLots(fxrpAmount);
    
    console.log(`\n📝 Requesting redemption:`);
    console.log(`   FXRP Amount: ${fxrpAmount}`);
    console.log(`   Lots: ${lots}`);
    console.log(`   Receiver XRPL Address: ${receiverUnderlyingAddress}`);
    
    // Get FXRP token and approve AssetManager to burn it
    const fxrpToken = await this.config.flareClient.getFXRPToken() as any;
    const assetManagerAddress = await this.getAssetManagerAddress();
    const decimals = await this.getAssetDecimals();
    const fxrpAmountRaw = ethers.parseUnits(fxrpAmount, decimals);
    
    console.log(`   Approving AssetManager to burn ${fxrpAmount} FXRP...`);
    const approveTx = await fxrpToken.approve(assetManagerAddress, fxrpAmountRaw);
    await approveTx.wait();
    console.log(`   ✅ Approval granted`);
    
    // Request redemption by manually constructing calldata to bypass ALL ethers validation
    // CORRECT Function signature: redeem(uint256 _lots, string _redeemerUnderlyingAddressString, address payable _executor)
    console.log(`   Requesting redemption from AssetManager (manually constructing calldata)...`);
    
    try {
      // Get function selector for redeem(uint256,string,address)
      const functionSignature = 'redeem(uint256,string,address)';
      const functionSelector = ethers.id(functionSignature).slice(0, 10); // First 4 bytes (8 hex chars + 0x)
      
      // Manually encode parameters using defaultAbiCoder - bypasses type validation
      const encodedParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'string', 'address'],  // Types
        [lots, receiverUnderlyingAddress, ethers.ZeroAddress]  // Values
      );
      
      // Combine selector + encoded params
      const data = functionSelector + encodedParams.slice(2); // Remove 0x from encodedParams
      
      // Get signer and send raw transaction
      const signer = this.config.flareClient.getContractSigner();
      const tx = await signer.sendTransaction({
        to: await this.getAssetManagerAddress(),
        data: data,
      });
      
      console.log(`✅ Redemption transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null - transaction may have failed');
      }
      
      console.log(`✅ Redemption requested: ${receipt.hash}`);
      
      // Parse RedemptionRequested event
      const redemptionEvent = this.parseRedemptionRequestedEvent(receipt);
      
      console.log('\n📝 Redemption Request Details:');
      console.log(`   Request ID: ${redemptionEvent.requestId}`);
      console.log(`   Redeemer: ${redemptionEvent.redeemer}`);
      console.log(`   Receiver XRPL Address: ${redemptionEvent.receiverUnderlyingAddress}`);
      console.log(`   Amount (UBA): ${redemptionEvent.valueUBA}`);
      console.log(`   Fee (UBA): ${redemptionEvent.feeUBA}`);
      console.log(`   First underlying block: ${redemptionEvent.firstUnderlyingBlock}`);
      console.log(`   Last underlying block: ${redemptionEvent.lastUnderlyingBlock}`);
      console.log(`   Last underlying timestamp: ${redemptionEvent.lastUnderlyingTimestamp}`);
      
      return {
        requestId: redemptionEvent.requestId,
        txHash: receipt.hash,
        firstUnderlyingBlock: redemptionEvent.firstUnderlyingBlock,
        lastUnderlyingBlock: redemptionEvent.lastUnderlyingBlock,
        lastUnderlyingTimestamp: redemptionEvent.lastUnderlyingTimestamp,
      };
    } catch (error) {
      console.error('Error requesting redemption:', error);
      console.error('Redemption parameters:', { lots, executor: ethers.ZeroAddress, receiverUnderlyingAddress });
      throw error;
    }
  }

  /**
   * Get redemption request details from FAssets contract
   * This includes the assigned agent vault address and payment details
   */
  async getRedemptionRequest(requestId: bigint): Promise<{
    agentVault: string;
    valueUBA: bigint;
    feeUBA: bigint;
    firstUnderlyingBlock: bigint;
    lastUnderlyingBlock: bigint;
    lastUnderlyingTimestamp: bigint;
    paymentAddress: string;
  }> {
    const assetManager = await this.getAssetManager();
    
    console.log(`\n🔍 Querying redemption request ${requestId}...`);
    
    // Query the redemption request from contract using correct method name
    const request = await assetManager.redemptionRequestInfo(requestId);
    
    console.log(`✅ Redemption request details:`);
    console.log(`   Agent Vault: ${request.agentVault}`);
    console.log(`   Value UBA: ${request.valueUBA}`);
    console.log(`   Fee UBA: ${request.feeUBA}`);
    console.log(`   Payment Address: ${request.paymentAddress}`);
    
    return {
      agentVault: request.agentVault,
      valueUBA: request.valueUBA,
      feeUBA: request.feeUBA,
      firstUnderlyingBlock: request.firstUnderlyingBlock,
      lastUnderlyingBlock: request.lastUnderlyingBlock,
      lastUnderlyingTimestamp: request.lastUnderlyingTimestamp,
      paymentAddress: request.paymentAddress,
    };
  }

  /**
   * Get comprehensive redemption request status including all available contract data
   * Returns complete information to diagnose why confirmRedemptionPayment might fail
   */
  async getRedemptionRequestStatus(requestId: bigint): Promise<{
    exists: boolean;
    details?: {
      agentVault: string;
      valueUBA: bigint;
      feeUBA: bigint;
      firstUnderlyingBlock: bigint;
      lastUnderlyingBlock: bigint;
      lastUnderlyingTimestamp: bigint;
      paymentAddress: string;
      rawResponse: any;
    };
  }> {
    const assetManager = await this.getAssetManager();
    
    console.log(`\n🔍 Querying full redemption request status for #${requestId}...`);
    
    try {
      // Query the redemption request from contract
      const request = await assetManager.redemptionRequestInfo(requestId);
      
      console.log(`📋 Full redemption request response:`, {
        keys: Object.keys(request),
        fullObject: JSON.stringify(request, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        , 2)
      });
      
      // Check if request exists (agentVault will be zero address if doesn't exist)
      const exists = request.agentVault !== ethers.ZeroAddress;
      
      console.log(`✅ Redemption request ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      
      if (exists) {
        console.log(`   Agent Vault: ${request.agentVault}`);
        console.log(`   Value UBA: ${request.valueUBA}`);
        console.log(`   Fee UBA: ${request.feeUBA}`);
        console.log(`   First Block: ${request.firstUnderlyingBlock}`);
        console.log(`   Last Block: ${request.lastUnderlyingBlock}`);
        console.log(`   Last Timestamp: ${request.lastUnderlyingTimestamp}`);
        console.log(`   Payment Address: ${request.paymentAddress}`);
      }
      
      return {
        exists,
        details: exists ? {
          agentVault: request.agentVault,
          valueUBA: request.valueUBA,
          feeUBA: request.feeUBA,
          firstUnderlyingBlock: request.firstUnderlyingBlock,
          lastUnderlyingBlock: request.lastUnderlyingBlock,
          lastUnderlyingTimestamp: request.lastUnderlyingTimestamp,
          paymentAddress: request.paymentAddress,
          rawResponse: request
        } : undefined
      };
    } catch (error: any) {
      console.error(`❌ Error querying redemption request:`, error.message);
      return {
        exists: false
      };
    }
  }

  /**
   * Get agent's underlying XRPL address from agent vault address
   * This is the address that will actually send the XRP payment
   */
  async getAgentUnderlyingAddress(agentVaultAddress: string): Promise<string> {
    const assetManager = await this.getAssetManager();
    
    console.log(`\n🔍 Querying agent vault ${agentVaultAddress}...`);
    
    // Get agent info from AssetManager
    const agentInfo = await assetManager.getAgentInfo(agentVaultAddress);
    
    // Log full agentInfo object to debug property names
    console.log(`\n📋 Full agentInfo structure:`, {
      keys: Object.keys(agentInfo),
      fullObject: JSON.stringify(agentInfo, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2)
    });
    
    // Try multiple possible property names for the underlying address
    // Different versions of FAssets SDK might use different property names
    let underlyingAddress: string | undefined;
    
    // Try common property names in order of likelihood
    if (agentInfo.underlyingAddress) {
      underlyingAddress = agentInfo.underlyingAddress;
      console.log(`✅ Found underlyingAddress via property: underlyingAddress`);
    } else if (agentInfo.underlyingAddressString) {
      underlyingAddress = agentInfo.underlyingAddressString;
      console.log(`✅ Found underlyingAddress via property: underlyingAddressString`);
    } else if (agentInfo.paymentAddress) {
      underlyingAddress = agentInfo.paymentAddress;
      console.log(`✅ Found underlyingAddress via property: paymentAddress`);
    } else if (agentInfo.xrpAddress) {
      underlyingAddress = agentInfo.xrpAddress;
      console.log(`✅ Found underlyingAddress via property: xrpAddress`);
    } else {
      // Try to find any property that looks like an XRPL address
      for (const [key, value] of Object.entries(agentInfo)) {
        if (typeof value === 'string' && value.startsWith('r') && value.length >= 25 && value.length <= 35) {
          underlyingAddress = value;
          console.log(`⚠️  Found potential XRPL address via property: ${key}`);
          break;
        }
      }
    }
    
    if (!underlyingAddress) {
      console.error(`❌ Could not find underlying address in agentInfo`);
      console.error(`   Available properties:`, Object.keys(agentInfo));
      console.error(`   Agent vault: ${agentVaultAddress}`);
      throw new Error(
        `Could not extract underlying XRPL address from agent info. ` +
        `Available properties: ${Object.keys(agentInfo).join(', ')}. ` +
        `Please check FAssets SDK version and update property name.`
      );
    }
    
    console.log(`✅ Agent underlying address: ${underlyingAddress}`);
    return underlyingAddress;
  }

  async confirmRedemptionPayment(
    proof: any,
    requestId: bigint
  ): Promise<string> {
    const assetManager = await this.getAssetManager();
    
    console.log(`\n✅ Confirming redemption payment:`);
    console.log(`   Request ID: ${requestId}`);
    
    const tx = await assetManager.confirmRedemptionPayment(proof, requestId);
    const receipt = await tx.wait();
    
    console.log(`✅ Redemption payment confirmed: ${receipt.hash}`);
    return receipt.hash;
  }

  async calculateLots(xrpAmount: string): Promise<number> {
    const assetManager = await this.getAssetManager();
    const lotSize = await assetManager.lotSize();
    const decimals = await assetManager.assetMintingDecimals();
    
    const amountUBA = ethers.parseUnits(xrpAmount, Number(decimals));
    
    // Calculate lots using BigInt arithmetic to avoid precision loss
    // Formula: lots = ceil(amountUBA / lotSize)
    const lots = (amountUBA + lotSize - BigInt(1)) / lotSize; // Ceiling division for BigInt
    const lotsNumber = Number(lots);
    
    // Check minimum: FAssets requires at least 1 lot
    if (lotsNumber < 1) {
      const minAmount = ethers.formatUnits(lotSize, Number(decimals));
      throw new Error(
        `Amount too small. Minimum deposit is ${minAmount} XRP (1 lot). ` +
        `Please increase your deposit amount.`
      );
    }
    
    console.log(`Lot size: ${ethers.formatUnits(lotSize, Number(decimals))} XRP`);
    console.log(`Amount: ${xrpAmount} XRP = ${lotsNumber} lot(s)`);
    
    return lotsNumber;
  }

  async calculateLotRoundedAmount(requestedAmount: string): Promise<{ requestedAmount: string; roundedAmount: string; lots: number; needsRounding: boolean; shortfall: number }> {
    const assetManager = await this.getAssetManager();
    const lotSize = await assetManager.lotSize();
    const decimals = await assetManager.assetMintingDecimals();
    
    const requestedUBA = ethers.parseUnits(requestedAmount, Number(decimals));
    
    // Calculate lots (ceiling division)
    const lots = (requestedUBA + lotSize - BigInt(1)) / lotSize;
    const lotsNumber = Number(lots);
    
    // Check minimum
    if (lotsNumber < 1) {
      const minAmount = ethers.formatUnits(lotSize, Number(decimals));
      throw new Error(
        `Amount too small. Minimum deposit is ${minAmount} XRP (1 lot). ` +
        `Please increase your deposit amount.`
      );
    }
    
    // Calculate rounded amount (lots * lotSize)
    const roundedUBA = BigInt(lotsNumber) * lotSize;
    const roundedAmount = ethers.formatUnits(roundedUBA, Number(decimals));
    
    // Check if rounding occurred
    const needsRounding = requestedUBA !== roundedUBA;
    
    // Calculate shortfall (how much extra user will pay)
    const shortfallUBA = roundedUBA - requestedUBA;
    const shortfall = Number(ethers.formatUnits(shortfallUBA, Number(decimals)));
    
    console.log(`📊 Lot calculation:`);
    console.log(`   Requested: ${requestedAmount} XRP`);
    console.log(`   Lot size: ${ethers.formatUnits(lotSize, Number(decimals))} XRP`);
    console.log(`   Lots needed: ${lotsNumber}`);
    console.log(`   Rounded to: ${roundedAmount} XRP`);
    console.log(`   Rounding required: ${needsRounding ? 'Yes' : 'No'}`);
    console.log(`   Shortfall: ${shortfall} XRP`);
    
    return {
      requestedAmount,
      roundedAmount,
      lots: lotsNumber,
      needsRounding,
      shortfall,
    };
  }

  async getAssetDecimals(): Promise<number> {
    const assetManager = await this.getAssetManager();
    return Number(await assetManager.assetMintingDecimals());
  }

  private parseCollateralReservedEvent(receipt: any): any {
    const AssetManagerABI = this.getAssetManagerABI();
    // The ABI file is directly an array, not an object with an 'abi' property
    const iface = new ethers.Interface(AssetManagerABI);
    
    console.log('\n🔍 Parsing CollateralReserved event from receipt:');
    console.log(`   Transaction hash: ${receipt.hash || receipt.transactionHash}`);
    console.log(`   Block number: ${receipt.blockNumber}`);
    console.log(`   Number of logs: ${receipt.logs?.length || 0}`);
    
    // Log all event names found in receipt
    const eventNames: string[] = [];
    for (const log of receipt.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          eventNames.push(parsed.name);
          if (parsed.name === "CollateralReserved") {
            console.log(`   ✅ Found CollateralReserved event!`);
            return parsed.args;
          }
        }
      } catch (e) {
        // Log doesn't match our ABI, skip it
        continue;
      }
    }
    
    console.error('   ❌ CollateralReserved event not found');
    console.error(`   Events found: ${eventNames.length > 0 ? eventNames.join(', ') : 'none'}`);
    console.error(`   Raw logs count: ${receipt.logs?.length || 0}`);
    
    // If we have logs but no CollateralReserved, log first log for debugging
    if (receipt.logs && receipt.logs.length > 0) {
      console.error('   First log sample:');
      console.error(`     address: ${receipt.logs[0].address}`);
      console.error(`     topics: ${receipt.logs[0].topics?.length || 0} topics`);
    }
    
    throw new Error("CollateralReserved event not found in transaction");
  }

  private parseRedemptionRequestedEvent(receipt: any): any {
    const AssetManagerABI = this.getAssetManagerABI();
    const iface = new ethers.Interface(AssetManagerABI);
    
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "RedemptionRequested") {
          return parsed.args;
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("RedemptionRequested event not found in transaction");
  }
}
