// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IStrategy.sol";

/**
 * @title MockStrategy
 * @dev Test implementation of IStrategy for unit testing
 * 
 * Features:
 * - Implements full IStrategy interface
 * - Configurable failure modes for testing edge cases
 * - Simulates over-delivery (yield/rebates)
 * - Simulates yield accrual
 */
contract MockStrategy is IStrategy {
    using SafeERC20 for IERC20;
    
    IERC20 public immutable fxrpToken;
    string public strategyName;
    
    // Tracking
    uint256 public totalDeployed;
    
    // Test configuration flags
    bool public shouldFailDeploy;
    bool public shouldFailWithdraw;
    uint256 public overDeliveryAmount;  // Extra FXRP to return on withdrawal
    uint256 public yieldAmount;         // Simulated yield for totalAssets()
    
    // Events are inherited from IStrategy interface - no need to redeclare
    
    constructor(address _fxrpToken, string memory _name) {
        fxrpToken = IERC20(_fxrpToken);
        strategyName = _name;
    }
    
    /**
     * @dev Returns underlying asset (FXRP)
     */
    function asset() external view override returns (address) {
        return address(fxrpToken);
    }
    
    /**
     * @dev Returns total assets = deployed + yield
     */
    function totalAssets() external view override returns (uint256) {
        return totalDeployed + yieldAmount;
    }
    
    /**
     * @dev Deploy FXRP from vault using pull-based pattern
     * 
     * CRITICAL: Vault must approve FXRP before calling this
     */
    function deploy(uint256 amount) external override {
        require(!shouldFailDeploy, "Mock deploy failure");
        require(amount > 0, "Amount must be > 0");
        
        // Pull FXRP from vault (msg.sender is vault)
        fxrpToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Track deployment
        totalDeployed += amount;
        
        emit DeployedToStrategy(amount);
    }
    
    /**
     * @dev Withdraw FXRP and send to receiver
     * 
     * Can simulate:
     * - Normal withdrawal
     * - Over-delivery (yield/rebates)
     * - Failures
     */
    function withdraw(uint256 amount, address receiver) external override returns (uint256 actualAmount) {
        require(!shouldFailWithdraw, "Mock withdraw failure");
        require(amount > 0, "Amount must be > 0");
        require(receiver != address(0), "Invalid receiver");
        
        // Clamp withdrawal to available balance (support partial withdrawals)
        uint256 availableAmount = totalDeployed < amount ? totalDeployed : amount;
        
        // Calculate actual amount (may include over-delivery)
        actualAmount = availableAmount + overDeliveryAmount;
        
        // Ensure we have enough FXRP (including over-delivery)
        require(fxrpToken.balanceOf(address(this)) >= actualAmount, "Insufficient FXRP balance");
        
        // Update tracking (deduct available amount, not actualAmount)
        totalDeployed -= availableAmount;
        
        // Transfer to receiver
        fxrpToken.safeTransfer(receiver, actualAmount);
        
        emit WithdrawnFromStrategy(availableAmount, actualAmount);
        
        return actualAmount;
    }
    
    /**
     * @dev Report performance (simple implementation for testing)
     */
    function report() external override returns (
        uint256 profit,
        uint256 loss,
        uint256 assets
    ) {
        profit = yieldAmount;  // All yield is profit
        loss = 0;              // No losses in mock
        assets = totalDeployed + yieldAmount;
        
        emit StrategyReport(profit, loss, assets);
        
        return (profit, loss, assets);
    }
    
    /**
     * @dev Returns whether strategy is active
     */
    function isActive() external view override returns (bool) {
        return !shouldFailDeploy && !shouldFailWithdraw;
    }
    
    /**
     * @dev Returns strategy name
     */
    function name() external view override returns (string memory) {
        return strategyName;
    }
    
    // ========================================
    // TEST HELPERS
    // ========================================
    
    /**
     * @dev Configure deploy failure mode
     */
    function setShouldFailDeploy(bool _fail) external {
        shouldFailDeploy = _fail;
    }
    
    /**
     * @dev Configure withdraw failure mode
     */
    function setShouldFailWithdraw(bool _fail) external {
        shouldFailWithdraw = _fail;
    }
    
    /**
     * @dev Configure over-delivery for testing yield scenarios
     * @param _amount Extra FXRP to return on withdrawal
     */
    function setOverDeliveryAmount(uint256 _amount) external {
        overDeliveryAmount = _amount;
    }
    
    /**
     * @dev Configure yield simulation for totalAssets()
     * @param _amount Yield to add to totalAssets
     */
    function setYieldAmount(uint256 _amount) external {
        yieldAmount = _amount;
    }
    
    /**
     * @dev Reset strategy to initial state
     */
    function reset() external {
        totalDeployed = 0;
        shouldFailDeploy = false;
        shouldFailWithdraw = false;
        overDeliveryAmount = 0;
        yieldAmount = 0;
    }
}
