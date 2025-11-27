// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Interface for ShXRPVault to mint boost shares
 */
interface IShXRPVault {
    function donateOnBehalf(address user, uint256 fxrpAmount) external returns (uint256 sharesMinted);
}

/**
 * @title StakingBoost
 * @dev Synthetix-style reward accumulator for SHIELD staking with proportional FXRP yield boost
 * 
 * Architecture (Audit-Proof Design):
 * - Users stake SHIELD tokens to receive proportional FXRP rewards
 * - RevenueRouter calls distributeBoost() with FXRP, updating rewardPerToken
 * - Users call claim() which converts their earned FXRP to shXRP shares
 * - O(1) reward calculation per user (no loops, gas efficient)
 * 
 * Synthetix Pattern:
 * - rewardPerTokenStored: Cumulative rewards per staked token
 * - userRewardPerTokenPaid[user]: Snapshot when user last interacted
 * - rewards[user]: Unclaimed rewards for user
 * - Formula: earned = balance * (rewardPerToken - paid) / 1e18
 * 
 * Flow:
 * 1. User stakes SHIELD → stake is recorded, rewards settled
 * 2. RevenueRouter.distribute() → sends FXRP here → updates rewardPerToken
 * 3. User calls claim() → earned FXRP sent to vault.donateOnBehalf() → shXRP minted to user
 * 4. User withdraws SHIELD → 30-day lock enforced, rewards settled first
 * 
 * Security:
 * - ReentrancyGuard on all state-changing functions
 * - Only RevenueRouter can call distributeBoost()
 * - Only this contract can call vault.donateOnBehalf()
 * - 30-day lock period on staked SHIELD
 */
contract StakingBoost is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ========================================
    // IMMUTABLE STATE
    // ========================================
    
    IERC20 public immutable shieldToken;
    IERC20 public immutable fxrpToken;
    IShXRPVault public immutable vault;
    
    // ========================================
    // CONSTANTS
    // ========================================
    
    uint256 public constant LOCK_PERIOD = 30 days;
    uint256 public constant BOOST_PER_TOKENS = 100 * 10**18; // 100 SHIELD = 1 boost (100 bps)
    uint256 private constant PRECISION = 1e18;
    
    // ========================================
    // REWARD ACCUMULATOR STATE (Synthetix Pattern)
    // ========================================
    
    /// @notice Cumulative FXRP rewards per staked SHIELD token (scaled by 1e18)
    uint256 public rewardPerTokenStored;
    
    /// @notice Snapshot of rewardPerToken when user last interacted
    mapping(address => uint256) public userRewardPerTokenPaid;
    
    /// @notice Unclaimed FXRP rewards for user
    mapping(address => uint256) public rewards;
    
    // ========================================
    // STAKING STATE
    // ========================================
    
    struct Stake {
        uint256 amount;
        uint256 stakedAt;
    }
    
    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    
    // ========================================
    // ACCESS CONTROL
    // ========================================
    
    address public revenueRouter;
    
    // ========================================
    // ADMIN CONFIG
    // ========================================
    
    /// @notice Global boost cap in basis points (max boost any user can receive)
    /// @dev Default 2500 = 25% max boost
    uint256 public globalBoostCapBps = 2500;
    
    // ========================================
    // EVENTS
    // ========================================
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardDistributed(uint256 fxrpAmount, uint256 newRewardPerToken);
    event RewardClaimed(address indexed user, uint256 fxrpAmount, uint256 sharesMinted);
    event RevenueRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event GlobalBoostCapUpdated(uint256 oldCap, uint256 newCap);
    
    // ========================================
    // MODIFIERS
    // ========================================
    
    /**
     * @dev Settles pending rewards for user before any state change
     * 
     * Synthetix Pattern:
     * 1. Calculate earned: balance * (rewardPerToken - paid) / 1e18
     * 2. Add to user's pending rewards
     * 3. Update user's paid snapshot to current rewardPerToken
     * 
     * This ensures rewards are always calculated correctly even if
     * user stakes/withdraws between reward distributions.
     */
    modifier updateReward(address account) {
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
    
    modifier onlyRevenueRouter() {
        require(msg.sender == revenueRouter, "Only RevenueRouter");
        _;
    }
    
    // ========================================
    // CONSTRUCTOR
    // ========================================
    
    /**
     * @dev Constructor
     * @param _shieldToken Address of SHIELD token
     * @param _fxrpToken Address of FXRP token
     * @param _vault Address of ShXRPVault
     * @param _revenueRouter Address of RevenueRouter (can be updated later)
     */
    constructor(
        address _shieldToken,
        address _fxrpToken,
        address _vault,
        address _revenueRouter
    ) Ownable(msg.sender) {
        require(_shieldToken != address(0), "Invalid SHIELD address");
        require(_fxrpToken != address(0), "Invalid FXRP address");
        require(_vault != address(0), "Invalid vault address");
        
        shieldToken = IERC20(_shieldToken);
        fxrpToken = IERC20(_fxrpToken);
        vault = IShXRPVault(_vault);
        revenueRouter = _revenueRouter;
    }
    
    // ========================================
    // STAKING FUNCTIONS
    // ========================================
    
    /**
     * @dev Stake SHIELD tokens to earn FXRP rewards
     * 
     * updateReward modifier settles any pending rewards before staking.
     * 
     * @param amount Amount of SHIELD to stake
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        
        Stake storage userStake = stakes[msg.sender];
        
        // Transfer tokens from user
        shieldToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update stake
        userStake.amount += amount;
        if (userStake.stakedAt == 0) {
            userStake.stakedAt = block.timestamp;
        }
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw staked SHIELD tokens (after 30-day lock period)
     * 
     * updateReward modifier settles any pending rewards before withdrawal.
     * 
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient stake");
        require(
            block.timestamp >= userStake.stakedAt + LOCK_PERIOD,
            "Tokens still locked"
        );
        
        // Update stake
        userStake.amount -= amount;
        if (userStake.amount == 0) {
            userStake.stakedAt = 0;
        }
        
        totalStaked -= amount;
        
        // Transfer tokens back to user
        shieldToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    // ========================================
    // REWARD DISTRIBUTION (RevenueRouter → StakingBoost)
    // ========================================
    
    /**
     * @dev Distribute FXRP rewards to stakers (called by RevenueRouter)
     * 
     * Synthetix Pattern:
     * - Calculates new rewards per token: fxrpAmount * 1e18 / totalStaked
     * - Adds to cumulative rewardPerTokenStored
     * - No loops, O(1) gas regardless of staker count
     * 
     * @param fxrpAmount Amount of FXRP to distribute
     */
    function distributeBoost(uint256 fxrpAmount) external onlyRevenueRouter nonReentrant {
        require(fxrpAmount > 0, "Cannot distribute 0");
        
        // Transfer FXRP from RevenueRouter
        fxrpToken.safeTransferFrom(msg.sender, address(this), fxrpAmount);
        
        // If no stakers, FXRP stays in contract (can be recovered by owner)
        if (totalStaked == 0) {
            return;
        }
        
        // Update cumulative reward per token
        // Formula: rewardPerToken += (fxrpAmount * 1e18) / totalStaked
        uint256 rewardIncrease = (fxrpAmount * PRECISION) / totalStaked;
        rewardPerTokenStored += rewardIncrease;
        
        emit RewardDistributed(fxrpAmount, rewardPerTokenStored);
    }
    
    // ========================================
    // CLAIM REWARDS (StakingBoost → Vault)
    // ========================================
    
    /**
     * @dev Claim pending FXRP rewards as shXRP shares
     * 
     * Flow:
     * 1. Calculate earned rewards using Synthetix formula
     * 2. Reset user's pending rewards to 0
     * 3. Approve FXRP to vault
     * 4. Call vault.donateOnBehalf() to mint shXRP to user
     * 
     * This is the key function that makes SHIELD staking valuable:
     * Only stakers receive the boost as shXRP shares.
     */
    function claim() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        
        if (reward > 0) {
            // Reset pending rewards
            rewards[msg.sender] = 0;
            
            // Approve vault to pull FXRP
            fxrpToken.approve(address(vault), reward);
            
            // Donate FXRP on behalf of user → mints shXRP shares to user
            uint256 sharesMinted = vault.donateOnBehalf(msg.sender, reward);
            
            emit RewardClaimed(msg.sender, reward, sharesMinted);
        }
    }
    
    /**
     * @dev Claim and withdraw in one transaction (convenience function)
     * 
     * Claims all pending rewards first, then withdraws specified amount.
     * Useful for users who want to exit completely.
     * 
     * @param withdrawAmount Amount of SHIELD to withdraw (after claim)
     */
    function claimAndWithdraw(uint256 withdrawAmount) external nonReentrant updateReward(msg.sender) {
        // Claim first
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            fxrpToken.approve(address(vault), reward);
            uint256 sharesMinted = vault.donateOnBehalf(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward, sharesMinted);
        }
        
        // Then withdraw
        if (withdrawAmount > 0) {
            Stake storage userStake = stakes[msg.sender];
            require(userStake.amount >= withdrawAmount, "Insufficient stake");
            require(
                block.timestamp >= userStake.stakedAt + LOCK_PERIOD,
                "Tokens still locked"
            );
            
            userStake.amount -= withdrawAmount;
            if (userStake.amount == 0) {
                userStake.stakedAt = 0;
            }
            
            totalStaked -= withdrawAmount;
            shieldToken.safeTransfer(msg.sender, withdrawAmount);
            
            emit Withdrawn(msg.sender, withdrawAmount);
        }
    }
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    /**
     * @dev Calculate earned FXRP rewards for a user
     * 
     * Synthetix Formula:
     * earned = (balance * (rewardPerToken - userPaid)) / 1e18 + pendingRewards
     * 
     * @param account User address
     * @return Total earned FXRP (including pending)
     */
    function earned(address account) public view returns (uint256) {
        uint256 balance = stakes[account].amount;
        uint256 rewardDelta = rewardPerTokenStored - userRewardPerTokenPaid[account];
        
        return (balance * rewardDelta) / PRECISION + rewards[account];
    }
    
    /**
     * @dev Get boost multiplier for a user in basis points
     * @param user Address of user
     * @return Boost in basis points (e.g., 500 = 5%), capped at globalBoostCapBps
     * 
     * Calculation: +1% (100 bps) per full 100 SHIELD staked
     * Example: 550 SHIELD → 5 * 100 = 500 bps → +5% APY on shXRP
     * 
     * Cap: Limited by globalBoostCapBps (default 2500 = 25% max)
     */
    function getBoost(address user) external view returns (uint256) {
        uint256 rawBoost = (stakes[user].amount / BOOST_PER_TOKENS) * 100;
        
        // Apply global cap
        if (rawBoost > globalBoostCapBps) {
            return globalBoostCapBps;
        }
        return rawBoost;
    }
    
    /**
     * @dev Get user's stake information
     * @param user Address of user
     * @return amount Amount staked
     * @return stakedAt Timestamp when first staked
     * @return unlockTime When tokens can be withdrawn
     * @return pendingRewards Unclaimed FXRP rewards
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 stakedAt,
        uint256 unlockTime,
        uint256 pendingRewards
    ) {
        Stake memory userStake = stakes[user];
        amount = userStake.amount;
        stakedAt = userStake.stakedAt;
        unlockTime = stakedAt > 0 ? stakedAt + LOCK_PERIOD : 0;
        pendingRewards = earned(user);
    }
    
    /**
     * @dev Get global staking statistics
     * @return totalShieldStaked Total SHIELD staked
     * @return currentRewardPerToken Current reward per token
     * @return pendingFxrpInContract FXRP balance in contract
     */
    function getGlobalStats() external view returns (
        uint256 totalShieldStaked,
        uint256 currentRewardPerToken,
        uint256 pendingFxrpInContract
    ) {
        totalShieldStaked = totalStaked;
        currentRewardPerToken = rewardPerTokenStored;
        pendingFxrpInContract = fxrpToken.balanceOf(address(this));
    }
    
    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    
    /**
     * @dev Update RevenueRouter address
     * @param newRouter New RevenueRouter address
     */
    function setRevenueRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router address");
        address oldRouter = revenueRouter;
        revenueRouter = newRouter;
        emit RevenueRouterUpdated(oldRouter, newRouter);
    }
    
    /**
     * @dev Update global boost cap
     * @param newCapBps New cap in basis points (max 10000 = 100%)
     */
    function setGlobalBoostCap(uint256 newCapBps) external onlyOwner {
        require(newCapBps <= 10000, "Cap cannot exceed 100%");
        uint256 oldCap = globalBoostCapBps;
        globalBoostCapBps = newCapBps;
        emit GlobalBoostCapUpdated(oldCap, newCapBps);
    }
    
    /**
     * @dev Emergency recovery of stuck tokens (excluding staked SHIELD)
     * 
     * Use case: If FXRP accumulates when totalStaked = 0
     * 
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverTokens(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        
        // Cannot recover staked SHIELD
        if (token == address(shieldToken)) {
            uint256 excess = shieldToken.balanceOf(address(this)) - totalStaked;
            require(amount <= excess, "Cannot recover staked SHIELD");
        }
        
        IERC20(token).safeTransfer(to, amount);
    }
}
