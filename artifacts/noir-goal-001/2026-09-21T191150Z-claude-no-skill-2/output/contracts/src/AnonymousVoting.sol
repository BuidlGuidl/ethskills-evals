// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IVerifier} from "../verifier/HonkVerifier.sol";
import {MemberGroup} from "./MemberGroup.sol";

/// @notice Yes/no proposals voted on with zero-knowledge membership proofs.
///
/// A vote carries (proposalId, support, nullifier, proof) and nothing else
/// identifying. `castVote` is permissionless on purpose: it must be sent by a
/// relayer or any wallet with no link to the member, never by the member's
/// NFT wallet — otherwise msg.sender alone attributes the vote.
///
/// Privacy boundary: individual votes are unlinkable to members, but the
/// running yes/no counts are chain state and are readable by anyone at any time
/// (a view that reverts cannot hide storage). `tally` only formalises "final".
contract AnonymousVoting {
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct Proposal {
        uint256 root; // member tree root frozen at creation: the eligible set
        uint256 scope; // nullifier scope, unique per (chain, contract, proposal)
        uint64 deadline;
        uint32 eligible; // anonymity set size = members registered at creation
        uint32 yes;
        uint32 no;
    }

    MemberGroup public immutable group;
    IVerifier public immutable verifier;
    /// @notice Refuse to open a proposal with fewer registered members than this.
    /// With k members, each vote hides among at most k people.
    uint256 public immutable minAnonymitySet;

    uint256 public proposalCount;
    mapping(uint256 proposalId => Proposal) public proposals;
    mapping(uint256 proposalId => mapping(uint256 nullifier => bool)) public nullifierUsed;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed creator,
        uint256 root,
        uint256 scope,
        uint64 deadline,
        uint32 eligible,
        string description
    );
    event VoteCast(uint256 indexed proposalId, bool support, uint256 nullifier);

    error NotMember();
    error AnonymitySetTooSmall(uint256 registered, uint256 required);
    error UnknownProposal();
    error VotingClosed();
    error VotingOpen();
    error AlreadyVoted();
    error InvalidNullifier();
    error InvalidProof();

    constructor(MemberGroup group_, IVerifier verifier_, uint256 minAnonymitySet_) {
        group = group_;
        verifier = verifier_;
        minAnonymitySet = minAnonymitySet_;
    }

    /// @notice Open a proposal. Any NFT holder may do so; the eligible voter set
    /// is frozen to the members registered right now.
    function createProposal(string calldata description, uint64 votingPeriod) external returns (uint256 proposalId) {
        if (group.membership().balanceOf(msg.sender) == 0) revert NotMember();
        uint256 registered = group.size();
        if (registered < minAnonymitySet) revert AnonymitySetTooSmall(registered, minAnonymitySet);

        proposalId = ++proposalCount;
        uint256 scope = uint256(keccak256(abi.encode(block.chainid, address(this), proposalId))) % SNARK_SCALAR_FIELD;
        uint64 deadline = uint64(block.timestamp) + votingPeriod;
        uint256 root = group.root();

        proposals[proposalId] = Proposal({
            root: root, scope: scope, deadline: deadline, eligible: uint32(registered), yes: 0, no: 0
        });
        emit ProposalCreated(proposalId, msg.sender, root, scope, deadline, uint32(registered), description);
    }

    /// @notice Submit an anonymous vote. Callable by anyone (relayer); the proof
    /// binds `support` and `nullifier`, so a relayer can neither change the vote
    /// nor replay it.
    function castVote(uint256 proposalId, bool support, uint256 nullifier, bytes calldata proof) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        // Without this, nullifier + p would be the same field element in the
        // proof but a different mapping key here: a double vote.
        if (nullifier >= SNARK_SCALAR_FIELD) revert InvalidNullifier();
        if (nullifierUsed[proposalId][nullifier]) revert AlreadyVoted();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.root);
        publicInputs[1] = bytes32(p.scope);
        publicInputs[2] = bytes32(uint256(support ? 1 : 0));
        publicInputs[3] = bytes32(nullifier);
        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        nullifierUsed[proposalId][nullifier] = true;
        if (support) p.yes++;
        else p.no++;
        emit VoteCast(proposalId, support, nullifier);
    }

    /// @notice Final result, available once the deadline has passed.
    function tally(uint256 proposalId) external view returns (uint256 yes, uint256 no, uint256 eligible) {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert UnknownProposal();
        if (block.timestamp < p.deadline) revert VotingOpen();
        return (p.yes, p.no, p.eligible);
    }
}
