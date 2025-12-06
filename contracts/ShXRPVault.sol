// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IStrategy.sol";

/**
 * @dev Interface for StakingBoost contract
 * Used to query user's SHIELD staking boost for enhanced APY
 */
interface IStakingBoost {
    function getBoost(address user) external view returns (uint256);
}

/**
 * @title Shield XRP Vault (shXRP)
 * @dev ERC-4626 compliant tokenized vault for XRP on Flare Network
 * 
 * Architecture:
 * - Asset: FXRP (FAssets-wrapped XRP on Flare Network)
 * - Shares: shXRP (liquid staking token, ERC-20 compliant)
 * - Standard: ERC-4626 (Tokenized Vault Standard)
 * 
 * Features:
 * - Deposit FXRP → Receive shXRP shares (automatic exchange rate)
 * - Redeem shXRP → Receive FXRP (proportional to vault performance)
 * - Operator-controlled for bridging coordination
 * - Multi-strategy yield optimization (Kinetic lending, Firelight staking, etc.)
 * - Dynamic buffer management for instant withdrawals
 * - ReentrancyGuard for deposit/withdrawal security
 * - Pausable for emergency stop (exploit/vulnerability protection)
 * - Deposit limit enforcement to control TVL growth
 * 
 * Flow:
 * 1. User mints FXRP via FAssets bridge (XRP → FXRP on Flare)
 * 2. User approves FXRP spending for this vault
 * 3. User calls deposit() with FXRP amount → Receives shXRP shares
 * 4. Vault holds buffer (10%) + deploys capital to strategies (90%)
 * 5. Strategies generate yield (Kinetic ~5-6%, Firelight higher when ready)
 * 6. shXRP value increases as strategies generate returns
 * 7. User calls withdraw() with shXRP → Receives FXRP from buffer + accrued yield
 * 
 * ERC-4626 Benefits:
 * - Standard interface for all DeFi integrations
 * - Automatic share price calculation (no manual exchange rate)
 * - Compatible with lending protocols, DEXs, aggregators
 * - Transparent vault accounting via totalAssets()
 * 
 * Integration Notes:
 * - FXRP: See docs/FLARE_FASSETS_INTEGRATION.md
 * - Strategies: See docs/STRATEGY_INTEGRATION.md
 * - Operators coordinate bridging between XRPL and Flare
 */
contract ShXRPVault is ERC4626, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // ========================================
    // ENUMS & STRUCTS
    // ========================================
    
    enum StrategyStatus {
        Inactive,      // Strategy not yet activated
        Active,        // Strategy operational and receiving deposits
        Paused,        // Temporarily paused (can be resumed)
        Deprecated     // Permanently disabled (being phased out)
    }
    
    struct StrategyInfo {
        address strategyAddress;    // IStrategy contract address
        uint256 targetBps;           // Target allocation in basis points (10000 = 100%)
        StrategyStatus status;       // Current operational status
        uint256 totalDeployed;       // Total FXRP deployed to this strategy
        uint256 lastReportTimestamp; // Last time strategy.report() was called
    }
    
    // ========================================
    // STATE VARIABLES
    // ========================================
    
    // Revenue Router for automatic fee distribution (buyback & burn)
    address public immutable revenueRouter;
    
    // Staking Boost for APY enhancement (+1% per 100 SHIELD staked)
    // NOTE: Not immutable to allow post-deployment configuration (circular dependency solution)
    // Can only be set once by owner after deployment
    IStakingBoost public stakingBoost;
    
    // Fee Configuration (in basis points, 10000 = 100%)
    uint256 public constant DEPOSIT_FEE_BPS = 20;  // 0.2% deposit fee
    uint256 public constant WITHDRAW_FEE_BPS = 20; // 0.2% withdraw fee
    
    // Yield Routing Fee for protocol revenue from strategy profits
    // Fee is deducted from reported profits and sent to RevenueRouter
    // Default: 10 bps = 0.1% of profits (adjustable by owner)
    uint256 public yieldRoutingFeeBps = 10;
    
    // Accrued protocol fees (ERC-4626 compliant fee accrual)
    // Fees are accrued when strategies report profit, claimed via claimAccruedFees()
    // This prevents minting unbacked shares which would dilute depositors
    uint256 public accruedProtocolFees;
    
    // Mapping of approved operators who can manage strategies
    mapping(address => bool) public operators;
    
    // Minimum deposit amount (0.01 FXRP with 6 decimals)
    uint256 public minDeposit = 10000; // 0.01 FXRP (6 decimals)
    
    // Maximum total deposit limit (prevents uncontrolled TVL growth)
    // Start with 1M FXRP (~$2.1M at $2.10/XRP), can be increased as strategies scale
    uint256 public depositLimit = 1_000_000e6; // 1,000,000 FXRP (6 decimals)
    
    // Strategy Management
    mapping(address => StrategyInfo) public strategies;
    address[] public strategyList;
    uint256 public totalStrategyTargetBps; // Sum of all strategy targetBps (for validation)
    
    // Buffer Management (for instant withdrawals)
    uint256 public bufferTargetBps = 1000; // 10% target buffer (10000 = 100%)
    
    // ========================================
    // EVENTS
    // ========================================
    
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event MinDepositUpdated(uint256 newMinDeposit);
    event BufferTargetUpdated(uint256 newTargetBps);
    event DepositLimitUpdated(uint256 newDepositLimit);
    event FeeTransferred(string indexed feeType, uint256 amount, address indexed recipient);
    
    // Strategy Events
    event StrategyAdded(address indexed strategy, uint256 targetBps);
    event StrategyRemoved(address indexed strategy);
    event StrategyStatusUpdated(address indexed strategy, StrategyStatus newStatus);
    event StrategyAllocationUpdated(address indexed strategy, uint256 newTargetBps);
    event DeployedToStrategy(address indexed strategy, uint256 amount);
    event WithdrawnFromStrategy(address indexed strategy, uint256 amount, uint256 actualAmount);
    event StrategyReported(address indexed strategy, uint256 profit, uint256 loss, uint256 totalAssets);
    
    // Boost Donation Events
    event DonatedOnBehalf(address indexed user, uint256 fxrpAmount, uint256 sharesMinted);
    event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost);
    
    // Fee Events
    event YieldRoutingFeeUpdated(uint256 newFeeBps);
    event ProtocolFeesAccrued(address indexed strategy, uint256 amount, uint256 totalAccrued);
    event ProtocolFeesClaimed(uint256 amount, address indexed recipient);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _fxrpToken Address of FXRP token (FAssets-wrapped XRP)
     * @param _name Name of the share token (e.g., "Shield XRP")
     * @param _symbol Symbol of the share token (e.g., "shXRP")
     * @param _revenueRouter Address of RevenueRouter for fee distribution
     * @param _stakingBoost Address of StakingBoost (can be address(0), set later via setStakingBoost)
     * 
     * Example deployment:
     * FXRP Mainnet: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
     * FXRP Coston2: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3
     * 
     * Note: stakingBoost can be set to address(0) initially and configured later
     * via setStakingBoost() to solve circular dependency during deployment.
     */
    constructor(
        IERC20 _fxrpToken,
        string memory _name,
        string memory _symbol,
        address _revenueRouter,
        address _stakingBoost
    ) ERC4626(_fxrpToken) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(address(_fxrpToken) != address(0), "Invalid FXRP token address");
        require(_revenueRouter != address(0), "Invalid revenue router address");
        
        revenueRouter = _revenueRouter;
        
        // StakingBoost can be address(0) initially - will be set via setStakingBoost()
        if (_stakingBoost != address(0)) {
            stakingBoost = IStakingBoost(_stakingBoost);
            emit StakingBoostUpdated(address(0), _stakingBoost);
        }
        
        // Deployer is first operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }
    
    /**
     * @dev Set StakingBoost contract address (one-time configuration)
     * 
     * Solves the circular dependency between StakingBoost and ShXRPVault:
     * - StakingBoost needs vault address at deployment
     * - Vault needs stakingBoost address for donateOnBehalf access control
     * 
     * Deployment Flow:
     * 1. Deploy ShXRPVault with stakingBoost = address(0)
     * 2. Deploy StakingBoost with real vault address
     * 3. Call vault.setStakingBoost(stakingBoostAddress)
     * 4. Now claim() → donateOnBehalf() works correctly
     * 
     * Security:
     * - Only callable by owner
     * - Can only be set once (require previous value == address(0))
     * - Cannot be set to address(0)
     * 
     * @param _stakingBoost Address of StakingBoost contract
     */
    function setStakingBoost(address _stakingBoost) external onlyOwner {
        require(_stakingBoost != address(0), "Invalid staking boost address");
        require(address(stakingBoost) == address(0), "StakingBoost already set");
        
        address oldBoost = address(stakingBoost);
        stakingBoost = IStakingBoost(_stakingBoost);
        
        emit StakingBoostUpdated(oldBoost, _stakingBoost);
    }
    
    /**
     * @dev Override decimals to match the underlying FXRP asset (6 decimals)
     * 
     * OpenZeppelin ERC20 defaults to 18 decimals, but FXRP uses 6.
     * This ensures all ERC4626 math (convertToShares, convertToAssets, etc.)
     * works correctly with 6-decimal FXRP values.
     * 
     * @return uint8 Number of decimals (inherited from FXRP)
     */
    function decimals() public view virtual override returns (uint8) {
        return IERC20Metadata(address(asset())).decimals();
    }
    
    /**
     * @dev Override maxDeposit to enforce deposit limit
     * 
     * ERC4626 Compliance (Critical):
     * Preview functions must reflect the deposit limit, otherwise integrators
     * (DEXs, aggregators, wallets) will show incorrect max deposit amounts.
     * 
     * Standard Behavior:
     * - Returns remaining capacity: depositLimit - totalAssets()
     * - Returns 0 if at or above limit
     * - Returns 0 if paused
     * 
     * Example:
     * - Deposit limit: 1M FXRP
     * - Current TVL: 750K FXRP
     * - maxDeposit() returns: 250K FXRP (remaining capacity)
     * 
     * @return Maximum amount of assets that can be deposited
     */
    function maxDeposit(address /* receiver */) public view virtual override returns (uint256) {
        // If paused, no deposits allowed
        if (paused()) {
            return 0;
        }
        
        uint256 currentAssets = totalAssets();
        
        // If at or above limit, no deposits allowed
        if (currentAssets >= depositLimit) {
            return 0;
        }
        
        // Return remaining capacity
        return depositLimit - currentAssets;
    }
    
    /**
     * @dev Override maxMint to enforce deposit limit
     * 
     * ERC4626 Compliance (Critical):
     * Shares-based preview must also respect deposit limit.
     * 
     * Calculation:
     * 1. Get remaining capacity in assets (depositLimit - totalAssets())
     * 2. Convert to shares using current exchange rate
     * 
     * @return Maximum amount of shares that can be minted
     */
    function maxMint(address /* receiver */) public view virtual override returns (uint256) {
        // If paused, no mints allowed
        if (paused()) {
            return 0;
        }
        
        uint256 currentAssets = totalAssets();
        
        // If at or above limit, no mints allowed
        if (currentAssets >= depositLimit) {
            return 0;
        }
        
        // Get remaining capacity in assets
        uint256 remainingAssets = depositLimit - currentAssets;
        
        // Convert to shares using current exchange rate
        return _convertToShares(remainingAssets, Math.Rounding.Floor);
    }
    
    /**
     * @dev Override maxWithdraw for ERC-4626 pause compliance
     * 
     * ERC-4626 Requirement:
     * When vault is paused, maxWithdraw MUST return 0 to indicate
     * no withdrawals are possible.
     * 
     * @param owner Address to check maximum withdrawable assets for
     * @return Maximum amount of assets the owner can withdraw (0 if paused)
     */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return super.maxWithdraw(owner);
    }
    
    /**
     * @dev Override maxRedeem for ERC-4626 pause compliance
     * 
     * ERC-4626 Requirement:
     * When vault is paused, maxRedeem MUST return 0 to indicate
     * no redemptions are possible.
     * 
     * @param owner Address to check maximum redeemable shares for
     * @return Maximum amount of shares the owner can redeem (0 if paused)
     */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        if (paused()) {
            return 0;
        }
        return super.maxRedeem(owner);
    }
    
    /**
     * @dev Calculate total assets under management
     * 
     * ERC-4626 Required Function
     * This drives the share price calculation:
     * Share Price = totalAssets() / totalSupply()
     * 
     * Assets Include:
     * 1. FXRP held directly in vault (buffer for instant withdrawals)
     * 2. FXRP deployed to active strategies (earning yield)
     * 
     * As strategies generate yield, totalAssets() increases,
     * automatically increasing the value of shXRP shares.
     * 
     * Strategy Safety:
     * - Uses try/catch for each strategy.totalAssets() call
     * - If a strategy fails, uses its totalDeployed as fallback
     * - Ensures totalAssets() never reverts (critical for ERC-4626)
     * 
     * @return Total FXRP-equivalent assets in the vault
     */
    function totalAssets() public view virtual override returns (uint256) {
        // Start with FXRP buffer (instant withdrawal reserve)
        uint256 total = IERC20(asset()).balanceOf(address(this));
        
        // Add value from all active strategies
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategyAddr = strategyList[i];
            StrategyInfo storage strategyInfo = strategies[strategyAddr];
            
            // Only count Active strategies
            if (strategyInfo.status != StrategyStatus.Active) {
                continue;
            }
            
            // Query strategy's total assets with fallback protection
            try IStrategy(strategyAddr).totalAssets() returns (uint256 strategyAssets) {
                total += strategyAssets;
            } catch {
                // If strategy fails, use totalDeployed as conservative estimate
                // This prevents single strategy failure from breaking entire vault
                total += strategyInfo.totalDeployed;
            }
        }
        
        return total;
    }
    
    /**
     * @dev Deposit FXRP and receive shXRP shares
     * 
     * Overrides ERC-4626 deposit to add:
     * - Minimum deposit enforcement
     * - Reentrancy protection
     * 
     * Standard ERC-4626 Flow:
     * 1. User approves FXRP spending: fxrp.approve(vault, amount)
     * 2. User calls deposit(amount, receiver)
     * 3. Vault transfers FXRP from user
     * 4. Vault mints shXRP shares to receiver
     * 
     * Share Calculation (automatic):
     * shares = (assets * totalSupply()) / totalAssets()
     * 
     * @param assets Amount of FXRP to deposit
     * @param receiver Address to receive shXRP shares
     * @return shares Amount of shXRP shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        require(assets >= minDeposit, "Below minimum deposit");
        return super.deposit(assets, receiver);
    }
    
    /**
     * @dev Mint exact amount of shXRP shares
     * 
     * Overrides ERC-4626 mint to add:
     * - Minimum deposit enforcement (via asset preview)
     * - Reentrancy protection
     * 
     * Use Case:
     * When user wants exact number of shares, not exact FXRP amount
     * 
     * @param shares Amount of shXRP shares to mint
     * @param receiver Address to receive shXRP shares
     * @return assets Amount of FXRP deposited
     */
    function mint(uint256 shares, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        uint256 assets = previewMint(shares);
        require(assets >= minDeposit, "Below minimum deposit");
        return super.mint(shares, receiver);
    }
    
    /**
     * @dev Withdraw FXRP by burning shXRP shares
     * 
     * Adds reentrancy protection to standard ERC-4626 withdraw
     * 
     * Standard ERC-4626 Flow:
     * 1. User calls withdraw(assets, receiver, owner)
     * 2. Vault burns shXRP from owner
     * 3. Vault transfers FXRP to receiver
     * 
     * @param assets Amount of FXRP to withdraw
     * @param receiver Address to receive FXRP
     * @param owner Address whose shXRP will be burned
     * @return shares Amount of shXRP burned
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        return super.withdraw(assets, receiver, owner);
    }
    
    /**
     * @dev Redeem shXRP shares for FXRP
     * 
     * Adds reentrancy protection to standard ERC-4626 redeem
     * 
     * Use Case:
     * When user wants to burn exact number of shares
     * 
     * @param shares Amount of shXRP to redeem
     * @param receiver Address to receive FXRP
     * @param owner Address whose shXRP will be burned
     * @return assets Amount of FXRP withdrawn
     */
    function redeem(uint256 shares, address receiver, address owner)
        public
        virtual
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        return super.redeem(shares, receiver, owner);
    }
    
    /**
     * @dev Override ERC4626 _deposit to enforce deposit limit and collect fees
     * 
     * ERC4626 Compliance (Critical):
     * The 'shares' parameter is already fee-adjusted from previewDeposit() or previewMint().
     * This ensures preview functions accurately reflect actual deposit outcomes.
     * 
     * Flow:
     * 1. User deposits 'assets' FXRP
     * 2. previewDeposit() calculated 'shares' accounting for 0.2% fee
     * 3. super._deposit() transfers assets and mints fee-adjusted shares
     * 4. Fee is collected from vault balance and sent to RevenueRouter
     * 
     * Example:
     * - User deposits 1000 FXRP
     * - previewDeposit(1000) returns shares worth 998 FXRP (2 FXRP fee deducted)
     * - super._deposit() mints shares worth 998 FXRP
     * - 2 FXRP fee transferred to RevenueRouter for buyback & burn
     * 
     * SECURITY (Firelight Protocol Pattern):
     * Deposit limit prevents uncontrolled TVL growth during beta/audit phase.
     * 
     * @param caller Address initiating deposit
     * @param receiver Address receiving shares
     * @param assets Amount of FXRP being deposited (gross amount)
     * @param shares Amount of shares being minted (fee-adjusted, fewer than without fee)
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override {
        // Enforce deposit limit BEFORE accepting assets
        require(totalAssets() + assets <= depositLimit, "Deposit limit exceeded");
        
        // Standard ERC4626 deposit flow with fee-adjusted shares
        // The 'shares' parameter is already reduced to account for 0.2% deposit fee
        // This was calculated in previewDeposit() which deducts fee before share conversion
        super._deposit(caller, receiver, assets, shares);
        
        // Collect 0.2% deposit fee and transfer to RevenueRouter
        // Fee is taken from vault's balance (already received from caller)
        IERC20 fxrp = IERC20(asset());
        uint256 depositFee = (assets * DEPOSIT_FEE_BPS) / 10000;
        if (depositFee > 0) {
            fxrp.safeTransfer(revenueRouter, depositFee);
            emit FeeTransferred("deposit", depositFee, revenueRouter);
        }
    }
    
    /**
     * @dev Override ERC4626 _withdraw to implement buffer-aware withdrawals and collect fees
     * 
     * ERC4626 Compliance (Critical):
     * The 'shares' parameter is already fee-adjusted from previewWithdraw() or previewRedeem().
     * This ensures preview functions accurately reflect actual withdrawal outcomes.
     * 
     * Flow:
     * 1. Calculate gross assets from fee-adjusted shares
     * 2. Check if buffer has enough FXRP (user withdrawal + fee)
     * 3. If insufficient, pull from strategies into buffer
     * 4. super._withdraw() burns shares and transfers assets to user
     * 5. Fee is collected from vault balance and sent to RevenueRouter
     * 
     * Example (withdraw path):
     * - User calls withdraw(1000 FXRP)
     * - previewWithdraw(1000) returns shares worth 1002 FXRP (2 FXRP fee included)
     * - super._withdraw() burns shares worth 1002 FXRP, transfers 1000 to user
     * - 2 FXRP fee transferred to RevenueRouter for buyback & burn
     * 
     * Example (redeem path):
     * - User calls redeem(shares worth 1000 FXRP)
     * - previewRedeem(shares) returns 998 FXRP (2 FXRP fee deducted)
     * - super._withdraw() burns shares worth 1000 FXRP, transfers 998 to user
     * - 2 FXRP fee transferred to RevenueRouter for buyback & burn
     * 
     * Buffer Replenishment:
     * If vault buffer insufficient, pulls liquidity from strategies proportionally.
     * Preserves instant withdrawal UX when buffer has capacity.
     * 
     * @param caller Address initiating withdrawal
     * @param receiver Address receiving withdrawn FXRP
     * @param owner Address whose shares are being burned
     * @param assets Amount of FXRP to withdraw (what user receives)
     * @param shares Amount of shares to burn (fee-adjusted, more than just for assets)
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        IERC20 fxrp = IERC20(asset());
        
        // Calculate gross assets represented by shares (before fee deduction)
        // This includes both the user's withdrawal and the fee
        uint256 grossAssets = super.previewRedeem(shares);
        uint256 withdrawFee = grossAssets - assets;
        
        uint256 bufferBalance = fxrp.balanceOf(address(this));
        
        // Case 1: Buffer has enough for withdrawal + fee
        if (bufferBalance >= grossAssets) {
            // Use standard ERC4626 flow with fee-adjusted shares
            // The 'shares' parameter is already adjusted to account for 0.2% withdrawal fee
            // This was calculated in previewWithdraw() or previewRedeem()
            super._withdraw(caller, receiver, owner, assets, shares);
            
            // AFTER standard withdrawal, apply SHIELD staking boost bonus
            // Use owner parameter (not msg.sender) to query boost
            uint256 boostBps = stakingBoost.getBoost(owner);
            if (boostBps > 0) {
                uint256 boostBonus = (assets * boostBps) / 10000;
                if (boostBonus > 0) {
                    fxrp.safeTransfer(receiver, boostBonus);
                }
            }
            
            // Collect 0.2% withdrawal fee and transfer to RevenueRouter
            if (withdrawFee > 0) {
                fxrp.safeTransfer(revenueRouter, withdrawFee);
                emit FeeTransferred("withdraw", withdrawFee, revenueRouter);
            }
            return;
        }
        
        // Case 2: Buffer insufficient - replenish from strategies FIRST
        uint256 shortfall = grossAssets - bufferBalance;
        
        // Pull liquidity from strategies into buffer (including fee amount)
        _withdrawFromStrategies(shortfall);
        
        // Verify buffer now has enough for withdrawal + fee
        require(fxrp.balanceOf(address(this)) >= grossAssets, "Insufficient liquidity in vault and strategies");
        
        // Use standard ERC4626 flow with fee-adjusted shares
        super._withdraw(caller, receiver, owner, assets, shares);
        
        // AFTER standard withdrawal, apply SHIELD staking boost bonus
        // Use owner parameter (not msg.sender) to query boost
        uint256 boostBps = stakingBoost.getBoost(owner);
        if (boostBps > 0) {
            uint256 boostBonus = (assets * boostBps) / 10000;
            if (boostBonus > 0) {
                fxrp.safeTransfer(receiver, boostBonus);
            }
        }
        
        // Collect 0.2% withdrawal fee and transfer to RevenueRouter
        if (withdrawFee > 0) {
            fxrp.safeTransfer(revenueRouter, withdrawFee);
            emit FeeTransferred("withdraw", withdrawFee, revenueRouter);
        }
    }
    
    /**
     * @dev Withdraw FXRP from strategies proportionally
     * 
     * Helper for buffer-aware withdrawals.
     * Withdraws from active/paused strategies proportionally based on totalDeployed.
     * 
     * CRITICAL Accounting (Architect Requirements):
     * - Use balanceBefore/balanceAfter pattern for safe accounting
     * - Update totalDeployed with actual received amount
     * - Try/catch pattern: skip failed strategies, continue to next
     * - Emit WithdrawnFromStrategy event for each successful withdrawal
     * - ROUNDING FIX: Allocate remainder to last eligible strategy
     * 
     * Rounding Issue Fix (Architect Review):
     * Integer division rounds down, leaving unpaid remainder.
     * Example: shortfall=91, Kinetic=50%, Firelight=50%
     *   - Kinetic gets: (50*91)/100 = 45 (rounds down from 45.5)
     *   - Firelight gets: (50*91)/100 = 45 (rounds down from 45.5)
     *   - Total: 45+45 = 90, missing 1 FXRP!
     * Solution: Give last strategy the remainder (91-90=1)
     * 
     * Edge Cases Handled:
     * - Strategy returns less than requested (accept partial, continue)
     * - Strategy withdrawal fails (try/catch, skip to next)
     * - No strategies deployed (return 0)
     * - Total deployed is zero (return 0)
     * - Rounding remainder allocated to last strategy
     * 
     * @param amount Total amount needed from strategies
     * @return uint256 Actual amount withdrawn from all strategies
     */
    function _withdrawFromStrategies(uint256 amount) internal returns (uint256) {
        // Calculate total deployed across active/paused strategies
        uint256 totalDeployed = 0;
        address[] memory eligibleStrategies = new address[](strategyList.length);
        uint256 eligibleCount = 0;
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategy = strategyList[i];
            StrategyInfo storage info = strategies[strategy];
            
            // Include both Active and Paused strategies
            if ((info.status == StrategyStatus.Active || info.status == StrategyStatus.Paused) && 
                info.totalDeployed > 0) {
                totalDeployed += info.totalDeployed;
                eligibleStrategies[eligibleCount] = strategy;
                eligibleCount++;
            }
        }
        
        // Edge case: no strategies deployed
        if (totalDeployed == 0 || eligibleCount == 0) {
            return 0;
        }
        
        uint256 totalWithdrawn = 0;
        uint256 remainingToWithdraw = amount;
        IERC20 fxrp = IERC20(asset());
        
        // Withdraw proportionally from each eligible strategy
        for (uint256 i = 0; i < eligibleCount; i++) {
            address strategy = eligibleStrategies[i];
            StrategyInfo storage info = strategies[strategy];
            
            // Calculate this strategy's proportional share
            uint256 strategyAmount;
            
            // ROUNDING FIX: Last strategy gets remainder
            if (i == eligibleCount - 1) {
                // Last strategy: give it all remaining amount
                strategyAmount = remainingToWithdraw;
            } else {
                // Other strategies: proportional share (rounds down)
                strategyAmount = (info.totalDeployed * amount) / totalDeployed;
            }
            
            // EDGE CASE FIX: Cap request at strategy's totalDeployed
            // Prevents asking strategy for more than it has
            if (strategyAmount > info.totalDeployed) {
                strategyAmount = info.totalDeployed;
            }
            
            if (strategyAmount == 0 || remainingToWithdraw == 0) {
                continue;
            }
            
            // Request withdrawal from strategy (with safe accounting)
            uint256 balanceBefore = fxrp.balanceOf(address(this));
            
            try IStrategy(strategy).withdraw(strategyAmount, address(this)) returns (uint256 actualAmount) {
                uint256 balanceAfter = fxrp.balanceOf(address(this));
                
                // Verify funds actually received
                if (balanceAfter > balanceBefore) {
                    uint256 received = balanceAfter - balanceBefore;
                    
                    // Update tracking with safe accounting
                    if (info.totalDeployed >= received) {
                        info.totalDeployed -= received;
                    } else {
                        info.totalDeployed = 0;
                    }
                    
                    totalWithdrawn += received;
                    
                    // UNDERFLOW FIX: Cap decrement at remainingToWithdraw
                    // Prevents underflow if strategy returns more than requested (yield, rebates)
                    uint256 toDecrement = received < remainingToWithdraw ? received : remainingToWithdraw;
                    remainingToWithdraw -= toDecrement;
                    
                    // Emit event for transparency
                    emit WithdrawnFromStrategy(strategy, strategyAmount, actualAmount);
                }
            } catch {
                // Strategy withdrawal failed - skip to next strategy
                // This allows partial success rather than complete revert
                continue;
            }
        }
        
        return totalWithdrawn;
    }
    
    // ========================================
    // OPERATOR MANAGEMENT
    // ========================================
    
    /**
     * @dev Add an operator who can manage Firelight deposits
     * 
     * Operators coordinate:
     * - Deploying idle FXRP to Firelight for yield
     * - Withdrawing from Firelight when users redeem
     * - Rebalancing between vault and Firelight
     * 
     * @param operator Address of the operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        operators[operator] = true;
        emit OperatorAdded(operator);
    }
    
    /**
     * @dev Remove an operator
     * @param operator Address of the operator
     */
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }
    
    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    
    /**
     * @dev Update minimum deposit amount
     * @param newMinDeposit New minimum deposit (FXRP has 6 decimals)
     * 
     * Example: 0.01 FXRP = 10000 (0.01 * 10^6)
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        require(newMinDeposit > 0, "Min deposit must be positive");
        minDeposit = newMinDeposit;
        emit MinDepositUpdated(newMinDeposit);
    }
    
    /**
     * @dev Update maximum deposit limit
     * 
     * Security Feature (Firelight Protocol Pattern):
     * Controls total TVL to manage risk and match strategy capacity.
     * 
     * Recommended Progression:
     * 1. Beta Launch: 100K FXRP (~$210K at $2.10/XRP)
     * 2. Post-Audit: 1M FXRP (~$2.1M)
     * 3. Growth Phase: 10M FXRP (~$21M)
     * 4. Mature: Uncapped (type(uint256).max) if strategies support unlimited TVL
     * 
     * @param newDepositLimit New deposit limit in FXRP (6 decimals)
     * 
     * Example: 1M FXRP = 1_000_000e6 = 1000000000000
     */
    function setDepositLimit(uint256 newDepositLimit) external onlyOwner {
        require(newDepositLimit > 0, "Deposit limit must be positive");
        depositLimit = newDepositLimit;
        emit DepositLimitUpdated(newDepositLimit);
    }
    
    /**
     * @dev Pause all deposits and withdrawals
     * 
     * Emergency Stop (Firelight Protocol Pattern):
     * Immediately halts all vault operations to contain exploits or vulnerabilities.
     * 
     * Use Cases:
     * - Critical bug discovered in vault or strategy
     * - Ongoing exploit/attack detected
     * - Suspicious activity requiring investigation
     * - Major protocol upgrade requiring migration
     * 
     * Effects When Paused:
     * - ❌ deposit() reverts
     * - ❌ mint() reverts
     * - ❌ withdraw() reverts
     * - ❌ redeem() reverts
     * - ✅ View functions still work (totalAssets, balanceOf, etc.)
     * - ✅ Owner can still manage strategies (emergency withdrawals)
     * 
     * Recovery:
     * Call unpause() after issue is resolved.
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause deposits and withdrawals
     * 
     * Restores normal vault operations after emergency pause.
     * 
     * Requirements:
     * - Only owner can unpause
     * - Vault must currently be paused
     * - Issue that caused pause must be resolved
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ========================================
    // BOOST DONATION (SHIELD STAKING REWARDS)
    // ========================================
    
    /**
     * @dev Donate FXRP on behalf of a specific user by minting shXRP shares
     * 
     * This function enables the weighted yield boost mechanism:
     * - StakingBoost contract calls this after distributeBoost()
     * - FXRP is transferred from caller and converted to shXRP shares
     * - Shares are minted ONLY to the specified user (not all holders)
     * - This gives SHIELD stakers proportionally more yield
     * 
     * Security:
     * - Only callable by StakingBoost contract
     * - Uses SafeERC20 for secure transfers
     * - NonReentrant to prevent reentrancy attacks
     * 
     * Flow:
     * 1. StakingBoost calculates user's pro-rata FXRP reward
     * 2. StakingBoost approves this vault for FXRP
     * 3. StakingBoost calls donateOnBehalf(user, fxrpAmount)
     * 4. Vault transfers FXRP from StakingBoost
     * 5. Vault mints equivalent shXRP shares to user
     * 6. User's shXRP balance increases (yield boost applied)
     * 
     * @param user Address to receive the minted shXRP shares
     * @param fxrpAmount Amount of FXRP to donate (transferred from caller)
     * @return sharesMinted Amount of shXRP shares minted to user
     */
    function donateOnBehalf(address user, uint256 fxrpAmount) 
        external 
        nonReentrant 
        returns (uint256 sharesMinted) 
    {
        require(msg.sender == address(stakingBoost), "Only StakingBoost can donate");
        require(user != address(0), "Invalid user address");
        require(fxrpAmount > 0, "Amount must be positive");
        
        IERC20 fxrp = IERC20(asset());
        
        // Transfer FXRP from StakingBoost to vault
        fxrp.safeTransferFrom(msg.sender, address(this), fxrpAmount);
        
        // Calculate shares to mint based on current exchange rate
        // Using the standard ERC4626 conversion (no fees on donations)
        sharesMinted = _convertToShares(fxrpAmount, Math.Rounding.Floor);
        
        // Mint shares directly to user
        if (sharesMinted > 0) {
            _mint(user, sharesMinted);
        }
        
        emit DonatedOnBehalf(user, fxrpAmount, sharesMinted);
        
        return sharesMinted;
    }
    
    // ========================================
    // STRATEGY MANAGEMENT
    // ========================================
    
    /**
     * @dev Add a new yield strategy to the vault
     * 
     * CRITICAL FIX (Architect Review):
     * Validates aggregate target allocations to prevent over-allocation
     * 
     * Validation:
     * - Strategy address must be valid contract
     * - Strategy must implement IStrategy interface
     * - Strategy asset must match vault asset (FXRP)
     * - Strategy cannot already exist
     * - Total allocations (buffer + all strategies) cannot exceed 100%
     * 
     * Example:
     * - Buffer target: 10% (1000 bps)
     * - Kinetic target: 40% (4000 bps)
     * - Firelight target: 50% (5000 bps)
     * - Total: 100% (10000 bps) ✓
     * 
     * @param strategy Address of IStrategy contract
     * @param targetBps Target allocation in basis points (10000 = 100%)
     */
    function addStrategy(address strategy, uint256 targetBps) external onlyOwner {
        require(strategy != address(0), "Invalid strategy address");
        require(strategies[strategy].strategyAddress == address(0), "Strategy already exists");
        require(targetBps <= 10000, "Target cannot exceed 100%");
        
        // CRITICAL: Validate aggregate allocation doesn't exceed 100%
        uint256 newTotalTargets = totalStrategyTargetBps + targetBps + bufferTargetBps;
        require(newTotalTargets <= 10000, "Total targets exceed 100%");
        
        // Verify strategy implements IStrategy and uses correct asset
        try IStrategy(strategy).asset() returns (address strategyAsset) {
            require(strategyAsset == address(asset()), "Strategy asset mismatch");
        } catch {
            revert("Invalid strategy contract");
        }
        
        // Add to mapping and list
        strategies[strategy] = StrategyInfo({
            strategyAddress: strategy,
            targetBps: targetBps,
            status: StrategyStatus.Inactive,  // Start inactive, activate manually
            totalDeployed: 0,
            lastReportTimestamp: block.timestamp
        });
        strategyList.push(strategy);
        
        // Update aggregate tracking
        totalStrategyTargetBps += targetBps;
        
        emit StrategyAdded(strategy, targetBps);
    }
    
    /**
     * @dev Remove a strategy from the vault
     * 
     * Requirements:
     * - All funds must be withdrawn from strategy first
     * - Strategy must exist
     * - Safer to deprecate first, then remove after cooldown
     * 
     * Updates aggregate target tracking when removing strategy.
     * 
     * @param strategy Address of strategy to remove
     */
    function removeStrategy(address strategy) external onlyOwner {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].totalDeployed == 0, "Strategy still has funds");
        
        // Update aggregate tracking before removal
        totalStrategyTargetBps -= strategies[strategy].targetBps;
        
        // Remove from mapping
        delete strategies[strategy];
        
        // Remove from list (swap with last, then pop)
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (strategyList[i] == strategy) {
                strategyList[i] = strategyList[strategyList.length - 1];
                strategyList.pop();
                break;
            }
        }
        
        emit StrategyRemoved(strategy);
    }
    
    /**
     * @dev Update target allocation for a strategy
     * 
     * CRITICAL FIX (Architect Review):
     * Validates aggregate targets don't exceed 100% after update
     * 
     * Note: This only updates the target. Actual rebalancing
     * must be triggered separately via deployToStrategy/withdrawFromStrategy.
     * 
     * @param strategy Address of strategy
     * @param newTargetBps New target allocation in basis points
     */
    function updateAllocation(address strategy, uint256 newTargetBps) external onlyOwner {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(newTargetBps <= 10000, "Target cannot exceed 100%");
        
        // Calculate new aggregate (remove old target, add new target)
        uint256 oldTargetBps = strategies[strategy].targetBps;
        uint256 newTotalTargets = totalStrategyTargetBps - oldTargetBps + newTargetBps + bufferTargetBps;
        require(newTotalTargets <= 10000, "Total targets exceed 100%");
        
        // Update tracking
        totalStrategyTargetBps = totalStrategyTargetBps - oldTargetBps + newTargetBps;
        strategies[strategy].targetBps = newTargetBps;
        
        emit StrategyAllocationUpdated(strategy, newTargetBps);
    }
    
    /**
     * @dev Deploy FXRP from vault buffer to a strategy
     * 
     * CRITICAL FIX (Architect Review):
     * Uses approval pattern to prevent double-counting in totalAssets()
     * 
     * Flow:
     * 1. Check vault has sufficient buffer
     * 2. Approve strategy to pull FXRP from vault
     * 3. Call strategy.deploy(amount) - strategy pulls via transferFrom
     * 4. Verify vault balance actually decreased (strategy pulled funds)
     * 5. Update totalDeployed tracking
     * 
     * Why this fixes double-counting:
     * - Vault balance decreases atomically when strategy calls transferFrom
     * - No intermediate state where FXRP sits on strategy contract
     * - totalAssets() = vault balance (reduced) + strategy.totalAssets() (external holdings) ✓
     * 
     * @param strategy Address of strategy to deploy to
     * @param amount Amount of FXRP to deploy
     */
    function deployToStrategy(address strategy, uint256 amount) external onlyOperator nonReentrant {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].status == StrategyStatus.Active, "Strategy not active");
        require(amount > 0, "Amount must be positive");
        
        IERC20 fxrp = IERC20(asset());
        uint256 vaultBalanceBefore = fxrp.balanceOf(address(this));
        require(vaultBalanceBefore >= amount, "Insufficient vault balance");
        
        // Approve strategy to pull FXRP from vault (using SafeERC20)
        fxrp.forceApprove(strategy, amount);
        
        // Strategy pulls FXRP and deploys to external protocol
        // This ensures vault balance decreases atomically
        IStrategy(strategy).deploy(amount);
        
        // Verify funds actually left vault (strategy must have pulled them)
        uint256 vaultBalanceAfter = fxrp.balanceOf(address(this));
        uint256 actualDeployed = vaultBalanceBefore - vaultBalanceAfter;
        require(actualDeployed > 0, "Strategy did not pull funds");
        require(actualDeployed <= amount, "Strategy pulled more than approved");
        
        // Update tracking with actual deployed amount
        strategies[strategy].totalDeployed += actualDeployed;
        
        // Clear any leftover approval (using SafeERC20)
        if (fxrp.allowance(address(this), strategy) > 0) {
            fxrp.forceApprove(strategy, 0);
        }
        
        emit DeployedToStrategy(strategy, actualDeployed);
    }
    
    /**
     * @dev Withdraw FXRP from a strategy back to vault buffer
     * 
     * CRITICAL FIX (Architect Review):
     * Safely handles partial withdrawals and accounting edge cases
     * 
     * Flow:
     * 1. Record vault balance before withdrawal
     * 2. Call strategy.withdraw(amount, address(this))
     * 3. Verify vault balance increased (funds received)
     * 4. Update totalDeployed tracking with actual received amount
     * 
     * Edge Cases Handled:
     * - Strategy returns less than requested (partial withdrawal)
     * - Strategy has withdrawal fees (received < requested)
     * - totalDeployed underflow protection
     * 
     * @param strategy Address of strategy to withdraw from
     * @param amount Amount of FXRP to withdraw
     */
    function withdrawFromStrategy(address strategy, uint256 amount) external onlyOperator nonReentrant {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(amount > 0, "Amount must be positive");
        require(amount <= strategies[strategy].totalDeployed, "Withdraw exceeds deployed");
        
        uint256 balanceBefore = IERC20(asset()).balanceOf(address(this));
        
        // Request withdrawal from strategy
        uint256 actualAmount = IStrategy(strategy).withdraw(amount, address(this));
        
        uint256 balanceAfter = IERC20(asset()).balanceOf(address(this));
        
        // Verify funds were received (prevents underflow)
        require(balanceAfter >= balanceBefore, "Vault balance decreased");
        uint256 received = balanceAfter - balanceBefore;
        require(received > 0, "No funds received from strategy");
        
        // Update tracking with actual received amount (safe from underflow)
        if (strategies[strategy].totalDeployed >= received) {
            strategies[strategy].totalDeployed -= received;
        } else {
            // Edge case: received more than tracked (profit from yield)
            strategies[strategy].totalDeployed = 0;
        }
        
        emit WithdrawnFromStrategy(strategy, amount, actualAmount);
    }
    
    /**
     * @dev Pause a strategy (emergency stop)
     * 
     * Paused strategies:
     * - Stop receiving new deployments
     * - Still counted in totalAssets()
     * - Can be resumed by owner
     * 
     * @param strategy Address of strategy to pause
     */
    function pauseStrategy(address strategy) external onlyOperator {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].status == StrategyStatus.Active, "Strategy not active");
        
        strategies[strategy].status = StrategyStatus.Paused;
        emit StrategyStatusUpdated(strategy, StrategyStatus.Paused);
    }
    
    /**
     * @dev Resume a paused strategy
     * 
     * @param strategy Address of strategy to resume
     */
    function resumeStrategy(address strategy) external onlyOwner {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].status == StrategyStatus.Paused, "Strategy not paused");
        
        strategies[strategy].status = StrategyStatus.Active;
        emit StrategyStatusUpdated(strategy, StrategyStatus.Active);
    }
    
    /**
     * @dev Activate an inactive strategy
     * 
     * New strategies start as Inactive and must be explicitly activated.
     * 
     * @param strategy Address of strategy to activate
     */
    function activateStrategy(address strategy) external onlyOwner {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].status == StrategyStatus.Inactive, "Strategy not inactive");
        
        strategies[strategy].status = StrategyStatus.Active;
        emit StrategyStatusUpdated(strategy, StrategyStatus.Active);
    }
    
    /**
     * @dev Report strategy performance and harvest profits
     * 
     * ERC4626 Compliance (Critical):
     * This function ensures accurate accounting by properly handling yield fees.
     * 
     * Strategy Profit Flow:
     * 1. Strategies REINVEST profits (not transferred to vault buffer)
     * 2. strategy.report() returns profit/loss amounts, but assets stay in strategy
     * 3. Vault must PULL fee from strategy to collect it
     * 
     * Yield Fee Application:
     * - Deducts 0.1% (adjustable) yield routing fee from profits
     * - Fee PULLED from strategy to vault, then transferred to RevenueRouter
     * - Net profit remains in strategy, increasing share value
     * 
     * Accounting Flow:
     * 1. Strategy reports: profit=10, loss=0, assetsAfter=110 (reinvested)
     * 2. Calculate yieldFee = 10 * 0.001 = 0.01
     * 3. Pull 0.01 from strategy to vault
     * 4. Transfer 0.01 from vault to revenueRouter
     * 5. Update totalDeployed = 110 - 0.01 = 109.99
     * 
     * This ensures totalAssets() accurately reflects vault holdings:
     * - Buffer + strategy.totalAssets() = buffer + 109.99 (correct)
     * - Fee sent to revenueRouter (not counted in totalAssets)
     * - No double-counting, no under-collateralization
     * 
     * Can be called by anyone (useful for keepers/bots).
     * 
     * @param strategy Address of strategy to report
     */
    function reportStrategy(address strategy) external {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        require(strategies[strategy].status == StrategyStatus.Active, "Strategy not active");
        
        // Trigger strategy report (returns profit, loss, totalAssets)
        (uint256 profit, uint256 loss, uint256 assetsAfter) = IStrategy(strategy).report();
        
        // Collect yield routing fee by accruing it internally
        // ERC-4626 compliant: we don't mint unbacked shares
        // Instead, we track fees owed and claim from vault buffer or future withdrawals
        if (profit > 0 && yieldRoutingFeeBps > 0) {
            uint256 yieldFee = (profit * yieldRoutingFeeBps) / 10000;
            
            if (yieldFee > 0) {
                // Accrue fee internally - it will be claimed via claimAccruedFees()
                accruedProtocolFees += yieldFee;
                emit ProtocolFeesAccrued(strategy, yieldFee, accruedProtocolFees);
            }
        }
        
        // Update strategy accounting
        strategies[strategy].totalDeployed = assetsAfter;
        strategies[strategy].lastReportTimestamp = block.timestamp;
        
        // Emit event
        emit StrategyReported(strategy, profit, loss, assetsAfter);
    }
    
    /**
     * @dev Update buffer target allocation
     * 
     * CRITICAL FIX (Architect Review):
     * Validates aggregate targets don't exceed 100% after buffer update
     * 
     * Buffer is FXRP held in vault for instant withdrawals.
     * Default: 1000 bps = 10%
     * 
     * @param newTargetBps New buffer target in basis points
     */
    function setBufferTarget(uint256 newTargetBps) external onlyOwner {
        require(newTargetBps <= 10000, "Target cannot exceed 100%");
        
        // Validate aggregate allocation with new buffer target
        uint256 newTotalTargets = totalStrategyTargetBps + newTargetBps;
        require(newTotalTargets <= 10000, "Total targets exceed 100%");
        
        bufferTargetBps = newTargetBps;
        emit BufferTargetUpdated(newTargetBps);
    }
    
    /**
     * @dev Update yield routing fee
     * 
     * Fee is accrued from strategy profits and claimed via claimAccruedFees().
     * This ERC-4626 compliant approach avoids minting unbacked shares.
     * 
     * Max fee: 500 bps = 5% of profits
     * Default: 10 bps = 0.1% of profits
     * 
     * @param newFeeBps New yield routing fee in basis points
     */
    function setYieldRoutingFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "Yield fee cannot exceed 5%");
        yieldRoutingFeeBps = newFeeBps;
        emit YieldRoutingFeeUpdated(newFeeBps);
    }
    
    /**
     * @dev Claim accrued protocol fees (ERC-4626 compliant)
     * 
     * Fees are accrued when strategies report profit via reportStrategy().
     * This function claims fees from the vault's FXRP buffer and sends to RevenueRouter.
     * 
     * Security:
     * - Only owner or operators can claim fees
     * - Fees are only claimed from available buffer (no strategy withdrawals)
     * - If buffer is insufficient, only available amount is claimed
     * 
     * Flow:
     * 1. Check buffer balance
     * 2. Claim min(accruedFees, bufferBalance)
     * 3. Transfer FXRP to RevenueRouter
     * 4. Reduce accruedFees by claimed amount
     * 
     * @return claimed Amount of FXRP claimed and sent to RevenueRouter
     */
    function claimAccruedFees() external onlyOperator returns (uint256 claimed) {
        if (accruedProtocolFees == 0) {
            return 0;
        }
        
        // Get available buffer balance
        uint256 bufferBalance = IERC20(asset()).balanceOf(address(this));
        
        // Claim up to the available buffer
        claimed = accruedProtocolFees > bufferBalance ? bufferBalance : accruedProtocolFees;
        
        if (claimed > 0) {
            // Reduce accrued fees
            accruedProtocolFees -= claimed;
            
            // Transfer to RevenueRouter
            SafeERC20.safeTransfer(IERC20(asset()), revenueRouter, claimed);
            
            emit ProtocolFeesClaimed(claimed, revenueRouter);
        }
        
        return claimed;
    }
    
    // ========================================
    // ERC4626 PREVIEW FUNCTIONS (FEE-ADJUSTED)
    // ========================================
    
    /**
     * @dev Preview how many shares will be minted for asset deposit
     * 
     * ERC4626 Compliance (Critical):
     * This MUST reflect the actual shares received after accounting for fees.
     * 
     * Fee Logic:
     * 1. Deduct 0.2% deposit fee from assets
     * 2. Convert net assets to shares using standard ERC4626 math
     * 
     * Example:
     * - User deposits 1000 FXRP
     * - Fee: 1000 * 0.002 = 2 FXRP (sent to RevenueRouter)
     * - Net: 998 FXRP (converted to shares)
     * - User receives shares worth 998 FXRP, not 1000 FXRP
     * 
     * @param assets Amount of FXRP to deposit (gross amount)
     * @return shares Amount of shXRP that will be minted (fee-adjusted)
     */
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        uint256 fee = (assets * DEPOSIT_FEE_BPS) / 10000;
        uint256 netAssets = assets - fee;
        return super.previewDeposit(netAssets);
    }
    
    /**
     * @dev Preview how many assets are needed to mint exact shares
     * 
     * ERC4626 Compliance (Critical):
     * This MUST reflect the actual assets needed after accounting for fees.
     * 
     * Fee Logic:
     * 1. Calculate net assets needed for shares (using standard ERC4626 math)
     * 2. Gross up to account for 0.2% deposit fee
     * 
     * Math:
     * - grossAssets * (1 - 0.002) = netAssets
     * - grossAssets = netAssets / 0.998
     * - grossAssets = netAssets * 10000 / 9980
     * 
     * Example:
     * - User wants shares worth 998 FXRP
     * - Net assets needed: 998 FXRP
     * - Gross assets: 998 * 10000 / 9980 = 1000 FXRP
     * - User deposits 1000 FXRP, fee is 2 FXRP, net is 998 FXRP
     * 
     * @param shares Amount of shXRP to mint
     * @return assets Amount of FXRP needed (fee-adjusted)
     */
    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        uint256 netAssets = super.previewMint(shares);
        return (netAssets * 10000) / (10000 - DEPOSIT_FEE_BPS);
    }
    
    /**
     * @dev Preview how many shares will be burned for asset withdrawal
     * 
     * ERC4626 Compliance (Critical):
     * This MUST reflect the actual shares burned after accounting for fees.
     * 
     * Fee Logic:
     * 1. User wants 'assets' FXRP
     * 2. Vault needs to provide assets + 0.2% fee
     * 3. Convert total assets to shares using standard ERC4626 math
     * 
     * Example:
     * - User wants 1000 FXRP
     * - Fee: 1000 * 0.002 = 2 FXRP (sent to RevenueRouter)
     * - Total needed: 1002 FXRP
     * - Burn shares worth 1002 FXRP
     * - User receives 1000 FXRP, fee is 2 FXRP
     * 
     * @param assets Amount of FXRP to withdraw
     * @return shares Amount of shXRP that will be burned (fee-adjusted)
     */
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        uint256 fee = (assets * WITHDRAW_FEE_BPS) / 10000;
        uint256 totalAssetsNeeded = assets + fee;
        return super.previewWithdraw(totalAssetsNeeded);
    }
    
    /**
     * @dev Preview how many assets will be received for share redemption
     * 
     * ERC4626 Compliance (Critical):
     * This MUST be a pure view function that reflects base redemption without user-specific boosts.
     * 
     * Fee Logic:
     * 1. Convert shares to gross assets using standard ERC4626 math
     * 2. Deduct 0.2% withdrawal fee
     * 3. Return net assets (NO BOOST - that's applied in _withdraw)
     * 
     * Example:
     * - User redeems shares worth 1000 FXRP
     * - Gross assets: 1000 FXRP
     * - Fee: 1000 * 0.002 = 2 FXRP (sent to RevenueRouter)
     * - Net: 998 FXRP (returned)
     * 
     * NOTE: Boost is NOT applied here to maintain ERC-4626 compliance.
     * Use previewRedeemWithBoost() for frontend display of boosted amounts.
     * Actual boost is applied in _withdraw() using the owner parameter.
     * 
     * @param shares Amount of shXRP to redeem
     * @return assets Amount of FXRP that will be received (fee-adjusted, NO boost)
     */
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        uint256 grossAssets = super.previewRedeem(shares);
        uint256 fee = (grossAssets * WITHDRAW_FEE_BPS) / 10000;
        return grossAssets - fee;
    }
    
    /**
     * @dev Preview how many assets will be received for share redemption WITH boost
     * 
     * Helper function for frontends to query boosted redemption amounts.
     * This is NOT part of ERC-4626 standard, but useful for UX.
     * 
     * Flow:
     * 1. Get base redemption amount from previewRedeem() (fee-adjusted)
     * 2. Query user's SHIELD staking boost
     * 3. Apply boost bonus
     * 
     * Example:
     * - User redeems shares worth 1000 FXRP
     * - Base redemption: 998 FXRP (after 0.2% fee)
     * - User has 500 SHIELD staked → boost = 5% = 500 bps
     * - Boost bonus: 998 * 500 / 10000 = 49.9 FXRP
     * - Total: 998 + 49.9 = 1047.9 FXRP
     * 
     * @param shares Amount of shXRP to redeem
     * @param user Address of the user (to query their boost)
     * @return assets Amount of FXRP that will be received (fee-adjusted + boosted)
     */
    function previewRedeemWithBoost(uint256 shares, address user) public view returns (uint256) {
        uint256 baseAssets = previewRedeem(shares);
        uint256 boostBps = stakingBoost.getBoost(user);
        if (boostBps == 0) {
            return baseAssets;
        }
        uint256 boostBonus = (baseAssets * boostBps) / 10000;
        return baseAssets + boostBonus;
    }
    
    // ========================================
    // BUFFER & STRATEGY VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Get current FXRP balance held in vault buffer
     * 
     * Buffer is used for:
     * - Instant withdrawals (no strategy unwinding delay)
     * - Gas for rebalancing operations
     * - Safety cushion for strategy failures
     * 
     * @return Current FXRP balance in vault
     */
    function getBufferBalance() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
    
    /**
     * @dev Calculate target buffer size based on totalAssets
     * 
     * Formula: targetBuffer = totalAssets() * bufferTargetBps / 10000
     * Example: If totalAssets = 1M FXRP and bufferTargetBps = 1000 (10%)
     *          then targetBuffer = 100K FXRP
     * 
     * @return Target buffer amount in FXRP
     */
    function getBufferTarget() public view returns (uint256) {
        return (totalAssets() * bufferTargetBps) / 10000;
    }
    
    /**
     * @dev Get comprehensive buffer status for monitoring
     * 
     * Returns:
     * - current: Current FXRP in buffer
     * - target: Target FXRP buffer based on allocation
     * - deficit: Amount below target (0 if above target)
     * - surplus: Amount above target (0 if below target)
     * - targetBps: Target buffer as % of totalAssets
     * 
     * @return current Current buffer balance
     * @return target Target buffer balance
     * @return deficit Amount below target
     * @return surplus Amount above target
     * @return targetBps Buffer target in basis points
     */
    function getBufferStatus() 
        public 
        view 
        returns (
            uint256 current,
            uint256 target,
            uint256 deficit,
            uint256 surplus,
            uint256 targetBps
        ) 
    {
        current = getBufferBalance();
        target = getBufferTarget();
        targetBps = bufferTargetBps;
        
        if (current < target) {
            deficit = target - current;
            surplus = 0;
        } else {
            deficit = 0;
            surplus = current - target;
        }
    }
    
    /**
     * @dev Get total FXRP deployed across all strategies
     * 
     * @return Total FXRP deployed to strategies
     */
    function getTotalDeployed() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < strategyList.length; i++) {
            total += strategies[strategyList[i]].totalDeployed;
        }
        return total;
    }
    
    /**
     * @dev Get detailed info for a specific strategy
     * 
     * @param strategy Address of strategy
     * @return info StrategyInfo struct with all details
     */
    function getStrategyInfo(address strategy) public view returns (StrategyInfo memory info) {
        require(strategies[strategy].strategyAddress != address(0), "Strategy does not exist");
        return strategies[strategy];
    }
    
    /**
     * @dev Get list of all strategy addresses
     * 
     * @return Array of strategy addresses
     */
    function getAllStrategies() public view returns (address[] memory) {
        return strategyList;
    }
    
    /**
     * @dev Get list of only active strategy addresses
     * 
     * @return Array of active strategy addresses
     */
    function getActiveStrategies() public view returns (address[] memory) {
        // First count active strategies
        uint256 activeCount = 0;
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (strategies[strategyList[i]].status == StrategyStatus.Active) {
                activeCount++;
            }
        }
        
        // Create array of active strategies
        address[] memory activeList = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (strategies[strategyList[i]].status == StrategyStatus.Active) {
                activeList[index] = strategyList[i];
                index++;
            }
        }
        
        return activeList;
    }
    
    /**
     * @dev Get current allocation percentages for monitoring
     * 
     * Returns arrays of:
     * - strategies: Strategy addresses
     * - allocations: Current allocation in basis points (calculated from totalAssets)
     * - targets: Target allocation in basis points (from StrategyInfo)
     * 
     * @return strategies_ Array of strategy addresses
     * @return allocations Array of current allocations (bps)
     * @return targets Array of target allocations (bps)
     */
    function getCurrentAllocations() 
        public 
        view 
        returns (
            address[] memory strategies_,
            uint256[] memory allocations,
            uint256[] memory targets
        ) 
    {
        uint256 totalAssets_ = totalAssets();
        uint256 length = strategyList.length;
        
        strategies_ = new address[](length + 1); // +1 for buffer
        allocations = new uint256[](length + 1);
        targets = new uint256[](length + 1);
        
        // Buffer entry (index 0)
        strategies_[0] = address(0); // Use address(0) to represent buffer
        if (totalAssets_ > 0) {
            allocations[0] = (getBufferBalance() * 10000) / totalAssets_;
        }
        targets[0] = bufferTargetBps;
        
        // Strategy entries
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            strategies_[i + 1] = strategy;
            
            // Calculate current allocation
            if (totalAssets_ > 0 && strategies[strategy].status == StrategyStatus.Active) {
                try IStrategy(strategy).totalAssets() returns (uint256 strategyAssets) {
                    allocations[i + 1] = (strategyAssets * 10000) / totalAssets_;
                } catch {
                    allocations[i + 1] = (strategies[strategy].totalDeployed * 10000) / totalAssets_;
                }
            }
            
            targets[i + 1] = strategies[strategy].targetBps;
        }
    }
}
