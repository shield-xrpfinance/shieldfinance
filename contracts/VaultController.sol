// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ShXRPVault.sol";

/**
 * @title VaultController
 * @dev Manages operator permissions, compounding, and coordination for ShXRP vaults
 */
contract VaultController is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant COMPOUNDER_ROLE = keccak256("COMPOUNDER_ROLE");
    
    // Registered vaults
    mapping(address => bool) public registeredVaults;
    address[] public vaultList;
    
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
    
    // View functions
    function getBridgeRequest(bytes32 requestId) external view returns (BridgeRequest memory) {
        return bridgeRequests[requestId];
    }
    
    function getVaultCount() external view returns (uint256) {
        return vaultList.length;
    }
}
