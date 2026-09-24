// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Placeholder so the pipeline works end to end. Replace with (or add alongside) the real contract.
contract Counter {
    uint256 public number;

    constructor(uint256 initial) {
        number = initial;
    }

    function increment() external {
        number++;
    }
}
