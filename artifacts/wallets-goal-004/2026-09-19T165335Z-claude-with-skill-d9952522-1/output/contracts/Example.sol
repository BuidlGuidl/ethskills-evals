// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Placeholder so the pipeline can be exercised end to end.
// Replace with (or add next to) the real contract and point CONTRACT_FILE / CONTRACT_NAME at it.
contract Example {
    string public greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }
}
