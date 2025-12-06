// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockStakingBoostDistributor
 * @dev Mock StakingBoost for testing RevenueRouter
 * Mimics the real StakingBoost by pulling FXRP from the caller
 */
contract MockStakingBoostDistributor {
    using SafeERC20 for IERC20;

    IERC20 public fxrpToken;
    uint256 public totalDistributed;
    uint256 public lastDistributionAmount;

    function setFxrpToken(address _fxrpToken) external {
        fxrpToken = IERC20(_fxrpToken);
    }

    function distributeBoost(uint256 fxrpAmount) external {
        lastDistributionAmount = fxrpAmount;
        totalDistributed += fxrpAmount;
        
        // Pull the FXRP from sender (RevenueRouter) - mimics real StakingBoost behavior
        if (address(fxrpToken) != address(0)) {
            fxrpToken.safeTransferFrom(msg.sender, address(this), fxrpAmount);
        }
    }
}
