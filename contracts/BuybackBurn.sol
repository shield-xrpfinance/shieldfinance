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
 * 
 * Security Features:
 * - Uses SafeERC20 forceApprove for safe token approvals
 * - Configurable slippage protection to prevent sandwich attacks
 * - Emergency rescue function for accidentally sent tokens
 */
contract BuybackBurn is Ownable {
    using SafeERC20 for IERC20;
    
    IShieldToken public immutable shieldToken;
    IWFLR public immutable wflr;
    IUniswapV3Router public immutable router;
    
    uint24 public constant POOL_FEE = 3000; // 0.3% pool fee
    
    /// @notice Maximum allowed slippage in basis points (e.g., 500 = 5%)
    uint256 public maxSlippageBps;
    
    /// @notice Last known price of SHIELD in wFLR (scaled by 1e18)
    /// @dev Used for slippage calculation, updated after each successful swap
    uint256 public lastKnownPrice;
    
    event BuybackAndBurn(uint256 wflrAmount, uint256 shieldBurned);
    event SlippageUpdated(uint256 oldSlippage, uint256 newSlippage);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TokensRescued(address token, address to, uint256 amount);
    
    error InvalidSlippage();
    error InvalidPrice();
    error CannotRescueWFLR();
    error CannotRescueSHIELD();
    error NoWFLRToSwap();
    error SlippageExceeded(uint256 expected, uint256 received);
    
    /**
     * @dev Constructor
     * @param _shieldToken Address of SHIELD token
     * @param _wflr Address of Wrapped FLR
     * @param _router Address of SparkDEX V3 Router
     * @param _maxSlippageBps Maximum slippage in basis points (e.g., 500 = 5%)
     * @param _initialPrice Initial SHIELD price in wFLR (scaled by 1e18)
     */
    constructor(
        address _shieldToken,
        address _wflr,
        address _router,
        uint256 _maxSlippageBps,
        uint256 _initialPrice
    ) Ownable(msg.sender) {
        require(_shieldToken != address(0), "Invalid SHIELD address");
        require(_wflr != address(0), "Invalid wFLR address");
        require(_router != address(0), "Invalid router address");
        require(_maxSlippageBps <= 2000, "Slippage too high"); // Max 20%
        require(_initialPrice > 0, "Invalid initial price");
        
        shieldToken = IShieldToken(_shieldToken);
        wflr = IWFLR(_wflr);
        router = IUniswapV3Router(_router);
        maxSlippageBps = _maxSlippageBps;
        lastKnownPrice = _initialPrice;
    }
    
    /**
     * @dev Swaps all wFLR balance to SHIELD and burns it
     * @notice Uses slippage protection based on last known price
     */
    function buyAndBurn() external {
        uint256 balance = wflr.balanceOf(address(this));
        if (balance == 0) revert NoWFLRToSwap();
        
        // Calculate minimum expected SHIELD based on last known price and slippage
        uint256 expectedShield = (balance * 1e18) / lastKnownPrice;
        uint256 minShieldOut = (expectedShield * (10000 - maxSlippageBps)) / 10000;
        
        // Use forceApprove for safe approval (handles non-standard tokens)
        IERC20(address(wflr)).forceApprove(address(router), balance);
        
        // Swap wFLR to SHIELD via SparkDEX V3
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: address(wflr),
            tokenOut: address(shieldToken),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: balance,
            amountOutMinimum: minShieldOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 shieldReceived = router.exactInputSingle(params);
        
        // Update last known price based on actual swap result
        uint256 oldPrice = lastKnownPrice;
        lastKnownPrice = (balance * 1e18) / shieldReceived;
        emit PriceUpdated(oldPrice, lastKnownPrice);
        
        // Burn all SHIELD tokens received
        shieldToken.burn(shieldReceived);
        
        emit BuybackAndBurn(balance, shieldReceived);
    }
    
    /**
     * @dev Updates maximum slippage tolerance
     * @param _maxSlippageBps New slippage in basis points (max 2000 = 20%)
     */
    function setMaxSlippage(uint256 _maxSlippageBps) external onlyOwner {
        if (_maxSlippageBps > 2000) revert InvalidSlippage();
        
        uint256 oldSlippage = maxSlippageBps;
        maxSlippageBps = _maxSlippageBps;
        
        emit SlippageUpdated(oldSlippage, _maxSlippageBps);
    }
    
    /**
     * @dev Updates last known price (for initial calibration or corrections)
     * @param _price New price in wFLR per SHIELD (scaled by 1e18)
     */
    function setLastKnownPrice(uint256 _price) external onlyOwner {
        if (_price == 0) revert InvalidPrice();
        
        uint256 oldPrice = lastKnownPrice;
        lastKnownPrice = _price;
        
        emit PriceUpdated(oldPrice, _price);
    }
    
    /**
     * @dev Rescues accidentally sent tokens (not wFLR or SHIELD)
     * @param token Address of token to rescue
     * @param to Address to send rescued tokens
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(wflr)) revert CannotRescueWFLR();
        if (token == address(shieldToken)) revert CannotRescueSHIELD();
        
        IERC20(token).safeTransfer(to, amount);
        
        emit TokensRescued(token, to, amount);
    }
    
    /**
     * @dev Receive FLR and wrap it to wFLR
     */
    receive() external payable {
        wflr.deposit{value: msg.value}();
    }
}
