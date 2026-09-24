// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract SimpleMembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    uint256 public totalSupply;
    mapping(uint256 tokenId => address owner) public ownerOf;
    mapping(address owner => uint256 balance) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function mint(address to) external returns (uint256 tokenId) {
        require(to != address(0), "zero address");
        tokenId = ++totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }
}

