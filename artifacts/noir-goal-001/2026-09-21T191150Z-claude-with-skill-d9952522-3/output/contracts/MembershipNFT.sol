// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stand-in for the DAO's existing membership NFT so the stack runs on a local chain.
/// AnonymousVoting only needs `ownerOf` / `balanceOf`, so point it at the real NFT in production.
contract MembershipNFT is ERC721, Ownable {
    uint256 public nextTokenId = 1;

    constructor(address owner_) ERC721("DAO Membership", "MEMBER") Ownable(owner_) {}

    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }
}
