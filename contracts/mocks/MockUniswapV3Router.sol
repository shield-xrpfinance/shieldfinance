// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockUniswapV3Router
 * @dev Mock Uniswap V3 Router for testing BuybackBurn
 */
contract MockUniswapV3Router {
    using SafeERC20 for IERC20;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    // Configurable output amount for testing
    uint256 public amountOut;
    address public outputToken;

    // Store last swap params for verification
    ExactInputSingleParams public lastSwapParams;

    function setAmountOut(uint256 _amountOut) external {
        amountOut = _amountOut;
    }

    function setOutputToken(address _outputToken) external {
        outputToken = _outputToken;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256)
    {
        // Store params for test verification
        lastSwapParams = params;

        // Take input tokens
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Check slippage
        require(amountOut >= params.amountOutMinimum, "Too little received");

        // Send output tokens
        IERC20(outputToken).safeTransfer(params.recipient, amountOut);

        return amountOut;
    }
}
