// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Source of the volatility reading the hook turns into a fee.
/// @dev Plug in any implementation later (TWAP-based, Chainlink, offchain keeper push, ...).
///      Must be cheap and must not be manipulable inside the same tx as the swap.
interface IVolatilitySignal {
    /// @return volBps volatility reading in basis points (unit is up to the implementation,
    ///         the hook's lowVol/highVol thresholds must use the same unit)
    function volatility(PoolId poolId) external view returns (uint256 volBps);
}
