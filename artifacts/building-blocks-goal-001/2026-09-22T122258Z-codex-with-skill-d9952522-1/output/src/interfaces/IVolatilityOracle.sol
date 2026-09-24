// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @notice Pluggable source for the token pool volatility signal.
/// @dev Return value is expressed in basis points. For example, 250 means 2.50%.
interface IVolatilityOracle {
    function currentVolatilityBps(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        view
        returns (uint256 volatilityBps);
}
