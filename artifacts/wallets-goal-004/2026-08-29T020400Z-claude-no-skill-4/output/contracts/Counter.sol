// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Counter
/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Replace this with the contract we are actually shipping — deploy.ts
///         picks up whatever CONTRACT_NAME points at, no script changes needed.
contract Counter {
    /// @notice Current count.
    uint256 public count;

    /// @notice Account that deployed this contract.
    address public immutable owner;

    event Incremented(address indexed by, uint256 newCount);

    /// @param startingCount Value the counter starts at.
    constructor(uint256 startingCount) {
        count = startingCount;
        owner = msg.sender;
    }

    /// @notice Increase the counter by one.
    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }
}
