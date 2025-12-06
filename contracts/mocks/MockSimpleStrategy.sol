// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockSimpleStrategy
 * @dev Minimal IStrategy implementation for unit tests
 * 
 * No access control - anyone can call (for testing simplicity)
 */
contract MockSimpleStrategy {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable fxrpToken;
    uint256 public totalDeployed;
    uint256 public yieldAmount;
    
    constructor(address _fxrpToken) {
        fxrpToken = IERC20(_fxrpToken);
    }
    
    function asset() external view returns (address) {
        return address(fxrpToken);
    }
    
    function totalAssets() external view returns (uint256) {
        // Return actual token balance (more realistic simulation)
        // This includes deployed + any yield minted to the strategy
        return fxrpToken.balanceOf(address(this));
    }
    
    function deploy(uint256 amount) external {
        fxrpToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeployed += amount;
    }
    
    function withdraw(uint256 amount, address receiver) external returns (uint256) {
        uint256 available = totalDeployed + yieldAmount;
        uint256 toWithdraw = amount > available ? available : amount;
        
        if (toWithdraw <= yieldAmount) {
            yieldAmount -= toWithdraw;
        } else {
            uint256 fromPrincipal = toWithdraw - yieldAmount;
            yieldAmount = 0;
            totalDeployed = totalDeployed > fromPrincipal ? totalDeployed - fromPrincipal : 0;
        }
        
        fxrpToken.safeTransfer(receiver, toWithdraw);
        return toWithdraw;
    }
    
    uint256 public lossAmount;
    
    function report() external returns (uint256 profit, uint256 loss, uint256 assets) {
        assets = totalDeployed + yieldAmount;
        profit = yieldAmount;
        loss = lossAmount;
        lossAmount = 0; // Reset loss after reporting
        yieldAmount = 0; // Reset yield after reporting
        return (profit, loss, assets);
    }
    
    function setLossAmount(uint256 _loss) external {
        lossAmount = _loss;
    }
    
    function setYieldAmount(uint256 _amount) external {
        yieldAmount = _amount;
    }
    
    // Address to send "lost" tokens to (simulating loss)
    address public constant BURN_ADDRESS = address(0xdead);
    
    function setLoss(uint256 amount) external {
        // Simulate loss by actually transferring tokens out (to dead address)
        uint256 balance = fxrpToken.balanceOf(address(this));
        uint256 toLose = amount > balance ? balance : amount;
        if (toLose > 0) {
            fxrpToken.safeTransfer(BURN_ADDRESS, toLose);
        }
        // Also update tracking for bookkeeping
        if (amount >= totalDeployed) {
            totalDeployed = 0;
        } else {
            totalDeployed -= amount;
        }
    }
    
    function isActive() external pure returns (bool) {
        return true;
    }
    
    function name() external pure returns (string memory) {
        return "MockSimpleStrategy";
    }
}
