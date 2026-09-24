// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @notice Source of the volatility signal the hook turns into a swap fee.
/// @dev Called by the hook on every swap via a gas-capped staticcall. Must be a cheap
/// `view`, must never revert in normal operation, and must NOT be manipulable within
/// the same transaction/block (e.g. do not read this pool's own spot price).
interface IVolatilityOracle {
    /// @return vol Volatility score for the pool, in the same units as the hook's
    /// `lowVol` / `highVol` thresholds (suggested: annualized vol in bps, 10_000 = 100%).
    function volatility(PoolKey calldata key) external view returns (uint256 vol);
}
