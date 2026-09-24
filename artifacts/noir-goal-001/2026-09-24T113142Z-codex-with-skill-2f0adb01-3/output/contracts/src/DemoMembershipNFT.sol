// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract DemoMembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable owner;
    uint256 public nextTokenId = 1;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error OnlyOwner();
    error ZeroAddress();

    constructor() {
        owner = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != owner) revert OnlyOwner();
        if (to == address(0)) revert ZeroAddress();

        tokenId = nextTokenId++;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }
}

