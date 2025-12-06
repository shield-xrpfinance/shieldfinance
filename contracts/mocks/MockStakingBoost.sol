// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IShXRPVault {
    function asset() external view returns (address);
    function donateOnBehalf(address user, uint256 fxrpAmount) external returns (uint256 sharesMinted);
}

/**
 * @title MockStakingBoost
 * @dev Test implementation for ShXRPVault unit tests
 * 
 * Features:
 * - Configurable boost per user
 * - Can call donateOnBehalf on vault
 */
contract MockStakingBoost {
    using SafeERC20 for IERC20;
    
    IShXRPVault public immutable vault;
    IERC20 public immutable fxrp;
    
    mapping(address => uint256) public boosts; // user => boost in bps
    
    constructor(address _vault) {
        vault = IShXRPVault(_vault);
        fxrp = IERC20(vault.asset());
    }
    
    /**
     * @dev Returns boost for user in basis points
     */
    function getBoost(address user) external view returns (uint256) {
        return boosts[user];
    }
    
    /**
     * @dev Set boost for testing
     */
    function setBoost(address user, uint256 boostBps) external {
        boosts[user] = boostBps;
    }
    
    /**
     * @dev Test helper to call donateOnBehalf on vault
     */
    function testDonate(address user, uint256 amount) external {
        // Approve vault to pull FXRP
        fxrp.approve(address(vault), amount);
        
        // Call donateOnBehalf
        vault.donateOnBehalf(user, amount);
    }
}
