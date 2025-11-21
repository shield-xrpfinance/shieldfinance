// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IShieldToken.sol";
import "./interfaces/IUniswapV3Router.sol";
import "./interfaces/IWFLR.sol";

/**
 * @title BuybackBurn
 * @dev Accepts wFLR, swaps to SHIELD via SparkDEX V3, and burns it
 * 
 * $10K Fair Launch Playbook:
 * - Receives wFLR from various sources (fees, donations, etc.)
 * - buyAndBurn() swaps all wFLR to SHIELD and burns it
 * - Creates constant deflationary pressure on SHIELD supply
 */
contract BuybackBurn is Ownable {
    using SafeERC20 for IERC20;
    
    IShieldToken public immutable shieldToken;
    IWFLR public immutable wflr;
    IUniswapV3Router public immutable router;
    
    uint24 public constant POOL_FEE = 3000; // 0.3% pool fee
    
    event BuybackAndBurn(uint256 wflrAmount, uint256 shieldBurned);
    
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
     * @dev Swaps all wFLR balance to SHIELD and burns it
     */
    function buyAndBurn() external {
        uint256 balance = wflr.balanceOf(address(this));
        require(balance > 0, "No wFLR to buyback");
        
        // Approve router to spend wFLR
        wflr.approve(address(router), balance);
        
        // Swap wFLR to SHIELD via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(wflr),
            tokenOut: address(shieldToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: balance,
            amountOutMinimum: 0, // Accept any amount (can be improved with price oracle)
            sqrtPriceLimitX96: 0
        });
        
        uint256 shieldReceived = router.exactInputSingle(params);
        
        // Burn all SHIELD tokens received
        shieldToken.burn(shieldReceived);
        
        emit BuybackAndBurn(balance, shieldReceived);
    }
    
    /**
     * @dev Receive FLR and wrap it to wFLR
     */
    receive() external payable {
        wflr.deposit{value: msg.value}();
    }
}
