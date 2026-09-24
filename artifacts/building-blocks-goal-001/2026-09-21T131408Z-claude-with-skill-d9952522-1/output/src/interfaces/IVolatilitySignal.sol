// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Source of the volatility reading the fee hook uses.
/// @dev Units are up to the implementation; the hook only compares the value to
///      its configured `lowVolatility` / `highVolatility` thresholds (same units).
///      Must be cheap (hook caps the call's gas) and must not be manipulable within
///      a single tx/block by someone swapping in the pool.
interface IVolatilitySignal {
    function volatility() external view returns (uint256);
}
