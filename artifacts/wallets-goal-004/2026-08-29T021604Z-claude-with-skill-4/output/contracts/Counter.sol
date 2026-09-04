// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Counter
/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Swap in the real contract and update CONTRACT_NAME in deploy.ts.
/// @dev    Note the shape here, it is the point of the example: the account
///         that *deploys* is not the account that *controls*. `owner` is passed
///         in as a constructor argument (the team Safe) so the throwaway deploy
///         key holds no authority over the contract once the tx is mined.
contract Counter {
    address public owner;
    uint256 public count;

    error NotOwner();
    error ZeroAddress();

    event Incremented(address indexed by, uint256 newCount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnerChanged(address(0), initialOwner);
    }

    function increment() external {
        count += 1;
        emit Incremented(msg.sender, count);
    }

    /// @notice Owner-gated, to show what the deploy key must NOT be able to call.
    function reset() external onlyOwner {
        count = 0;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }
}
