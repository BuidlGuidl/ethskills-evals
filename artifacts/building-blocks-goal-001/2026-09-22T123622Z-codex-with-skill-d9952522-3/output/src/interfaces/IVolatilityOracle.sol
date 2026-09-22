// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey, SwapParams} from "../V4Types.sol";

interface IVolatilityOracle {
    /// @notice Returns a volatility signal scaled by 1e18.
    /// @dev The hook does not prescribe how this is produced. A later implementation
    /// can use realized pool movement, an external oracle, EWMA, or any other signal.
    function currentVolatility(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external view returns (uint256 volatilityE18);
}

