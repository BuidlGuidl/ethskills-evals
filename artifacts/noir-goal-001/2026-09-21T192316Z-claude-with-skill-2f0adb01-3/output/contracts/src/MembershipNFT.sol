// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Stand-in for the DAO's existing membership NFT so the system can be stood up
/// on a local chain. In production, point AnonymousVoting at the real NFT; any
/// ERC-721 works. Non-transferable here, because a membership that can be sold
/// would let one person register (and vote) with the same token twice.
contract MembershipNFT is ERC721, Ownable {
    uint256 public nextId = 1;

    error Soulbound();

    constructor(address owner_) ERC721("DAO Membership", "MEMBER") Ownable(owner_) {}

    function mint(address to) external onlyOwner returns (uint256 id) {
        id = nextId++;
        _safeMint(to, id);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) revert Soulbound();
    }
}
