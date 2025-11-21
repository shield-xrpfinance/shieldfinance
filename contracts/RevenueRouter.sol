// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IShieldToken.sol";
import "./interfaces/IUniswapV3Router.sol";
import "./interfaces/IWFLR.sol";

/**
 * @title RevenueRouter
 * @dev Routes protocol revenue: 50% swapped to SHIELD and burned, 50% kept as reserves
 * 
 * $10K Fair Launch Playbook:
 * - Receives wFLR fees from vault operations
 * - distribute() swaps 50% to SHIELD via SparkDEX V3 and burns it
 * - Remaining 50% accumulates as protocol reserves (withdrawable by owner)
 */
contract RevenueRouter is Ownable {
    using SafeERC20 for IERC20;
    
    IShieldToken public immutable shieldToken;
    IWFLR public immutable wflr;
    IUniswapV3Router public immutable router;
    
    uint24 public constant POOL_FEE = 3000; // 0.3% pool fee
    
    event RevenueDistributed(uint256 wflrAmount, uint256 shieldBurned);
    event ReservesWithdrawn(address indexed to, uint256 amount);
    
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
    
    /**
     * @dev Distributes revenue: 50% swapped to SHIELD and burned, 50% kept as reserves
     */
    function distribute() external {
        uint256 balance = wflr.balanceOf(address(this));
        require(balance > 0, "No revenue to distribute");
        
        // Calculate 50% for buyback & burn
        uint256 buybackAmount = balance / 2;
        
        // Approve router to spend wFLR
        wflr.approve(address(router), buybackAmount);
        
        // Swap wFLR to SHIELD via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(wflr),
            tokenOut: address(shieldToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: buybackAmount,
            amountOutMinimum: 0, // Accept any amount (can be improved with price oracle)
            sqrtPriceLimitX96: 0
        });
        
        uint256 shieldReceived = router.exactInputSingle(params);
        
        // Burn the SHIELD tokens
        shieldToken.burn(shieldReceived);
        
        emit RevenueDistributed(buybackAmount, shieldReceived);
    }
    
    /**
     * @dev Withdraw protocol reserves (50% kept from revenue)
     * @param to Address to receive reserves
     * @param amount Amount to withdraw
     */
    function withdrawReserves(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        IERC20(address(wflr)).safeTransfer(to, amount);
        emit ReservesWithdrawn(to, amount);
    }
    
    /**
     * @dev Receive FLR and wrap it to wFLR
     */
    receive() external payable {
        wflr.deposit{value: msg.value}();
    }
}
