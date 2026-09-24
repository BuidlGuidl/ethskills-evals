// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable owner;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address owner) private _ownerOf;
    mapping(address member => uint256 balance) private _balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotOwner();
    error AlreadyMember();
    error TokenDoesNotExist();

    constructor() {
        owner = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != owner) revert NotOwner();
        if (_balanceOf[to] != 0) revert AlreadyMember();

        tokenId = ++totalSupply;
        _ownerOf[tokenId] = to;
        _balanceOf[to] = 1;

        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _ownerOf[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
        return tokenOwner;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balanceOf[account];
    }
}

