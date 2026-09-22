// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Pluggable volatility signal used by VolatilityDynamicFeeHook.
interface IVolatilityOracle {
    /// @dev Returns a normalized volatility score using 1e18 precision.
    ///      The hook maps this score to calm/normal/volatile fee bands.
    function currentVolatility(PoolId poolId, PoolKey calldata key, bytes calldata hookData)
        external
        view
        returns (uint256 volatilityE18);
}
