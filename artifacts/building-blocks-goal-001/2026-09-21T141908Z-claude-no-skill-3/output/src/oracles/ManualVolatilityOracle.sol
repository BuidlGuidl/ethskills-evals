// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: a keeper/owner pushes the value. Swap for a real oracle later via
///         DynamicFeeHook.setOracle — no pool migration needed.
contract ManualVolatilityOracle is IVolatilityOracle {
    address public immutable updater;
    uint256 public vol;

    event VolatilityUpdated(uint256 vol);

    error NotUpdater();

    constructor(address _updater, uint256 initialVol) {
        updater = _updater;
        vol = initialVol;
    }

    function setVolatility(uint256 newVol) external {
        if (msg.sender != updater) revert NotUpdater();
        vol = newVol;
        emit VolatilityUpdated(newVol);
    }

    function volatility(PoolId) external view returns (uint256) {
        return vol;
    }
}
