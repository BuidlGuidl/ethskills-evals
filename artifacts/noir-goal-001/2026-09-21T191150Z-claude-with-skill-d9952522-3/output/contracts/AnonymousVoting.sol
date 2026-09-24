// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {InternalLeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/InternalLeanIMT.sol";
import {SNARK_SCALAR_FIELD} from "@zk-kit/lean-imt.sol/Constants.sol";
import {IVerifier} from "./HonkVerifier.sol";

/// @title Anonymous yes/no voting for a DAO with a public membership NFT.
/// @notice Two separate phases, sent from different wallets:
///   1. register(): the member's own (public) wallet proves NFT ownership and adds a
///      Poseidon commitment to the member tree. Links wallet -> commitment, which is fine:
///      membership is public and the commitment reveals nothing about any vote.
///   2. castVote(): sent by a relayer (never the member's wallet). A ZK proof shows the
///      vote comes from *some* leaf of the proposal's snapshotted tree, plus a
///      per-proposal nullifier hash that blocks double voting without identifying the leaf.
contract AnonymousVoting {
    using InternalLeanIMT for LeanIMTData;

    struct Proposal {
        uint256 root; // member-tree root snapshotted at creation: the anonymity set
        uint256 scope; // external nullifier bound into every proof for this proposal
        uint64 deadline; // votes accepted while block.timestamp <= deadline
        uint32 eligibleVoters; // tree size at snapshot
        uint32 yes;
        uint32 no;
    }

    IERC721 public immutable membership;
    IVerifier public immutable verifier;
    /// @notice Proposals can't open over a tree smaller than this (a 1-leaf set de-anonymises).
    uint256 public immutable minAnonymitySet;

    LeanIMTData internal tree;
    mapping(uint256 tokenId => bool) public tokenRegistered;
    mapping(uint256 nullifierHash => bool) public nullifierUsed;
    Proposal[] internal proposals;

    /// Everything a client needs to rebuild the tree offchain, in insertion order.
    event MemberRegistered(uint256 indexed tokenId, uint256 commitment, uint256 leafIndex, uint256 root);
    event ProposalCreated(
        uint256 indexed proposalId, uint256 root, uint256 scope, uint64 deadline, uint32 eligibleVoters, string description
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, uint256 vote);

    error NotTokenOwner();
    error AlreadyRegistered();
    error NotMember();
    error AnonymitySetTooSmall(uint256 size, uint256 required);
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error InvalidVote();
    error NullifierAlreadyUsed();
    error InvalidProof();

    constructor(IERC721 membership_, IVerifier verifier_, uint256 minAnonymitySet_) {
        membership = membership_;
        verifier = verifier_;
        minAnonymitySet = minAnonymitySet_;
    }

    // ---------------------------------------------------------------- membership

    /// @notice Called once per membership NFT, from the wallet holding it.
    /// @param commitment poseidon3(nullifier, secret, 1) — computed and kept offchain by the member.
    function register(uint256 tokenId, uint256 commitment) external {
        if (membership.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        // Keyed by token, not wallet: passing the NFT to a fresh wallet can't mint a second leaf.
        if (tokenRegistered[tokenId]) revert AlreadyRegistered();
        tokenRegistered[tokenId] = true;

        uint256 leafIndex = tree.size;
        uint256 root = tree._insert(commitment); // reverts on 0, >= field, or duplicate
        emit MemberRegistered(tokenId, commitment, leafIndex, root);
    }

    function memberRoot() external view returns (uint256) {
        return tree._root();
    }

    function memberCount() external view returns (uint256) {
        return tree.size;
    }

    // ---------------------------------------------------------------- proposals

    function createProposal(string calldata description, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        uint256 size = tree.size;
        if (size < minAnonymitySet || size == 0) revert AnonymitySetTooSmall(size, minAnonymitySet);

        proposalId = proposals.length;
        uint256 scope = scopeOf(proposalId);
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        proposals.push(
            Proposal({
                root: tree._root(),
                scope: scope,
                deadline: deadline,
                eligibleVoters: uint32(size),
                yes: 0,
                no: 0
            })
        );
        emit ProposalCreated(proposalId, tree._root(), scope, deadline, uint32(size), description);
    }

    /// @notice Per-proposal external nullifier. Binding chain id and this contract's address means a
    /// proof can't be replayed on another deployment that happens to share the member tree.
    function scopeOf(uint256 proposalId) public view returns (uint256) {
        return uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (uint256 root, uint256 scope, uint64 deadline, uint32 eligibleVoters)
    {
        Proposal storage p = _proposal(proposalId);
        return (p.root, p.scope, p.deadline, p.eligibleVoters);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    // ---------------------------------------------------------------- voting

    /// @notice Anyone may submit — in practice a relayer, so msg.sender says nothing about the voter.
    /// The proof binds (root, scope, vote, nullifierHash); changing any of them invalidates it, so a
    /// relayer or mempool observer can only submit the vote as cast, or not at all.
    /// @param vote 1 = yes, 0 = no.
    function castVote(uint256 proposalId, uint256 vote, uint256 nullifierHash, bytes calldata proof) external {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp > p.deadline) revert VotingClosed();
        if (vote > 1) revert InvalidVote();
        if (nullifierUsed[nullifierHash]) revert NullifierAlreadyUsed();

        if (!verifier.verify(proof, _publicInputs(p.root, p.scope, vote, nullifierHash))) revert InvalidProof();

        nullifierUsed[nullifierHash] = true;
        if (vote == 1) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, nullifierHash, vote);
    }

    /// @notice Final tally, readable by anyone once the deadline has passed.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, uint256 eligibleVoters) {
        Proposal storage p = _proposal(proposalId);
        if (block.timestamp <= p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.eligibleVoters);
    }

    // ---------------------------------------------------------------- internal

    /// Order must match the `pub` parameters of circuits/vote/src/main.nr:
    /// root, scope, vote, nullifier_hash.
    function _publicInputs(uint256 root, uint256 scope, uint256 vote, uint256 nullifierHash)
        internal
        pure
        returns (bytes32[] memory inputs)
    {
        inputs = new bytes32[](4);
        inputs[0] = bytes32(root);
        inputs[1] = bytes32(scope);
        inputs[2] = bytes32(vote);
        inputs[3] = bytes32(nullifierHash);
    }

    function _proposal(uint256 proposalId) internal view returns (Proposal storage) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        return proposals[proposalId];
    }
}
