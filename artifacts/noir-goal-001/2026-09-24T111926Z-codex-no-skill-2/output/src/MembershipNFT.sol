// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MembershipNFT {
    string public name = "DAO Membership";
    string public symbol = "DAOM";
    address public owner;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address owner) public ownerOf;
    mapping(address account => uint256 balance) public balanceOf;
    mapping(uint256 tokenId => address approved) public getApproved;
    mapping(address owner => mapping(address operator => bool approved)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "zero address");
        tokenId = ++totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function approve(address spender, uint256 tokenId) external {
        address tokenOwner = ownerOf[tokenId];
        require(msg.sender == tokenOwner || isApprovedForAll[tokenOwner][msg.sender], "not approved");
        getApproved[tokenId] = spender;
        emit Approval(tokenOwner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(to != address(0), "zero address");
        address tokenOwner = ownerOf[tokenId];
        require(tokenOwner == from, "wrong owner");
        require(
            msg.sender == tokenOwner || getApproved[tokenId] == msg.sender || isApprovedForAll[tokenOwner][msg.sender],
            "not approved"
        );

        delete getApproved[tokenId];
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        ownerOf[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }
}

