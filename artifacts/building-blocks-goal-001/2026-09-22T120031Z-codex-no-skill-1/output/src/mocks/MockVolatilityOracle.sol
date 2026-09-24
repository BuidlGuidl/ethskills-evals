// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice Test and staging oracle stub. Replace with a production signal.
contract MockVolatilityOracle is IVolatilityOracle {
    uint256 public volatility;

    function setVolatilityBps(uint256 newVolatility) external {
        volatility = newVolatility;
    }

    function volatilityBps(PoolId, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        view
        returns (uint256)
    {
        return volatility;
    }
}
