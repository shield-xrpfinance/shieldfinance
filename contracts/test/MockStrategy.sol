// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IStrategy.sol";

/**
 * @title MockStrategy
 * @dev Test implementation of IStrategy for testnet simulation
 * 
 * Features:
 * - Implements full IStrategy interface
 * - AccessControl for proper vault operator permissions
 * - Configurable failure modes for testing edge cases
 * - Simulates over-delivery (yield/rebates)
 * - Simulates yield accrual with configurable APY
 * - Can be activated/deactivated like real strategies
 * 
 * Use on Testnet:
 * - Deploy with FXRP address and admin/operator
 * - Register with VaultController
 * - Add to ShXRPVault with target allocation
 * - Use setYieldAmount() to simulate yield generation
 */
contract MockStrategy is IStrategy, AccessControl {
    using SafeERC20 for IERC20;
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    IERC20 public immutable fxrpToken;
    string public strategyName;
    
    // Tracking
    uint256 public totalDeployed;
    uint256 public lastReportedAssets;
    uint256 public totalProfitReported;
    
    // Strategy state
    bool private _isActive;
    
    // Test configuration flags
    bool public shouldFailDeploy;
    bool public shouldFailWithdraw;
    uint256 public overDeliveryAmount;  // Extra FXRP to return on withdrawal
    uint256 public yieldAmount;         // Simulated yield for totalAssets()
    
    // Events are inherited from IStrategy interface - no need to redeclare
    event StrategyActivated();
    event StrategyDeactivated();
    
    constructor(address _fxrpToken, address _admin, address _operator, string memory _name) {
        require(_fxrpToken != address(0), "Invalid FXRP token");
        require(_admin != address(0), "Invalid admin");
        
        fxrpToken = IERC20(_fxrpToken);
        strategyName = _name;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _operator);
        
        // Inactive by default until explicitly activated
        _isActive = false;
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
     * @notice Activate the strategy
     */
    function activate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isActive = true;
        emit StrategyActivated();
    }
    
    /**
     * @notice Deactivate the strategy
     */
    function deactivate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _isActive = false;
        emit StrategyDeactivated();
    }
    
    /**
     * @dev Deploy FXRP from vault using pull-based pattern
     * 
     * CRITICAL: Vault must approve FXRP before calling this
     */
    function deploy(uint256 amount) external override onlyRole(OPERATOR_ROLE) {
        require(_isActive, "Strategy not active");
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
    function withdraw(uint256 amount, address receiver) external override onlyRole(OPERATOR_ROLE) returns (uint256 actualAmount) {
        require(!shouldFailWithdraw, "Mock withdraw failure");
        require(amount > 0, "Amount must be > 0");
        require(receiver != address(0), "Invalid receiver");
        
        // Calculate total available (deployed + yield)
        uint256 totalAvailable = totalDeployed + yieldAmount;
        
        // Clamp withdrawal to available balance
        uint256 withdrawAmount = amount > totalAvailable ? totalAvailable : amount;
        
        // Calculate actual amount (may include over-delivery for testing)
        actualAmount = withdrawAmount + overDeliveryAmount;
        
        // Ensure we have enough FXRP
        uint256 balance = fxrpToken.balanceOf(address(this));
        if (actualAmount > balance) {
            actualAmount = balance;
        }
        
        // Update tracking - reduce yield first, then principal
        if (withdrawAmount <= yieldAmount) {
            yieldAmount -= withdrawAmount;
        } else {
            uint256 principalWithdraw = withdrawAmount - yieldAmount;
            yieldAmount = 0;
            totalDeployed = totalDeployed > principalWithdraw ? totalDeployed - principalWithdraw : 0;
        }
        
        // Transfer to receiver
        if (actualAmount > 0) {
            fxrpToken.safeTransfer(receiver, actualAmount);
        }
        
        emit WithdrawnFromStrategy(amount, actualAmount);
        
        return actualAmount;
    }
    
    /**
     * @dev Report performance - calculates profit since last report
     * Called by VaultController.executeCompound() to track yield
     */
    function report() external override onlyRole(OPERATOR_ROLE) returns (
        uint256 profit,
        uint256 loss,
        uint256 assets
    ) {
        assets = totalDeployed + yieldAmount;
        
        // Calculate profit since last report
        if (assets > lastReportedAssets) {
            profit = assets - lastReportedAssets;
        } else {
            loss = lastReportedAssets - assets;
        }
        
        // Track cumulative profit
        totalProfitReported += profit;
        lastReportedAssets = assets;
        
        emit StrategyReport(profit, loss, assets);
        
        return (profit, loss, assets);
    }
    
    /**
     * @dev Returns whether strategy is active
     */
    function isActive() external view override returns (bool) {
        return _isActive && !shouldFailDeploy && !shouldFailWithdraw;
    }
    
    /**
     * @dev Returns strategy name
     */
    function name() external view override returns (string memory) {
        return strategyName;
    }
    
    // ========================================
    // TEST HELPERS (Admin only)
    // ========================================
    
    /**
     * @dev Configure deploy failure mode
     */
    function setShouldFailDeploy(bool _fail) external onlyRole(DEFAULT_ADMIN_ROLE) {
        shouldFailDeploy = _fail;
    }
    
    /**
     * @dev Configure withdraw failure mode
     */
    function setShouldFailWithdraw(bool _fail) external onlyRole(DEFAULT_ADMIN_ROLE) {
        shouldFailWithdraw = _fail;
    }
    
    /**
     * @dev Configure over-delivery for testing yield scenarios
     * @param _amount Extra FXRP to return on withdrawal
     */
    function setOverDeliveryAmount(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        overDeliveryAmount = _amount;
    }
    
    /**
     * @dev Configure yield simulation for totalAssets()
     * @param _amount Yield to add to totalAssets (6 decimals)
     * 
     * Example: To simulate 1 FXRP of yield, call setYieldAmount(1000000)
     */
    function setYieldAmount(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        yieldAmount = _amount;
    }
    
    /**
     * @dev Add FXRP yield to strategy (simulates real yield from protocol)
     * @param _amount Yield to add (6 decimals)
     * 
     * This adds to both yieldAmount tracking AND requires actual FXRP transfer
     * to ensure the strategy can pay out the yield on withdrawal.
     */
    function addYield(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Must transfer actual FXRP to back the yield
        fxrpToken.safeTransferFrom(msg.sender, address(this), _amount);
        yieldAmount += _amount;
    }
    
    /**
     * @dev Reset strategy to initial state
     */
    function reset() external onlyRole(DEFAULT_ADMIN_ROLE) {
        totalDeployed = 0;
        lastReportedAssets = 0;
        totalProfitReported = 0;
        shouldFailDeploy = false;
        shouldFailWithdraw = false;
        overDeliveryAmount = 0;
        yieldAmount = 0;
        _isActive = false;
    }
    
    /**
     * @dev Get current state for debugging
     */
    function getState() external view returns (
        uint256 deployed,
        uint256 yield_,
        uint256 total,
        uint256 lastReported,
        uint256 profitReported,
        bool active
    ) {
        return (
            totalDeployed,
            yieldAmount,
            totalDeployed + yieldAmount,
            lastReportedAssets,
            totalProfitReported,
            _isActive
        );
    }
}
