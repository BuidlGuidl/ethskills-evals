// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolId} from "v4-core/types/PoolId.sol";
import {IVolatilitySignal} from "./interfaces/IVolatilitySignal.sol";

/// @notice Placeholder signal: a value pushed by an owner/keeper. Replace with a real source.
contract StubVolatilitySignal is IVolatilitySignal {
    address public immutable updater;
    uint256 public volBps;

    event VolatilityUpdated(uint256 volBps);

    error NotUpdater();

    constructor(address _updater, uint256 initialVolBps) {
        updater = _updater;
        volBps = initialVolBps;
    }

    function set(uint256 _volBps) external {
        if (msg.sender != updater) revert NotUpdater();
        volBps = _volBps;
        emit VolatilityUpdated(_volBps);
    }

    function volatility(PoolId) external view returns (uint256) {
        return volBps;
    }
}
