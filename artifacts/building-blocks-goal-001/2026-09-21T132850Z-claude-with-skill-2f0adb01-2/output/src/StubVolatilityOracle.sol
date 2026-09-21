// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: a trusted updater pushes one volatility value.
/// @dev Replace with a real source later via DynamicFeeHook.setOracle — no pool migration needed.
contract StubVolatilityOracle is IVolatilityOracle {
    address public immutable updater;
    uint256 public volatility;
    uint256 public updatedAt;

    event VolatilityUpdated(uint256 volatility);

    error NotUpdater();

    constructor(address _updater, uint256 initialVolatility) {
        updater = _updater;
        volatility = initialVolatility;
        updatedAt = block.timestamp;
    }

    function setVolatility(uint256 _volatility) external {
        if (msg.sender != updater) revert NotUpdater();
        volatility = _volatility;
        updatedAt = block.timestamp;
        emit VolatilityUpdated(_volatility);
    }

    function getVolatility(PoolId) external view returns (uint256, uint256) {
        return (volatility, updatedAt);
    }
}
