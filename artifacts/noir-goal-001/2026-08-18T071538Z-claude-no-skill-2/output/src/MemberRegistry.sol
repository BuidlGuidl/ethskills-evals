// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./verifiers/HonkVerifierBase.sol";

interface IMembership {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title MemberRegistry
/// @notice The anonymity set. Every member who wants to vote publishes one
///         identity commitment here, from their own (public, NFT-holding)
///         wallet. The commitments live in a fixed-depth incremental Merkle
///         tree; ballots later prove membership in a snapshot of that tree
///         without revealing which leaf they are.
///
/// @dev The EVM has no cheap Poseidon2, so the contract cannot recompute the
///      tree itself. Instead of trusting an operator to post roots, each
///      joiner supplies a `register` proof: "slot `index` of the tree rooted
///      at `root` is empty, and filling it with `commitment` yields
///      `newRoot`". The contract pins `root` and `index` from its own storage,
///      so the only value the caller chooses is their commitment. Nobody —
///      including the DAO — can push a root that shrinks the anonymity set.
contract MemberRegistry {
    /// @dev Must match `common::TREE_DEPTH` in circuits/common/src/lib.nr.
    uint32 public constant TREE_DEPTH = 8;
    uint32 public constant CAPACITY = 256;

    /// @dev Root of the all-zero depth-8 Poseidon2 tree. Pinned by the Noir
    ///      test `empty_root_matches_the_solidity_constant`.
    bytes32 public constant EMPTY_ROOT = 0x067243231eddf4222f3911defbba7705aff06ed45960b27f6f91319196ef97e1;

    IMembership public immutable membership;
    IVerifier public immutable registerVerifier;

    /// @notice Current Merkle root over all published commitments.
    bytes32 public root = EMPTY_ROOT;

    /// @notice Every commitment in leaf order, so anyone can rebuild the tree.
    bytes32[] public commitments;

    /// @notice One anonymity-set slot per membership NFT holder.
    mapping(address => bool) public hasJoined;
    mapping(bytes32 => bool) public commitmentUsed;

    event Joined(uint32 indexed index, bytes32 commitment, bytes32 root);

    error NotAMember();
    error AlreadyJoined();
    error RegistryFull();
    error ZeroCommitment();
    error CommitmentAlreadyUsed();
    error BadInsertionProof();

    constructor(IMembership _membership, IVerifier _registerVerifier) {
        membership = _membership;
        registerVerifier = _registerVerifier;
    }

    function memberCount() external view returns (uint32) {
        return uint32(commitments.length);
    }

    /// @notice All commitments, for rebuilding the tree off chain.
    function allCommitments() external view returns (bytes32[] memory) {
        return commitments;
    }

    /// @notice Join the anonymity set.
    /// @param commitment Poseidon2(secret) — the member's leaf.
    /// @param newRoot    The root after appending `commitment`.
    /// @param proof      UltraHonk proof of the `register` circuit.
    ///
    /// @dev Sent by the member's own NFT-holding wallet, so an observer learns
    ///      "this member joined the vote" and which leaf index they own. That
    ///      is unavoidable — the NFT check needs an authenticated sender — and
    ///      harmless: the commitment hides the secret, and the ballot proof
    ///      never reveals the leaf.
    function join(bytes32 commitment, bytes32 newRoot, bytes calldata proof) external {
        if (membership.balanceOf(msg.sender) == 0) revert NotAMember();
        if (hasJoined[msg.sender]) revert AlreadyJoined();
        if (commitment == 0) revert ZeroCommitment();
        if (commitmentUsed[commitment]) revert CommitmentAlreadyUsed();

        uint32 index = uint32(commitments.length);
        if (index >= CAPACITY) revert RegistryFull();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = root; // old_root, pinned by the contract
        publicInputs[1] = newRoot;
        publicInputs[2] = commitment;
        publicInputs[3] = bytes32(uint256(index)); // index, pinned by the contract
        // See the note in Ballot.castVote: the generated verifier reverts on a bad
        // proof, so this is a fallback for verifiers that return false instead.
        if (!registerVerifier.verify(proof, publicInputs)) revert BadInsertionProof();

        hasJoined[msg.sender] = true;
        commitmentUsed[commitment] = true;
        commitments.push(commitment);
        root = newRoot;

        emit Joined(index, commitment, newRoot);
    }
}
