// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable owner;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address holder) public ownerOf;
    mapping(address holder => uint256 balance) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotOwner();
    error NotHolder();
    error Soulbound();
    error AlreadyMinted();
    error ZeroAddress();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[to] != 0) revert AlreadyMinted();

        tokenId = ++totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] = 1;

        emit Transfer(address(0), to, tokenId);
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }
}

