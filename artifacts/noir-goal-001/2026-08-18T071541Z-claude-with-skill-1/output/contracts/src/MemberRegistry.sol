// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {InternalLeanIMT, LeanIMTData} from "lean-imt/InternalLeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "lean-imt/Constants.sol";

/// @notice The anonymity set. Every membership NFT may bind exactly one Poseidon commitment,
///         once, forever. Commitments live in a LeanIMT whose root is snapshotted per proposal
///         by `AnonVoting`.
///
/// Registration is deliberately public and attributable: `msg.sender` is the member's normal
/// wallet and the commitment is in the event log. That is fine — the commitment is a hiding
/// Poseidon hash of secrets only the member knows, and it is the *voting* transaction that must
/// be unlinkable. See NOTES.md.
contract MemberRegistry {
    using InternalLeanIMT for LeanIMTData;

    IERC721 public immutable membershipNFT;

    LeanIMTData internal tree;

    /// @notice Membership NFT ids that have already bound a commitment.
    mapping(uint256 tokenId => bool) public tokenIdRegistered;
    /// @notice Every root this tree has ever had, so a proposal snapshot can be shown to be real.
    mapping(uint256 root => bool) public isKnownRoot;

    event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 newRoot);

    error NotTokenOwner();
    error TokenAlreadyRegistered();
    error CommitmentOutOfField();
    error CommitmentAlreadyUsed();

    constructor(IERC721 membershipNFT_) {
        membershipNFT = membershipNFT_;
        isKnownRoot[0] = true; // the empty tree
    }

    /// @notice Bind `commitment` to membership NFT `tokenId`. Callable once per token.
    /// @dev Keyed on tokenId rather than on the caller, so transferring the NFT cannot mint a
    ///      second commitment. The flip side: a member who sells their NFT keeps the ability to
    ///      vote until governance rotates the tree. Documented in NOTES.md.
    function register(uint256 tokenId, uint256 commitment) external returns (uint256 leafIndex, uint256 newRoot) {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (tokenIdRegistered[tokenId]) revert TokenAlreadyRegistered();
        if (commitment >= SNARK_SCALAR_FIELD || commitment == 0) revert CommitmentOutOfField();
        if (tree._has(commitment)) revert CommitmentAlreadyUsed();

        tokenIdRegistered[tokenId] = true;
        leafIndex = tree.size;
        newRoot = tree._insert(commitment);
        isKnownRoot[newRoot] = true;

        emit MemberRegistered(tokenId, commitment, leafIndex, newRoot);
    }

    function root() external view returns (uint256) {
        return tree._root();
    }

    function depth() external view returns (uint256) {
        return tree.depth;
    }

    function size() external view returns (uint256) {
        return tree.size;
    }

    function indexOf(uint256 commitment) external view returns (uint256) {
        return tree._indexOf(commitment);
    }
}
