// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "v4-core/types/PoolKey.sol";

/// @notice Volatility signal consumed by VolatilityFeeHook on every swap.
/// @dev Units are up to the implementation, but must match the hook's `volLow`/`volHigh` thresholds
///      (suggested: annualized volatility in basis points, e.g. 8000 = 80%).
///      Called via STATICCALL with a gas cap; must be cheap, must not revert, must not be
///      manipulable within a single tx (don't derive it from this pool's own spot price).
interface IVolatilityOracle {
    function volatility(PoolKey calldata key) external view returns (uint256);
}
