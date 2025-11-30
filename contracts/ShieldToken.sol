// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title ShieldToken
 * @author Shield Finance
 * @notice $SHIELD governance token for the Shield Finance liquid staking protocol
 * @dev Pure ERC20 with fixed supply, no admin functions, no privileged access
 * 
 * Token Economics:
 * - Total Supply: 10,000,000 SHIELD (fixed, immutable, defined as constant)
 * - All tokens minted to deployer at launch for distribution
 * - Burnable by any holder for community-driven deflation
 * - No taxes, no restrictions, standard ERC20 behavior
 * 
 * Audit Findings Addressed:
 * - ST-02: Removed unused Ownable inheritance (no admin functions needed)
 * - ST-03: TOTAL_SUPPLY is constant, not mutable variable
 * - ST-05: Improved NatSpec documentation and code clarity
 * 
 * Trust Model:
 * - ST-01 (Acknowledged): All tokens minted to deployer - distribution is
 *   handled off-chain. Verify on-chain that tokens were distributed to
 *   liquidity pools and stakeholder addresses as promised.
 * 
 * Security Properties:
 * - No owner/admin functions - fully permissionless after deployment
 * - No minting after constructor - supply is permanently fixed
 * - No pausability - transfers cannot be halted
 * - No blacklisting - all addresses can transact freely
 */
contract ShieldToken is ERC20, ERC20Burnable {
    /// @notice Fixed total supply of SHIELD tokens (10 million with 18 decimals)
    /// @dev Declared as constant for gas efficiency and immutability guarantee
    uint256 public constant TOTAL_SUPPLY = 10_000_000 * 10**18;
    
    /**
     * @notice Deploys the SHIELD token and mints entire supply to deployer
     * @dev The deployer is responsible for distributing tokens to:
     *      - Liquidity pools (DEX pairs)
     *      - Staking rewards reserve
     *      - Team/investor vesting contracts
     *      - Community airdrops
     * 
     * After deployment, there is no admin or owner - the token is fully
     * decentralized and permissionless.
     */
    constructor() ERC20("ShieldToken", "SHIELD") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @notice Returns the number of decimals used for display purposes
     * @dev Override to explicitly document the standard 18 decimals
     * @return The number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
