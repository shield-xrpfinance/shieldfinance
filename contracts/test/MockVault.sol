// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockVault
 * @dev Mock implementation of IShXRPVault for testing StakingBoost
 * 
 * Implements donateOnBehalf() which is called by StakingBoost.claim()
 * to convert FXRP rewards into shXRP shares.
 * 
 * Used in audit remediation tests to verify:
 * - SB-06: forceApprove is used correctly (successful claims)
 * - SB-01: Reward claiming flow works end-to-end
 */
contract MockVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable fxrpToken;
    
    uint256 public sharesMintedPerFxrp = 1e12; // 1:1 ratio for simplicity (FXRP 6 decimals, shares 18 decimals)
    
    mapping(address => uint256) public sharesOf;
    uint256 public totalSharesMinted;
    
    event DonationReceived(address indexed user, uint256 fxrpAmount, uint256 sharesMinted);

    constructor(address _fxrpToken) {
        fxrpToken = IERC20(_fxrpToken);
    }

    /**
     * @dev Called by StakingBoost to convert FXRP to shXRP shares
     * @param user Address to credit shares to
     * @param fxrpAmount Amount of FXRP being donated
     * @return sharesMinted Number of shXRP shares minted
     */
    function donateOnBehalf(address user, uint256 fxrpAmount) external returns (uint256 sharesMinted) {
        require(fxrpAmount > 0, "Amount must be > 0");
        require(user != address(0), "Invalid user");
        
        fxrpToken.safeTransferFrom(msg.sender, address(this), fxrpAmount);
        
        sharesMinted = fxrpAmount * sharesMintedPerFxrp;
        sharesOf[user] += sharesMinted;
        totalSharesMinted += sharesMinted;
        
        emit DonationReceived(user, fxrpAmount, sharesMinted);
        
        return sharesMinted;
    }

    function setSharesMintedPerFxrp(uint256 _ratio) external {
        sharesMintedPerFxrp = _ratio;
    }
}
