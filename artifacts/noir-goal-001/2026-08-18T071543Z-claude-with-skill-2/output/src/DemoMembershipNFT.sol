// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Stand-in for the DAO's real membership NFT, so the local deployment
/// has something to gate on. On a live chain, point MembershipRegistry at the
/// existing NFT and do not deploy this.
contract DemoMembershipNFT is ERC721 {
    address public immutable issuer;
    uint256 public nextTokenId;

    error NotIssuer();

    constructor() ERC721("DAO Membership", "DAOM") {
        issuer = msg.sender;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != issuer) revert NotIssuer();
        tokenId = nextTokenId++;
        _mint(to, tokenId);
    }
}
