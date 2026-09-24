// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Pluggable volatility signal for the dynamic-fee hook.
/// @dev Implementations should return volatility in basis points, where 10_000 = 100%.
interface IVolatilityOracle {
    function volatilityBps(
        PoolKey calldata key,
        address swapper,
        SwapParams calldata params,
        bytes calldata hookData
    ) external view returns (uint256);
}

