// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IOAppCore
 * @dev LayerZero V2 OApp Core Interface
 * Minimal interface for OApp messaging
 */
interface IOAppCore {
    function endpoint() external view returns (address);
    function peers(uint32 _eid) external view returns (bytes32);
    function setPeer(uint32 _eid, bytes32 _peer) external;
}
