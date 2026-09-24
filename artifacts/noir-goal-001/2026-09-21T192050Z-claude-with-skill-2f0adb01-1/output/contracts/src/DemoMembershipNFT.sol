// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Stand-in for the DAO's existing membership NFT on a local chain. In a real
///         deployment AnonVoting is pointed at the live NFT and this is not deployed.
contract DemoMembershipNFT is ERC721, Ownable {
    uint256 public nextId = 1;

    constructor(address owner_) ERC721("DAO Member", "MEMBER") Ownable(owner_) {}

    function mint(address to) external onlyOwner returns (uint256 id) {
        id = nextId++;
        _mint(to, id);
    }
}
