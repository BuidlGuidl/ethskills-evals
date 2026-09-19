// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Placeholder contract so the pipeline works end to end.
/// Replace with the real contract and update CONTRACT_FILE / CONTRACT_NAME.
contract Greeter {
    string public greeting;

    constructor(string memory initialGreeting) {
        greeting = initialGreeting;
    }

    function setGreeting(string calldata newGreeting) external {
        greeting = newGreeting;
    }
}
