// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StXRPVault
 * @dev Liquid staking vault for XRP on Flare Network
 * 
 * Features:
 * - Mints stXRP 1:1 for deposited XRP
 * - Burns stXRP on withdrawal
 * - Integrates with XRPL escrow hooks for cross-chain bridge
 * - Operator-controlled deposits/withdrawals for security
 * - Rewards distribution for stXRP holders
 * 
 * Architecture:
 * 1. User initiates deposit → Frontend calls XRPL hook
 * 2. XRPL hook locks XRP in escrow → Emits event
 * 3. Operator calls mintStXRP() → Issues stXRP to user
 * 4. User requests withdrawal → Burns stXRP
 * 5. Operator releases XRP from XRPL escrow
 */
contract StXRPVault is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    // Mapping of approved operators who can mint/burn stXRP
    mapping(address => bool) public operators;
    
    // Minimum deposit amount (0.01 XRP equivalent)
    uint256 public minDeposit = 0.01 ether;
    
    // Total XRP locked in escrow on XRPL
    uint256 public totalXRPLocked;
    
    // Exchange rate (stXRP to XRP) - starts at 1:1, can increase with rewards
    uint256 public exchangeRate = 1 ether;
    
    // Events
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event StXRPMinted(address indexed user, uint256 xrpAmount, uint256 stXRPAmount, string xrplTxHash);
    event StXRPBurned(address indexed user, uint256 stXRPAmount, uint256 xrpAmount);
    event RewardsDistributed(uint256 rewardAmount, uint256 newExchangeRate);
    event MinDepositUpdated(uint256 newMinDeposit);
    event ExchangeRateUpdated(uint256 newRate);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not an operator");
        _;
    }
    
    constructor() ERC20("Staked XRP", "stXRP") Ownable(msg.sender) {
        // Deployer is first operator
        operators[msg.sender] = true;
        emit OperatorAdded(msg.sender);
    }
    
    /**
     * @dev Add an operator who can mint/burn stXRP
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
     * @dev Mint stXRP tokens after XRP is locked in XRPL escrow
     * @param user Address of the user who deposited XRP
     * @param xrpAmount Amount of XRP deposited (in wei/drops)
     * @param xrplTxHash XRPL transaction hash for verification
     */
    function mintStXRP(
        address user,
        uint256 xrpAmount,
        string calldata xrplTxHash
    ) external onlyOperator nonReentrant {
        require(user != address(0), "Invalid user address");
        require(xrpAmount >= minDeposit, "Amount below minimum deposit");
        require(bytes(xrplTxHash).length > 0, "Invalid XRPL tx hash");
        
        // Calculate stXRP amount based on exchange rate
        uint256 stXRPAmount = (xrpAmount * 1 ether) / exchangeRate;
        
        // Update total locked XRP
        totalXRPLocked += xrpAmount;
        
        // Mint stXRP to user
        _mint(user, stXRPAmount);
        
        emit StXRPMinted(user, xrpAmount, stXRPAmount, xrplTxHash);
    }
    
    /**
     * @dev Burn stXRP and request XRP withdrawal from XRPL escrow
     * @param stXRPAmount Amount of stXRP to burn
     * @return xrpAmount Amount of XRP to be withdrawn
     */
    function burnStXRP(uint256 stXRPAmount) external nonReentrant returns (uint256 xrpAmount) {
        require(stXRPAmount > 0, "Cannot burn zero amount");
        require(balanceOf(msg.sender) >= stXRPAmount, "Insufficient stXRP balance");
        
        // Calculate XRP amount based on exchange rate
        xrpAmount = (stXRPAmount * exchangeRate) / 1 ether;
        
        // Update total locked XRP
        require(totalXRPLocked >= xrpAmount, "Insufficient XRP locked");
        totalXRPLocked -= xrpAmount;
        
        // Burn stXRP from user
        _burn(msg.sender, stXRPAmount);
        
        emit StXRPBurned(msg.sender, stXRPAmount, xrpAmount);
        
        return xrpAmount;
    }
    
    /**
     * @dev Distribute rewards and update exchange rate
     * @param rewardAmount Amount of XRP rewards to distribute
     */
    function distributeRewards(uint256 rewardAmount) external onlyOperator {
        require(rewardAmount > 0, "Reward amount must be positive");
        require(totalSupply() > 0, "No stXRP minted yet");
        
        // Add rewards to total locked XRP
        totalXRPLocked += rewardAmount;
        
        // Update exchange rate: (total XRP) / (total stXRP)
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
     * @dev Get current exchange rate (stXRP to XRP)
     * @return Current exchange rate in wei
     */
    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }
    
    /**
     * @dev Calculate stXRP amount for given XRP amount
     * @param xrpAmount Amount of XRP
     * @return Amount of stXRP
     */
    function calculateStXRPAmount(uint256 xrpAmount) external view returns (uint256) {
        return (xrpAmount * 1 ether) / exchangeRate;
    }
    
    /**
     * @dev Calculate XRP amount for given stXRP amount
     * @param stXRPAmount Amount of stXRP
     * @return Amount of XRP
     */
    function calculateXRPAmount(uint256 stXRPAmount) external view returns (uint256) {
        return (stXRPAmount * exchangeRate) / 1 ether;
    }
    
    /**
     * @dev Returns the number of decimals used
     * @return uint8 Number of decimals (18)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
