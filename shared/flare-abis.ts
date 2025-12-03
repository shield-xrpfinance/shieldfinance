/**
 * Flare Network Contract ABIs
 * 
 * FAssets Protocol & Firelight.finance Integration
 * Last Updated: December 3, 2025
 * 
 * ABI Sources:
 * - FAssets: https://github.com/flare-foundation/fassets
 * - Firelight: ERC-4626 Standard + custom events
 * - ERC-20: Standard OpenZeppelin implementation
 * 
 * For complete ABIs, refer to:
 * - FAssets GitHub: https://github.com/flare-foundation/fassets/tree/main/contracts
 * - ERC-4626 Spec: https://eips.ethereum.org/EIPS/eip-4626
 */

/**
 * Flare Contract Registry ABI
 * Used to retrieve AssetManager and other contract addresses dynamically
 */
export const FLARE_CONTRACT_REGISTRY_ABI = [
  "function getContractAddressByName(string calldata _name) external view returns (address)",
  "function getContractAddressesByName(string[] calldata _names) external view returns (address[] memory)",
  "function getAllContracts() external view returns (string[] memory _names, address[] memory _addresses)"
] as const;

/**
 * FAssets AssetManager ABI (Partial)
 * 
 * Core functions for minting and redeeming FXRP
 * Full ABI available at: https://github.com/flare-foundation/fassets
 * 
 * Contract uses Diamond Pattern (EIP-2535) with multiple facets:
 * - CollateralReservationsFacet: reserveCollateral()
 * - MintingFacet: executeMinting()
 * - RedemptionsFacet: redeem(), redeemFromAgent()
 */
export const FASSETS_ASSET_MANAGER_ABI = [
  // ==================== Minting Functions ====================
  
  /**
   * Reserve collateral from an agent to start minting process
   * @param _agentVault Agent vault address
   * @param _lots Number of lots to mint (1 lot = 1 underlying asset unit)
   * @param _maxMintingFeeBIPS Maximum minting fee in basis points
   * @param _executor Executor address (or zero address)
   * @returns Collateral reservation ID
   */
  "function reserveCollateral(address _agentVault, uint256 _lots, uint256 _maxMintingFeeBIPS, address _executor) external payable returns (uint256)",
  
  /**
   * Execute minting after payment proof is obtained
   * @param _payment Payment proof from Flare Data Connector
   * @param _collateralReservationId Reservation ID from reserveCollateral()
   * @returns Minted amount in underlying base asset (UBA)
   */
  "function executeMinting(bytes calldata _payment, uint256 _collateralReservationId) external returns (uint256)",
  
  /**
   * Get information about a collateral reservation
   * @param _collateralReservationId Reservation ID
   */
  "function getCollateralReservationInfo(uint256 _collateralReservationId) external view returns (tuple(address minter, address agentVault, uint256 valueUBA, uint256 feeUBA, uint256 firstUnderlyingBlock, uint256 lastUnderlyingBlock, uint256 lastUnderlyingTimestamp, bytes32 paymentReference, address executor, uint256 executorFee))",
  
  // ==================== Redemption Functions ====================
  
  /**
   * Redeem FAssets for underlying assets
   * @param _lots Number of lots to redeem
   * @param _receiverUnderlyingAddress Address to receive underlying assets (e.g., XRPL address)
   * @param _executor Executor address (or zero address)
   * @returns Request ID
   */
  "function redeem(uint256 _lots, string calldata _receiverUnderlyingAddress, address _executor) external returns (uint256)",
  
  /**
   * Redeem from a specific agent
   * @param _agentVault Agent vault address
   * @param _lots Number of lots to redeem
   * @param _receiverUnderlyingAddress Address to receive underlying assets
   * @param _executor Executor address
   */
  "function redeemFromAgent(address _agentVault, uint256 _lots, string calldata _receiverUnderlyingAddress, address _executor) external returns (uint256)",
  
  // ==================== View Functions ====================
  
  /**
   * Get list of available agents
   * @param _offset Pagination offset
   * @param _count Number of agents to return
   */
  "function getAvailableAgentsDetailedList(uint256 _offset, uint256 _count) external view returns (tuple(address agentVault, uint256 feeBIPS, uint256 mintingVaultCollateralRatioBIPS, uint256 mintingPoolCollateralRatioBIPS, uint256 freeCollateralLots, uint256 totalVaultCollateralWei, uint256 totalPoolCollateralNATWei, string underlyingAddressString)[] memory _agents, uint256 _totalAgentCount)",
  
  /**
   * Get agent information
   * @param _agentVault Agent vault address
   */
  "function getAgentInfo(address _agentVault) external view returns (tuple(address agentVault, address vaultCollateralToken, uint256 feeBIPS, uint256 poolFeeShareBIPS, uint256 mintedUBA, uint256 reservedUBA, uint256 redeemingUBA, uint256 announcedUnderlyingWithdrawalId, uint256 freeUnderlyingBalanceUBA, uint256 mintingVaultCollateralRatioBIPS, uint256 mintingPoolCollateralRatioBIPS, uint256 freeVaultCollateralWei, uint256 freePoolCollateralNATWei, uint256 totalVaultCollateralWei, uint256 totalPoolCollateralNATWei, string underlyingAddressString))",
  
  /**
   * Get asset token (FXRP) address
   */
  "function fAsset() external view returns (address)",
  
  /**
   * Get asset minting decimals
   */
  "function assetMintingDecimals() external view returns (uint256)",
  
  /**
   * Calculate collateral reservation fee
   * @param _lots Number of lots
   */
  "function collateralReservationFee(uint256 _lots) external view returns (uint256)",
  
  // ==================== Events ====================
  
  "event CollateralReserved(address indexed minter, uint256 indexed collateralReservationId, address indexed agentVault, uint256 amountUBA, uint256 feeUBA, uint256 firstUnderlyingBlock, uint256 lastUnderlyingBlock, uint256 lastUnderlyingTimestamp, bytes32 paymentReference)",
  
  "event MintingExecuted(address indexed minter, uint256 indexed collateralReservationId, uint256 indexed agentVault, uint256 amountUBA, uint256 agentFeeUBA, uint256 poolFeeUBA)",
  
  "event RedemptionRequested(address indexed redeemer, uint256 indexed requestId, address indexed agentVault, uint256 amountUBA, uint256 feeUBA, string paymentAddress)",
  
  "event RedemptionPerformed(address indexed redeemer, uint256 indexed requestId, address indexed agentVault, uint256 amountUBA, uint256 feeUBA)",
  
  "event RedemptionDefault(address indexed redeemer, uint256 indexed requestId, address indexed agentVault, uint256 amountUBA, uint256 redeemedVaultCollateralWei, uint256 redeemedPoolCollateralWei)"
] as const;

/**
 * ERC-20 Standard ABI
 * Used for FXRP and stXRP token interactions
 */
export const ERC20_ABI = [
  // Read functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // Write functions
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

/**
 * ERC-4626 Tokenized Vault Standard ABI
 * 
 * Generic ERC-4626 vault interface for shXRP and other vaults
 * Specification: https://eips.ethereum.org/EIPS/eip-4626
 */
export const ERC4626_ABI = [
  // ERC-20 base functions
  ...ERC20_ABI,
  
  // ERC-4626 vault functions
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256 shares)",
  "function convertToAssets(uint256 shares) view returns (uint256 assets)",
  "function maxDeposit(address receiver) view returns (uint256)",
  "function maxMint(address receiver) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function maxRedeem(address owner) view returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewMint(uint256 shares) view returns (uint256 assets)",
  "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function mint(uint256 shares, address receiver) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  
  // ERC-4626 events
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
] as const;

/**
 * ShXRPVault Event ABI
 * Events emitted by the Shield XRP Vault contract for analytics tracking
 */
export const SHXRP_VAULT_EVENTS_ABI = [
  "event FeeTransferred(string indexed feeType, uint256 amount, address indexed recipient)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  "event DonatedOnBehalf(address indexed user, uint256 fxrpAmount, uint256 sharesMinted)",
] as const;

/**
 * RevenueRouter Event ABI
 * Events emitted when revenue is distributed (SHIELD burn + staker boost)
 */
export const REVENUE_ROUTER_EVENTS_ABI = [
  "event RevenueDistributed(uint256 wflrTotal, uint256 shieldBurned, uint256 fxrpToStakers, uint256 reserves)",
  "event ReservesWithdrawn(address indexed to, uint256 amount)",
] as const;

/**
 * Firelight Launch Vault ABI (extends ERC-4626)
 * 
 * Used by Firelight Launch Vault for FXRP → stXRP staking
 * Adds custom functions for min deposit, deposit limit, and paused state
 */
export const FIRELIGHT_VAULT_ABI = [
  // ==================== ERC-20 Functions (inherited) ====================
  ...ERC20_ABI,
  
  // ==================== ERC-4626 Vault Functions ====================
  
  // Asset information
  "function asset() view returns (address)",  // Returns FXRP token address
  "function totalAssets() view returns (uint256)",  // Total FXRP in vault
  
  // Custom ShXRPVault configuration
  "function minDeposit() view returns (uint256)",  // Minimum deposit amount in FXRP
  "function depositLimit() view returns (uint256)",  // Maximum total assets allowed in vault
  "function paused() view returns (bool)",  // Check if vault is paused
  
  // Deposit functions
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function mint(uint256 shares, address receiver) returns (uint256 assets)",
  
  // Withdraw functions
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  
  // Preview functions (simulate operations)
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewMint(uint256 shares) view returns (uint256 assets)",
  "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
  
  // Conversion functions
  "function convertToShares(uint256 assets) view returns (uint256 shares)",
  "function convertToAssets(uint256 shares) view returns (uint256 assets)",
  
  // Max operations
  "function maxDeposit(address receiver) view returns (uint256)",
  "function maxMint(address receiver) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function maxRedeem(address owner) view returns (uint256)",
  
  // ==================== ERC-4626 Events ====================
  
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)",
  
  // ==================== ShXRPVault Admin Functions ====================
  
  // P0 Security Features (Owner only)
  "function pause()",  // Emergency stop - halt all deposits/withdrawals
  "function unpause()",  // Resume normal operations after pause
  "function setDepositLimit(uint256 newLimit)",  // Update maximum vault capacity
  
  // ==================== Firelight Custom Events (if applicable) ====================
  
  // Note: Exact custom events TBD from Firelight contract source
  // These are educated guesses based on common vault patterns
  "event YieldDistributed(uint256 amount)",
  "event RewardsCompounded(uint256 newTotalAssets)",
  "event VaultCapUpdated(uint256 newCap)",
  
  // P0 Security Events (OpenZeppelin Pausable)
  "event Paused(address account)",
  "event Unpaused(address account)",
  "event DepositLimitUpdated(uint256 newDepositLimit)"
] as const;

/**
 * VaultController ABI
 * 
 * Manages operator permissions, compounding, and multi-strategy coordination for ShXRP vaults.
 * Handles rebalancing between buffer and strategies (Kinetic, Firelight).
 */
export const VAULT_CONTROLLER_ABI = [
  "function registerVault(address vault) external",
  "function deregisterVault(address vault) external",
  "function registeredVaults(address vault) external view returns (bool)",
  "function vaultList(uint256 index) external view returns (address)",
  "function getVaultCount() external view returns (uint256)",
  
  "function registerStrategy(address strategy, string calldata name) external",
  "function deregisterStrategy(address strategy) external",
  "function registeredStrategies(address strategy) external view returns (bool)",
  "function strategyList(uint256 index) external view returns (address)",
  "function strategyNames(address strategy) external view returns (string)",
  "function getStrategyCount() external view returns (uint256)",
  
  "function BUFFER_TARGET_BPS() external view returns (uint256)",
  "function KINETIC_TARGET_BPS() external view returns (uint256)",
  "function FIRELIGHT_TARGET_BPS() external view returns (uint256)",
  
  "function getCurrentAllocation(address vault) external view returns (uint256 bufferAmount, uint256 kineticAmount, uint256 firelightAmount, uint256 totalAssets)",
  "function getTargetAllocation(address vault, uint256 totalAssets) external view returns (uint256 bufferTarget, uint256 kineticTarget, uint256 firelightTarget)",
  "function needsRebalancing(address vault, uint256 thresholdBps) external view returns (bool)",
  
  "function deployToStrategies(address vault, uint256 amount) external",
  "function withdrawFromStrategies(address vault, uint256 amount) external",
  "function rebalanceVault(address vault) external",
  
  "function executeCompound(address vault) external",
  "function setMinCompoundInterval(uint256 interval) external",
  "function lastCompoundTime(address vault) external view returns (uint256)",
  "function minCompoundInterval() external view returns (uint256)",
  
  "function addOperator(address operator) external",
  "function removeOperator(address operator) external",
  "function addCompounder(address compounder) external",
  "function removeCompounder(address compounder) external",
  
  "event VaultRegistered(address indexed vault)",
  "event VaultDeregistered(address indexed vault)",
  "event StrategyRegistered(address indexed strategy, string name)",
  "event StrategyDeregistered(address indexed strategy)",
  "event StrategyDeployed(address indexed vault, address indexed strategy, uint256 amount)",
  "event StrategyWithdrawn(address indexed vault, address indexed strategy, uint256 amount)",
  "event VaultRebalanced(address indexed vault, uint256 bufferBefore, uint256 bufferAfter, uint256 kineticBefore, uint256 kineticAfter, uint256 firelightBefore, uint256 firelightAfter)",
  "event CompoundExecuted(address indexed vault, uint256 yieldAmount)",
  "event OperatorAdded(address indexed operator)",
  "event OperatorRemoved(address indexed operator)"
] as const;

/**
 * ShXRPVault Strategy Management ABI
 * 
 * Strategy-specific functions for the ShXRP vault.
 * Used for managing yield strategies (Kinetic, Firelight).
 */
export const SHXRP_VAULT_STRATEGY_ABI = [
  ...ERC20_ABI,
  
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function minDeposit() view returns (uint256)",
  "function depositLimit() view returns (uint256)",
  "function paused() view returns (bool)",
  
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  "function convertToShares(uint256 assets) view returns (uint256 shares)",
  "function convertToAssets(uint256 shares) view returns (uint256 assets)",
  "function previewDeposit(uint256 assets) view returns (uint256 shares)",
  "function previewWithdraw(uint256 assets) view returns (uint256 shares)",
  "function previewRedeem(uint256 shares) view returns (uint256 assets)",
  
  "function strategies(address strategy) view returns (address strategyAddress, uint256 targetBps, uint8 status, uint256 totalDeployed, uint256 lastReportTimestamp)",
  "function strategyList(uint256 index) view returns (address)",
  "function bufferTargetBps() view returns (uint256)",
  "function totalStrategyTargetBps() view returns (uint256)",
  
  "function getStrategyInfo(address strategy) view returns (tuple(address strategyAddress, uint256 targetBps, uint8 status, uint256 totalDeployed, uint256 lastReportTimestamp))",
  "function getStrategyList() view returns (address[])",
  "function getActiveStrategies() view returns (address[])",
  
  "function addStrategy(address strategy, uint256 targetBps) external",
  "function removeStrategy(address strategy) external",
  "function updateAllocation(address strategy, uint256 newTargetBps) external",
  "function setStrategyStatus(address strategy, uint8 newStatus) external",
  
  "function deployToStrategy(address strategy, uint256 amount) external returns (uint256)",
  "function withdrawFromStrategy(address strategy, uint256 amount) external returns (uint256)",
  "function withdrawFromAllStrategies(uint256 amount) external returns (uint256)",
  
  "function operators(address account) view returns (bool)",
  "function addOperator(address operator) external",
  "function removeOperator(address operator) external",
  
  "function pause() external",
  "function unpause() external",
  "function setDepositLimit(uint256 newLimit) external",
  "function setMinDeposit(uint256 newMinDeposit) external",
  "function setBufferTarget(uint256 newBufferTargetBps) external",
  
  "event StrategyAdded(address indexed strategy, uint256 targetBps)",
  "event StrategyRemoved(address indexed strategy)",
  "event StrategyStatusUpdated(address indexed strategy, uint8 newStatus)",
  "event StrategyAllocationUpdated(address indexed strategy, uint256 newTargetBps)",
  "event DeployedToStrategy(address indexed strategy, uint256 amount)",
  "event WithdrawnFromStrategy(address indexed strategy, uint256 amount, uint256 actualAmount)",
  "event BufferTargetUpdated(uint256 newTargetBps)",
  "event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
] as const;

/**
 * IStrategy Interface ABI
 * 
 * Standard interface for yield strategies (Kinetic, Firelight, etc.)
 */
export const STRATEGY_ABI = [
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver) returns (uint256 actualWithdrawn)",
  "function report() external returns (uint256 profit, uint256 loss)",
  "function harvest() external",
  "function migrate(address newStrategy) external",
  "function maxDeposit() view returns (uint256)",
  "function paused() view returns (bool)"
] as const;

/**
 * Helper function to get contract interface
 * 
 * @example
 * ```typescript
 * import { ethers } from 'ethers';
 * import { getContractInterface } from './flare-abis';
 * 
 * const assetManagerInterface = getContractInterface('assetManager');
 * const vault = new ethers.Contract(vaultAddress, getContractInterface('firelightVault'), signer);
 * ```
 */
export function getContractInterface(contractType: 'assetManager' | 'fxrp' | 'firelightVault' | 'contractRegistry' | 'vaultController' | 'shxrpVaultStrategy' | 'strategy') {
  switch (contractType) {
    case 'assetManager':
      return FASSETS_ASSET_MANAGER_ABI;
    case 'fxrp':
      return ERC20_ABI;
    case 'firelightVault':
      return FIRELIGHT_VAULT_ABI;
    case 'contractRegistry':
      return FLARE_CONTRACT_REGISTRY_ABI;
    case 'vaultController':
      return VAULT_CONTROLLER_ABI;
    case 'shxrpVaultStrategy':
      return SHXRP_VAULT_STRATEGY_ABI;
    case 'strategy':
      return STRATEGY_ABI;
    default:
      throw new Error(`Unknown contract type: ${contractType}`);
  }
}

/**
 * Event topics for filtering logs
 * Pre-computed keccak256 hashes of event signatures
 */
export const EVENT_TOPICS = {
  fassets: {
    CollateralReserved: "0x...", // keccak256("CollateralReserved(address,uint256,address,uint256,uint256,uint256,uint256,uint256,bytes32)")
    MintingExecuted: "0x...",    // keccak256("MintingExecuted(address,uint256,address,uint256,uint256,uint256)")
    RedemptionRequested: "0x...", // keccak256("RedemptionRequested(address,uint256,address,uint256,uint256,string)")
    RedemptionPerformed: "0x..."  // keccak256("RedemptionPerformed(address,uint256,address,uint256,uint256)")
  },
  firelight: {
    Deposit: "0x...",   // keccak256("Deposit(address,address,uint256,uint256)")
    Withdraw: "0x..."   // keccak256("Withdraw(address,address,address,uint256,uint256)")
  },
  erc20: {
    Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    Approval: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
  }
} as const;

/**
 * ABI Reference Documentation
 */
export const ABI_REFERENCES = {
  fassets: {
    repository: "https://github.com/flare-foundation/fassets",
    contractsPath: "https://github.com/flare-foundation/fassets/tree/main/contracts",
    userInterfaces: "https://github.com/flare-foundation/fassets/tree/main/contracts/userInterfaces",
    documentation: "https://dev.flare.network/fassets/developer-guides/fassets-mint"
  },
  firelight: {
    // Note: Firelight may not have public GitHub repo
    // Using ERC-4626 standard as reference
    erc4626Spec: "https://eips.ethereum.org/EIPS/eip-4626",
    documentation: "https://medium.com/@Firelight",
    // When official docs/repo available, add here
    repository: null
  },
  standards: {
    erc20: "https://eips.ethereum.org/EIPS/eip-20",
    erc4626: "https://eips.ethereum.org/EIPS/eip-4626",
    diamond: "https://eips.ethereum.org/EIPS/eip-2535"
  }
} as const;

/**
 * Type definitions for contract interactions
 */
export interface CollateralReservationInfo {
  minter: string;
  agentVault: string;
  valueUBA: bigint;
  feeUBA: bigint;
  firstUnderlyingBlock: bigint;
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
  paymentReference: string;
  executor: string;
  executorFee: bigint;
}

export interface AgentInfo {
  agentVault: string;
  vaultCollateralToken: string;
  feeBIPS: bigint;
  poolFeeShareBIPS: bigint;
  mintedUBA: bigint;
  reservedUBA: bigint;
  redeemingUBA: bigint;
  announcedUnderlyingWithdrawalId: bigint;
  freeUnderlyingBalanceUBA: bigint;
  mintingVaultCollateralRatioBIPS: bigint;
  mintingPoolCollateralRatioBIPS: bigint;
  freeVaultCollateralWei: bigint;
  freePoolCollateralNATWei: bigint;
  totalVaultCollateralWei: bigint;
  totalPoolCollateralNATWei: bigint;
  underlyingAddressString: string;
}

/**
 * Usage Notes
 * 
 * IMPORTANT:
 * 1. These are PARTIAL ABIs containing only the most commonly used functions
 * 2. For complete ABIs, compile contracts from source repositories
 * 3. Always verify ABI matches deployed contract version
 * 4. Use ethers.Interface or web3.eth.Contract for type-safe interactions
 * 
 * TO GET COMPLETE ABIs:
 * - FAssets: Clone https://github.com/flare-foundation/fassets and run `npm run compile`
 * - Firelight: Check firelight.finance for contract verification links
 * - Verified contracts: Download ABI directly from Flarescan block explorer
 * 
 * VERIFICATION:
 * - Mainnet FXRP: https://flarescan.com/token/0xAf7278D382323A865734f93B687b300005B8b60E
 * - Coston2 FXRP: https://coston2-explorer.flare.network/token/0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3
 */
