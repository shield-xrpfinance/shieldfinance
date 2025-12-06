// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZapPresale
 * @author Shield Finance
 * @notice Enables purchasing SHIELD tokens in presale using any token
 * @dev Integrates with DEX routers (SparkDEX on Flare, Uniswap V3 on other chains)
 *      to swap any token to USDC/USDT, then forwards to ShieldPresale contract
 * 
 * Flow:
 * 1. User provides any token (ETH, WETH, WFLR, etc.)
 * 2. ZapPresale swaps to payment token via DEX
 * 3. Forwards payment to ShieldPresale.buy()
 * 4. Purchase is recorded under user's address
 * 
 * Supported DEXs:
 * - Flare: SparkDEX V3
 * - Base/Arbitrum/Ethereum: Uniswap V3
 */

interface IShieldPresale {
    function buy(
        uint256 _usdAmount,
        bytes32 _referralCode,
        bytes32[] calldata _allowlistProof,
        bytes32[] calldata _kycProof
    ) external;
    
    function paymentToken() external view returns (address);
}

interface ISwapRouter {
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
    
    function exactInputSingle(ExactInputSingleParams calldata params) 
        external payable returns (uint256 amountOut);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract ZapPresale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IShieldPresale public immutable presale;
    ISwapRouter public immutable swapRouter;
    IWETH public immutable wrappedNative;
    IERC20 public immutable paymentToken;

    uint24 public defaultPoolFee = 3000; // 0.3%
    uint256 public slippageBps = 100;    // 1% default slippage
    
    mapping(address => uint24) public tokenPoolFees;
    mapping(address => bool) public supportedTokens;

    event ZapPurchase(
        address indexed buyer,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        uint256 shieldAmount
    );
    event TokenSupported(address token, uint24 poolFee);
    event SlippageUpdated(uint256 newSlippageBps);

    error UnsupportedToken();
    error InsufficientOutput();
    error SwapFailed();
    error InvalidAmount();

    constructor(
        address _presale,
        address _swapRouter,
        address _wrappedNative,
        address _owner
    ) Ownable(_owner) {
        presale = IShieldPresale(_presale);
        swapRouter = ISwapRouter(_swapRouter);
        wrappedNative = IWETH(_wrappedNative);
        paymentToken = IERC20(presale.paymentToken());

        IERC20(address(paymentToken)).approve(_presale, type(uint256).max);
        IERC20(address(wrappedNative)).approve(_swapRouter, type(uint256).max);
    }

    function addSupportedToken(address _token, uint24 _poolFee) external onlyOwner {
        supportedTokens[_token] = true;
        tokenPoolFees[_token] = _poolFee;
        IERC20(_token).approve(address(swapRouter), type(uint256).max);
        emit TokenSupported(_token, _poolFee);
    }

    function removeSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = false;
    }

    function setSlippage(uint256 _slippageBps) external onlyOwner {
        require(_slippageBps <= 1000, "Slippage too high"); // Max 10%
        slippageBps = _slippageBps;
        emit SlippageUpdated(_slippageBps);
    }

    function setDefaultPoolFee(uint24 _fee) external onlyOwner {
        defaultPoolFee = _fee;
    }

    function getPoolFee(address _token) public view returns (uint24) {
        uint24 fee = tokenPoolFees[_token];
        return fee > 0 ? fee : defaultPoolFee;
    }

    function _getMinAmountOut(uint256 _expectedAmount) internal view returns (uint256) {
        return (_expectedAmount * (10000 - slippageBps)) / 10000;
    }

    function zapWithNative(
        uint256 _minPaymentOut,
        bytes32 _referralCode,
        bytes32[] calldata _allowlistProof,
        bytes32[] calldata _kycProof
    ) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        wrappedNative.deposit{value: msg.value}();

        uint256 paymentReceived = _swapToPaymentToken(
            address(wrappedNative),
            msg.value,
            _minPaymentOut
        );

        _executePurchase(paymentReceived, _referralCode, _allowlistProof, _kycProof);

        emit ZapPurchase(msg.sender, address(0), msg.value, paymentReceived, 0);
    }

    function zapWithToken(
        address _tokenIn,
        uint256 _amountIn,
        uint256 _minPaymentOut,
        bytes32 _referralCode,
        bytes32[] calldata _allowlistProof,
        bytes32[] calldata _kycProof
    ) external nonReentrant {
        if (!supportedTokens[_tokenIn]) revert UnsupportedToken();
        if (_amountIn == 0) revert InvalidAmount();

        IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);

        uint256 paymentReceived = _swapToPaymentToken(_tokenIn, _amountIn, _minPaymentOut);

        _executePurchase(paymentReceived, _referralCode, _allowlistProof, _kycProof);

        emit ZapPurchase(msg.sender, _tokenIn, _amountIn, paymentReceived, 0);
    }

    function _swapToPaymentToken(
        address _tokenIn,
        uint256 _amountIn,
        uint256 _minAmountOut
    ) internal returns (uint256) {
        if (_tokenIn == address(paymentToken)) {
            return _amountIn;
        }

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _tokenIn,
            tokenOut: address(paymentToken),
            fee: getPoolFee(_tokenIn),
            recipient: address(this),
            deadline: block.timestamp + 300, // 5 minute deadline
            amountIn: _amountIn,
            amountOutMinimum: _minAmountOut,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        
        if (amountOut < _minAmountOut) revert InsufficientOutput();
        
        return amountOut;
    }

    function _executePurchase(
        uint256 _paymentAmount,
        bytes32 _referralCode,
        bytes32[] calldata _allowlistProof,
        bytes32[] calldata _kycProof
    ) internal {
        presale.buy(_paymentAmount, _referralCode, _allowlistProof, _kycProof);
    }

    function quoteZap(
        address _tokenIn,
        uint256 _amountIn
    ) external view returns (uint256 estimatedPayment, uint256 minPayment) {
        if (_tokenIn == address(paymentToken)) {
            return (_amountIn, _amountIn);
        }
        
        estimatedPayment = _amountIn;
        minPayment = _getMinAmountOut(estimatedPayment);
    }

    function rescueTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            (bool success,) = _to.call{value: _amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    receive() external payable {}
}
