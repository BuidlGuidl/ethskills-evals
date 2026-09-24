// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";

/// @notice Volatility signal consumed by DynamicFeeHook.
/// @dev Plug any source in here (Chainlink/realized-vol feed, TWAP-based calc, keeper-pushed value...).
///      Must be cheap and must not be manipulable within a single tx — it gates every swap's fee.
interface IVolatilityOracle {
    /// @return volBps current volatility in basis points (units only need to match the hook's thresholds)
    function volatility(PoolKey calldata key) external view returns (uint256 volBps);
}
