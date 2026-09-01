// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Placeholder so the deploy pipeline is runnable end to end.
 * Replace this file with the contract we are actually shipping, then set
 * CONTRACT=<YourContractName> in .env.
 */
contract Counter {
    uint256 public count;

    event CountChanged(uint256 newCount, address indexed by);

    constructor(uint256 startingCount) {
        count = startingCount;
    }

    function increment() external {
        count += 1;
        emit CountChanged(count, msg.sender);
    }
}
