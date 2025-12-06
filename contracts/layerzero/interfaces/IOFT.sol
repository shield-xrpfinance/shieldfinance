// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { MessagingFee, MessagingReceipt } from "./ILayerZeroEndpointV2.sol";

/**
 * @title IOFT
 * @dev LayerZero V2 OFT (Omnichain Fungible Token) Interface
 * Standard interface for cross-chain token transfers
 */

struct SendParam {
    uint32 dstEid;
    bytes32 to;
    uint256 amountLD;
    uint256 minAmountLD;
    bytes extraOptions;
    bytes composeMsg;
    bytes oftCmd;
}

struct OFTLimit {
    uint256 minAmountLD;
    uint256 maxAmountLD;
}

struct OFTFeeDetail {
    int256 feeAmountLD;
    string description;
}

struct OFTReceipt {
    uint256 amountSentLD;
    uint256 amountReceivedLD;
}

interface IOFT {
    event OFTSent(
        bytes32 indexed guid,
        uint32 dstEid,
        address indexed fromAddress,
        uint256 amountSentLD,
        uint256 amountReceivedLD
    );

    event OFTReceived(
        bytes32 indexed guid,
        uint32 srcEid,
        address indexed toAddress,
        uint256 amountReceivedLD
    );

    function oftVersion() external view returns (bytes4 interfaceId, uint64 version);

    function token() external view returns (address);

    function approvalRequired() external view returns (bool);

    function sharedDecimals() external view returns (uint8);

    function quoteOFT(SendParam calldata _sendParam) 
        external view returns (OFTLimit memory, OFTFeeDetail[] memory, OFTReceipt memory);

    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) 
        external view returns (MessagingFee memory);

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory, OFTReceipt memory);
}
