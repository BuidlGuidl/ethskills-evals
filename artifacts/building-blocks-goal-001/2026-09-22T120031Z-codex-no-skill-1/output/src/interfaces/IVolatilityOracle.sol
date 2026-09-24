// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Pluggable volatility signal for DynamicVolatilityFeeHook.
/// @dev Implementations should return a normalized volatility score in basis
/// points. The hook only compares this value to its configured threshold.
interface IVolatilityOracle {
    function volatilityBps(
        PoolId poolId,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external view returns (uint256);
}
