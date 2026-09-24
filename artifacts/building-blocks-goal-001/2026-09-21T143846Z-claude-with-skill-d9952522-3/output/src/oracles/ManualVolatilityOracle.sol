// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: a single value set by an updater. Swap for a real
///         implementation (TWAP-deviation, realized-vol keeper, Chainlink feed, ...) via
///         DynamicFeeHook.setOracle — no pool migration needed.
contract ManualVolatilityOracle is IVolatilityOracle {
    address public immutable updater;
    uint256 public volBps;

    event VolatilityUpdated(uint256 volBps);

    error NotUpdater();

    constructor(address _updater, uint256 _volBps) {
        updater = _updater;
        volBps = _volBps;
    }

    function setVolatility(uint256 _volBps) external {
        if (msg.sender != updater) revert NotUpdater();
        volBps = _volBps;
        emit VolatilityUpdated(_volBps);
    }

    function getVolatility(PoolId) external view returns (uint256) {
        return volBps;
    }
}
