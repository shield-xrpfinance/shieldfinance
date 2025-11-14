// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title KineticStrategy
 * @notice Strategy for depositing FXRP into Kinetic lending protocol
 * @dev Implements IStrategy for integration with ShXRPVault multi-strategy system
 * 
 * Kinetic Protocol Details:
 * - Premier lending/borrowing protocol on Flare Network
 * - Built on Compound V2 architecture
 * - FXRP ISO Market: ~10.34M FXRP TVL (~$26.26M)
 * - Supply APY: ~3.83-6% (historical)
 * - Total Borrow: ~287k FXRP (~$728k)
 * - Website: https://kinetic-market.com/
 * 
 * Configuration Needed:
 * - Kinetic cToken contract address (e.g., cFXRP on Flare mainnet)
 * - Comptroller contract address
 * - Interest rate model verification
 * 
 * @custom:security-contact security@shyield.finance
 */
contract KineticStrategy is IStrategy, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable fxrpToken;
    
    // Kinetic cToken contract (wraps deposited FXRP)
    // TODO: Set to actual cFXRP address on Flare mainnet/Coston2
    address public kineticCToken;
    
    // Kinetic Comptroller for market interactions
    // TODO: Set to actual Comptroller address
    address public kineticComptroller;
    
    // Strategy state
    bool private _isActive;
    
    // Tracking
    uint256 private totalDeployedAmount;
    uint256 private lastReportedAssets;
    uint256 private accumulatedYield;
    bool private reportInitialized;
    
    // Events
    event KineticConfigUpdated(address indexed cToken, address indexed comptroller);

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
        
        _isActive = false;
    }
    
    /**
     * @notice Configure Kinetic contract addresses
     * @dev Must be called before activating strategy
     * @param _cToken Kinetic cToken address (e.g., cFXRP)
     * @param _comptroller Kinetic Comptroller address
     */
    function setKineticConfig(
        address _cToken,
        address _comptroller
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_cToken != address(0), "Invalid cToken");
        require(_comptroller != address(0), "Invalid comptroller");
        
        kineticCToken = _cToken;
        kineticComptroller = _comptroller;
        
        emit KineticConfigUpdated(_cToken, _comptroller);
    }
    
    /**
     * @notice Deploy FXRP to Kinetic lending pool
     * @dev Pull-based: Vault must approve FXRP transfer first
     * @param amount Amount of FXRP to deploy (6 decimals)
     */
    function deploy(uint256 amount) external override onlyRole(OPERATOR_ROLE) {
        require(_isActive, "Strategy not active");
        require(amount > 0, "Amount must be > 0");
        require(kineticCToken != address(0), "Kinetic not configured");
        
        // TODO: Implement actual Kinetic deposit
        // For now, just pull FXRP from vault (safe for testing)
        fxrpToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // TODO: Call Kinetic cToken.mint(amount)
        // Example Compound V2 pattern:
        // require(kineticCToken.mint(amount) == 0, "Kinetic mint failed");
        
        totalDeployedAmount += amount;
        
        emit DeployedToStrategy(amount);
    }
    
    /**
     * @notice Withdraw FXRP from Kinetic lending pool
     * @param amount Amount of FXRP to withdraw (6 decimals)
     * @param receiver Address to receive withdrawn FXRP
     * @return actualAmount Amount actually withdrawn (may include accrued yield)
     */
    function withdraw(uint256 amount, address receiver) external override onlyRole(OPERATOR_ROLE) returns (uint256 actualAmount) {
        require(amount > 0, "Amount must be > 0");
        require(receiver != address(0), "Invalid receiver");
        
        // Get current total assets (principal + yield)
        uint256 currentTotal = this.totalAssets();
        
        // Clamp to available assets (not just principal)
        uint256 requestedAmount = amount < currentTotal ? amount : currentTotal;
        
        // TODO: Implement actual Kinetic withdrawal
        // Example Compound V2 pattern:
        // uint256 cTokenBalance = kineticCToken.balanceOf(address(this));
        // uint256 exchangeRate = kineticCToken.exchangeRateCurrent();
        // uint256 cTokensToRedeem = (requestedAmount * 1e18) / exchangeRate;
        // require(kineticCToken.redeem(cTokensToRedeem) == 0, "Kinetic redeem failed");
        // actualAmount = fxrpToken.balanceOf(address(this)); // May include extra yield
        
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
     * @dev Returns deployed amount + accrued interest from Kinetic
     * @return Total FXRP value in strategy (6 decimals)
     */
    function totalAssets() external view override returns (uint256) {
        if (kineticCToken == address(0)) {
            return 0;
        }
        
        // TODO: Implement actual Kinetic balance query
        // Example Compound V2 pattern:
        // uint256 cTokenBalance = kineticCToken.balanceOf(address(this));
        // uint256 exchangeRate = kineticCToken.exchangeRateCurrent();
        // return (cTokenBalance * exchangeRate) / 1e18;
        
        // Return principal + yield
        return totalDeployedAmount + accumulatedYield;
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
     * @notice Activate strategy
     */
    function activate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(kineticCToken != address(0), "Kinetic not configured");
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
        return "Kinetic FXRP Lending";
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
     * @dev Withdraws all FXRP from Kinetic back to this contract
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // TODO: Implement Kinetic full withdrawal
        // For now, no-op (funds already in contract buffer)
    }
}
