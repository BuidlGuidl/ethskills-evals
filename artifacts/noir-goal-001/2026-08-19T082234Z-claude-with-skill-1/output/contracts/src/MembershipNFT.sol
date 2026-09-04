// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Stand-in for the DAO's existing membership NFT, so the local chain
///         has something to gate on. In production you point MemberRegistry at
///         the real one; nothing else changes.
/// @dev Non-transferable on purpose: membership is an identity, and a
///      transferable seat would let one person accumulate ballots.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable issuer;
    uint256 public totalSupply;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotIssuer();
    error AlreadyMember();
    error NonTransferable();

    constructor(address _issuer) {
        issuer = _issuer;
    }

    function issue(address member) external returns (uint256 tokenId) {
        if (msg.sender != issuer) revert NotIssuer();
        if (balanceOf[member] != 0) revert AlreadyMember();
        tokenId = ++totalSupply;
        ownerOf[tokenId] = member;
        balanceOf[member] = 1;
        emit Transfer(address(0), member, tokenId);
    }

    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd; // ERC165, ERC721
    }
}
