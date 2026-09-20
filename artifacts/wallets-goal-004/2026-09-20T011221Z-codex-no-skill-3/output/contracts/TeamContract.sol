// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TeamContract {
    address public immutable owner;
    string public name;

    event NameChanged(string name);

    constructor(string memory initialName) {
        owner = msg.sender;
        name = initialName;
    }

    function setName(string calldata nextName) external {
        require(msg.sender == owner, "not owner");
        name = nextName;
        emit NameChanged(nextName);
    }
}
