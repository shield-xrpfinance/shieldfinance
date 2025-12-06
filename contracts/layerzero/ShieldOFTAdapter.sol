// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/ILayerZeroEndpointV2.sol";
import "./interfaces/IOFT.sol";
import "./libs/OFTMsgCodec.sol";

/**
 * @title ShieldOFTAdapter
 * @author Shield Finance
 * @notice LayerZero V2 OFT Adapter for SHIELD token on Flare (home chain)
 * @dev Locks SHIELD tokens on Flare when bridging out, unlocks when bridging back
 * 
 * Security Features:
 * - Rate limiting per address and global limits
 * - Pausability for emergency stops
 * - Multi-sig ownership recommended for mainnet
 * - Circuit breaker for large transfers
 * 
 * Architecture:
 * - This adapter wraps the existing SHIELD ERC20 token
 * - Users deposit SHIELD, which gets locked in this contract
 * - LayerZero message triggers mint on destination chain
 * - On return, destination chain burns, this adapter unlocks
 */
contract ShieldOFTAdapter is Ownable, Pausable, ReentrancyGuard, IOFT {
    using SafeERC20 for IERC20;
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for address;

    IERC20 public immutable innerToken;
    ILayerZeroEndpointV2 public immutable endpoint;
    
    uint8 public constant SHARED_DECIMALS = 6;
    uint8 public immutable tokenDecimals;
    uint256 public immutable decimalConversionRate;

    mapping(uint32 => bytes32) public peers;
    mapping(address => uint256) public hourlyTransfers;
    mapping(address => uint256) public dailyTransfers;
    mapping(address => uint256) public lastHourReset;
    mapping(address => uint256) public lastDayReset;
    
    uint256 public globalDailyTransfers;
    uint256 public lastGlobalDayReset;
    
    uint256 public maxTransferPerHour = 1_000_000 * 10**18;
    uint256 public maxTransferPerDay = 5_000_000 * 10**18;
    uint256 public globalDailyLimit = 50_000_000 * 10**18;
    uint256 public circuitBreakerThreshold = 10_000_000 * 10**18;

    bool public circuitBreakerTripped;

    event PeerSet(uint32 indexed eid, bytes32 peer);
    event RateLimitsUpdated(uint256 hourly, uint256 daily, uint256 global, uint256 threshold);
    event CircuitBreakerTripped(address indexed sender, uint256 amount);
    event CircuitBreakerReset();

    error InvalidPeer();
    error RateLimitExceeded(string limitType, uint256 amount, uint256 limit);
    error CircuitBreakerActive();
    error InsufficientFee();
    error InvalidAmount();

    constructor(
        address _token,
        address _endpoint,
        address _owner
    ) Ownable(_owner) {
        innerToken = IERC20(_token);
        endpoint = ILayerZeroEndpointV2(_endpoint);
        
        tokenDecimals = 18;
        decimalConversionRate = 10 ** (tokenDecimals - SHARED_DECIMALS);
        
        lastGlobalDayReset = block.timestamp;
    }

    function oftVersion() external pure returns (bytes4 interfaceId, uint64 version) {
        return (type(IOFT).interfaceId, 1);
    }

    function token() external view returns (address) {
        return address(innerToken);
    }

    function approvalRequired() external pure returns (bool) {
        return true;
    }

    function sharedDecimals() external pure returns (uint8) {
        return SHARED_DECIMALS;
    }

    function setPeer(uint32 _eid, bytes32 _peer) external onlyOwner {
        peers[_eid] = _peer;
        emit PeerSet(_eid, _peer);
    }

    function setRateLimits(
        uint256 _hourly,
        uint256 _daily,
        uint256 _global,
        uint256 _threshold
    ) external onlyOwner {
        maxTransferPerHour = _hourly;
        maxTransferPerDay = _daily;
        globalDailyLimit = _global;
        circuitBreakerThreshold = _threshold;
        emit RateLimitsUpdated(_hourly, _daily, _global, _threshold);
    }

    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerTripped = false;
        emit CircuitBreakerReset();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _resetRateLimitsIfNeeded(address _user) internal {
        if (block.timestamp > lastHourReset[_user] + 1 hours) {
            hourlyTransfers[_user] = 0;
            lastHourReset[_user] = block.timestamp;
        }
        if (block.timestamp > lastDayReset[_user] + 1 days) {
            dailyTransfers[_user] = 0;
            lastDayReset[_user] = block.timestamp;
        }
        if (block.timestamp > lastGlobalDayReset + 1 days) {
            globalDailyTransfers = 0;
            lastGlobalDayReset = block.timestamp;
        }
    }

    function _checkRateLimits(address _user, uint256 _amount) internal {
        _resetRateLimitsIfNeeded(_user);
        
        if (_amount >= circuitBreakerThreshold) {
            circuitBreakerTripped = true;
            emit CircuitBreakerTripped(_user, _amount);
            revert CircuitBreakerActive();
        }
        
        if (hourlyTransfers[_user] + _amount > maxTransferPerHour) {
            revert RateLimitExceeded("hourly", _amount, maxTransferPerHour);
        }
        if (dailyTransfers[_user] + _amount > maxTransferPerDay) {
            revert RateLimitExceeded("daily", _amount, maxTransferPerDay);
        }
        if (globalDailyTransfers + _amount > globalDailyLimit) {
            revert RateLimitExceeded("global", _amount, globalDailyLimit);
        }
        
        hourlyTransfers[_user] += _amount;
        dailyTransfers[_user] += _amount;
        globalDailyTransfers += _amount;
    }

    function _toLD(uint64 _amountSD) internal view returns (uint256) {
        return uint256(_amountSD) * decimalConversionRate;
    }

    function _toSD(uint256 _amountLD) internal view returns (uint64) {
        return uint64(_amountLD / decimalConversionRate);
    }

    function _removeDust(uint256 _amountLD) internal view returns (uint256) {
        return (_amountLD / decimalConversionRate) * decimalConversionRate;
    }

    function quoteOFT(SendParam calldata _sendParam) 
        external view returns (OFTLimit memory limit, OFTFeeDetail[] memory fees, OFTReceipt memory receipt) 
    {
        uint256 minAmount = decimalConversionRate;
        uint256 maxAmount = type(uint64).max * decimalConversionRate;
        limit = OFTLimit(minAmount, maxAmount);
        
        fees = new OFTFeeDetail[](0);
        
        uint256 amountSent = _removeDust(_sendParam.amountLD);
        receipt = OFTReceipt(amountSent, amountSent);
    }

    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) 
        external view returns (MessagingFee memory) 
    {
        bytes32 peer = peers[_sendParam.dstEid];
        if (peer == bytes32(0)) revert InvalidPeer();

        bytes memory message = OFTMsgCodec.encode(
            _sendParam.to,
            _toSD(_sendParam.amountLD),
            _sendParam.composeMsg
        );

        MessagingParams memory params = MessagingParams({
            dstEid: _sendParam.dstEid,
            receiver: peer,
            message: message,
            options: _sendParam.extraOptions,
            payInLzToken: _payInLzToken
        });

        return endpoint.quote(params, address(this));
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable nonReentrant whenNotPaused returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        if (circuitBreakerTripped) revert CircuitBreakerActive();
        
        bytes32 peer = peers[_sendParam.dstEid];
        if (peer == bytes32(0)) revert InvalidPeer();

        uint256 amountLD = _removeDust(_sendParam.amountLD);
        if (amountLD == 0) revert InvalidAmount();

        _checkRateLimits(msg.sender, amountLD);

        innerToken.safeTransferFrom(msg.sender, address(this), amountLD);

        bytes memory message = OFTMsgCodec.encode(
            _sendParam.to,
            _toSD(amountLD),
            _sendParam.composeMsg
        );

        MessagingParams memory params = MessagingParams({
            dstEid: _sendParam.dstEid,
            receiver: peer,
            message: message,
            options: _sendParam.extraOptions,
            payInLzToken: _fee.lzTokenFee > 0
        });

        if (msg.value < _fee.nativeFee) revert InsufficientFee();

        msgReceipt = endpoint.send{value: _fee.nativeFee}(params, _refundAddress);
        
        oftReceipt = OFTReceipt(amountLD, amountLD);

        emit OFTSent(msgReceipt.guid, _sendParam.dstEid, msg.sender, amountLD, amountLD);
    }

    function lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) external payable nonReentrant whenNotPaused {
        require(msg.sender == address(endpoint), "Only endpoint");
        
        bytes32 peer = peers[_origin.srcEid];
        require(_origin.sender == peer, "Invalid peer");

        address toAddress = OFTMsgCodec.bytes32ToAddress(_message.sendTo());
        uint256 amountLD = _toLD(_message.amountSD());

        innerToken.safeTransfer(toAddress, amountLD);

        emit OFTReceived(_guid, _origin.srcEid, toAddress, amountLD);
    }

    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            (bool success,) = _to.call{value: _amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(_token).safeTransfer(_to, _amount);
        }
    }

    receive() external payable {}
}
