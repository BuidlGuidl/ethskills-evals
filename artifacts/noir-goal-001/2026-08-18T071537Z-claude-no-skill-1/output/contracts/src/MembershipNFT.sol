// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMembershipNFT} from "./IMembershipNFT.sol";

/// @title MembershipNFT
/// @notice Minimal non-transferable ERC-721 standing in for the DAO's existing
///         membership NFT, so the local deployment is self-contained.
///
/// @dev In production you would delete this and point MemberSet / PrivateBallot
///      at the NFT you already have -- they only ever call `ownerOf` and
///      `balanceOf` through IMembershipNFT.
///
///      Membership is public by design here: who holds a token, and who
///      enrolled a voting commitment, are both readable by anyone. That is the
///      DAO's stated situation and it costs nothing -- the anonymity set for a
///      ballot is *all* enrolled members, so a large, public, well-known member
///      list makes ballots harder to attribute, not easier.
contract MembershipNFT is IMembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable admin;
    uint256 public totalSupply;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(address => uint256) private _tokenOfMember;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error AlreadyMember();
    error NoSuchToken();
    error Soulbound();

    constructor(address admin_) {
        admin = admin_;
    }

    /// @notice Mint membership token to `member`. One per address.
    function mint(address member) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        if (_balanceOf[member] != 0) revert AlreadyMember();
        tokenId = ++totalSupply;
        _ownerOf[tokenId] = member;
        _balanceOf[member] = 1;
        _tokenOfMember[member] = tokenId;
        emit Transfer(address(0), member, tokenId);
    }

    /// @notice Mint a whole cohort. Convenience for standing the DAO up; the
    ///         per-member `enroll` that follows can only be sent by the members
    ///         themselves.
    function mintBatch(address[] calldata newMembers) external returns (uint256 firstTokenId) {
        if (msg.sender != admin) revert NotAdmin();
        firstTokenId = totalSupply + 1;
        for (uint256 i = 0; i < newMembers.length; i++) {
            address member = newMembers[i];
            if (_balanceOf[member] != 0) revert AlreadyMember();
            uint256 tokenId = ++totalSupply;
            _ownerOf[tokenId] = member;
            _balanceOf[member] = 1;
            _tokenOfMember[member] = tokenId;
            emit Transfer(address(0), member, tokenId);
        }
    }

    /// @notice Which seat an address holds, or 0. Convenience for clients that
    ///         know a member by address rather than by token id.
    function tokenOfMember(address member) external view returns (uint256) {
        return _tokenOfMember[member];
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NoSuchToken();
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }

    /// @dev Non-transferable: a transferable seat would let one person enroll a
    ///      commitment, hand the token on, and have the new holder enroll a
    ///      second one -- two ballots from one seat, with no way to tell.
    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }
}
