// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Placeholder contract so the deploy pipeline is runnable end to end.
///         Replace this file with the contract we're actually shipping — the
///         compile/deploy scripts pick up whatever is in contracts/ and are
///         driven by the CONTRACT name in package.json scripts.
contract Greeter {
    string public greeting;
    address public immutable owner;

    event GreetingSet(string greeting);

    constructor(string memory _greeting) {
        owner = msg.sender;
        greeting = _greeting;
        emit GreetingSet(_greeting);
    }

    function setGreeting(string calldata _greeting) external {
        require(msg.sender == owner, "Greeter: not owner");
        greeting = _greeting;
        emit GreetingSet(_greeting);
    }
}
