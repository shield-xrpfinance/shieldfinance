// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IShieldToken.sol";
import "./interfaces/IUniswapV3Router.sol";

/**
 * @dev Interface for StakingBoost to distribute yield boosts
 */
interface IStakingBoostDistributor {
    function distributeBoost(uint256 fxrpAmount) external;
}

/**
 * @title RevenueRouter
 * @dev Routes protocol revenue (FXRP): SHIELD burn + yield boost to stakers
 * 
 * Revenue Flow:
 * 1. Receives FXRP fees from vault operations (deposit/withdraw fees)
 * 2. Splits revenue: burnAllocationBps% → swap to SHIELD & burn
 * 3. boostAllocationBps% → direct to StakingBoost for staker yield
 * 4. Rest kept as protocol reserves (withdrawable by owner)
 * 
 * Example with default allocations (50% burn, 40% boost, 10% reserves):
 * - 1000 FXRP received
 * - 500 FXRP → swap to SHIELD → burn (deflationary)
 * - 400 FXRP → StakingBoost.distributeBoost() for stakers
 * - 100 FXRP → protocol reserves
 * 
 * Security Features:
 * - Uses SafeERC20 forceApprove for safe token approvals
 * - Configurable slippage protection for swaps
 * - Emergency rescue function for accidentally sent tokens
 */
contract RevenueRouter is Ownable {
    using SafeERC20 for IERC20;
    
    // ========================================
    // IMMUTABLE STATE
    // ========================================
    
    /// @notice SHIELD token for buyback & burn
    IShieldToken public immutable shieldToken;
    
    /// @notice FXRP token (protocol revenue input)
    IERC20 public immutable fxrpToken;
    
    /// @notice SparkDEX V3 Router for swaps
    IUniswapV3Router public immutable router;
    
    // ========================================
    // CONFIGURABLE STATE
    // ========================================
    
    /// @notice StakingBoost contract for yield distribution
    IStakingBoostDistributor public stakingBoost;
    
    /// @notice Allocation for SHIELD buyback & burn (basis points, 10000 = 100%)
    uint256 public burnAllocationBps = 5000; // 50% default
    
    /// @notice Allocation for FXRP yield boost to stakers (basis points)
    uint256 public boostAllocationBps = 4000; // 40% default
    
    /// @notice Minimum FXRP balance to trigger distribution
    uint256 public minDistributionThreshold = 100000; // 0.1 FXRP (6 decimals)
    
    /// @notice Maximum allowed slippage in basis points (e.g., 500 = 5%)
    uint256 public maxSlippageBps = 500; // 5% default
    
    /// @notice Last known price of SHIELD in FXRP (scaled by 1e18)
    uint256 public lastKnownPrice;
    
    // ========================================
    // CONSTANTS
    // ========================================
    
    uint24 public constant POOL_FEE = 3000; // 0.3% pool fee
    uint256 public constant MAX_ALLOCATION_BPS = 10000; // 100%
    
    // ========================================
    // EVENTS
    // ========================================
    
    event RevenueDistributed(
        uint256 fxrpTotal,
        uint256 shieldBurned,
        uint256 fxrpToStakers,
        uint256 reserves
    );
    event ReservesWithdrawn(address indexed to, uint256 amount);
    event BurnAllocationUpdated(uint256 oldBps, uint256 newBps);
    event BoostAllocationUpdated(uint256 oldBps, uint256 newBps);
    event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost);
    event DistributionThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TokensRescued(address token, address to, uint256 amount);
    
    // ========================================
    // ERRORS
    // ========================================
    
    error InvalidSlippage();
    error InvalidPrice();
    error BelowDistributionThreshold();
    error CannotRescueFXRP();
    error InvalidRecipient();
    error AllocationTooHigh();
    error TotalAllocationExceeds100();
    
    // ========================================
    // CONSTRUCTOR
    // ========================================
    
    /**
     * @dev Constructor
     * @param _shieldToken Address of SHIELD token
     * @param _fxrpToken Address of FXRP token
     * @param _router Address of SparkDEX V3 Router
     * @param _initialPrice Initial SHIELD price in FXRP (scaled by 1e18)
     */
    constructor(
        address _shieldToken,
        address _fxrpToken,
        address _router,
        uint256 _initialPrice
    ) Ownable(msg.sender) {
        require(_shieldToken != address(0), "Invalid SHIELD address");
        require(_fxrpToken != address(0), "Invalid FXRP address");
        require(_router != address(0), "Invalid router address");
        require(_initialPrice > 0, "Invalid initial price");
        
        shieldToken = IShieldToken(_shieldToken);
        fxrpToken = IERC20(_fxrpToken);
        router = IUniswapV3Router(_router);
        lastKnownPrice = _initialPrice;
    }
    
    // ========================================
    // CORE DISTRIBUTION
    // ========================================
    
    /**
     * @dev Distributes revenue: SHIELD burn + FXRP to stakers + reserves
     * 
     * Flow:
     * 1. Check FXRP balance >= minDistributionThreshold
     * 2. Calculate allocations based on bps settings
     * 3. Swap burnAllocation% to SHIELD and burn
     * 4. Send boostAllocation% FXRP to StakingBoost
     * 5. Remaining stays as reserves
     * 
     * Can be called by anyone (keeper/bot friendly)
     */
    function distribute() external {
        uint256 balance = fxrpToken.balanceOf(address(this));
        if (balance < minDistributionThreshold) revert BelowDistributionThreshold();
        
        // Calculate allocations
        uint256 burnAmount = (balance * burnAllocationBps) / MAX_ALLOCATION_BPS;
        uint256 boostAmount = (balance * boostAllocationBps) / MAX_ALLOCATION_BPS;
        uint256 reserves = balance - burnAmount - boostAmount;
        
        uint256 shieldBurned = 0;
        uint256 fxrpDistributed = 0;
        
        // Step 1: SHIELD Buyback & Burn (swap FXRP → SHIELD)
        if (burnAmount > 0) {
            shieldBurned = _swapAndBurnShield(burnAmount);
        }
        
        // Step 2: FXRP direct to StakingBoost (no swap needed!)
        if (boostAmount > 0 && address(stakingBoost) != address(0)) {
            fxrpDistributed = _distributeBoost(boostAmount);
        }
        
        emit RevenueDistributed(balance, shieldBurned, fxrpDistributed, reserves);
    }
    
    /**
     * @dev Internal: Swap FXRP to SHIELD and burn
     * @param fxrpAmount Amount of FXRP to swap
     * @return shieldBurned Amount of SHIELD burned
     */
    function _swapAndBurnShield(uint256 fxrpAmount) internal returns (uint256 shieldBurned) {
        // Calculate minimum expected SHIELD based on last known price and slippage
        uint256 expectedShield = (fxrpAmount * 1e18) / lastKnownPrice;
        uint256 minShieldOut = (expectedShield * (10000 - maxSlippageBps)) / 10000;
        
        // Use forceApprove for safe approval
        fxrpToken.forceApprove(address(router), fxrpAmount);
        
        // Swap FXRP to SHIELD via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(fxrpToken),
            tokenOut: address(shieldToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: fxrpAmount,
            amountOutMinimum: minShieldOut,
            sqrtPriceLimitX96: 0
        });
        
        shieldBurned = router.exactInputSingle(params);
        
        // Clear router allowance for safety (should be consumed, but be explicit)
        fxrpToken.forceApprove(address(router), 0);
        
        // Update last known price based on actual swap result
        uint256 oldPrice = lastKnownPrice;
        lastKnownPrice = (fxrpAmount * 1e18) / shieldBurned;
        emit PriceUpdated(oldPrice, lastKnownPrice);
        
        // Burn the SHIELD tokens
        shieldToken.burn(shieldBurned);
        
        return shieldBurned;
    }
    
    /**
     * @dev Internal: Send FXRP directly to StakingBoost
     * @param fxrpAmount Amount of FXRP to distribute
     * @return Amount distributed
     */
    function _distributeBoost(uint256 fxrpAmount) internal returns (uint256) {
        // Approve StakingBoost to pull FXRP
        fxrpToken.forceApprove(address(stakingBoost), fxrpAmount);
        
        // Distribute to StakingBoost (updates reward accumulator)
        stakingBoost.distributeBoost(fxrpAmount);
        
        // Clear any remaining allowance for safety
        fxrpToken.forceApprove(address(stakingBoost), 0);
        
        return fxrpAmount;
    }
    
    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    
    /**
     * @dev Set SHIELD burn allocation
     * @param newBps New allocation in basis points (max 8000 = 80%)
     */
    function setBurnAllocation(uint256 newBps) external onlyOwner {
        if (newBps > 8000) revert AllocationTooHigh();
        if (newBps + boostAllocationBps > MAX_ALLOCATION_BPS) revert TotalAllocationExceeds100();
        
        uint256 oldBps = burnAllocationBps;
        burnAllocationBps = newBps;
        emit BurnAllocationUpdated(oldBps, newBps);
    }
    
    /**
     * @dev Set FXRP boost allocation for stakers
     * @param newBps New allocation in basis points (max 8000 = 80%)
     */
    function setBoostAllocation(uint256 newBps) external onlyOwner {
        if (newBps > 8000) revert AllocationTooHigh();
        if (burnAllocationBps + newBps > MAX_ALLOCATION_BPS) revert TotalAllocationExceeds100();
        
        uint256 oldBps = boostAllocationBps;
        boostAllocationBps = newBps;
        emit BoostAllocationUpdated(oldBps, newBps);
    }
    
    /**
     * @dev Set StakingBoost contract address
     * @param newStakingBoost Address of new StakingBoost contract (can be zero to disable)
     * @notice Setting to zero address will disable boost distribution
     */
    function setStakingBoost(address newStakingBoost) external onlyOwner {
        // Clear any existing allowance to old stakingBoost before switching
        if (address(stakingBoost) != address(0)) {
            fxrpToken.forceApprove(address(stakingBoost), 0);
        }
        
        address oldBoost = address(stakingBoost);
        stakingBoost = IStakingBoostDistributor(newStakingBoost);
        emit StakingBoostUpdated(oldBoost, newStakingBoost);
    }
    
    /**
     * @dev Set minimum distribution threshold
     * @param newThreshold New threshold in FXRP (6 decimals)
     */
    function setDistributionThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = minDistributionThreshold;
        minDistributionThreshold = newThreshold;
        emit DistributionThresholdUpdated(oldThreshold, newThreshold);
    }
    
    /**
     * @dev Updates maximum slippage tolerance
     * @param newSlippageBps New slippage in basis points (max 2000 = 20%)
     */
    function setMaxSlippage(uint256 newSlippageBps) external onlyOwner {
        if (newSlippageBps > 2000) revert InvalidSlippage();
        
        uint256 oldSlippage = maxSlippageBps;
        maxSlippageBps = newSlippageBps;
        
        emit SlippageUpdated(oldSlippage, newSlippageBps);
    }
    
    /**
     * @dev Updates last known price (for initial calibration or corrections)
     * @param newPrice New price in FXRP per SHIELD (scaled by 1e18)
     */
    function setLastKnownPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        
        uint256 oldPrice = lastKnownPrice;
        lastKnownPrice = newPrice;
        
        emit PriceUpdated(oldPrice, newPrice);
    }
    
    /**
     * @dev Withdraw protocol reserves (FXRP kept after burn + boost)
     * @param to Address to receive reserves
     * @param amount Amount to withdraw
     */
    function withdrawReserves(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        fxrpToken.safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }
    
    /**
     * @dev Emergency recovery of any ERC20 token (except FXRP)
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(fxrpToken)) revert CannotRescueFXRP();
        if (to == address(0)) revert InvalidRecipient();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Get current revenue status
     * @return fxrpBalance Current FXRP balance
     * @return burnAlloc SHIELD burn allocation (bps)
     * @return boostAlloc FXRP boost allocation (bps)
     * @return reserveAlloc Reserve allocation (bps)
     * @return canDistribute Whether distribute() can be called
     */
    function getRevenueStatus() external view returns (
        uint256 fxrpBalance,
        uint256 burnAlloc,
        uint256 boostAlloc,
        uint256 reserveAlloc,
        bool canDistribute
    ) {
        fxrpBalance = fxrpToken.balanceOf(address(this));
        burnAlloc = burnAllocationBps;
        boostAlloc = boostAllocationBps;
        reserveAlloc = MAX_ALLOCATION_BPS - burnAllocationBps - boostAllocationBps;
        canDistribute = fxrpBalance >= minDistributionThreshold;
    }
}
