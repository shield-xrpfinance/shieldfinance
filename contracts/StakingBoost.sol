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
 * Security (Audit Fixes Applied):
 * - ReentrancyGuard on all state-changing functions including recoverTokens
 * - Only RevenueRouter can call distributeBoost()
 * - Only this contract can call vault.donateOnBehalf()
 * - 30-day lock period on staked SHIELD (resets on EVERY deposit per SB-03 fix)
 * - Owner CANNOT withdraw FXRP owed to stakers (only excess FXRP)
 * - Fee-on-transfer tokens are detected and rejected
 * - Zero-address validation on all constructor parameters
 * - Orphaned FXRP (distributed when totalStaked=0) is stored in pendingRewards
 * - SB-03: Lock period resets on each deposit to prevent gaming exploits
 * 
 * Token Assumptions (Documented per Audit):
 * - SHIELD and FXRP must be standard ERC-20 tokens
 * - Fee-on-transfer tokens are NOT supported (will revert)
 * - Rebasing tokens are NOT supported
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
    
    /// @notice FXRP rewards distributed when no stakers existed (orphaned)
    /// @dev These will be folded into rewardPerTokenStored when staking resumes
    uint256 public pendingOrphanedRewards;
    
    /// @notice Running total of all unclaimed rewards across all users
    /// @dev Used to calculate "excess" FXRP that owner can recover
    uint256 public totalUnclaimedRewards;
    
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
    
    /// @notice Testnet-only: bypass lock period for testing unstake functionality
    /// @dev Should NEVER be enabled on mainnet. Owner can toggle for testnet testing.
    bool public testnetLockBypass = false;
    
    // ========================================
    // EVENTS
    // ========================================
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardDistributed(uint256 fxrpAmount, uint256 newRewardPerToken);
    event RewardClaimed(address indexed user, uint256 fxrpAmount, uint256 sharesMinted);
    event RevenueRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event GlobalBoostCapUpdated(uint256 oldCap, uint256 newCap);
    event OrphanedRewardsDistributed(uint256 amount, uint256 newRewardPerToken);
    event TokensRecovered(address indexed token, address indexed to, uint256 amount);
    event TestnetLockBypassUpdated(bool enabled);
    
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
     * 
     * Note: totalUnclaimedRewards is NOT updated here - it's tracked
     * globally in distributeBoost() and decremented in claim().
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
     * 
     * AUDIT FIX: Added zero-address validation for _revenueRouter
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
        require(_revenueRouter != address(0), "Invalid revenue router address");
        
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
     * Lock Period Behavior:
     * - Each new deposit resets the 30-day lock period for the ENTIRE staked balance
     * - The lock timer is based on the MOST RECENT deposit timestamp
     * - This prevents gaming where users stake tiny amounts early to bypass lock periods
     * 
     * AUDIT FIX (SB-03): Lock period is now reset on EVERY deposit, not just the first.
     * AUDIT FIX: Added fee-on-transfer token detection
     * 
     * @param amount Amount of SHIELD to stake
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        
        Stake storage userStake = stakes[msg.sender];
        
        // AUDIT FIX: Check for fee-on-transfer tokens by comparing balances
        uint256 balanceBefore = shieldToken.balanceOf(address(this));
        shieldToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = shieldToken.balanceOf(address(this)) - balanceBefore;
        require(received == amount, "Fee-on-transfer tokens not supported");
        
        // If this is the first stake after orphaned rewards accumulated, distribute them
        if (totalStaked == 0 && pendingOrphanedRewards > 0) {
            // Will be distributed proportionally to this first staker
            // They get all orphaned rewards since they're the only staker
        }
        
        // Update stake
        userStake.amount += amount;
        // AUDIT FIX (SB-03): Always reset stakedAt on every deposit to enforce full lock period
        // This prevents lock period gaming where users stake tiny amounts early, then add large
        // amounts just before the lock expires to immediately withdraw everything.
        // The entire staked balance is now locked for 30 days from the MOST RECENT deposit.
        userStake.stakedAt = block.timestamp;
        
        totalStaked += amount;
        
        // AUDIT FIX: Fold in orphaned rewards now that we have stakers
        if (pendingOrphanedRewards > 0) {
            uint256 orphanedAmount = pendingOrphanedRewards;
            pendingOrphanedRewards = 0;
            
            // AUDIT FIX: Track orphaned rewards as liabilities when folded in
            totalUnclaimedRewards += orphanedAmount;
            
            uint256 rewardIncrease = (orphanedAmount * PRECISION) / totalStaked;
            rewardPerTokenStored += rewardIncrease;
            emit OrphanedRewardsDistributed(orphanedAmount, rewardPerTokenStored);
        }
        
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
        
        // Check lock period unless testnet bypass is enabled
        if (!testnetLockBypass) {
            require(
                block.timestamp >= userStake.stakedAt + LOCK_PERIOD,
                "Tokens still locked"
            );
        }
        
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
     * AUDIT FIX: Added fee-on-transfer detection
     * AUDIT FIX: Orphaned FXRP now stored in pendingOrphanedRewards instead of being lost
     * AUDIT FIX: totalUnclaimedRewards is incremented here to prevent owner drain
     * 
     * @param fxrpAmount Amount of FXRP to distribute
     */
    function distributeBoost(uint256 fxrpAmount) external onlyRevenueRouter nonReentrant {
        require(fxrpAmount > 0, "Cannot distribute 0");
        
        // AUDIT FIX: Check for fee-on-transfer tokens by comparing balances
        uint256 balanceBefore = fxrpToken.balanceOf(address(this));
        fxrpToken.safeTransferFrom(msg.sender, address(this), fxrpAmount);
        uint256 received = fxrpToken.balanceOf(address(this)) - balanceBefore;
        require(received == fxrpAmount, "Fee-on-transfer tokens not supported");
        
        // AUDIT FIX: If no stakers, store FXRP in pendingOrphanedRewards bucket
        // It will be distributed when staking resumes
        if (totalStaked == 0) {
            pendingOrphanedRewards += fxrpAmount;
            return;
        }
        
        // AUDIT FIX: Track distributed rewards as liabilities BEFORE stakers interact
        // This prevents owner from draining freshly distributed rewards
        totalUnclaimedRewards += fxrpAmount;
        
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
     * 3. Approve FXRP to vault using safe pattern
     * 4. Call vault.donateOnBehalf() to mint shXRP to user
     * 
     * AUDIT FIX: Uses SafeERC20 safeIncreaseAllowance pattern
     * 
     * This is the key function that makes SHIELD staking valuable:
     * Only stakers receive the boost as shXRP shares.
     */
    function claim() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        
        if (reward > 0) {
            // Reset pending rewards
            rewards[msg.sender] = 0;
            
            // Decrease total unclaimed rewards
            totalUnclaimedRewards -= reward;
            
            // AUDIT FIX: Use SafeERC20 pattern - reset to 0 first, then approve
            // This handles non-standard tokens like USDT that require zero-reset
            fxrpToken.forceApprove(address(vault), reward);
            
            // Donate FXRP on behalf of user → mints shXRP shares to user
            uint256 sharesMinted = vault.donateOnBehalf(msg.sender, reward);
            
            // Reset approval after use for safety
            fxrpToken.forceApprove(address(vault), 0);
            
            emit RewardClaimed(msg.sender, reward, sharesMinted);
        }
    }
    
    /**
     * @dev Claim and withdraw in one transaction (convenience function)
     * 
     * Claims all pending rewards first, then withdraws specified amount.
     * Useful for users who want to exit completely.
     * 
     * AUDIT FIX: Uses SafeERC20 safeIncreaseAllowance pattern
     * 
     * @param withdrawAmount Amount of SHIELD to withdraw (after claim)
     */
    function claimAndWithdraw(uint256 withdrawAmount) external nonReentrant updateReward(msg.sender) {
        // Claim first
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            
            // Decrease total unclaimed rewards
            totalUnclaimedRewards -= reward;
            
            // AUDIT FIX: Use SafeERC20 forceApprove pattern
            fxrpToken.forceApprove(address(vault), reward);
            uint256 sharesMinted = vault.donateOnBehalf(msg.sender, reward);
            fxrpToken.forceApprove(address(vault), 0);
            
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
     * @return stakedAt Timestamp of most recent deposit (lock period starts from here)
     * @return unlockTime When tokens can be withdrawn (30 days from stakedAt)
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
     * @return orphanedRewards FXRP waiting to be distributed when stakers return
     * @return unclaimedRewardsTotal Total rewards owed to stakers
     */
    function getGlobalStats() external view returns (
        uint256 totalShieldStaked,
        uint256 currentRewardPerToken,
        uint256 pendingFxrpInContract,
        uint256 orphanedRewards,
        uint256 unclaimedRewardsTotal
    ) {
        totalShieldStaked = totalStaked;
        currentRewardPerToken = rewardPerTokenStored;
        pendingFxrpInContract = fxrpToken.balanceOf(address(this));
        orphanedRewards = pendingOrphanedRewards;
        unclaimedRewardsTotal = totalUnclaimedRewards;
    }
    
    /**
     * @dev Calculate the excess FXRP that can be recovered by owner
     * @return Amount of FXRP that exceeds all obligations
     * 
     * AUDIT FIX: This ensures owner can ONLY recover truly excess FXRP,
     * not rewards owed to stakers.
     */
    function getRecoverableFxrp() public view returns (uint256) {
        uint256 balance = fxrpToken.balanceOf(address(this));
        uint256 reserved = totalUnclaimedRewards + pendingOrphanedRewards;
        
        if (balance > reserved) {
            return balance - reserved;
        }
        return 0;
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
     * @dev Toggle testnet lock bypass (TESTNET ONLY)
     * 
     * SECURITY: This function can ONLY enable bypass on testnet chains (Coston2: chainId 114).
     * It will revert if called on mainnet (Flare: chainId 14).
     * This prevents accidental or malicious bypass of the 30-day lock on production.
     * 
     * It allows users to unstake immediately without waiting for the 30-day lock period.
     * Use only for testing the unstake functionality on testnet.
     * 
     * @param enabled Whether to enable or disable the lock bypass
     */
    function setTestnetLockBypass(bool enabled) external onlyOwner {
        // SECURITY: Only allow enabling on testnet chains
        // Coston2 (Flare testnet) = 114
        // Flare mainnet = 14
        if (enabled) {
            require(block.chainid == 114, "Lock bypass only allowed on Coston2 testnet");
        }
        testnetLockBypass = enabled;
        emit TestnetLockBypassUpdated(enabled);
    }
    
    /**
     * @dev Emergency recovery of stuck tokens (excluding staked SHIELD and owed FXRP)
     * 
     * AUDIT FIX: Added nonReentrant modifier
     * AUDIT FIX: For FXRP, only allows recovery of EXCESS FXRP (balance - reserved)
     * This prevents owner from draining rewards owed to stakers.
     * 
     * Use cases:
     * - Recover accidentally sent tokens
     * - Recover excess FXRP after accounting reconciliation
     * 
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverTokens(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        
        // Cannot recover staked SHIELD
        if (token == address(shieldToken)) {
            uint256 excess = shieldToken.balanceOf(address(this)) - totalStaked;
            require(amount <= excess, "Cannot recover staked SHIELD");
        }
        
        // AUDIT FIX: For FXRP, can only recover excess beyond what's owed to stakers
        if (token == address(fxrpToken)) {
            uint256 recoverable = getRecoverableFxrp();
            require(amount <= recoverable, "Cannot recover FXRP owed to stakers");
        }
        
        IERC20(token).safeTransfer(to, amount);
        
        emit TokensRecovered(token, to, amount);
    }
}
