// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerifier} from "./interfaces/IVerifier.sol";
import {IMembershipNFT} from "./interfaces/IMembershipNFT.sol";
import {MemberRegistry} from "./MemberRegistry.sol";

/// @title AnonymousBallot
/// @notice Yes/no proposals tallied from zero-knowledge membership proofs.
///
/// `castVote` is deliberately permissionless: it does not care who `msg.sender` is,
/// and it never records one. The proof hides *which* member is voting, so the vote
/// must arrive from a wallet that is not the member's -- a relayer or a 4337 bundler.
/// If a member sent their own vote, `msg.sender` would re-link them to the ballot and
/// the proof would have bought nothing.
contract AnonymousBallot {
    struct Proposal {
        bytes32 descriptionHash;
        // Member tree root frozen the moment the proposal opened. Members who
        // register later are not in this anonymity set and cannot vote on it.
        uint256 merkleRoot;
        // Leaf count at the snapshot -- how many members could vote, i.e. the size of
        // the anonymity set each individual vote hides in.
        uint32 snapshotMemberCount;
        uint64 votingEnds;
        uint32 yesVotes;
        uint32 noVotes;
    }

    IVerifier public immutable verifier;
    MemberRegistry public immutable registry;
    IMembershipNFT public immutable membershipNFT;

    /// @notice Refuse to open a proposal whose anonymity set is too small to hide in.
    uint32 public immutable minAnonymitySet;

    Proposal[] public proposals;

    /// @dev proposalId => nullifierHash => spent. The nullifier is scoped to the
    ///      proposal in-circuit, so the same member's markers on two proposals are
    ///      unrelated values.
    mapping(uint256 proposalId => mapping(uint256 nullifierHash => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 merkleRoot,
        uint32 snapshotMemberCount,
        uint64 votingEnds
    );

    /// @dev Carries no address and nothing derived from one.
    event VoteCast(uint256 indexed proposalId, uint256 nullifierHash, bool support);

    error NotAMember();
    error AnonymitySetTooSmall(uint32 have, uint32 need);
    error VotingPeriodTooShort();
    error NoSuchProposal();
    error VotingClosed();
    error VotingStillOpen();
    error NullifierAlreadySpent();
    error InvalidProof();

    constructor(
        IVerifier _verifier,
        MemberRegistry _registry,
        IMembershipNFT _membershipNFT,
        uint32 _minAnonymitySet
    ) {
        verifier = _verifier;
        registry = _registry;
        membershipNFT = _membershipNFT;
        minAnonymitySet = _minAnonymitySet;
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Open a proposal, freezing the current member set as its anonymity set.
    /// @dev Sent from the proposer's own wallet. A chain observer learns who proposed
    ///      what -- which is public information anyway -- and nothing about any vote.
    function createProposal(uint256 tokenId, string calldata description, uint64 votingPeriod)
        external
        returns (uint256 proposalId)
    {
        if (membershipNFT.ownerOf(tokenId) != msg.sender) revert NotAMember();
        if (votingPeriod == 0) revert VotingPeriodTooShort();

        uint32 snapshotMemberCount = registry.memberCount();
        if (snapshotMemberCount < minAnonymitySet) {
            revert AnonymitySetTooSmall(snapshotMemberCount, minAnonymitySet);
        }

        uint64 votingEnds = uint64(block.timestamp) + votingPeriod;
        proposalId = proposals.length;
        proposals.push(
            Proposal({
                descriptionHash: keccak256(bytes(description)),
                merkleRoot: registry.root(),
                snapshotMemberCount: snapshotMemberCount,
                votingEnds: votingEnds,
                yesVotes: 0,
                noVotes: 0
            })
        );

        emit ProposalCreated(
            proposalId, msg.sender, description, registry.root(), snapshotMemberCount, votingEnds
        );
    }

    /// @notice Submit one member's vote. Anyone may send this transaction; it should
    ///         not be the member.
    /// @param nullifierHash Poseidon(identitySecret, proposalId), from the proof.
    /// @param support true = yes. Public, and bound into the proof, so the relayer
    ///        carrying it cannot flip it.
    /// @param proof UltraHonk proof over public inputs
    ///        [merkleRoot, proposalId, nullifierHash, support].
    function castVote(uint256 proposalId, uint256 nullifierHash, bool support, bytes calldata proof)
        external
    {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp >= p.votingEnds) revert VotingClosed();
        if (nullifierSpent[proposalId][nullifierHash]) revert NullifierAlreadySpent();

        // Spend the marker before the external call, so a replay reverts even if the
        // verifier were ever swapped for something that could re-enter.
        nullifierSpent[proposalId][nullifierHash] = true;

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = bytes32(p.merkleRoot);
        publicInputs[1] = bytes32(proposalId);
        publicInputs[2] = bytes32(nullifierHash);
        publicInputs[3] = bytes32(uint256(support ? 1 : 0));

        if (!verifier.verify(proof, publicInputs)) revert InvalidProof();

        // Counted only after the proof verified.
        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit VoteCast(proposalId, nullifierHash, support);
    }

    /// @notice Final tally, readable by anyone once voting has closed.
    function result(uint256 proposalId)
        external
        view
        returns (uint32 yesVotes, uint32 noVotes, uint32 turnout, uint32 anonymitySet)
    {
        if (proposalId >= proposals.length) revert NoSuchProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.votingEnds) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes, p.yesVotes + p.noVotes, p.snapshotMemberCount);
    }
}
