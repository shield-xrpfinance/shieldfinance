// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingBoost
 * @dev Simple staking contract for SHIELD tokens with APY boost calculation
 * 
 * $10K Fair Launch Playbook:
 * - Users stake SHIELD tokens
 * - Optional 30-day lock period for withdrawals
 * - getBoost() returns boost multiplier: 1 boost per 100 SHIELD staked
 * - Example: 550 SHIELD staked → boost = 5 → +5% APY
 */
contract StakingBoost is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable shieldToken;
    uint256 public constant LOCK_PERIOD = 30 days;
    uint256 public constant BOOST_PER_TOKENS = 100 * 10**18; // 100 SHIELD = 1 boost
    
    struct Stake {
        uint256 amount;
        uint256 stakedAt;
    }
    
    mapping(address => Stake) public stakes;
    uint256 public totalStaked;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _shieldToken Address of SHIELD token
     */
    constructor(address _shieldToken) {
        require(_shieldToken != address(0), "Invalid token address");
        shieldToken = IERC20(_shieldToken);
    }
    
    /**
     * @dev Stake SHIELD tokens
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external nonReentrant {
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
     * @dev Withdraw staked tokens (after 30-day lock period)
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
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
    
    /**
     * @dev Get boost multiplier for a user in basis points
     * @param user Address of user
     * @return Boost in basis points (e.g., 500 = 5%)
     * 
     * Calculation: +1% (100 bps) per full 100 SHIELD staked
     * Example: 550 SHIELD → 5 * 100 = 500 bps → +5% APY on shXRP
     */
    function getBoost(address user) external view returns (uint256) {
        return (stakes[user].amount / BOOST_PER_TOKENS) * 100; // Return in basis points
    }
    
    /**
     * @dev Get user's stake information
     * @param user Address of user
     * @return amount Amount staked
     * @return stakedAt Timestamp when first staked
     * @return unlockTime When tokens can be withdrawn
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 stakedAt,
        uint256 unlockTime
    ) {
        Stake memory userStake = stakes[user];
        amount = userStake.amount;
        stakedAt = userStake.stakedAt;
        unlockTime = stakedAt > 0 ? stakedAt + LOCK_PERIOD : 0;
    }
}
