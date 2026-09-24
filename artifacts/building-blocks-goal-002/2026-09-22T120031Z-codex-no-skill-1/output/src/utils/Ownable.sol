// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Ownable {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    address public owner;

    constructor(address owner_) {
        require(owner_ != address(0), "OWNABLE_ZERO_OWNER");
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNABLE_ZERO_OWNER");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

