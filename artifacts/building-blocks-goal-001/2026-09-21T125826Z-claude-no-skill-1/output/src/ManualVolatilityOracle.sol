// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IVolatilityOracle} from "./interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: a trusted updater pushes a single volatility value.
/// Swap it for a real oracle later with `DynamicFeeHook.setOracle` — no pool migration.
contract ManualVolatilityOracle is IVolatilityOracle {
    address public updater;
    uint256 public currentVolatility;

    event VolatilityUpdated(uint256 vol);
    event UpdaterChanged(address updater);

    error NotUpdater();

    constructor(address _updater, uint256 initialVol) {
        updater = _updater;
        currentVolatility = initialVol;
    }

    function volatility(PoolKey calldata) external view returns (uint256) {
        return currentVolatility;
    }

    function setVolatility(uint256 vol) external {
        if (msg.sender != updater) revert NotUpdater();
        currentVolatility = vol;
        emit VolatilityUpdated(vol);
    }

    function setUpdater(address _updater) external {
        if (msg.sender != updater) revert NotUpdater();
        updater = _updater;
        emit UpdaterChanged(_updater);
    }
}
