// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Placeholder so the deploy pipeline is runnable end to end.
///         Replace with the contract actually shipping this week, then set
///         CONTRACT_NAME in deploy.ts (or pass --contract) to match.
contract Counter {
    address public owner;
    uint256 public count;

    event Incremented(address indexed by, uint256 newCount);

    /// @param initialOwner Administrative owner. Pass the team Safe, not the
    ///        deployer EOA — the deploy key is hot and single-signature.
    constructor(address initialOwner) {
        require(initialOwner != address(0), "owner is zero address");
        owner = initialOwner;
    }

    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }
}
