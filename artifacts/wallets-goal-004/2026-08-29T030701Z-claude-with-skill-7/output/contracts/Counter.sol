// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Placeholder so the toolchain runs end to end out of the box.
///         Replace with the contract you are actually shipping, then run
///         `npm run compile && npm run deploy -- Counter` with your name.
contract Counter {
    uint256 public count;
    address public immutable owner;

    event Counted(address indexed by, uint256 newCount);

    constructor(uint256 startingCount) {
        count = startingCount;
        owner = msg.sender;
    }

    function increment() external {
        count += 1;
        emit Counted(msg.sender, count);
    }
}
