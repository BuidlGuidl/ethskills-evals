// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Counter
/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Replace this file with the contract we're actually shipping, set
///         CONTRACT_NAME in .env to its name, and update CONSTRUCTOR_ARGS in
///         deploy.ts to match its constructor.
contract Counter {
    uint256 public count;
    address public immutable owner;

    event Incremented(address indexed by, uint256 newCount);

    constructor(uint256 initialCount) {
        count = initialCount;
        owner = msg.sender;
    }

    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }
}
