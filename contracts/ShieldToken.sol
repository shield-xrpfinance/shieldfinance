// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShieldToken
 * @dev $SHIELD Fair Launch - Exactly 10,000,000 total supply, all to deployer
 * 
 * $10K Fair Launch Playbook:
 * - Total Supply: 10,000,000 SHIELD (fixed, immutable)
 * - All minted to deployer at launch
 * - Burnable for community deflation
 * - No taxes, no restrictions, pure ERC20
 */
contract ShieldToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 10**18;
    
    /**
     * @dev Constructor mints exactly 10M tokens to deployer
     */
    constructor() ERC20("ShieldToken", "SHIELD") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @dev Returns the number of decimals used
     * @return uint8 Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
