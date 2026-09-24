// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

abstract contract Owned {
    error NotOwner();
    error ZeroAddress();

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert NotOwner();
    }
}
