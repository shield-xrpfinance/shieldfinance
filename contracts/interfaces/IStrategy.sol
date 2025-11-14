// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategy
 * @dev Standard interface for yield strategies in ShXRP Vault
 * 
 * Architecture:
 * - ShXRPVault holds multiple strategies implementing this interface
 * - Each strategy manages a portion of vault's FXRP capital
 * - Vault calls deploy() to allocate capital, withdraw() to retrieve it
 * - totalAssets() returns FXRP-equivalent value for vault accounting
 * 
 * Compatible Strategies:
 * - KineticStrategy: FXRP lending on Kinetic Markets (~5-6% APY)
 * - FirelightStrategy: FXRP → stXRP liquid staking (when protocol matures)
 * - Future: SparkDEX LP, Enosys Loans, etc.
 * 
 * Security Notes:
 * - Only vault contract should call deploy/withdraw
 * - Strategies must return accurate totalAssets() for share price calculation
 * - Failed operations should revert (not return false)
 */
interface IStrategy {
    
    /**
     * @dev Returns the underlying asset (FXRP token address)
     * 
     * All strategies must use FXRP as the base asset to maintain
     * compatibility with ShXRPVault's ERC-4626 implementation.
     * 
     * @return address FXRP token address
     * 
     * Example:
     * return 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE; // FXRP Mainnet
     */
    function asset() external view returns (address);
    
    /**
     * @dev Calculate total FXRP-equivalent value held by this strategy
     * 
     * Critical Function:
     * - Used by ShXRPVault.totalAssets() for share price calculation
     * - Must return accurate FXRP value including accrued yield
     * - Should handle edge cases (zero deposits, protocol paused, etc.)
     * 
     * Implementation Guide:
     * - For lending: Query deposited balance + accrued interest
     * - For staking: Convert staked tokens to FXRP using oracle/exchange rate
     * - For LP: Value LP tokens in FXRP terms
     * 
     * Example (Kinetic lending):
     * ```
     * return kineticPool.balanceOfUnderlying(address(this));
     * ```
     * 
     * Example (Firelight staking with oracle):
     * ```
     * uint256 stXRPBalance = stXRPToken.balanceOf(address(this));
     * uint256 stXRPPrice = oracle.getPrice("stXRP/FXRP");
     * return (stXRPBalance * stXRPPrice) / 1e18;
     * ```
     * 
     * @return Total FXRP-equivalent assets in strategy (6 decimals)
     */
    function totalAssets() external view returns (uint256);
    
    /**
     * @dev Deploy FXRP capital to this strategy
     * 
     * Called by:
     * - ShXRPVault.deployToStrategy(strategyAddress, amount)
     * - Rebalancing keeper when buffer exceeds target
     * 
     * CRITICAL: Pull-Based Pattern
     * - Vault approves FXRP for strategy before calling deploy()
     * - Strategy MUST pull FXRP from vault using transferFrom
     * - This prevents double-counting in vault.totalAssets()
     * 
     * Requirements:
     * - Caller must be vault contract
     * - Vault must have approved FXRP transfer beforehand
     * - Strategy must pull exactly the approved amount
     * - Amount must be > 0
     * 
     * Implementation Steps:
     * 1. Pull FXRP from vault using transferFrom(msg.sender, address(this), amount)
     * 2. Deposit FXRP into underlying protocol (Kinetic, Firelight, etc.)
     * 3. Track position (update internal accounting)
     * 4. Emit DeployedToStrategy event
     * 
     * Example (Kinetic):
     * ```
     * // Pull FXRP from vault (vault has already approved)
     * IERC20(fxrp).transferFrom(msg.sender, address(this), amount);
     * 
     * // Deploy to Kinetic protocol
     * IERC20(fxrp).approve(kineticPool, amount);
     * kineticPool.supply(amount);
     * 
     * emit DeployedToStrategy(amount);
     * ```
     * 
     * @param amount Amount of FXRP to deploy (6 decimals)
     */
    function deploy(uint256 amount) external;
    
    /**
     * @dev Withdraw FXRP from this strategy
     * 
     * Called by:
     * - ShXRPVault.withdrawFromStrategy(strategyAddress, amount)
     * - User withdrawal when buffer is insufficient
     * - Rebalancing keeper when strategy allocation too high
     * 
     * Requirements:
     * - Caller must be vault contract
     * - Amount must be <= totalAssets()
     * - Receiver must be valid address
     * 
     * Implementation Steps:
     * 1. Redeem position from underlying protocol
     * 2. Receive FXRP (may include accrued yield)
     * 3. Transfer FXRP to receiver (usually vault)
     * 4. Update internal accounting
     * 5. Emit WithdrawnFromStrategy event
     * 
     * Edge Cases:
     * - If protocol has withdrawal delay (e.g., Firelight unstaking):
     *   * Strategy should handle async withdrawals
     *   * May need to revert with "Withdrawal pending" error
     * - If amount > available liquidity:
     *   * Withdraw maximum available
     *   * Or revert if exact amount required
     * 
     * Example (Kinetic):
     * ```
     * uint256 fxrpReceived = kineticPool.withdraw(amount);
     * IERC20(fxrp).transfer(receiver, fxrpReceived);
     * emit WithdrawnFromStrategy(amount, fxrpReceived);
     * ```
     * 
     * @param amount Amount of FXRP to withdraw (6 decimals)
     * @param receiver Address to receive withdrawn FXRP (usually vault)
     * @return actualAmount Actual FXRP withdrawn (may differ due to fees/slippage)
     */
    function withdraw(uint256 amount, address receiver) external returns (uint256 actualAmount);
    
    /**
     * @dev Report strategy performance and update state
     * 
     * Called by:
     * - Vault periodically (e.g., daily via keeper)
     * - Before rebalancing operations
     * - After major vault operations (large deposit/withdrawal)
     * 
     * Purpose:
     * - Claim/compound rewards if applicable
     * - Update internal state (cached balances, exchange rates, etc.)
     * - Calculate performance metrics (APY, total return, etc.)
     * - Emit performance data for off-chain tracking
     * 
     * Implementation Example (Kinetic):
     * ```
     * uint256 previousBalance = lastReportedBalance;
     * uint256 currentBalance = kineticPool.balanceOfUnderlying(address(this));
     * uint256 profit = currentBalance - previousBalance;
     * 
     * lastReportedBalance = currentBalance;
     * totalProfit += profit;
     * 
     * emit StrategyReport(currentBalance, profit, block.timestamp);
     * ```
     * 
     * Return Values:
     * - profit: FXRP gained since last report
     * - loss: FXRP lost (if any - should be rare)
     * - totalAssets: Current total FXRP value
     * 
     * @return profit FXRP gained since last report (6 decimals)
     * @return loss FXRP lost since last report (6 decimals)
     * @return totalAssets Current total FXRP-equivalent value (6 decimals)
     */
    function report() external returns (
        uint256 profit,
        uint256 loss,
        uint256 totalAssets
    );
    
    /**
     * @dev Check if strategy is active and accepting deposits
     * 
     * Useful for:
     * - Vault to check before deploying capital
     * - UI to show strategy status
     * - Emergency pause mechanism
     * 
     * Should return false if:
     * - Strategy is paused by owner
     * - Underlying protocol is paused/deprecated
     * - Strategy reached max capacity
     * - Critical error detected
     * 
     * @return true if strategy is operational and can accept deposits
     */
    function isActive() external view returns (bool);
    
    /**
     * @dev Get strategy name for identification
     * 
     * Used by:
     * - Vault for logging/events
     * - UI for display
     * - Analytics for tracking
     * 
     * Examples:
     * - "Kinetic FXRP Lending"
     * - "Firelight stXRP Staking"
     * - "SparkDEX FXRP/USDT0 LP"
     * 
     * @return Strategy name as string
     */
    function name() external view returns (string memory);
    
    // ========================================
    // EVENTS
    // ========================================
    
    /**
     * @dev Emitted when FXRP is deployed to strategy
     * @param amount FXRP amount deployed
     */
    event DeployedToStrategy(uint256 amount);
    
    /**
     * @dev Emitted when FXRP is withdrawn from strategy
     * @param amount FXRP amount requested
     * @param actualAmount Actual FXRP withdrawn
     */
    event WithdrawnFromStrategy(uint256 amount, uint256 actualAmount);
    
    /**
     * @dev Emitted when strategy reports performance
     * @param profit FXRP gained since last report
     * @param loss FXRP lost since last report
     * @param totalAssets Current total FXRP value
     */
    event StrategyReport(uint256 profit, uint256 loss, uint256 totalAssets);
}
