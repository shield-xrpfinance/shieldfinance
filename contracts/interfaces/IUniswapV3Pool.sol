// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUniswapV3Pool
 * @dev Interface for Uniswap V3 Pool
 * Used for SparkDEX V3 pools on Flare mainnet
 */
interface IUniswapV3Pool {
    /**
     * @dev Returns the pool's factory address
     */
    function factory() external view returns (address);

    /**
     * @dev Returns the first of the two tokens of the pool
     */
    function token0() external view returns (address);

    /**
     * @dev Returns the second of the two tokens of the pool
     */
    function token1() external view returns (address);

    /**
     * @dev Returns the pool's fee
     */
    function fee() external view returns (uint24);

    /**
     * @dev Returns the current sqrt price
     */
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    /**
     * @dev Returns the liquidity in the pool
     */
    function liquidity() external view returns (uint128);
}
