// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @notice Volatility signal consumed by DynamicFeeHook. Implementation is pluggable.
/// @dev Must be cheap and must NOT be derivable from this pool's own spot price within
///      the same block (flash-manipulable). Prefer TWAP/offchain-fed/realized-vol sources.
interface IVolatilityOracle {
    /// @param poolId pool being swapped in
    /// @return volatility unitless score; hook maps it to a fee via its configured band
    ///         (suggested unit: annualized vol in bps, e.g. 8000 = 80%)
    /// @return updatedAt timestamp of the reading, used for staleness checks
    function getVolatility(PoolId poolId) external view returns (uint256 volatility, uint256 updatedAt);
}
