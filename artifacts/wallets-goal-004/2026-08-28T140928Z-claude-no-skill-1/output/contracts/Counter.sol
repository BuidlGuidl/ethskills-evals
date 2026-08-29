// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Counter
/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Replace this with the contract we are actually shipping — deploy.ts
///         picks up whatever `CONTRACT_NAME` points at, no script changes needed.
contract Counter {
    uint256 public value;

    event ValueChanged(uint256 newValue);

    constructor(uint256 initialValue) {
        value = initialValue;
        emit ValueChanged(initialValue);
    }

    function increment() external {
        value += 1;
        emit ValueChanged(value);
    }

    function set(uint256 newValue) external {
        value = newValue;
        emit ValueChanged(newValue);
    }
}
