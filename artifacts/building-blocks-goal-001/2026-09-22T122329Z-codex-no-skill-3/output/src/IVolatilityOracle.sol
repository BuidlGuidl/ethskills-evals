// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

interface IVolatilityOracle {
    /// @notice Returns the current volatility signal for a pool in basis points.
    /// @dev 10_000 means 100%. The hook treats the value as a tiering signal.
    function volatilityBips(PoolId poolId) external view returns (uint32);
}
