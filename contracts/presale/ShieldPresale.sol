// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title ShieldPresale
 * @author Shield Finance
 * @notice Community Allocation contract for SHIELD token presale
 * @dev Supports staged pricing, vesting, allowlist, referral bonuses, and KYC tiers
 * 
 * Presale Structure:
 * - 4 stages with increasing prices ($0.005 -> $0.0075 -> $0.01 -> $0.015)
 * - 20% unlocked at TGE (Token Generation Event)
 * - 80% vests linearly over 180 days
 * - $50K hard cap, $50 min / $5K max per wallet
 * - 5% referral bonus for valid codes
 * 
 * Security Features:
 * - Merkle tree allowlist verification
 * - KYC tier limits for compliance
 * - Pausable and owner-controlled
 * - Separate claim phase from purchase
 */
contract ShieldPresale is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Stage {
        uint256 price;          // Price in USD (6 decimals, e.g., 5000 = $0.005)
        uint256 allocation;     // SHIELD tokens allocated to this stage
        uint256 sold;           // SHIELD tokens sold in this stage
        uint256 startTime;      // Stage start timestamp
        uint256 endTime;        // Stage end timestamp
    }

    struct Purchase {
        uint256 totalTokens;    // Total SHIELD purchased
        uint256 claimed;        // Amount already claimed
        uint256 purchaseTime;   // When the purchase was made
        address referrer;       // Referrer address (if any)
        bool kycVerified;       // Whether user completed KYC
    }

    struct ReferralInfo {
        bytes32 code;           // Unique referral code
        uint256 referrals;      // Number of successful referrals
        uint256 bonusEarned;    // Total bonus SHIELD earned
    }

    IERC20 public immutable paymentToken;    // USDC/USDT for payment
    IERC20 public shieldToken;               // SHIELD token (set after TGE)
    
    Stage[] public stages;
    mapping(address => Purchase) public purchases;
    mapping(address => ReferralInfo) public referrals;
    mapping(bytes32 => address) public referralCodeOwner;
    
    bytes32 public allowlistRoot;
    bytes32 public kycRoot;

    uint256 public constant USD_DECIMALS = 6;
    uint256 public constant SHIELD_DECIMALS = 18;
    uint256 public constant TGE_PERCENT = 20;
    uint256 public constant VESTING_DURATION = 180 days;
    uint256 public constant REFERRAL_BONUS_PERCENT = 5;

    uint256 public hardCap;                  // Total USD to raise
    uint256 public minPurchase;              // Minimum purchase in USD
    uint256 public maxPurchase;              // Maximum purchase per wallet in USD
    uint256 public totalRaised;              // Total USD raised so far
    uint256 public totalSold;                // Total SHIELD sold
    uint256 public tgeTimestamp;             // When TGE happens
    
    bool public allowlistEnabled = true;
    bool public claimEnabled = false;
    uint256 public currentStage = 0;

    uint256 public kycTier1Limit = 1000 * 10**USD_DECIMALS;   // $1K without KYC
    uint256 public kycTier2Limit = 5000 * 10**USD_DECIMALS;   // $5K with KYC

    event TokensPurchased(
        address indexed buyer,
        uint256 usdAmount,
        uint256 shieldAmount,
        uint256 stage,
        address referrer
    );
    event TokensClaimed(address indexed claimer, uint256 amount);
    event ReferralCodeCreated(address indexed owner, bytes32 code);
    event ReferralBonusPaid(address indexed referrer, address indexed buyer, uint256 bonus);
    event StageAdvanced(uint256 newStage);
    event TGESet(uint256 timestamp);
    event ClaimEnabled();
    event ShieldTokenSet(address token);

    error AllowlistRequired();
    error KYCRequired();
    error InvalidAmount();
    error ExceedsMaxPurchase();
    error ExceedsStageCap();
    error ExceedsHardCap();
    error PresaleNotActive();
    error ClaimNotEnabled();
    error NothingToClaim();
    error InvalidReferralCode();
    error SelfReferral();
    error StageNotActive();

    constructor(
        address _paymentToken,
        uint256 _hardCap,
        uint256 _minPurchase,
        uint256 _maxPurchase,
        address _owner
    ) Ownable(_owner) {
        paymentToken = IERC20(_paymentToken);
        hardCap = _hardCap;
        minPurchase = _minPurchase;
        maxPurchase = _maxPurchase;
    }

    function addStage(
        uint256 _price,
        uint256 _allocation,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyOwner {
        stages.push(Stage({
            price: _price,
            allocation: _allocation,
            sold: 0,
            startTime: _startTime,
            endTime: _endTime
        }));
    }

    function setAllowlistRoot(bytes32 _root) external onlyOwner {
        allowlistRoot = _root;
    }

    function setKYCRoot(bytes32 _root) external onlyOwner {
        kycRoot = _root;
    }

    function setAllowlistEnabled(bool _enabled) external onlyOwner {
        allowlistEnabled = _enabled;
    }

    function setShieldToken(address _token) external onlyOwner {
        shieldToken = IERC20(_token);
        emit ShieldTokenSet(_token);
    }

    function setTGE(uint256 _timestamp) external onlyOwner {
        tgeTimestamp = _timestamp;
        emit TGESet(_timestamp);
    }

    function enableClaim() external onlyOwner {
        require(address(shieldToken) != address(0), "Shield token not set");
        require(tgeTimestamp > 0 && block.timestamp >= tgeTimestamp, "TGE not reached");
        claimEnabled = true;
        emit ClaimEnabled();
    }

    function advanceStage() external onlyOwner {
        require(currentStage < stages.length - 1, "Already at final stage");
        currentStage++;
        emit StageAdvanced(currentStage);
    }

    function setKYCLimits(uint256 _tier1, uint256 _tier2) external onlyOwner {
        kycTier1Limit = _tier1;
        kycTier2Limit = _tier2;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createReferralCode(bytes32 _code) external {
        require(purchases[msg.sender].totalTokens > 0 || msg.sender == owner(), "Must be a buyer or owner");
        require(referralCodeOwner[_code] == address(0), "Code already exists");
        
        referrals[msg.sender].code = _code;
        referralCodeOwner[_code] = msg.sender;
        
        emit ReferralCodeCreated(msg.sender, _code);
    }

    function _verifyAllowlist(bytes32[] calldata _proof) internal view returns (bool) {
        if (!allowlistEnabled) return true;
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        return MerkleProof.verify(_proof, allowlistRoot, leaf);
    }

    function _verifyKYC(bytes32[] calldata _proof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        return MerkleProof.verify(_proof, kycRoot, leaf);
    }

    function _calculateShieldAmount(uint256 _usdAmount, uint256 _stageIndex) internal view returns (uint256) {
        Stage storage stage = stages[_stageIndex];
        return (_usdAmount * 10**SHIELD_DECIMALS) / stage.price;
    }

    function buy(
        uint256 _usdAmount,
        bytes32 _referralCode,
        bytes32[] calldata _allowlistProof,
        bytes32[] calldata _kycProof
    ) external nonReentrant whenNotPaused {
        if (currentStage >= stages.length) revert PresaleNotActive();
        
        Stage storage stage = stages[currentStage];
        if (block.timestamp < stage.startTime || block.timestamp > stage.endTime) {
            revert StageNotActive();
        }

        if (!_verifyAllowlist(_allowlistProof)) revert AllowlistRequired();

        if (_usdAmount < minPurchase) revert InvalidAmount();

        Purchase storage purchase = purchases[msg.sender];
        uint256 totalPurchased = purchase.totalTokens > 0 
            ? (purchase.totalTokens * stage.price) / 10**SHIELD_DECIMALS + _usdAmount
            : _usdAmount;

        bool hasKYC = _verifyKYC(_kycProof);
        if (hasKYC) {
            purchase.kycVerified = true;
        }

        if (!hasKYC && totalPurchased > kycTier1Limit) {
            revert KYCRequired();
        }
        if (totalPurchased > kycTier2Limit) {
            revert ExceedsMaxPurchase();
        }

        uint256 shieldAmount = _calculateShieldAmount(_usdAmount, currentStage);
        
        if (stage.sold + shieldAmount > stage.allocation) {
            revert ExceedsStageCap();
        }
        if (totalRaised + _usdAmount > hardCap) {
            revert ExceedsHardCap();
        }

        uint256 referralBonus = 0;
        address referrer = address(0);
        
        if (_referralCode != bytes32(0)) {
            referrer = referralCodeOwner[_referralCode];
            if (referrer == address(0)) revert InvalidReferralCode();
            if (referrer == msg.sender) revert SelfReferral();
            
            referralBonus = (shieldAmount * REFERRAL_BONUS_PERCENT) / 100;
            referrals[referrer].referrals++;
            referrals[referrer].bonusEarned += referralBonus;
        }

        paymentToken.safeTransferFrom(msg.sender, address(this), _usdAmount);

        stage.sold += shieldAmount;
        totalSold += shieldAmount + referralBonus;
        totalRaised += _usdAmount;
        
        purchase.totalTokens += shieldAmount;
        purchase.purchaseTime = block.timestamp;
        if (referrer != address(0) && purchase.referrer == address(0)) {
            purchase.referrer = referrer;
        }

        emit TokensPurchased(msg.sender, _usdAmount, shieldAmount, currentStage, referrer);
        
        if (referralBonus > 0) {
            emit ReferralBonusPaid(referrer, msg.sender, referralBonus);
        }
    }

    function getClaimableAmount(address _user) public view returns (uint256) {
        if (!claimEnabled || tgeTimestamp == 0) return 0;
        
        Purchase storage purchase = purchases[_user];
        if (purchase.totalTokens == 0) return 0;

        uint256 tgeAmount = (purchase.totalTokens * TGE_PERCENT) / 100;
        uint256 vestingAmount = purchase.totalTokens - tgeAmount;

        uint256 elapsed = block.timestamp - tgeTimestamp;
        uint256 vestedAmount;
        
        if (elapsed >= VESTING_DURATION) {
            vestedAmount = vestingAmount;
        } else {
            vestedAmount = (vestingAmount * elapsed) / VESTING_DURATION;
        }

        uint256 totalClaimable = tgeAmount + vestedAmount;
        
        if (totalClaimable <= purchase.claimed) return 0;
        
        return totalClaimable - purchase.claimed;
    }

    function claim() external nonReentrant {
        if (!claimEnabled) revert ClaimNotEnabled();
        
        uint256 claimable = getClaimableAmount(msg.sender);
        if (claimable == 0) revert NothingToClaim();

        purchases[msg.sender].claimed += claimable;
        shieldToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    function claimReferralBonus() external nonReentrant {
        if (!claimEnabled) revert ClaimNotEnabled();
        
        ReferralInfo storage info = referrals[msg.sender];
        uint256 bonus = info.bonusEarned;
        if (bonus == 0) revert NothingToClaim();

        info.bonusEarned = 0;
        shieldToken.safeTransfer(msg.sender, bonus);

        emit TokensClaimed(msg.sender, bonus);
    }

    function getCurrentStageInfo() external view returns (
        uint256 stageIndex,
        uint256 price,
        uint256 allocation,
        uint256 sold,
        uint256 remaining,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    ) {
        if (currentStage >= stages.length) {
            return (0, 0, 0, 0, 0, 0, 0, false);
        }
        
        Stage storage stage = stages[currentStage];
        bool active = block.timestamp >= stage.startTime && block.timestamp <= stage.endTime;
        
        return (
            currentStage,
            stage.price,
            stage.allocation,
            stage.sold,
            stage.allocation - stage.sold,
            stage.startTime,
            stage.endTime,
            active
        );
    }

    function getUserInfo(address _user) external view returns (
        uint256 totalTokens,
        uint256 claimed,
        uint256 claimable,
        uint256 purchaseTime,
        bool kycVerified,
        address referrer
    ) {
        Purchase storage purchase = purchases[_user];
        return (
            purchase.totalTokens,
            purchase.claimed,
            getClaimableAmount(_user),
            purchase.purchaseTime,
            purchase.kycVerified,
            purchase.referrer
        );
    }

    function withdrawFunds(address _to) external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransfer(_to, balance);
    }

    function withdrawUnsoldTokens(address _to) external onlyOwner {
        require(claimEnabled, "Claim not enabled yet");
        uint256 balance = shieldToken.balanceOf(address(this));
        uint256 totalOwed = totalSold;
        
        for (uint i = 0; i < stages.length; i++) {
            totalOwed -= stages[i].sold;
        }
        
        if (balance > totalOwed) {
            shieldToken.safeTransfer(_to, balance - totalOwed);
        }
    }

    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(_to, _amount);
    }
}
