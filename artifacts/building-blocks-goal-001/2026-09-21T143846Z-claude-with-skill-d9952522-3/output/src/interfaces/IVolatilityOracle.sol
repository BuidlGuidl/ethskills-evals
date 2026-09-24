// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @notice Volatility signal consumed by DynamicFeeHook on every swap.
/// @dev Must be cheap (called inside every swap) and must not revert in normal operation.
///      Units: basis points of volatility (e.g. 5000 = 50% annualized). Scale is up to the
///      implementation as long as the hook's volLow/volHigh thresholds use the same scale.
interface IVolatilityOracle {
    function getVolatility(PoolId poolId) external view returns (uint256 volBps);
}
