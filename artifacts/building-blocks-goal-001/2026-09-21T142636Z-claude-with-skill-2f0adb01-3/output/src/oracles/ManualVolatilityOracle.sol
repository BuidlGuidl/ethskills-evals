// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice STUB signal: an updater pushes a volatility value per pool.
/// @dev Placeholder until a real signal (offchain keeper, TWAP-derived, Chainlink, etc.) is wired up.
///      Swap it out later with `VolatilityFeeHook.setOracle` — no pool migration needed.
contract ManualVolatilityOracle is IVolatilityOracle {
    using PoolIdLibrary for PoolKey;

    address public updater;
    mapping(PoolId => uint256) public volatilityOf;

    event UpdaterSet(address indexed updater);
    event VolatilitySet(PoolId indexed poolId, uint256 volatility);

    error NotUpdater();

    constructor(address _updater) {
        updater = _updater;
        emit UpdaterSet(_updater);
    }

    function volatility(PoolKey calldata key) external view returns (uint256) {
        return volatilityOf[key.toId()];
    }

    function setVolatility(PoolId poolId, uint256 value) external {
        if (msg.sender != updater) revert NotUpdater();
        volatilityOf[poolId] = value;
        emit VolatilitySet(poolId, value);
    }

    function setUpdater(address _updater) external {
        if (msg.sender != updater) revert NotUpdater();
        updater = _updater;
        emit UpdaterSet(_updater);
    }
}
