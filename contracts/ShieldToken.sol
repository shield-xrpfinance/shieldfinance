// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShieldToken
 * @dev $SHIELD governance and utility token for the XRP Liquid Staking Protocol
 * 
 * Tokenomics:
 * - Total Supply: 100,000,000 SHIELD
 * - Treasury Allocation: 10,000,000 SHIELD (10%)
 * - Remaining: 90,000,000 SHIELD for community distribution
 * 
 * Features:
 * - Burnable: Token holders can burn their tokens
 * - Mintable: Only owner can mint (for controlled emissions)
 * - Ownable: Ownership can be transferred to DAO governance
 */
contract ShieldToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18; // 100M tokens
    uint256 public constant TREASURY_ALLOCATION = 10_000_000 * 10**18; // 10M tokens (10%)
    
    address public immutable treasury;
    
    event TreasuryFunded(address indexed treasury, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount);
    
    /**
     * @dev Constructor mints total supply and allocates to deployer and treasury
     * @param _treasury Address of the treasury wallet
     */
    constructor(address _treasury) ERC20("Shield Finance", "SHIELD") Ownable(msg.sender) {
        require(_treasury != address(0), "Treasury address cannot be zero");
        
        treasury = _treasury;
        
        // Mint treasury allocation
        _mint(_treasury, TREASURY_ALLOCATION);
        emit TreasuryFunded(_treasury, TREASURY_ALLOCATION);
        
        // Mint remaining supply to deployer
        uint256 remainingSupply = TOTAL_SUPPLY - TREASURY_ALLOCATION;
        _mint(msg.sender, remainingSupply);
        emit TokensMinted(msg.sender, remainingSupply);
    }
    
    /**
     * @dev Mint new tokens (only owner)
     * @param to Address to receive minted tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation
     * @return uint8 Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
