// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/// @notice Volatility signal consumed by DynamicFeeHook on every swap.
/// @dev Plug any source in here (TWAP deviation, realized vol, offchain keeper push, Chainlink feed...).
///      Must be cheap (called with a gas cap on every swap) and must not revert in normal operation.
interface IVolatilityOracle {
    /// @return score normalized volatility, 0 = calm ... 1e18 = max volatile. Values > 1e18 are clamped.
    function volatilityScore(PoolKey calldata key) external view returns (uint256 score);
}
