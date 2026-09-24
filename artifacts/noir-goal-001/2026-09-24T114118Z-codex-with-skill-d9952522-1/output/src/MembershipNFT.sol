// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MembershipNFT {
    string public name = "DAO Membership";
    string public symbol = "DAOM";

    address public immutable owner;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address holder) public ownerOf;
    mapping(address holder => uint256 count) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotOwner();
    error AlreadyMinted();
    error ZeroAddress();
    error NonTransferable();

    constructor() {
        owner = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != owner) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[to] != 0) revert AlreadyMinted();

        tokenId = ++totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] = 1;

        emit Transfer(address(0), to, tokenId);
    }

    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }
}
