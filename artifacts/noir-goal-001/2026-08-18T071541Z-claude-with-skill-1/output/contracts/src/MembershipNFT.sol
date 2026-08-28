// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stand-in for the DAO's existing membership NFT, so the local chain has something to
///         gate registration on. In production, point `MemberRegistry` at the real NFT instead.
contract MembershipNFT is ERC721, Ownable {
    uint256 public nextTokenId = 1;

    constructor(address owner_) ERC721("DAO Membership", "DAOM") Ownable(owner_) {}

    function mint(address to) public onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }

    /// @dev One transaction for the whole cohort. Minting 150 NFTs one call at a time is a lot of
    ///      blocks for a local chain to chew through during setup.
    function mintBatch(address[] calldata to) external onlyOwner returns (uint256 firstTokenId) {
        firstTokenId = nextTokenId;
        for (uint256 i = 0; i < to.length; i++) {
            mint(to[i]);
        }
    }
}
