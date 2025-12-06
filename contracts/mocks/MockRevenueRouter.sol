// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockRevenueRouter
 * @dev Test implementation for ShXRPVault unit tests
 * 
 * Simply receives FXRP fees - no distribution logic
 */
contract MockRevenueRouter {
    uint256 public totalFeesReceived;
    
    event FeesReceived(address indexed token, uint256 amount);
    
    // No-op receive function for testing
    receive() external payable {}
    
    // Helper to track fee receipt (can be called by test to verify)
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
