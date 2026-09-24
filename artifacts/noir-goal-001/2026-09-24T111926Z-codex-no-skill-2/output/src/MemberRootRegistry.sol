// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MemberRootRegistry {
    address public owner;
    address public immutable membershipNft;
    bytes32 public currentRoot;

    mapping(bytes32 root => bool known) public isKnownRoot;

    event RootAccepted(bytes32 indexed root);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address membershipNft_, bytes32 initialRoot) {
        owner = msg.sender;
        membershipNft = membershipNft_;
        _acceptRoot(initialRoot);
    }

    function acceptRoot(bytes32 root) external onlyOwner {
        _acceptRoot(root);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _acceptRoot(bytes32 root) private {
        currentRoot = root;
        isKnownRoot[root] = true;
        emit RootAccepted(root);
    }
}

