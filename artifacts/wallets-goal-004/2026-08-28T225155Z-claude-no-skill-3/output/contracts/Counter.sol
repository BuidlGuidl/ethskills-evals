// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Placeholder contract so the deploy pipeline is runnable out of the
///         box. Replace it with the real contract, then point CONTRACT_NAME in
///         deploy.ts (or the CONTRACT env var) at your contract's name.
contract Counter {
    uint256 public count;

    event CountChanged(uint256 newCount);

    constructor(uint256 initialCount) {
        count = initialCount;
    }

    function increment() external {
        count += 1;
        emit CountChanged(count);
    }
}
