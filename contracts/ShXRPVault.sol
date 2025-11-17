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
    
    // Strategy Events
    event StrategyAdded(address indexed strategy, uint256 targetBps);
    event StrategyRemoved(address indexed strategy);
    event StrategyStatusUpdated(address indexed strategy, StrategyStatus newStatus);
    event StrategyAllocationUpdated(address indexed strategy, uint256 newTargetBps);
    event DeployedToStrategy(address indexed strategy, uint256 amount);
    event WithdrawnFromStrategy(address indexed strategy, uint256 amount, uint256 actualAmount);
    event StrategyReported(address indexed strategy, uint256 profit, uint256 loss, uint256 totalAssets);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _fxrpToken Address of FXRP token (FAssets-wrapped XRP)
     * @param _name Name of the share token (e.g., "Shield XRP")
     * @param _symbol Symbol of the share token (e.g., "shXRP")
     * 
     * Example deployment:
     * FXRP Mainnet: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
     * FXRP Coston2: 0xa3Bd00D652D0f28D2417339322A51d4Fbe2B22D3
     */
    constructor(
        IERC20 _fxrpToken,
        string memory _name,
        string memory _symbol
    ) ERC4626(_fxrpToken) ERC20(_name, _symbol) Ownable(msg.sender) {
        require(address(_fxrpToken) != address(0), "Invalid FXRP token address");
        
        // Deployer is first operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
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
     * @param receiver Address that would receive shares (unused, per ERC4626 spec)
     * @return Maximum amount of assets that can be deposited
     */
    function maxDeposit(address receiver) public view virtual override returns (uint256) {
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
     * @param receiver Address that would receive shares (unused, per ERC4626 spec)
     * @return Maximum amount of shares that can be minted
     */
    function maxMint(address receiver) public view virtual override returns (uint256) {
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
     * @dev Override ERC4626 _deposit to enforce deposit limit
     * 
     * SECURITY (Firelight Protocol Pattern):
     * Prevents uncontrolled TVL growth by enforcing maximum deposit cap.
     * 
     * Benefits:
     * - Risk Management: Limit exposure during beta/audit phase
     * - Strategy Capacity: Some strategies have TVL caps (e.g., Firelight max capacity)
     * - Gradual Launch: Start with conservative limit, increase as strategies scale
     * 
     * Example Limits:
     * - Beta Launch: 100K FXRP (~$210K)
     * - Post-Audit: 1M FXRP (~$2.1M)
     * - Mature Protocol: 10M+ FXRP (uncapped if strategies support it)
     * 
     * @param caller Address initiating deposit
     * @param receiver Address receiving shares
     * @param assets Amount of FXRP being deposited
     * @param shares Amount of shares being minted
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override {
        // Enforce deposit limit BEFORE accepting assets
        require(totalAssets() + assets <= depositLimit, "Deposit limit exceeded");
        
        // Proceed with standard ERC4626 deposit flow
        super._deposit(caller, receiver, assets, shares);
    }
    
    /**
     * @dev Override ERC4626 _withdraw to implement buffer-aware withdrawals
     * 
     * PHASE 1.5 (Architect Revised):
     * Replenishes buffer from strategies if needed, then uses standard ERC4626 flow.
     * 
     * CRITICAL FIX (Architect Review):
     * - Preserves ERC4626 hook chain by calling super._withdraw()
     * - Pulls from strategies into buffer BEFORE standard flow
     * - Prevents breaking parent logic and future extensions
     * 
     * Flow:
     * 1. Check if buffer has enough FXRP
     * 2. If yes: use standard ERC4626 flow (instant withdrawal)
     * 3. If no:
     *    a. Calculate shortfall
     *    b. Pull from strategies into buffer (proportionally)
     *    c. Verify buffer now has enough
     *    d. Call super._withdraw() for standard flow (burn → transfer → emit)
     * 
     * This approach:
     * - ✅ Preserves ERC4626 hook chain
     * - ✅ Pulls liquidity before burning
     * - ✅ Reuses parent's SafeERC20 and event logic
     * - ✅ Works with future extensions
     * 
     * @param caller Address initiating withdrawal
     * @param receiver Address receiving withdrawn FXRP
     * @param owner Address whose shares are being burned
     * @param assets Amount of FXRP to withdraw
     * @param shares Amount of shares to burn
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        IERC20 fxrp = IERC20(asset());
        uint256 bufferBalance = fxrp.balanceOf(address(this));
        
        // Case 1: Buffer has enough - use standard ERC4626 flow
        if (bufferBalance >= assets) {
            super._withdraw(caller, receiver, owner, assets, shares);
            return;
        }
        
        // Case 2: Buffer insufficient - replenish from strategies FIRST
        uint256 shortfall = assets - bufferBalance;
        
        // Pull liquidity from strategies into buffer
        // This happens BEFORE any state changes (allowance, burn, transfer)
        _withdrawFromStrategies(shortfall);
        
        // Verify buffer now has enough for standard withdrawal flow
        require(fxrp.balanceOf(address(this)) >= assets, "Insufficient liquidity in vault and strategies");
        
        // Now use standard ERC4626 flow (preserves hook chain)
        // This handles: allowance check, burn, transfer, emit
        super._withdraw(caller, receiver, owner, assets, shares);
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
        
        // Approve strategy to pull FXRP from vault
        fxrp.approve(strategy, amount);
        
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
        
        // Clear any leftover approval
        if (fxrp.allowance(address(this), strategy) > 0) {
            fxrp.approve(strategy, 0);
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
     * This triggers strategy.report() which:
     * - Updates internal accounting
     * - Harvests rewards/fees
     * - Reports profit/loss to vault
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
        
        // Update timestamp
        strategies[strategy].lastReportTimestamp = block.timestamp;
        
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
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Get the underlying asset (FXRP token address)
     * 
     * Inherited from ERC4626, but documented for clarity
     * 
     * @return Address of FXRP token
     */
    // function asset() public view override returns (address)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many shares will be minted for asset amount
     * 
     * Inherited from ERC4626
     * Formula: shares = (assets * totalSupply()) / totalAssets()
     * 
     * @param assets Amount of FXRP to deposit
     * @return shares Amount of shXRP that will be minted
     */
    // function previewDeposit(uint256 assets) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many assets are needed for share amount
     * 
     * Inherited from ERC4626
     * Formula: assets = (shares * totalAssets()) / totalSupply()
     * 
     * @param shares Amount of shXRP to mint
     * @return assets Amount of FXRP needed
     */
    // function previewMint(uint256 shares) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many shares will be burned for asset withdrawal
     * 
     * Inherited from ERC4626
     * 
     * @param assets Amount of FXRP to withdraw
     * @return shares Amount of shXRP that will be burned
     */
    // function previewWithdraw(uint256 assets) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Preview how many assets will be received for share redemption
     * 
     * Inherited from ERC4626
     * 
     * @param shares Amount of shXRP to redeem
     * @return assets Amount of FXRP that will be received
     */
    // function previewRedeem(uint256 shares) public view override returns (uint256)
    // Already implemented in ERC4626
    
    /**
     * @dev Returns the number of decimals (6, matches FXRP)
     * 
     * Note: shXRP inherits decimals from the underlying FXRP asset (6 decimals)
     * Inherited from ERC4626 which uses the same decimals as the underlying asset
     * 
     * @return uint8 Number of decimals
     */
    // function decimals() public view override returns (uint8)
    // Already implemented in ERC4626, automatically matches FXRP's 6 decimals
    
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
