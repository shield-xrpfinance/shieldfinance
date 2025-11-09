// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Shield XRP Vault (shXRP)
 * @dev Liquid staking vault for XRP on Flare Network
 * 
 * Features:
 * - Mints shXRP 1:1 for deposited XRP
 * - Burns shXRP on withdrawal
 * - Integrates with XRPL escrow hooks for cross-chain bridge
 * - Operator-controlled deposits/withdrawals for security
 * - Rewards distribution for shXRP holders
 * 
 * Architecture:
 * 1. User initiates deposit → Frontend calls XRPL hook
 * 2. XRPL hook locks XRP in escrow → Emits event
 * 3. Operator calls mintShXRP() → Issues shXRP to user
 * 4. User requests withdrawal → Burns shXRP
 * 5. Operator releases XRP from XRPL escrow
 */
contract ShXRPVault is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    // Mapping of approved operators who can mint/burn shXRP
    mapping(address => bool) public operators;
    
    // Minimum deposit amount (0.01 XRP equivalent)
    uint256 public minDeposit = 0.01 ether;
    
    // Total XRP locked in escrow on XRPL
    uint256 public totalXRPLocked;
    
    // Exchange rate (shXRP to XRP) - starts at 1:1, can increase with rewards
    uint256 public exchangeRate = 1 ether;
    
    // Events
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event ShXRPMinted(address indexed user, uint256 xrpAmount, uint256 shXRPAmount, string xrplTxHash);
    event ShXRPBurned(address indexed user, uint256 shXRPAmount, uint256 xrpAmount);
    event RewardsDistributed(uint256 rewardAmount, uint256 newExchangeRate);
    event MinDepositUpdated(uint256 newMinDeposit);
    event ExchangeRateUpdated(uint256 newRate);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not an operator");
        _;
    }
    
    constructor() ERC20("Shield XRP", "shXRP") Ownable(msg.sender) {
        // Deployer is first operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }
    
    /**
     * @dev Add an operator who can mint/burn shXRP
     * @param operator Address of the operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        operators[operator] = true;
        emit OperatorAdded(operator);
    }
    
    /**
     * @dev Remove an operator
     * @param operator Address of the operator
     */
    function removeOperator(address operator) external onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }
    
    /**
     * @dev Mint shXRP tokens after XRP is locked in XRPL escrow
     * @param user Address of the user who deposited XRP
     * @param xrpAmount Amount of XRP deposited (in wei/drops)
     * @param xrplTxHash XRPL transaction hash for verification
     */
    function mintShXRP(
        address user,
        uint256 xrpAmount,
        string calldata xrplTxHash
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(xrpAmount >= minDeposit, "Amount below minimum deposit");
        require(bytes(xrplTxHash).length > 0, "Invalid XRPL tx hash");
        
        // Calculate shXRP amount based on exchange rate
        uint256 shXRPAmount = (xrpAmount * 1 ether) / exchangeRate;
        
        // Update total locked XRP
        totalXRPLocked += xrpAmount;
        
        // Mint shXRP to user
        _mint(user, shXRPAmount);
        
        emit ShXRPMinted(user, xrpAmount, shXRPAmount, xrplTxHash);
    }
    
    /**
     * @dev Burn shXRP and request XRP withdrawal from XRPL escrow
     * @param shXRPAmount Amount of shXRP to burn
     * @return xrpAmount Amount of XRP to be withdrawn
     */
    function burnShXRP(uint256 shXRPAmount) external nonReentrant returns (uint256 xrpAmount) {
        require(shXRPAmount > 0, "Cannot burn zero amount");
        require(balanceOf(msg.sender) >= shXRPAmount, "Insufficient shXRP balance");
        
        // Calculate XRP amount based on exchange rate
        xrpAmount = (shXRPAmount * exchangeRate) / 1 ether;
        
        // Update total locked XRP
        require(totalXRPLocked >= xrpAmount, "Insufficient XRP locked");
        totalXRPLocked -= xrpAmount;
        
        // Burn shXRP from user
        _burn(msg.sender, shXRPAmount);
        
        emit ShXRPBurned(msg.sender, shXRPAmount, xrpAmount);
        
        return xrpAmount;
    }
    
    /**
     * @dev Distribute rewards and update exchange rate
     * @param rewardAmount Amount of XRP rewards to distribute
     */
    function distributeRewards(uint256 rewardAmount) external onlyOperator {
        require(rewardAmount > 0, "Reward amount must be positive");
        require(totalSupply() > 0, "No shXRP minted yet");
        
        // Add rewards to total locked XRP
        totalXRPLocked += rewardAmount;
        
        // Update exchange rate: (total XRP) / (total shXRP)
        exchangeRate = (totalXRPLocked * 1 ether) / totalSupply();
        
        emit RewardsDistributed(rewardAmount, exchangeRate);
    }
    
    /**
     * @dev Update minimum deposit amount
     * @param newMinDeposit New minimum deposit (in wei)
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        require(newMinDeposit > 0, "Min deposit must be positive");
        minDeposit = newMinDeposit;
        emit MinDepositUpdated(newMinDeposit);
    }
    
    /**
     * @dev Get current exchange rate (shXRP to XRP)
     * @return Current exchange rate in wei
     */
    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }
    
    /**
     * @dev Calculate shXRP amount for given XRP amount
     * @param xrpAmount Amount of XRP
     * @return Amount of shXRP
     */
    function calculateShXRPAmount(uint256 xrpAmount) external view returns (uint256) {
        return (xrpAmount * 1 ether) / exchangeRate;
    }
    
    /**
     * @dev Calculate XRP amount for given shXRP amount
     * @param shXRPAmount Amount of shXRP
     * @return Amount of XRP
     */
    function calculateXRPAmount(uint256 shXRPAmount) external view returns (uint256) {
        return (shXRPAmount * exchangeRate) / 1 ether;
    }
    
    /**
     * @dev Returns the number of decimals used
     * @return uint8 Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
