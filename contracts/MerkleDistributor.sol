// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MerkleDistributor
 * @notice Distributes SHIELD tokens via Merkle tree for fair airdrop
 * 
 * Shield Finance $SHIELD Airdrop:
 * - 2,000,000 SHIELD tokens (20% of total supply)
 * - Claimable via Merkle proof (gas-efficient, secure)
 * - One-time claim per address
 * - Merkle root is IMMUTABLE (set at deployment, cannot be changed)
 * - For additional rounds, deploy a NEW MerkleDistributor contract
 * 
 * Security Design:
 * - Address-based claim tracking (simple, gas-efficient)
 * - Immutable root prevents double-claim exploits
 * - No updateMerkleRoot() function (intentionally removed for fair launch)
 * 
 * Based on OpenZeppelin's standard Merkle claim pattern
 * Used by Uniswap, ENS, and other major projects
 */
contract MerkleDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ========================================
    // STATE VARIABLES
    // ========================================

    /// @notice The SHIELD token being distributed
    IERC20 public immutable token;

    /// @notice Merkle root of the distribution tree
    bytes32 public merkleRoot;

    /// @notice Mapping of address => claimed status
    /// @dev Design Note: Uses address-based tracking for simplicity
    ///      - Merkle root is immutable (set at deployment)
    ///      - Each address can claim only once
    ///      - For multi-round airdrops, deploy NEW contract (don't update root)
    mapping(address => bool) public hasClaimed;

    /// @notice Total amount claimed so far
    uint256 public totalClaimed;

    // ========================================
    // EVENTS
    // ========================================

    /// @notice Emitted when tokens are claimed
    event Claimed(address indexed account, uint256 amount);

    /// @notice Emitted when owner withdraws unclaimed tokens
    event Withdrawn(address indexed owner, uint256 amount);

    // NOTE: MerkleRootUpdated event removed - root is immutable for fair launch

    // ========================================
    // CONSTRUCTOR
    // ========================================

    /**
     * @notice Initialize the airdrop contract
     * @param _token SHIELD token address
     * @param _merkleRoot Initial merkle root
     */
    constructor(
        IERC20 _token,
        bytes32 _merkleRoot
    ) Ownable(msg.sender) {
        require(address(_token) != address(0), "Invalid token address");
        require(_merkleRoot != bytes32(0), "Invalid merkle root");

        token = _token;
        merkleRoot = _merkleRoot;
    }

    // ========================================
    // CLAIM FUNCTIONS
    // ========================================

    /**
     * @notice Claim airdrop tokens
     * @param amount Amount of tokens to claim
     * @param merkleProof Merkle proof for eligibility
     * 
     * Requirements:
     * - Caller must be in the merkle tree
     * - Caller must not have claimed before
     * - Merkle proof must be valid
     * 
     * Example usage:
     * ```
     * // Generate proof off-chain using merkletreejs
     * const leaf = ethers.solidityPackedKeccak256(['address', 'uint256'], [userAddress, amount]);
     * const proof = merkleTree.getHexProof(leaf);
     * 
     * // Call claim with proof
     * await distributor.claim(amount, proof);
     * ```
     */
    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        require(!hasClaimed[msg.sender], "Already claimed");
        require(amount > 0, "Amount must be > 0");

        // Verify merkle proof using standard OpenZeppelin pattern
        // Leaf = keccak256(abi.encodePacked(address, amount))
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, leaf),
            "Invalid proof"
        );

        // Mark as claimed
        hasClaimed[msg.sender] = true;
        totalClaimed += amount;

        // Transfer tokens
        token.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice Check if an address has claimed their tokens
     * @param account Address to check
     * @return True if claimed, false otherwise
     */
    function isClaimed(address account) external view returns (bool) {
        return hasClaimed[account];
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================

    /**
     * NOTE: updateMerkleRoot() function REMOVED for fair launch security
     * 
     * SECURITY DESIGN DECISION:
     * - This contract uses address-based claim tracking for simplicity
     * - Merkle root is immutable to prevent double-claim exploits
     * - For multi-round airdrops, deploy a NEW MerkleDistributor contract
     * 
     * Alternative Design (if root updates are required):
     * - Use bitmap pattern: mapping(uint256 => uint256) claimedBitMap
     * - Assign each user an index in the merkle tree
     * - Prevents re-claims even after root updates
     * - Trade-off: More complex setup, higher gas costs
     */

    /**
     * @notice Withdraw unclaimed tokens after airdrop period ends
     * @param recipient Address to receive unclaimed tokens
     * @param amount Amount to withdraw
     * 
     * Only owner can call this function.
     * Recommended: Wait at least 3-6 months after airdrop launch
     * before withdrawing unclaimed tokens.
     */
    function withdraw(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        uint256 balance = token.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");

        token.safeTransfer(recipient, amount);

        emit Withdrawn(recipient, amount);
    }

    /**
     * @notice Get contract's current token balance
     * @return Current SHIELD token balance
     */
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Get total unclaimed tokens
     * @return Amount of tokens not yet claimed
     */
    function getUnclaimedBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
