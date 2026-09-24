// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Pluggable volatility source for the dynamic fee hook.
/// @dev Return volatility in basis points. For example, 250 means 2.5%.
interface IVolatilityOracle {
    function volatilityBps(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint256);
}
