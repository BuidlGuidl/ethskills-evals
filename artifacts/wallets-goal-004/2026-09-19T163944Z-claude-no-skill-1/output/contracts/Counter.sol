// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Placeholder so the pipeline can be exercised end to end.
/// Replace with (or add alongside it) the contract we're shipping.
contract Counter {
    uint256 public count;
    address public immutable owner;

    event Incremented(uint256 newCount);

    constructor(uint256 initialCount) {
        count = initialCount;
        owner = msg.sender;
    }

    function increment() external {
        count += 1;
        emit Incremented(count);
    }
}
