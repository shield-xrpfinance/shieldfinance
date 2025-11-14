// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title FirelightStrategy
 * @notice Strategy for staking FXRP in Firelight liquid staking protocol
 * @dev Implements IStrategy for integration with ShXRPVault multi-strategy system
 * 
 * Firelight Protocol Details:
 * - Liquid staking protocol for FXRP on Flare Network
 * - Expected launch: Q1 2026
 * - Provides stXRP (staked FXRP) liquid staking tokens
 * - Higher APY potential vs lending (staking rewards)
 * - May have unstaking delays/withdrawal queues
 * - Website: https://firelight.finance/
 * 
 * Configuration Needed:
 * - Firelight staking contract address
 * - stXRP token contract address
 * - Oracle for stXRP/FXRP exchange rate (if applicable)
 * - Unstaking delay period
 * 
 * Implementation Notes:
 * - DISABLED by default (Q1 2026 launch)
 * - Will be activated when Firelight goes live
 * - Requires careful testing of unstaking flow
 * 
 * @custom:security-contact security@shyield.finance
 */
contract FirelightStrategy is IStrategy, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable fxrpToken;
    
    // Firelight staking contract
    // TODO: Set to actual Firelight contract address when live (Q1 2026)
    address public firelightStaking;
    
    // stXRP liquid staking token
    // TODO: Set to actual stXRP token address
    address public stXRPToken;
    
    // Oracle for stXRP/FXRP exchange rate (if needed)
    // TODO: Determine if oracle required or if Firelight provides rate
    address public exchangeRateOracle;
    
    // Strategy state
    bool private _isActive;
    
    // Tracking
    uint256 private totalDeployedAmount;
    uint256 private lastReportedAssets;
    uint256 private accumulatedYield;
    bool private reportInitialized;
    
    // Events
    event FirelightConfigUpdated(address indexed stakingContract, address indexed stXRP, address indexed oracle);
    event UnstakingInitiated(uint256 amount, uint256 withdrawalId);

    constructor(
        address _fxrpToken,
        address _admin,
        address _operator
    ) {
        require(_fxrpToken != address(0), "Invalid FXRP token");
        require(_admin != address(0), "Invalid admin");
        require(_operator != address(0), "Invalid operator");
        
        fxrpToken = IERC20(_fxrpToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _operator);
        
        // Disabled by default (Q1 2026 launch)
        _isActive = false;
    }
    
    /**
     * @notice Configure Firelight contract addresses
     * @dev Must be called before activating strategy
     * @param _stakingContract Firelight staking contract address
     * @param _stXRP stXRP token address
     * @param _oracle Exchange rate oracle (address(0) if not needed)
     */
    function setFirelightConfig(
        address _stakingContract,
        address _stXRP,
        address _oracle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_stakingContract != address(0), "Invalid staking contract");
        require(_stXRP != address(0), "Invalid stXRP");
        
        firelightStaking = _stakingContract;
        stXRPToken = _stXRP;
        exchangeRateOracle = _oracle;
        
        emit FirelightConfigUpdated(_stakingContract, _stXRP, _oracle);
    }
    
    /**
     * @notice Deploy FXRP to Firelight staking
     * @dev Pull-based: Vault must approve FXRP transfer first
     * @param amount Amount of FXRP to stake (6 decimals)
     */
    function deploy(uint256 amount) external override onlyRole(OPERATOR_ROLE) {
        require(_isActive, "Strategy not active");
        require(amount > 0, "Amount must be > 0");
        require(firelightStaking != address(0), "Firelight not configured");
        
        // TODO: Implement actual Firelight staking
        // For now, just pull FXRP from vault (safe for testing)
        fxrpToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // TODO: Stake FXRP to receive stXRP
        // Example pattern:
        // fxrpToken.approve(firelightStaking, amount);
        // uint256 stXRPReceived = IFirelightStaking(firelightStaking).stake(amount);
        
        totalDeployedAmount += amount;
        
        emit DeployedToStrategy(amount);
    }
    
    /**
     * @notice Withdraw FXRP from Firelight staking
     * @param amount Amount of FXRP to withdraw (6 decimals)
     * @param receiver Address to receive withdrawn FXRP
     * @return actualAmount Amount actually withdrawn (may include staking rewards)
     */
    function withdraw(uint256 amount, address receiver) external override onlyRole(OPERATOR_ROLE) returns (uint256 actualAmount) {
        require(amount > 0, "Amount must be > 0");
        require(receiver != address(0), "Invalid receiver");
        
        // Get current total assets (principal + staking rewards)
        uint256 currentTotal = this.totalAssets();
        
        // Clamp to available assets
        uint256 requestedAmount = amount < currentTotal ? amount : currentTotal;
        
        // TODO: Implement actual Firelight unstaking
        // Important: Firelight may have unstaking delays!
        // Example pattern:
        // uint256 stXRPBalance = IERC20(stXRPToken).balanceOf(address(this));
        // uint256 exchangeRate = getStXRPToFXRPRate();
        // uint256 stXRPToUnstake = (requestedAmount * 1e18) / exchangeRate;
        // 
        // // Option 1: Instant withdrawal (if available, may have fee)
        // actualAmount = IFirelightStaking(firelightStaking).unstakeInstant(stXRPToUnstake);
        // 
        // // Option 2: Delayed withdrawal (queue, claim later)
        // uint256 withdrawalId = IFirelightStaking(firelightStaking).requestUnstake(stXRPToUnstake);
        // emit UnstakingInitiated(requestedAmount, withdrawalId);
        // revert("Unstaking delayed - claim after delay period");
        
        // For now, transfer from buffer (safe for testing)
        uint256 balance = fxrpToken.balanceOf(address(this));
        actualAmount = balance < requestedAmount ? balance : requestedAmount;
        
        if (actualAmount > 0) {
            fxrpToken.safeTransfer(receiver, actualAmount);
            
            // Withdraw from yield first, then principal
            if (actualAmount <= accumulatedYield) {
                accumulatedYield -= actualAmount;
            } else {
                uint256 yieldPortion = accumulatedYield;
                uint256 principalPortion = actualAmount - yieldPortion;
                accumulatedYield = 0;
                
                if (principalPortion >= totalDeployedAmount) {
                    totalDeployedAmount = 0;
                } else {
                    totalDeployedAmount -= principalPortion;
                }
            }
        }
        
        emit WithdrawnFromStrategy(amount, actualAmount);
        
        return actualAmount;
    }
    
    /**
     * @notice Get total assets managed by strategy
     * @dev Returns FXRP-equivalent value of staked position
     * @return Total FXRP value in strategy (6 decimals)
     */
    function totalAssets() external view override returns (uint256) {
        if (firelightStaking == address(0) || stXRPToken == address(0)) {
            return 0;
        }
        
        // TODO: Implement actual Firelight balance query
        // Example pattern:
        // uint256 stXRPBalance = IERC20(stXRPToken).balanceOf(address(this));
        // uint256 exchangeRate = getStXRPToFXRPRate(); // From oracle or Firelight
        // return (stXRPBalance * exchangeRate) / 1e18;
        
        // Return principal + yield
        return totalDeployedAmount + accumulatedYield;
    }
    
    /**
     * @notice Get stXRP to FXRP exchange rate
     * @dev Helper function to query exchange rate (from oracle or Firelight)
     * @return Exchange rate in 18 decimals
     */
    function getStXRPToFXRPRate() internal view returns (uint256) {
        // TODO: Implement actual exchange rate query
        // Option 1: Firelight provides rate
        // return IFirelightStaking(firelightStaking).getExchangeRate();
        // 
        // Option 2: Oracle provides rate
        // if (exchangeRateOracle != address(0)) {
        //     return IOracle(exchangeRateOracle).getRate("stXRP/FXRP");
        // }
        // 
        // Option 3: Calculate from reserves
        // uint256 totalStXRP = IERC20(stXRPToken).totalSupply();
        // uint256 totalFXRP = IFirelightStaking(firelightStaking).totalStaked();
        // return (totalFXRP * 1e18) / totalStXRP;
        
        // For now, return 1:1
        return 1e18;
    }
    
    /**
     * @notice Report strategy performance
     * @dev Called periodically to update metrics
     * @return profit FXRP gained since last report (6 decimals)
     * @return loss FXRP lost since last report (6 decimals)
     * @return currentAssets Current total FXRP value (6 decimals)
     */
    function report() external override onlyRole(OPERATOR_ROLE) returns (uint256 profit, uint256 loss, uint256 currentAssets) {
        currentAssets = this.totalAssets();
        
        // Initialize baseline on first-ever report
        if (!reportInitialized) {
            lastReportedAssets = currentAssets;
            reportInitialized = true;
            emit StrategyReport(0, 0, currentAssets);
            return (0, 0, currentAssets);
        }
        
        // Calculate incremental profit/loss since LAST report
        if (currentAssets > lastReportedAssets) {
            profit = currentAssets - lastReportedAssets;
            loss = 0;
        } else if (currentAssets < lastReportedAssets) {
            profit = 0;
            loss = lastReportedAssets - currentAssets;
        } else {
            profit = 0;
            loss = 0;
        }
        
        lastReportedAssets = currentAssets;
        emit StrategyReport(profit, loss, currentAssets);
        
        return (profit, loss, currentAssets);
    }
    
    /**
     * @notice Get underlying asset address
     */
    function asset() external view override returns (address) {
        return address(fxrpToken);
    }
    
    /**
     * @notice Check if strategy is active
     */
    function isActive() external view override returns (bool) {
        return _isActive;
    }
    
    /**
     * @notice Activate strategy (admin only)
     * @dev Should only be activated when Firelight launches (Q1 2026)
     */
    function activate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(firelightStaking != address(0), "Firelight not configured");
        require(stXRPToken != address(0), "stXRP not configured");
        _isActive = true;
    }
    
    /**
     * @notice Deactivate strategy
     */
    function deactivate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isActive = false;
    }
    
    /**
     * @notice Get strategy name
     */
    function name() external pure override returns (string memory) {
        return "Firelight stXRP Staking";
    }
    
    /**
     * @notice Simulate yield accumulation for testing
     * @dev Manually adds yield to test report() functionality
     * @param amount Amount of simulated yield to add (6 decimals)
     */
    function simulateYield(uint256 amount) external onlyRole(OPERATOR_ROLE) {
        accumulatedYield += amount;
    }
    
    /**
     * @notice Emergency withdrawal (admin only)
     * @dev Withdraws all stXRP/FXRP back to this contract
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // TODO: Implement Firelight emergency unstake
        // May require waiting for unstaking delay
    }
    
    /**
     * @notice Claim pending unstaking withdrawals
     * @dev For delayed unstaking model
     * @param withdrawalId ID of pending withdrawal
     */
    function claimUnstaking(uint256 withdrawalId) external onlyRole(OPERATOR_ROLE) {
        // TODO: Implement claim logic for delayed withdrawals
        // Example:
        // uint256 claimedAmount = IFirelightStaking(firelightStaking).claimUnstake(withdrawalId);
        // emit WithdrawalClaimed(withdrawalId, claimedAmount);
    }
}
