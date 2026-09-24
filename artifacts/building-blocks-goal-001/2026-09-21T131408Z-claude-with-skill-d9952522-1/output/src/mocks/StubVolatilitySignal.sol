// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVolatilitySignal} from "../interfaces/IVolatilitySignal.sol";

/// @notice Placeholder signal: an owner-set number. Replace with a real source
///         (oracle, TWAP-derived realized vol, keeper-pushed value, ...) later.
contract StubVolatilitySignal is IVolatilitySignal {
    address public immutable owner;
    uint256 public volatility;

    event VolatilitySet(uint256 value);

    error NotOwner();

    constructor(address _owner, uint256 initial) {
        owner = _owner;
        volatility = initial;
    }

    function set(uint256 value) external {
        if (msg.sender != owner) revert NotOwner();
        volatility = value;
        emit VolatilitySet(value);
    }
}
