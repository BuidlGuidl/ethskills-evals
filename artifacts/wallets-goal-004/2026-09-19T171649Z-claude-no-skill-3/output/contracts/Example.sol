// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Placeholder so the pipeline can be exercised end to end.
/// Replace with (or add alongside) the real contract and point
/// CONTRACT_PATH / CONTRACT_NAME at it.
contract Example {
    address public immutable owner;
    string public greeting;

    constructor(string memory _greeting) {
        owner = msg.sender;
        greeting = _greeting;
    }
}
