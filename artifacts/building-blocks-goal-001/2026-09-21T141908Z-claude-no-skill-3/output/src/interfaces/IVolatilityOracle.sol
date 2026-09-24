// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @notice Volatility signal consumed by DynamicFeeHook on every swap.
/// @dev Must be cheap (called with a gas cap) and must not be manipulable within a single tx/block.
interface IVolatilityOracle {
    /// @return volBps Current volatility score in basis points (e.g. 250 = 2.5%). Units only need to
    ///         match the hook's `volLow` / `volHigh` config.
    function volatility(PoolId poolId) external view returns (uint256 volBps);
}
