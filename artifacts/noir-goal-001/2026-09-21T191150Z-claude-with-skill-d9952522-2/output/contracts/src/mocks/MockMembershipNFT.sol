// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IMembershipNFT} from "../IMembershipNFT.sol";

/// @notice Local-chain stand-in for the DAO's membership NFT. Only deployed by the
/// deploy script when no MEMBERSHIP_NFT address is supplied. Not for production.
contract MockMembershipNFT is IMembershipNFT {
    address public immutable minter;
    uint256 public totalSupply;
    mapping(uint256 => address) internal owners;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor() {
        minter = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        require(msg.sender == minter, "only minter");
        tokenId = ++totalSupply;
        owners[tokenId] = to;
        balanceOf[to]++;
        emit Transfer(address(0), to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(owners[tokenId] == from && msg.sender == from, "not owner");
        owners[tokenId] = to;
        balanceOf[from]--;
        balanceOf[to]++;
        emit Transfer(from, to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address o) {
        o = owners[tokenId];
        require(o != address(0), "no token");
    }
}
