// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title IERC4626
 * @dev Minimal ERC-4626 interface for Firelight stXRP vault interaction
 */
interface IERC4626 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function balanceOf(address account) external view returns (uint256);
    function maxDeposit(address receiver) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);
}

/**
 * @title FirelightStrategy
 * @notice Strategy for staking FXRP in Firelight liquid staking protocol (stXRP)
 * @dev Implements IStrategy for integration with ShXRPVault multi-strategy system
 * 
 * Firelight Protocol Details:
 * - Liquid staking protocol for FXRP on Flare Network
 * - Live since Dec 3, 2025 on mainnet
 * - stXRP vault: 0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3
 * - ERC-4626 compliant vault (deposit FXRP → receive stXRP)
 * - Audited by OpenZeppelin + Coinspect
 * - Website: https://firelight.finance/
 * 
 * Integration Flow:
 * 1. ShXRPVault approves FXRP for this strategy
 * 2. deploy() is called → pulls FXRP, deposits to Firelight, receives stXRP
 * 3. stXRP balance accrues value as staking rewards accumulate
 * 4. withdraw() redeems stXRP for FXRP and sends to receiver
 * 
 * @custom:security-contact security@shyield.finance
 */
contract FirelightStrategy is IStrategy, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable fxrpToken;
    
    // Firelight stXRP vault (ERC-4626)
    // Mainnet: 0x4C18Ff3C89632c3Dd62E796c0aFA5c07c4c1B2b3
    IERC4626 public stXRPVault;
    
    // Strategy state
    bool private _isActive;
    
    // Tracking for reporting
    uint256 private lastReportedAssets;
    bool private reportInitialized;
    
    // Events
    event FirelightConfigUpdated(address indexed stXRPVault);
    event DepositedToFirelight(uint256 fxrpAmount, uint256 stXRPReceived);
    event RedeemedFromFirelight(uint256 stXRPAmount, uint256 fxrpReceived);

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
        
        // Disabled by default until configured
        _isActive = false;
    }
    
    /**
     * @notice Configure Firelight stXRP vault address
     * @dev Must be called before activating strategy
     * @param _stXRPVault Firelight stXRP vault address (ERC-4626)
     */
    function setFirelightConfig(address _stXRPVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_stXRPVault != address(0), "Invalid stXRP vault");
        
        // Verify the vault's underlying asset is FXRP
        IERC4626 vault = IERC4626(_stXRPVault);
        require(vault.asset() == address(fxrpToken), "Vault asset must be FXRP");
        
        stXRPVault = vault;
        
        emit FirelightConfigUpdated(_stXRPVault);
    }
    
    /**
     * @notice Deploy FXRP to Firelight staking
     * @dev Pull-based: Vault must approve FXRP transfer first
     *      Deposits FXRP to Firelight stXRP vault, receives stXRP shares
     * @param amount Amount of FXRP to stake (6 decimals)
     */
    function deploy(uint256 amount) external override onlyRole(OPERATOR_ROLE) {
        require(_isActive, "Strategy not active");
        require(amount > 0, "Amount must be > 0");
        require(address(stXRPVault) != address(0), "Firelight not configured");
        
        // Check Firelight deposit capacity
        uint256 maxDeposit = stXRPVault.maxDeposit(address(this));
        require(maxDeposit >= amount, "Exceeds Firelight deposit limit");
        
        // Pull FXRP from vault (vault has already approved)
        fxrpToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve Firelight to spend FXRP
        fxrpToken.forceApprove(address(stXRPVault), amount);
        
        // Deposit FXRP to Firelight, receive stXRP shares
        uint256 stXRPReceived = stXRPVault.deposit(amount, address(this));
        
        emit DepositedToFirelight(amount, stXRPReceived);
        emit DeployedToStrategy(amount);
    }
    
    /**
     * @notice Withdraw FXRP from Firelight staking
     * @dev Redeems stXRP shares for FXRP and transfers to receiver
     * @param amount Amount of FXRP to withdraw (6 decimals)
     * @param receiver Address to receive withdrawn FXRP
     * @return actualAmount Amount actually withdrawn (includes any accrued yield)
     */
    function withdraw(uint256 amount, address receiver) external override onlyRole(OPERATOR_ROLE) returns (uint256 actualAmount) {
        require(amount > 0, "Amount must be > 0");
        require(receiver != address(0), "Invalid receiver");
        require(address(stXRPVault) != address(0), "Firelight not configured");
        
        // Get our stXRP balance
        uint256 stXRPBalance = stXRPVault.balanceOf(address(this));
        if (stXRPBalance == 0) {
            return 0;
        }
        
        // Calculate how many stXRP shares we need to redeem for the requested FXRP amount
        uint256 sharesToRedeem = stXRPVault.convertToShares(amount);
        
        // Cap at our actual balance
        if (sharesToRedeem > stXRPBalance) {
            sharesToRedeem = stXRPBalance;
        }
        
        // Check Firelight redemption capacity
        uint256 maxRedeem = stXRPVault.maxRedeem(address(this));
        if (sharesToRedeem > maxRedeem) {
            sharesToRedeem = maxRedeem;
        }
        
        if (sharesToRedeem == 0) {
            return 0;
        }
        
        // Redeem stXRP shares for FXRP
        actualAmount = stXRPVault.redeem(sharesToRedeem, receiver, address(this));
        
        emit RedeemedFromFirelight(sharesToRedeem, actualAmount);
        emit WithdrawnFromStrategy(amount, actualAmount);
        
        return actualAmount;
    }
    
    /**
     * @notice Get total assets managed by strategy
     * @dev Returns FXRP-equivalent value of staked position using ERC-4626 conversion
     * @return Total FXRP value in strategy (6 decimals)
     */
    function totalAssets() external view override returns (uint256) {
        if (address(stXRPVault) == address(0)) {
            return 0;
        }
        
        // Get our stXRP balance
        uint256 stXRPBalance = stXRPVault.balanceOf(address(this));
        if (stXRPBalance == 0) {
            return 0;
        }
        
        // Convert stXRP shares to FXRP value using vault's exchange rate
        // This automatically includes any accrued staking rewards
        return stXRPVault.convertToAssets(stXRPBalance);
    }
    
    /**
     * @notice Get stXRP balance held by this strategy
     * @return stXRP token balance (6 decimals)
     */
    function getStXRPBalance() external view returns (uint256) {
        if (address(stXRPVault) == address(0)) {
            return 0;
        }
        return stXRPVault.balanceOf(address(this));
    }
    
    /**
     * @notice Get current stXRP to FXRP exchange rate
     * @dev Uses ERC-4626 conversion (1 stXRP share → X FXRP assets)
     * @return Exchange rate in 6 decimals (e.g., 1050000 = 1.05 FXRP per stXRP)
     */
    function getExchangeRate() external view returns (uint256) {
        if (address(stXRPVault) == address(0)) {
            return 1e6; // 1:1 if not configured
        }
        
        // How much FXRP is 1 stXRP worth?
        return stXRPVault.convertToAssets(1e6);
    }
    
    /**
     * @notice Report strategy performance
     * @dev Called periodically to update metrics and calculate profit/loss
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
     * @dev Should only be activated after Firelight vault is configured
     */
    function activate() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(stXRPVault) != address(0), "Firelight not configured");
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
     * @notice Get Firelight stXRP vault address
     */
    function getFirelightVault() external view returns (address) {
        return address(stXRPVault);
    }
    
    /**
     * @notice Emergency withdrawal (admin only)
     * @dev Redeems all stXRP back to FXRP and holds in this contract
     */
    function emergencyWithdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(stXRPVault) != address(0), "Firelight not configured");
        
        uint256 stXRPBalance = stXRPVault.balanceOf(address(this));
        if (stXRPBalance > 0) {
            // Redeem all stXRP to this contract
            uint256 fxrpReceived = stXRPVault.redeem(stXRPBalance, address(this), address(this));
            emit RedeemedFromFirelight(stXRPBalance, fxrpReceived);
        }
        
        // Deactivate strategy
        _isActive = false;
    }
    
    /**
     * @notice Rescue stuck tokens (admin only)
     * @dev Only for tokens other than stXRP (which is managed by the strategy)
     * @param token Token address to rescue
     * @param to Recipient address
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid recipient");
        // Don't allow rescuing stXRP (strategy's managed asset) unless deactivated
        if (token == address(stXRPVault)) {
            require(!_isActive, "Cannot rescue stXRP while active");
        }
        IERC20(token).safeTransfer(to, amount);
    }
}
