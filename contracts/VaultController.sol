// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ShXRPVault.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title VaultController
 * @dev Manages operator permissions, compounding, and multi-strategy coordination for ShXRP vaults
 */
contract VaultController is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant COMPOUNDER_ROLE = keccak256("COMPOUNDER_ROLE");
    
    // Registered vaults
    mapping(address => bool) public registeredVaults;
    address[] public vaultList;
    
    // Strategy registry
    mapping(address => bool) public registeredStrategies;
    address[] public strategyList;
    mapping(address => string) public strategyNames;
    
    // Target allocations (basis points, 10000 = 100%)
    uint256 public constant BUFFER_TARGET_BPS = 1000;  // 10%
    uint256 public constant KINETIC_TARGET_BPS = 4000; // 40%
    uint256 public constant FIRELIGHT_TARGET_BPS = 5000; // 50%
    
    // Compounding configuration
    uint256 public minCompoundInterval = 1 hours;
    mapping(address => uint256) public lastCompoundTime;
    
    // Bridging tracking
    mapping(bytes32 => BridgeRequest) public bridgeRequests;
    
    struct BridgeRequest {
        address user;
        address vault;
        uint256 xrpAmount;
        uint256 fxrpExpected;
        uint256 timestamp;
        BridgeStatus status;
        string xrplTxHash;
        string flareTxHash;
    }
    
    enum BridgeStatus {
        Pending,
        XRPLConfirmed,
        BridgingInProgress,
        FXRPReceived,
        VaultMinted,
        Failed,
        Cancelled
    }
    
    // Events
    event VaultRegistered(address indexed vault);
    event VaultDeregistered(address indexed vault);
    event BridgeRequestCreated(bytes32 indexed requestId, address indexed user, uint256 xrpAmount);
    event BridgeStatusUpdated(bytes32 indexed requestId, BridgeStatus newStatus);
    event CompoundExecuted(address indexed vault, uint256 yieldAmount);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    
    // Strategy Events
    event StrategyRegistered(address indexed strategy, string name);
    event StrategyDeregistered(address indexed strategy);
    event StrategyDeployed(address indexed vault, address indexed strategy, uint256 amount);
    event StrategyWithdrawn(address indexed vault, address indexed strategy, uint256 amount);
    event VaultRebalanced(
        address indexed vault,
        uint256 bufferBefore,
        uint256 bufferAfter,
        uint256 kineticBefore,
        uint256 kineticAfter,
        uint256 firelightBefore,
        uint256 firelightAfter
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(COMPOUNDER_ROLE, msg.sender);
    }
    
    // Vault management
    function registerVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!registeredVaults[vault], "Vault already registered");
        registeredVaults[vault] = true;
        vaultList.push(vault);
        emit VaultRegistered(vault);
    }
    
    function deregisterVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(registeredVaults[vault], "Vault not registered");
        registeredVaults[vault] = false;
        emit VaultDeregistered(vault);
    }
    
    // Bridge request management
    function createBridgeRequest(
        address user,
        address vault,
        uint256 xrpAmount,
        string calldata xrplTxHash
    ) external onlyRole(OPERATOR_ROLE) returns (bytes32) {
        bytes32 requestId = keccak256(abi.encodePacked(user, vault, xrpAmount, block.timestamp));
        
        bridgeRequests[requestId] = BridgeRequest({
            user: user,
            vault: vault,
            xrpAmount: xrpAmount,
            fxrpExpected: xrpAmount, // 1:1 initially, can add conversion logic
            timestamp: block.timestamp,
            status: BridgeStatus.Pending,
            xrplTxHash: xrplTxHash,
            flareTxHash: ""
        });
        
        emit BridgeRequestCreated(requestId, user, xrpAmount);
        return requestId;
    }
    
    function updateBridgeStatus(
        bytes32 requestId,
        BridgeStatus newStatus,
        string calldata flareTxHash
    ) external onlyRole(OPERATOR_ROLE) {
        BridgeRequest storage request = bridgeRequests[requestId];
        require(request.timestamp > 0, "Request not found");
        
        request.status = newStatus;
        if (bytes(flareTxHash).length > 0) {
            request.flareTxHash = flareTxHash;
        }
        
        emit BridgeStatusUpdated(requestId, newStatus);
    }
    
    // Compounding
    function executeCompound(address vault) 
        external 
        onlyRole(COMPOUNDER_ROLE) 
        nonReentrant 
    {
        require(registeredVaults[vault], "Vault not registered");
        require(
            block.timestamp >= lastCompoundTime[vault] + minCompoundInterval,
            "Compound interval not reached"
        );
        
        // Call vault's compound function (to be implemented)
        // For now, just update timestamp
        lastCompoundTime[vault] = block.timestamp;
        
        emit CompoundExecuted(vault, 0);
    }
    
    function setMinCompoundInterval(uint256 interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minCompoundInterval = interval;
    }
    
    // Operator management
    function addOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(OPERATOR_ROLE, operator);
        emit OperatorAdded(operator);
    }
    
    function removeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(OPERATOR_ROLE, operator);
        emit OperatorRemoved(operator);
    }
    
    function addCompounder(address compounder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(COMPOUNDER_ROLE, compounder);
    }
    
    function removeCompounder(address compounder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(COMPOUNDER_ROLE, compounder);
    }
    
    // ========================================
    // STRATEGY MANAGEMENT
    // ========================================
    
    function registerStrategy(
        address strategy,
        string calldata name
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(strategy != address(0), "Invalid strategy address");
        require(!registeredStrategies[strategy], "Strategy already registered");
        
        registeredStrategies[strategy] = true;
        strategyList.push(strategy);
        strategyNames[strategy] = name;
        
        emit StrategyRegistered(strategy, name);
    }
    
    function deregisterStrategy(address strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(registeredStrategies[strategy], "Strategy not registered");
        
        registeredStrategies[strategy] = false;
        delete strategyNames[strategy];
        
        emit StrategyDeregistered(strategy);
    }
    
    // ========================================
    // ALLOCATION VIEW FUNCTIONS
    // ========================================
    
    function getCurrentAllocation(address vault) external view returns (
        uint256 bufferAmount,
        uint256 kineticAmount,
        uint256 firelightAmount,
        uint256 totalAssets
    ) {
        require(registeredVaults[vault], "Vault not registered");
        
        ShXRPVault vaultContract = ShXRPVault(vault);
        IERC20 asset = IERC20(vaultContract.asset());
        
        bufferAmount = asset.balanceOf(address(vaultContract));
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategyAddr = strategyList[i];
            if (!registeredStrategies[strategyAddr]) continue;
            
            string memory name = strategyNames[strategyAddr];
            uint256 strategyAssets = 0;
            
            try IStrategy(strategyAddr).totalAssets() returns (uint256 assets) {
                strategyAssets = assets;
            } catch {
                strategyAssets = 0;
            }
            
            if (keccak256(bytes(name)) == keccak256(bytes("Kinetic"))) {
                kineticAmount = strategyAssets;
            } else if (keccak256(bytes(name)) == keccak256(bytes("Firelight"))) {
                firelightAmount = strategyAssets;
            }
        }
        
        totalAssets = bufferAmount + kineticAmount + firelightAmount;
    }
    
    function getTargetAllocation(address vault, uint256 totalAssets) external view returns (
        uint256 bufferTarget,
        uint256 kineticTarget,
        uint256 firelightTarget
    ) {
        require(registeredVaults[vault], "Vault not registered");
        
        address kineticStrategy = _getStrategyAddress(vault, "Kinetic");
        address firelightStrategy = _getStrategyAddress(vault, "Firelight");
        
        bool kineticActive = _isStrategyActive(vault, kineticStrategy);
        bool firelightActive = _isStrategyActive(vault, firelightStrategy);
        
        bufferTarget = (totalAssets * BUFFER_TARGET_BPS) / 10000;
        
        if (kineticActive && firelightActive) {
            kineticTarget = (totalAssets * KINETIC_TARGET_BPS) / 10000;
            firelightTarget = (totalAssets * FIRELIGHT_TARGET_BPS) / 10000;
        } else if (kineticActive && !firelightActive) {
            kineticTarget = (totalAssets * (KINETIC_TARGET_BPS + FIRELIGHT_TARGET_BPS)) / 10000;
            firelightTarget = 0;
        } else if (!kineticActive && firelightActive) {
            kineticTarget = 0;
            firelightTarget = (totalAssets * (KINETIC_TARGET_BPS + FIRELIGHT_TARGET_BPS)) / 10000;
        } else {
            bufferTarget = totalAssets;
            kineticTarget = 0;
            firelightTarget = 0;
        }
    }
    
    function needsRebalancing(
        address vault,
        uint256 thresholdBps
    ) external view returns (bool) {
        require(registeredVaults[vault], "Vault not registered");
        
        (
            uint256 bufferAmount,
            uint256 kineticAmount,
            uint256 firelightAmount,
            uint256 totalAssets
        ) = this.getCurrentAllocation(vault);
        
        if (totalAssets == 0) return false;
        
        (uint256 bufferTarget, uint256 kineticTarget, uint256 firelightTarget) = 
            this.getTargetAllocation(vault, totalAssets);
        
        uint256 bufferDeviation = _calculateDeviation(bufferAmount, bufferTarget, totalAssets);
        uint256 kineticDeviation = _calculateDeviation(kineticAmount, kineticTarget, totalAssets);
        uint256 firelightDeviation = _calculateDeviation(firelightAmount, firelightTarget, totalAssets);
        
        return bufferDeviation > thresholdBps || 
               kineticDeviation > thresholdBps || 
               firelightDeviation > thresholdBps;
    }
    
    function _calculateDeviation(
        uint256 current,
        uint256 target,
        uint256 total
    ) internal pure returns (uint256) {
        if (total == 0) return 0;
        
        uint256 currentBps = (current * 10000) / total;
        uint256 targetBps = (target * 10000) / total;
        
        if (currentBps > targetBps) {
            return currentBps - targetBps;
        } else {
            return targetBps - currentBps;
        }
    }
    
    function _isStrategyActive(address vault, address strategy) internal view returns (bool) {
        if (strategy == address(0)) return false;
        
        try ShXRPVault(vault).getStrategyInfo(strategy) returns (ShXRPVault.StrategyInfo memory info) {
            return info.status == ShXRPVault.StrategyStatus.Active || 
                   info.status == ShXRPVault.StrategyStatus.Paused;
        } catch {
            return false;
        }
    }
    
    function _getStrategyAddress(address vault, string memory name) internal view returns (address) {
        address strategy = _getStrategyByName(name);
        if (strategy == address(0)) return address(0);
        
        try ShXRPVault(vault).getStrategyInfo(strategy) returns (ShXRPVault.StrategyInfo memory) {
            return strategy;
        } catch {
            return address(0);
        }
    }
    
    // ========================================
    // STRATEGY DEPLOYMENT FUNCTIONS
    // ========================================
    
    /**
     * @dev Calculate strategy deficits based on current and target allocations
     * @param kineticCurrent Current Kinetic strategy balance
     * @param firelightCurrent Current Firelight strategy balance
     * @param kineticTarget Target Kinetic strategy balance
     * @param firelightTarget Target Firelight strategy balance
     * @return kineticDeficit Deficit for Kinetic (positive = underweight, negative = overweight)
     * @return firelightDeficit Deficit for Firelight (positive = underweight, negative = overweight)
     */
    function _calculateStrategyDeficits(
        uint256 kineticCurrent,
        uint256 firelightCurrent,
        uint256 kineticTarget,
        uint256 firelightTarget
    ) private pure returns (
        int256 kineticDeficit,
        int256 firelightDeficit
    ) {
        kineticDeficit = int256(kineticTarget) - int256(kineticCurrent);
        firelightDeficit = int256(firelightTarget) - int256(firelightCurrent);
    }
    
    /**
     * @dev Calculate deployment amounts based on deficits
     * @param deployableAmount Total amount available to deploy
     * @param kineticCurrent Current Kinetic balance
     * @param firelightCurrent Current Firelight balance
     * @param totalAssets Current total assets
     * @return kineticAmount Amount to deploy to Kinetic
     * @return firelightAmount Amount to deploy to Firelight
     */
    function _calculateDeploymentAmounts(
        address vault,
        uint256 deployableAmount,
        uint256 kineticCurrent,
        uint256 firelightCurrent,
        uint256 totalAssets
    ) private view returns (
        uint256 kineticAmount,
        uint256 firelightAmount
    ) {
        // Calculate targets
        (, uint256 kineticTarget, uint256 firelightTarget) = this.getTargetAllocation(vault, totalAssets);
        
        // Calculate deficits (can be negative)
        int256 kineticDeficit = int256(kineticTarget) - int256(kineticCurrent);
        int256 firelightDeficit = int256(firelightTarget) - int256(firelightCurrent);
        
        // ONLY allocate to underweight strategies
        // CAP each at its positive deficit
        
        if (kineticDeficit > 0 && firelightDeficit > 0) {
            // Both underweight - cap each at deficit
            uint256 kineticNeed = uint256(kineticDeficit);
            uint256 firelightNeed = uint256(firelightDeficit);
            uint256 totalNeed = kineticNeed + firelightNeed;
            
            if (deployableAmount >= totalNeed) {
                // Can satisfy both - cap at exact deficits
                kineticAmount = kineticNeed;
                firelightAmount = firelightNeed;
                // Residual stays in buffer (deployableAmount - totalNeed)
            } else {
                // Can't satisfy both - proportional allocation
                kineticAmount = deployableAmount * kineticNeed / totalNeed;
                firelightAmount = deployableAmount - kineticAmount;
                // No residual (used all deployable)
            }
            
        } else if (kineticDeficit > 0) {
            // Only Kinetic underweight
            uint256 kineticNeed = uint256(kineticDeficit);
            kineticAmount = deployableAmount < kineticNeed ? deployableAmount : kineticNeed;
            firelightAmount = 0;  // NOT sending to overweight Firelight!
            // Residual stays in buffer if deployableAmount > kineticNeed
            
        } else if (firelightDeficit > 0) {
            // Only Firelight underweight
            uint256 firelightNeed = uint256(firelightDeficit);
            kineticAmount = 0;  // NOT sending to overweight Kinetic!
            firelightAmount = deployableAmount < firelightNeed ? deployableAmount : firelightNeed;
            // Residual stays in buffer if deployableAmount > firelightNeed
            
        } else {
            // Both at or above target - cannot deploy
            revert("Strategies already at or above target allocation");
        }
    }
    
    /**
     * @dev External wrapper for _calculateDeploymentAmounts to enable try/catch
     */
    function _calculateDeploymentAmountsExternal(
        address vault,
        uint256 deployableAmount,
        uint256 kineticCurrent,
        uint256 firelightCurrent,
        uint256 totalAssets
    ) external view returns (
        uint256 kineticAmount,
        uint256 firelightAmount
    ) {
        return _calculateDeploymentAmounts(
            vault,
            deployableAmount,
            kineticCurrent,
            firelightCurrent,
            totalAssets
        );
    }
    
    function deployToStrategies(
        address vault,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(registeredVaults[vault], "Vault not registered");
        
        (uint256 bufferCurrent, uint256 kineticCurrent, uint256 firelightCurrent, uint256 totalAssets) 
            = this.getCurrentAllocation(vault);
        
        (uint256 bufferTarget, , ) = this.getTargetAllocation(vault, totalAssets);
        
        uint256 deployableAmount;
        if (bufferCurrent > bufferTarget) {
            deployableAmount = bufferCurrent - bufferTarget;
        } else {
            revert("Buffer already at or below target - cannot deploy");
        }
        
        if (amount > 0 && amount < deployableAmount) {
            deployableAmount = amount;
        }
        
        require(deployableAmount > 0, "No funds available for deployment");
        require(bufferCurrent >= deployableAmount, "Insufficient vault liquidity");
        
        address kinetic = _getStrategyByName("Kinetic");
        address firelight = _getStrategyByName("Firelight");
        
        require(kinetic != address(0), "Kinetic strategy not registered");
        require(firelight != address(0), "Firelight strategy not registered");
        
        // Calculate deployment amounts (may be less than deployableAmount)
        (uint256 kineticAmount, uint256 firelightAmount) = _calculateDeploymentAmounts(
            vault,
            deployableAmount,
            kineticCurrent,
            firelightCurrent,
            totalAssets
        );
        
        // IMPORTANT: Only deploy what was calculated (may leave residual in buffer)
        // This is CORRECT behavior - buffer can be above 10% when strategies are at target
        
        if (kineticAmount > 0) {
            ShXRPVault(vault).deployToStrategy(kinetic, kineticAmount);
            emit StrategyDeployed(vault, kinetic, kineticAmount);
        }
        if (firelightAmount > 0) {
            ShXRPVault(vault).deployToStrategy(firelight, firelightAmount);
            emit StrategyDeployed(vault, firelight, firelightAmount);
        }
        
        // Note: If kineticAmount + firelightAmount < deployableAmount, residual stays in buffer
    }
    
    function withdrawFromStrategies(
        address vault,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(registeredVaults[vault], "Vault not registered");
        require(amount > 0, "Amount must be greater than 0");
        
        address kineticStrategy = _getStrategyByName("Kinetic");
        address firelightStrategy = _getStrategyByName("Firelight");
        
        require(kineticStrategy != address(0) || firelightStrategy != address(0), "No strategies registered");
        
        uint256 kineticAvailable = 0;
        uint256 firelightAvailable = 0;
        
        if (kineticStrategy != address(0)) {
            try IStrategy(kineticStrategy).totalAssets() returns (uint256 assets) {
                kineticAvailable = assets;
            } catch {}
        }
        
        if (firelightStrategy != address(0)) {
            try IStrategy(firelightStrategy).totalAssets() returns (uint256 assets) {
                firelightAvailable = assets;
            } catch {}
        }
        
        uint256 totalStrategyAssets = kineticAvailable + firelightAvailable;
        require(totalStrategyAssets >= amount, "Insufficient strategy liquidity");
        
        ShXRPVault vaultContract = ShXRPVault(vault);
        uint256 remainingToWithdraw = amount;
        
        if (firelightStrategy != address(0) && remainingToWithdraw > 0) {
            if (firelightAvailable > 0) {
                uint256 withdrawAmount = remainingToWithdraw > firelightAvailable ? firelightAvailable : remainingToWithdraw;
                vaultContract.withdrawFromStrategy(firelightStrategy, withdrawAmount);
                remainingToWithdraw -= withdrawAmount;
                emit StrategyWithdrawn(vault, firelightStrategy, withdrawAmount);
            }
        }
        
        if (kineticStrategy != address(0) && remainingToWithdraw > 0) {
            if (kineticAvailable > 0) {
                uint256 withdrawAmount = remainingToWithdraw > kineticAvailable ? kineticAvailable : remainingToWithdraw;
                vaultContract.withdrawFromStrategy(kineticStrategy, withdrawAmount);
                remainingToWithdraw -= withdrawAmount;
                emit StrategyWithdrawn(vault, kineticStrategy, withdrawAmount);
            }
        }
        
        require(remainingToWithdraw == 0 || remainingToWithdraw < amount, "Insufficient liquidity in strategies");
    }
    
    function rebalanceVault(address vault) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(registeredVaults[vault], "Vault not registered");
        
        (
            uint256 bufferBefore,
            uint256 kineticBefore,
            uint256 firelightBefore,
            uint256 totalAssets
        ) = this.getCurrentAllocation(vault);
        
        if (totalAssets == 0) return;
        
        uint256 bufferTarget = (totalAssets * BUFFER_TARGET_BPS) / 10000;
        
        address kineticStrategy = _getStrategyByName("Kinetic");
        address firelightStrategy = _getStrategyByName("Firelight");
        
        if (bufferBefore > bufferTarget) {
            _rebalanceExcessBuffer(vault, bufferBefore - bufferTarget, kineticStrategy, firelightStrategy);
        } else if (bufferBefore < bufferTarget) {
            _rebalanceDeficitBuffer(vault, bufferTarget - bufferBefore, kineticBefore, firelightBefore, kineticStrategy, firelightStrategy, totalAssets);
        }
        
        (
            uint256 bufferAfter,
            uint256 kineticAfter,
            uint256 firelightAfter,
        ) = this.getCurrentAllocation(vault);
        
        emit VaultRebalanced(
            vault,
            bufferBefore,
            bufferAfter,
            kineticBefore,
            kineticAfter,
            firelightBefore,
            firelightAfter
        );
    }
    
    function _rebalanceExcessBuffer(
        address vault,
        uint256 excess,
        address kinetic,
        address firelight
    ) internal {
        (uint256 bufferCurrent, uint256 kineticCurrent, uint256 firelightCurrent, uint256 totalAssets) 
            = this.getCurrentAllocation(vault);
        
        (uint256 bufferTarget, , ) = this.getTargetAllocation(vault, totalAssets);
        
        uint256 deployableAmount;
        if (bufferCurrent > bufferTarget) {
            deployableAmount = bufferCurrent - bufferTarget;
        } else {
            return;
        }
        
        if (excess < deployableAmount) {
            deployableAmount = excess;
        }
        
        require(bufferCurrent >= deployableAmount, "Insufficient vault liquidity for rebalancing");
        
        // Try to calculate deficit-driven deployment amounts
        // If both strategies are at target, just return (no deployment needed)
        uint256 kineticDeploy = 0;
        uint256 firelightDeploy = 0;
        
        try this._calculateDeploymentAmountsExternal(
            vault,
            deployableAmount,
            kineticCurrent,
            firelightCurrent,
            totalAssets
        ) returns (uint256 k, uint256 f) {
            kineticDeploy = k;
            firelightDeploy = f;
        } catch {
            // Both strategies at or above target - nothing to deploy
            return;
        }
        
        if (kinetic != address(0) && kineticDeploy > 0) {
            ShXRPVault(vault).deployToStrategy(kinetic, kineticDeploy);
            emit StrategyDeployed(vault, kinetic, kineticDeploy);
        }
        
        if (firelight != address(0) && firelightDeploy > 0) {
            ShXRPVault(vault).deployToStrategy(firelight, firelightDeploy);
            emit StrategyDeployed(vault, firelight, firelightDeploy);
        }
    }
    
    function _rebalanceDeficitBuffer(
        address vault,
        uint256 deficit,
        uint256 kineticBefore,
        uint256 firelightBefore,
        address kineticStrategy,
        address firelightStrategy,
        uint256 totalAssets
    ) internal {
        ShXRPVault vaultContract = ShXRPVault(vault);
        (, uint256 kineticTarget, uint256 firelightTarget) = this.getTargetAllocation(vault, totalAssets);
        
        if (firelightStrategy != address(0) && firelightBefore > firelightTarget) {
            uint256 withdrawAmount = firelightBefore - firelightTarget;
            if (withdrawAmount > deficit) withdrawAmount = deficit;
            
            vaultContract.withdrawFromStrategy(firelightStrategy, withdrawAmount);
            deficit -= withdrawAmount;
            emit StrategyWithdrawn(vault, firelightStrategy, withdrawAmount);
        }
        
        if (kineticStrategy != address(0) && deficit > 0 && kineticBefore > kineticTarget) {
            uint256 withdrawAmount = kineticBefore - kineticTarget;
            if (withdrawAmount > deficit) withdrawAmount = deficit;
            
            vaultContract.withdrawFromStrategy(kineticStrategy, withdrawAmount);
            emit StrategyWithdrawn(vault, kineticStrategy, withdrawAmount);
        }
    }
    
    function _getStrategyByName(string memory name) internal view returns (address) {
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (registeredStrategies[strategyList[i]] && 
                keccak256(bytes(strategyNames[strategyList[i]])) == keccak256(bytes(name))) {
                return strategyList[i];
            }
        }
        return address(0);
    }
    
    // ========================================
    // VIEW FUNCTIONS
    // ========================================
    
    function getBridgeRequest(bytes32 requestId) external view returns (BridgeRequest memory) {
        return bridgeRequests[requestId];
    }
    
    function getVaultCount() external view returns (uint256) {
        return vaultList.length;
    }
    
    function getStrategyCount() external view returns (uint256) {
        return strategyList.length;
    }
}
