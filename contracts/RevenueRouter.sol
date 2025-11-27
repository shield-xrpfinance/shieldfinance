// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IShieldToken.sol";
import "./interfaces/IUniswapV3Router.sol";
import "./interfaces/IWFLR.sol";

/**
 * @dev Interface for StakingBoost to distribute yield boosts
 */
interface IStakingBoostDistributor {
    function distributeBoost(uint256 fxrpAmount) external;
}

/**
 * @title RevenueRouter
 * @dev Routes protocol revenue: SHIELD burn + FXRP yield boost to stakers
 * 
 * Revenue Flow:
 * 1. Receives wFLR fees from vault operations (deposit/withdraw fees)
 * 2. Splits revenue: burnAllocationBps% → SHIELD buyback & burn
 * 3. Remaining: boostAllocationBps% → swap to FXRP → StakingBoost for staker yield
 * 4. Rest kept as protocol reserves (withdrawable by owner)
 * 
 * Example with default allocations (50% burn, 40% boost, 10% reserves):
 * - 1000 wFLR received
 * - 500 wFLR → swap to SHIELD → burn (deflationary)
 * - 400 wFLR → swap to FXRP → StakingBoost.distributeBoost()
 * - 100 wFLR → protocol reserves
 * 
 * SHIELD Staker Yield Boost:
 * - StakingBoost receives FXRP and distributes to SHIELD stakers
 * - Stakers can claim() to convert FXRP to shXRP shares
 * - More SHIELD staked = more yield boost (Synthetix-style accumulator)
 */
contract RevenueRouter is Ownable {
    using SafeERC20 for IERC20;
    
    // ========================================
    // IMMUTABLE STATE
    // ========================================
    
    IShieldToken public immutable shieldToken;
    IWFLR public immutable wflr;
    IUniswapV3Router public immutable router;
    
    // ========================================
    // CONFIGURABLE STATE
    // ========================================
    
    /// @notice FXRP token for yield boost swaps
    IERC20 public fxrpToken;
    
    /// @notice StakingBoost contract for yield distribution
    IStakingBoostDistributor public stakingBoost;
    
    /// @notice Allocation for SHIELD buyback & burn (basis points, 10000 = 100%)
    uint256 public burnAllocationBps = 5000; // 50% default
    
    /// @notice Allocation for FXRP yield boost to stakers (basis points)
    uint256 public boostAllocationBps = 4000; // 40% default
    
    /// @notice Minimum wFLR balance to trigger distribution
    uint256 public minDistributionThreshold = 0.1 ether; // 0.1 wFLR
    
    // ========================================
    // CONSTANTS
    // ========================================
    
    uint24 public constant POOL_FEE = 3000; // 0.3% pool fee
    uint256 public constant MAX_ALLOCATION_BPS = 10000; // 100%
    
    // ========================================
    // EVENTS
    // ========================================
    
    event RevenueDistributed(
        uint256 wflrTotal,
        uint256 shieldBurned,
        uint256 fxrpToStakers,
        uint256 reserves
    );
    event ReservesWithdrawn(address indexed to, uint256 amount);
    event BurnAllocationUpdated(uint256 oldBps, uint256 newBps);
    event BoostAllocationUpdated(uint256 oldBps, uint256 newBps);
    event StakingBoostUpdated(address indexed oldBoost, address indexed newBoost);
    event FxrpTokenUpdated(address indexed oldToken, address indexed newToken);
    event DistributionThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    
    // ========================================
    // CONSTRUCTOR
    // ========================================
    
    /**
     * @dev Constructor
     * @param _shieldToken Address of SHIELD token
     * @param _wflr Address of Wrapped FLR
     * @param _router Address of SparkDEX V3 Router
     */
    constructor(
        address _shieldToken,
        address _wflr,
        address _router
    ) Ownable(msg.sender) {
        require(_shieldToken != address(0), "Invalid SHIELD address");
        require(_wflr != address(0), "Invalid wFLR address");
        require(_router != address(0), "Invalid router address");
        
        shieldToken = IShieldToken(_shieldToken);
        wflr = IWFLR(_wflr);
        router = IUniswapV3Router(_router);
    }
    
    // ========================================
    // CORE DISTRIBUTION
    // ========================================
    
    /**
     * @dev Distributes revenue: SHIELD burn + FXRP to stakers + reserves
     * 
     * Flow:
     * 1. Check wFLR balance >= minDistributionThreshold
     * 2. Calculate allocations based on bps settings
     * 3. Swap burnAllocation% to SHIELD and burn
     * 4. Swap boostAllocation% to FXRP and send to StakingBoost
     * 5. Remaining stays as reserves
     * 
     * Can be called by anyone (keeper/bot friendly)
     */
    function distribute() external {
        uint256 balance = wflr.balanceOf(address(this));
        require(balance >= minDistributionThreshold, "Below distribution threshold");
        
        // Calculate allocations
        uint256 burnAmount = (balance * burnAllocationBps) / MAX_ALLOCATION_BPS;
        uint256 boostAmount = (balance * boostAllocationBps) / MAX_ALLOCATION_BPS;
        uint256 reserves = balance - burnAmount - boostAmount;
        
        uint256 shieldBurned = 0;
        uint256 fxrpDistributed = 0;
        
        // Step 1: SHIELD Buyback & Burn
        if (burnAmount > 0) {
            shieldBurned = _swapAndBurnShield(burnAmount);
        }
        
        // Step 2: FXRP Boost to Stakers
        if (boostAmount > 0 && address(stakingBoost) != address(0) && address(fxrpToken) != address(0)) {
            fxrpDistributed = _swapAndDistributeBoost(boostAmount);
        }
        
        emit RevenueDistributed(balance, shieldBurned, fxrpDistributed, reserves);
    }
    
    /**
     * @dev Internal: Swap wFLR to SHIELD and burn
     * @param wflrAmount Amount of wFLR to swap
     * @return shieldBurned Amount of SHIELD burned
     */
    function _swapAndBurnShield(uint256 wflrAmount) internal returns (uint256 shieldBurned) {
        // Approve router to spend wFLR
        wflr.approve(address(router), wflrAmount);
        
        // Swap wFLR to SHIELD via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(wflr),
            tokenOut: address(shieldToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wflrAmount,
            amountOutMinimum: 0, // Accept any amount (can be improved with price oracle)
            sqrtPriceLimitX96: 0
        });
        
        shieldBurned = router.exactInputSingle(params);
        
        // Burn the SHIELD tokens
        shieldToken.burn(shieldBurned);
        
        return shieldBurned;
    }
    
    /**
     * @dev Internal: Swap wFLR to FXRP and distribute to stakers
     * @param wflrAmount Amount of wFLR to swap
     * @return fxrpDistributed Amount of FXRP distributed
     */
    function _swapAndDistributeBoost(uint256 wflrAmount) internal returns (uint256 fxrpDistributed) {
        // Approve router to spend wFLR
        wflr.approve(address(router), wflrAmount);
        
        // Swap wFLR to FXRP via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(wflr),
            tokenOut: address(fxrpToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wflrAmount,
            amountOutMinimum: 0, // Accept any amount (can be improved with price oracle)
            sqrtPriceLimitX96: 0
        });
        
        fxrpDistributed = router.exactInputSingle(params);
        
        // Approve StakingBoost to pull FXRP
        fxrpToken.approve(address(stakingBoost), fxrpDistributed);
        
        // Distribute to StakingBoost (updates reward accumulator)
        stakingBoost.distributeBoost(fxrpDistributed);
        
        return fxrpDistributed;
    }
    
    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    
    /**
     * @dev Set SHIELD burn allocation
     * @param newBps New allocation in basis points (max 8000 = 80%)
     */
    function setBurnAllocation(uint256 newBps) external onlyOwner {
        require(newBps <= 8000, "Burn allocation too high");
        require(newBps + boostAllocationBps <= MAX_ALLOCATION_BPS, "Total allocation exceeds 100%");
        
        uint256 oldBps = burnAllocationBps;
        burnAllocationBps = newBps;
        emit BurnAllocationUpdated(oldBps, newBps);
    }
    
    /**
     * @dev Set FXRP boost allocation for stakers
     * @param newBps New allocation in basis points (max 8000 = 80%)
     */
    function setBoostAllocation(uint256 newBps) external onlyOwner {
        require(newBps <= 8000, "Boost allocation too high");
        require(burnAllocationBps + newBps <= MAX_ALLOCATION_BPS, "Total allocation exceeds 100%");
        
        uint256 oldBps = boostAllocationBps;
        boostAllocationBps = newBps;
        emit BoostAllocationUpdated(oldBps, newBps);
    }
    
    /**
     * @dev Set StakingBoost contract address
     * @param newStakingBoost Address of new StakingBoost contract
     */
    function setStakingBoost(address newStakingBoost) external onlyOwner {
        address oldBoost = address(stakingBoost);
        stakingBoost = IStakingBoostDistributor(newStakingBoost);
        emit StakingBoostUpdated(oldBoost, newStakingBoost);
    }
    
    /**
     * @dev Set FXRP token address
     * @param newFxrpToken Address of FXRP token
     */
    function setFxrpToken(address newFxrpToken) external onlyOwner {
        address oldToken = address(fxrpToken);
        fxrpToken = IERC20(newFxrpToken);
        emit FxrpTokenUpdated(oldToken, newFxrpToken);
    }
    
    /**
     * @dev Set minimum distribution threshold
     * @param newThreshold New threshold in wei
     */
    function setDistributionThreshold(uint256 newThreshold) external onlyOwner {
        uint256 oldThreshold = minDistributionThreshold;
        minDistributionThreshold = newThreshold;
        emit DistributionThresholdUpdated(oldThreshold, newThreshold);
    }
    
    /**
     * @dev Withdraw protocol reserves (wFLR kept after burn + boost)
     * @param to Address to receive reserves
     * @param amount Amount to withdraw
     */
    function withdrawReserves(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(address(wflr)).safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }
    
    /**
     * @dev Emergency recovery of any ERC20 token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Get current revenue status
     * @return wflrBalance Current wFLR balance
     * @return burnAlloc SHIELD burn allocation (bps)
     * @return boostAlloc FXRP boost allocation (bps)
     * @return reserveAlloc Reserve allocation (bps)
     * @return canDistribute Whether distribute() can be called
     */
    function getRevenueStatus() external view returns (
        uint256 wflrBalance,
        uint256 burnAlloc,
        uint256 boostAlloc,
        uint256 reserveAlloc,
        bool canDistribute
    ) {
        wflrBalance = wflr.balanceOf(address(this));
        burnAlloc = burnAllocationBps;
        boostAlloc = boostAllocationBps;
        reserveAlloc = MAX_ALLOCATION_BPS - burnAllocationBps - boostAllocationBps;
        canDistribute = wflrBalance >= minDistributionThreshold;
    }
    
    // ========================================
    // RECEIVE
    // ========================================
    
    /**
     * @dev Receive FLR and wrap it to wFLR
     */
    receive() external payable {
        wflr.deposit{value: msg.value}();
    }
}
