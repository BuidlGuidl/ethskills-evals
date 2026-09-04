// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Counter
/// @notice Placeholder deploy target so the tooling is runnable end to end.
///         Replace with the contract you are actually shipping.
contract Counter {
    uint256 public count;

    event Incremented(address indexed by, uint256 newCount);

    constructor(uint256 initialCount) {
        count = initialCount;
    }

    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }
}
