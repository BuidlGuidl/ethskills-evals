// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stand-in for the DAO's existing membership NFT, used on local chains only.
/// In production, point MemberRegistry at the real NFT contract instead.
contract MembershipNFT is ERC721, Ownable {
    uint256 public nextId = 1;

    constructor(address owner_) ERC721("DAO Membership", "MEMBER") Ownable(owner_) {}

    function mint(address to) external onlyOwner returns (uint256 id) {
        id = nextId++;
        _mint(to, id);
    }
}
