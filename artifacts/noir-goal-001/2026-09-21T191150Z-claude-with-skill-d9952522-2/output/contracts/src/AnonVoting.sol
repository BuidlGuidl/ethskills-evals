// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "./HonkVerifier.sol";
import {IMembershipNFT} from "./IMembershipNFT.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @title AnonVoting
/// @notice Yes/no proposals voted on with Noir membership proofs.
///
/// `castVote` is permissionless and checks nothing about `msg.sender`: it is meant
/// to be sent by a relayer, never by the member's own (publicly known) wallet.
/// The proof binds root, nullifier hash, proposal scope and the vote, so whoever
/// submits it cannot alter the vote — only drop it.
contract AnonVoting {
    uint256 internal constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        bytes32 descriptionHash;
        uint256 root; // registry root snapshotted at creation = the anonymity set
        uint256 scope; // per-proposal domain for nullifiers
        uint64 deadline;
        uint32 yes;
        uint32 no;
    }

    IVerifier public immutable verifier;
    MemberRegistry public immutable registry;
    IMembershipNFT public immutable membership;
    /// Refuse to open a proposal while fewer members than this are registered.
    uint256 public immutable minAnonymitySet;

    Proposal[] internal proposals;
    mapping(uint256 nullifierHash => bool) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 descriptionHash,
        uint256 root,
        uint256 scope,
        uint64 deadline,
        uint256 eligibleMembers
    );
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotMember();
    error AnonymitySetTooSmall();
    error BadDeadline();
    error UnknownProposal();
    error VotingClosed();
    error NullifierUsed();
    error InvalidProof();

    constructor(IVerifier _verifier, MemberRegistry _registry, uint256 _minAnonymitySet) {
        verifier = _verifier;
        registry = _registry;
        membership = _registry.membership();
        minAnonymitySet = _minAnonymitySet;
    }

    function createProposal(bytes32 descriptionHash, uint64 deadline) external returns (uint256 id) {
        if (membership.balanceOf(msg.sender) == 0) revert NotMember();
        if (deadline <= block.timestamp) revert BadDeadline();
        uint256 eligible = registry.activeMembers();
        if (eligible < minAnonymitySet) revert AnonymitySetTooSmall();

        id = proposals.length;
        uint256 scope = uint256(keccak256(abi.encode(block.chainid, address(this), id))) % FIELD;
        uint256 root = registry.root();
        proposals.push(Proposal(descriptionHash, root, scope, deadline, 0, 0));
        emit ProposalCreated(id, descriptionHash, root, scope, deadline, eligible);
    }

    /// @notice Count one anonymous vote. Intended to be sent by a relayer.
    function castVote(uint256 proposalId, uint256 nullifierHash, bool support, bytes calldata proof) external {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp > p.deadline) revert VotingClosed();
        // Reject non-canonical encodings: x and x + FIELD are the same field element
        // to the verifier but different keys here, which would allow a second vote.
        if (nullifierHash >= FIELD || nullifierUsed[nullifierHash]) revert NullifierUsed();

        // Order must match the circuit's pub params: root, nullifier_hash, scope, vote.
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(nullifierHash);
        publicInputs[2] = bytes32(p.scope);
        publicInputs[3] = bytes32(uint256(support ? 1 : 0));
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[nullifierHash] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, nullifierHash, support);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        return proposals[proposalId];
    }

    /// @notice The tally. `final_` is true once the deadline has passed.
    /// Counts are public storage, so they are readable while voting is open too — see NOTES.md.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, bool final_) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        return (p.yes, p.no, block.timestamp > p.deadline);
    }
}
