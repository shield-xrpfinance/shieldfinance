// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFeeOnTransferToken
 * @dev ERC20 token that takes a fee on every transfer (for testing fee-on-transfer rejection)
 * 
 * Used in audit remediation tests to verify SB-04:
 * - StakingBoost.stake() should reject fee-on-transfer tokens
 * - StakingBoost.distributeBoost() should reject fee-on-transfer tokens
 */
contract MockFeeOnTransferToken is ERC20 {
    uint8 private _decimals;
    uint256 public feeBps; // Fee in basis points (100 = 1%)
    address public feeRecipient;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 _feeBps,
        address _feeRecipient
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (from != address(0) && to != address(0) && feeBps > 0) {
            uint256 fee = (amount * feeBps) / 10000;
            uint256 amountAfterFee = amount - fee;
            
            super._update(from, to, amountAfterFee);
            if (fee > 0) {
                super._update(from, feeRecipient, fee);
            }
        } else {
            super._update(from, to, amount);
        }
    }
}
