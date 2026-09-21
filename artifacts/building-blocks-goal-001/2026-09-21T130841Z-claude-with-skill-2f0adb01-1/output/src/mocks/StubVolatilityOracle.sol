// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

/// @notice Placeholder signal: owner-set value. Replace with a real source via DynamicFeeHook.setOracle.
contract StubVolatilityOracle is IVolatilityOracle {
    address public immutable owner;
    uint256 public vol;

    error NotOwner();

    constructor(address _owner, uint256 initialVol) {
        owner = _owner;
        vol = initialVol;
    }

    function setVolatility(uint256 v) external {
        if (msg.sender != owner) revert NotOwner();
        vol = v;
    }

    function volatility(PoolKey calldata) external view returns (uint256) {
        return vol;
    }
}
