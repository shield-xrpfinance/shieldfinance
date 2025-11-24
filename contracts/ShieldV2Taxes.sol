// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(
        address recipient,
        uint256 amount
    ) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;
        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        return c;
    }
}

contract Ownable is Context {
    address private _owner;
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(_owner == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    function transferOwnership(address _newOwner) public virtual onlyOwner {
        emit OwnershipTransferred(_owner, _newOwner);
        _owner = _newOwner;
    }
}

interface IFlareswapV2Factory {
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

interface IFlareswapV2Router02 {
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;

    function factory() external pure returns (address);

    function WETH() external pure returns (address);

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    )
        external
        payable
        returns (uint amountToken, uint amountETH, uint liquidity);
}

contract SHIELD is Context, IERC20, Ownable {
    using SafeMath for uint256;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _mmNoFees;

    uint256 private _startingBuyFee = 10;
    uint256 private _startingSellFee = 15;
    uint256 private _endingBuyFee = 1;
    uint256 private _endingSellFee = 1;

    uint256 private _launchBuyCount = 150;
    uint256 private _launchSellCount = 150;
    uint256 private _launchProtectedSwaps = 50;
    uint256 public _launchSwapCount = 0;

    uint8 private constant _decimals = 9;
    uint256 private constant _dTotal = 100_000_000 * 10 ** _decimals;

    string private _name = unicode"SHIELD";
    string private _symbol = unicode"SHIELD";

    uint256 public _upperTradeLimit = (_dTotal * 1) / 100;
    uint256 public _upperWalletLimit = (_dTotal * 1) / 100;
    uint256 public _upperFeeTrade = (_dTotal * 5) / 100;
    uint256 public _upperFeeHeld = (_dTotal * 1) / 1000;

    IFlareswapV2Router02 private flareswapV2Router;
    address public flareswapV2Pair;

    address payable public _mmWallet;
    address payable public _shieldWallet;
    address payable public _marketingWallet;

    bool private marketsOpen = false;
    bool private inTrade = false;

    event UpperTradeLimitEmit(uint _upperTradeLimit);

    modifier swapLock() {
        inTrade = true;
        _;
        inTrade = false;
    }

    constructor() {
        _mmWallet = payable(_msgSender());
        _shieldWallet = payable(_msgSender());
        _marketingWallet = payable(_msgSender());
        _balances[_msgSender()] = _dTotal;
        _mmNoFees[_mmWallet] = true;
        _mmNoFees[address(this)] = true;
        emit Transfer(address(0), _msgSender(), _dTotal);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return _decimals;
    }

    function totalSupply() public pure override returns (uint256) {
        return _dTotal;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 amount
    ) public override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()].sub(
                amount,
                "ERC20: transfer amount exceeds allowance"
            )
        );
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) private {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        uint256 taxAmount = 0;
        if (
            marketsOpen &&
            !_mmNoFees[from] &&
            !_mmNoFees[to]
        ) {
            if (
                from == flareswapV2Pair &&
                to != address(flareswapV2Router) &&
                !_mmNoFees[to]
            ) {
                require(amount <= _upperTradeLimit, "Exceeds the _upperTradeLimit");
                require(
                    balanceOf(to) + amount <= _upperWalletLimit,
                    "Exceeds the maxWalletSize"
                );
                taxAmount = amount
                    .mul(
                        (_launchSwapCount > _launchBuyCount)
                            ? _endingBuyFee
                            : _startingBuyFee
                    )
                    .div(100);
                _launchSwapCount++;
            }
            if (
                to == flareswapV2Pair &&
                from != address(this) &&
                !_mmNoFees[from]
            ) {
                taxAmount = amount
                    .mul(
                        (_launchSwapCount > _launchSellCount)
                            ? _endingSellFee
                            : _startingSellFee
                    )
                    .div(100);
            }
            uint256 contractTokenBalance = balanceOf(address(this));
            if (
                !inTrade &&
                to == flareswapV2Pair &&
                contractTokenBalance > _upperFeeHeld &&
                _launchSwapCount > _launchProtectedSwaps
            ) {
                swapTokensForEth(
                    min(amount, min(contractTokenBalance, _upperFeeTrade))
                );
                uint256 contractETHBalance = address(this).balance;

                if (contractETHBalance > 50000000000000000) {
                    uint256 mmAmount = (contractETHBalance * 40) / 100;
                    uint256 marketmarkerWalletAmount = (contractETHBalance * 40) / 100;
                    uint256 marketingWalletAmount = contractETHBalance - mmAmount - marketmarkerWalletAmount;

                    _mmWallet.transfer(mmAmount);
                    _shieldWallet.transfer(marketmarkerWalletAmount);
                    _marketingWallet.transfer(marketingWalletAmount);
                }
            }
        }
        if (taxAmount > 0) {
            _balances[address(this)] = _balances[address(this)].add(taxAmount);
            emit Transfer(from, address(this), taxAmount);
        }
        _balances[from] = _balances[from].sub(amount);
        _balances[to] = _balances[to].add(amount.sub(taxAmount));
        emit Transfer(from, to, amount.sub(taxAmount));
    }

    function min(uint256 a, uint256 b) private pure returns (uint256) {
        return (a > b) ? b : a;
    }

    function swapTokensForEth(uint256 tokenAmount) private swapLock {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = flareswapV2Router.WETH();
        _approve(address(this), address(flareswapV2Router), tokenAmount);
        flareswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function enableTrading(address router) public payable onlyOwner {
        require(!marketsOpen, "SHIELD is already trading");
        flareswapV2Router = IFlareswapV2Router02(
            router
        );
        _approve(address(this), address(flareswapV2Router), _dTotal);
        flareswapV2Pair = IFlareswapV2Factory(flareswapV2Router.factory()).createPair(
                address(this),
                flareswapV2Router.WETH()
            );
        flareswapV2Router.addLiquidityETH{value: msg.value}(
            address(this),
            balanceOf(address(this)),
            0,
            0,
            _mmWallet,
            block.timestamp
        );
        IERC20(flareswapV2Pair).approve(address(flareswapV2Router), type(uint).max);

        marketsOpen = true;
    }

    function removeLimits() external onlyOwner {
        _upperTradeLimit = _dTotal;
        _upperWalletLimit = _dTotal;
        emit UpperTradeLimitEmit(_dTotal);
    }

    function removeFees(address account, bool excluded) external onlyOwner {
        _mmNoFees[account] = excluded;
    }

    function reduceFees(
        uint256 startingBuyFee,
        uint256 startingSellFee,
        uint256 endingBuyFee,
        uint256 endingSellFee
    ) external onlyOwner {
        require(
            startingBuyFee + startingSellFee <= 10,
            "Fees must remain under 10%"
        );
        require(
            endingBuyFee + endingSellFee <= 10,
            "Fees must remain under 10%"
        );
        _startingBuyFee = startingBuyFee;
        _startingSellFee = startingSellFee;
        _endingBuyFee = endingBuyFee;
        _endingSellFee = endingSellFee;
    }

    function updateMakersWallet(
        address newMakerWallet
    ) external onlyOwner {
        _shieldWallet = payable(newMakerWallet);
        _mmNoFees[newMakerWallet] = true;
    }

    function updateMarketingWallet(
        address newMarketingWallet
    ) external onlyOwner {
        _marketingWallet = payable(newMarketingWallet);
        _mmNoFees[newMarketingWallet] = true;
    }

    function removeTokens(address _token) external onlyOwner returns (bool _sent) {
        if (_token == address(0)) {
            bool success;
            (success, ) = address(_mmWallet).call{value: address(this).balance}("");
        } else {
            uint256 _contractBalance = IERC20(_token).balanceOf(address(this));
            _sent = IERC20(_token).transfer(_mmWallet, _contractBalance);
        }
    }

    receive() external payable {}
}
