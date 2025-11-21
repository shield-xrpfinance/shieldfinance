// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title INonfungiblePositionManager
 * @dev Interface for Uniswap V3 NonfungiblePositionManager
 * Used for SparkDEX V3 liquidity positions on Flare mainnet
 */
interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }

    /**
     * @dev Creates and initializes a pool if it doesn't exist
     * @param token0 The first token of the pool
     * @param token1 The second token of the pool
     * @param fee The fee amount
     * @param sqrtPriceX96 The initial sqrt price
     * @return pool The address of the pool
     */
    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable returns (address pool);

    /**
     * @dev Mints a new position NFT
     * @param params The mint parameters
     * @return tokenId The ID of the token that represents the position
     * @return liquidity The liquidity of the position
     * @return amount0 The amount of token0
     * @return amount1 The amount of token1
     */
    function mint(MintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /**
     * @dev Increases liquidity in the position
     */
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /**
     * @dev Decreases liquidity in the position
     */
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /**
     * @dev Collects tokens owed to a position
     */
    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /**
     * @dev Burns a token ID, which deletes it from the NFT contract
     */
    function burn(uint256 tokenId) external payable;

    /**
     * @dev Returns the position information
     */
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );

    /**
     * @dev Returns the address that owns the token
     */
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /**
     * @dev Transfers a token
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    /**
     * @dev Approves another address to transfer a token
     */
    function approve(address to, uint256 tokenId) external;
}
