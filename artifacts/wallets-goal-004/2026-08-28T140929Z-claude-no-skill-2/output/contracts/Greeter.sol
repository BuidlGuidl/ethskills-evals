// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Greeter
/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Replace it with the contract you are actually shipping, then set
///         CONTRACT_NAME in deploy.ts (or pass --contract) to match.
contract Greeter {
    string public greeting;
    address public immutable owner;

    event GreetingChanged(address indexed by, string greeting);

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
        emit GreetingChanged(msg.sender, _greeting);
    }

    function setGreeting(string calldata _greeting) external {
        require(msg.sender == owner, "Greeter: not owner");
        greeting = _greeting;
        emit GreetingChanged(msg.sender, _greeting);
    }
}
