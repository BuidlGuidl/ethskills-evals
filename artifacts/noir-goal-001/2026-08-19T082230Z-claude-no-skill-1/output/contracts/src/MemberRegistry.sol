// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IHonkVerifier} from "./interfaces/IHonkVerifier.sol";
import {IMembershipNFT} from "./interfaces/IMembershipNFT.sol";

/// @title MemberRegistry
/// @notice Append-only Merkle tree of member identity commitments. This is the
///         anonymity set every ballot is proven against.
///
/// @dev The contract stores a root and a count and *hashes nothing*. Each append
///      arrives with a `join` proof that `newRoot` is the current root with the
///      single slot at index `memberCount` changed from empty to `commitment`.
///      That has two consequences worth knowing:
///
///      1. There is no Poseidon2 implementation in Solidity to keep bit-for-bit
///         in sync with the Noir one, which is the usual source of silent
///         breakage in designs like this.
///      2. Nobody, including the DAO, can move the root to a tree of their
///         choosing - e.g. one padded with extra leaves whose secrets they hold,
///         which would let them mint votes. The only reachable roots are the
///         ones produced by honest sequential appends.
///
///      Joining is deliberately public and attributable: membership is already
///      public, and `join` needs the NFT check. What must never be linkable to a
///      wallet is the *ballot*, and that link is broken by the vote circuit.
contract MemberRegistry {
    /// @notice Depth of the membership tree. Must equal `dao_zk::TREE_DEPTH`.
    uint256 public constant TREE_DEPTH = 8;

    /// @notice Leaf capacity, 2**TREE_DEPTH. 256 slots for ~150 members.
    uint256 public constant CAPACITY = 1 << TREE_DEPTH;

    /// @notice Root of the all-empty depth-8 tree under `dao_zk::hash_node`.
    /// @dev Hardcoded rather than a constructor argument so it cannot be seeded
    ///      with a pre-stuffed tree at deploy time. Reproduce it with
    ///      `node scripts/print-constants.mjs`, or from the Noir side with the
    ///      `empty_root_matches_solidity` test in circuits/lib.
    bytes32 public constant EMPTY_ROOT = 0x2dd69f6f1029f5afc7acc7b8cd5bf12012a288788b5bccbba6992244b1fa75e8;

    IMembershipNFT public immutable membershipNFT;
    IHonkVerifier public immutable joinVerifier;

    /// @notice Current membership tree root.
    bytes32 public root = EMPTY_ROOT;

    /// @notice Number of occupied leaves; also the index of the next append.
    uint256 public memberCount;

    /// @notice One join per membership token, so transferring the NFT onwards
    ///         does not buy a second seat in the tree.
    mapping(uint256 tokenId => bool) public tokenHasJoined;

    /// @notice Guards against two members racing in with the same commitment,
    ///         which would leave one of them unable to vote.
    mapping(bytes32 commitment => bool) public commitmentTaken;

    /// @notice Emitted for every append. The full leaf set is recoverable from
    ///         this log alone, which is what lets any member rebuild the tree
    ///         locally and produce a Merkle path without asking anyone.
    event MemberJoined(uint256 indexed leafIndex, bytes32 commitment, bytes32 newRoot);

    error NotTokenHolder(uint256 tokenId, address caller);
    error TokenAlreadyJoined(uint256 tokenId);
    error CommitmentAlreadyRegistered(bytes32 commitment);
    error RegistryFull();
    error StaleRoot(bytes32 expected, bytes32 got);
    error InvalidJoinProof();

    constructor(IMembershipNFT membershipNFT_, IHonkVerifier joinVerifier_) {
        membershipNFT = membershipNFT_;
        joinVerifier = joinVerifier_;
    }

    /// @notice Append `commitment` to the membership tree.
    /// @param tokenId     A membership token held by the caller.
    /// @param commitment  `dao_zk::identity_commitment(secret)`, computed locally.
    /// @param expectedRoot The root the proof was built against. Passed in so a
    ///        join that lost a race against another member fails loudly with
    ///        `StaleRoot` instead of as an opaque proof failure.
    /// @param newRoot     Root after the append.
    /// @param proof       `join` circuit proof.
    function join(uint256 tokenId, bytes32 commitment, bytes32 expectedRoot, bytes32 newRoot, bytes calldata proof)
        external
    {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotTokenHolder(tokenId, msg.sender);
        if (tokenHasJoined[tokenId]) revert TokenAlreadyJoined(tokenId);
        if (commitmentTaken[commitment]) revert CommitmentAlreadyRegistered(commitment);

        bytes32 currentRoot = root;
        if (expectedRoot != currentRoot) revert StaleRoot(currentRoot, expectedRoot);

        uint256 leafIndex = memberCount;
        if (leafIndex >= CAPACITY) revert RegistryFull();

        // Public inputs in the order the `join` circuit declares them.
        // `leafIndex` is pinned to `memberCount` here, which is what forces
        // appends to be sequential and keeps `memberCount` honest.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = currentRoot;
        publicInputs[1] = newRoot;
        publicInputs[2] = commitment;
        publicInputs[3] = bytes32(leafIndex);
        if (!joinVerifier.verify(proof, publicInputs)) revert InvalidJoinProof();

        tokenHasJoined[tokenId] = true;
        commitmentTaken[commitment] = true;
        memberCount = leafIndex + 1;
        root = newRoot;

        emit MemberJoined(leafIndex, commitment, newRoot);
    }
}
