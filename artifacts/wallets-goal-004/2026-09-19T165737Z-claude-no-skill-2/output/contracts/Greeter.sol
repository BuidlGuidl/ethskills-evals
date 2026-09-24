// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Placeholder so the pipeline works end to end.
/// Replace with (or add alongside) the real contract and point CONTRACT_PATH / CONTRACT_NAME at it.
contract Greeter {
    string public greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }
}
