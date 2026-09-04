// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemberRegistry} from "./MemberRegistry.sol";

interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title PrivateBallot
/// @notice Yes/no proposals where the tally is public but no ballot can be traced
///         back to a member - not by an observer, not by the DAO, not by us.
///
/// A ballot is a zero-knowledge proof that says: "some leaf of the member tree
/// belongs to me, here is my one nullifier for this proposal, and I vote yes/no."
/// The proof carries no leaf index and no commitment, and the nullifier is a PRF of
/// the member's secret, so it is uncorrelated with their public commitment. The
/// contract learns exactly two things it did not already know: that one more
/// eligible member has voted, and which way that ballot went.
contract PrivateBallot {
    /// @dev Public-input layout expected by the generated Honk verifier. This order
    ///      is the declaration order of the `pub` parameters of circuits/vote/src/main.nr.
    uint256 private constant PI_ROOT = 0;
    uint256 private constant PI_SCOPE = 1;
    uint256 private constant PI_NULLIFIER = 2;
    uint256 private constant PI_VOTE = 3;
    uint256 private constant PI_RELAYER = 4;
    uint256 private constant PUBLIC_INPUT_COUNT = 5;

    uint64 public constant MIN_VOTING_PERIOD = 1 hours;
    uint64 public constant MAX_VOTING_PERIOD = 30 days;

    MemberRegistry public immutable registry;
    IHonkVerifier public immutable verifier;

    struct Proposal {
        /// Member tree root, pinned when the proposal was created.
        bytes32 root;
        /// Registered members at that moment, i.e. the size of the anonymity set.
        uint32 eligible;
        uint64 votingEnds;
        uint32 yesVotes;
        uint32 noVotes;
        string description;
    }

    Proposal[] internal proposals;

    /// @notice proposalId => nullifier => already counted.
    mapping(uint256 => mapping(bytes32 => bool)) public nullifierSpent;

    event ProposalCreated(
        uint256 indexed proposalId, bytes32 root, uint32 eligible, uint64 votingEnds, string description
    );
    /// @dev No voter identity here - by construction there is none to emit.
    event VoteCast(uint256 indexed proposalId, bytes32 nullifier, bool support);

    error NotAMember();
    error BadVotingPeriod();
    error NoMembers();
    error UnknownProposal();
    error VotingClosed();
    error VotingStillOpen();
    error NullifierAlreadyUsed();
    error InvalidProof();

    constructor(MemberRegistry registry_, IHonkVerifier verifier_) {
        registry = registry_;
        verifier = verifier_;
    }

    /// @notice Open a proposal. Any member may do this.
    /// @dev The root is pinned here and never moves. That matters for privacy, not
    ///      just for bookkeeping: if the root tracked registrations while voting was
    ///      open, each ballot would advertise which registration window its voter
    ///      proved against, splitting the anonymity set into small buckets.
    function createProposal(string calldata description, uint64 votingPeriod)
        external
        returns (uint256 proposalId)
    {
        if (registry.membershipNFT().balanceOf(msg.sender) == 0) revert NotAMember();
        if (votingPeriod < MIN_VOTING_PERIOD || votingPeriod > MAX_VOTING_PERIOD) revert BadVotingPeriod();

        uint32 eligible = registry.memberCount();
        if (eligible == 0) revert NoMembers();

        proposalId = proposals.length;
        proposals.push(
            Proposal({
                root: registry.root(),
                eligible: eligible,
                votingEnds: uint64(block.timestamp) + votingPeriod,
                yesVotes: 0,
                noVotes: 0,
                description: description
            })
        );

        emit ProposalCreated(
            proposalId, proposals[proposalId].root, eligible, proposals[proposalId].votingEnds, description
        );
    }

    /// @notice Domain separator a ballot's nullifier is derived under.
    /// @dev Binding the scope to this contract keeps nullifiers from colliding
    ///      across ballot deployments that share a registry - without it, voting in
    ///      one deployment would burn your vote in the other.
    function voteScope(uint256 proposalId) public view returns (bytes32) {
        return bytes32(uint256(sha256(abi.encode(address(this), proposalId))) >> 8);
    }

    /// @notice Submit one anonymous ballot.
    /// @dev `msg.sender` is a public input of the proof, so a proof is only valid
    ///      for the exact address the member chose to submit it. A proof sitting in
    ///      the mempool cannot be lifted and replayed by anyone else, and the member
    ///      is free to hand it to a relayer without trusting them with anything.
    function castVote(uint256 proposalId, bool support, bytes32 nullifier, bytes calldata proof) external {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp >= p.votingEnds) revert VotingClosed();
        if (nullifierSpent[proposalId][nullifier]) revert NullifierAlreadyUsed();

        bytes32[] memory publicInputs = new bytes32[](PUBLIC_INPUT_COUNT);
        publicInputs[PI_ROOT] = p.root;
        publicInputs[PI_SCOPE] = voteScope(proposalId);
        publicInputs[PI_NULLIFIER] = nullifier;
        publicInputs[PI_VOTE] = bytes32(uint256(support ? 1 : 0));
        publicInputs[PI_RELAYER] = bytes32(uint256(uint160(msg.sender)));

        // The generated Honk verifier signals a bad proof by reverting with its own
        // internal errors (SumcheckFailed, ProofLengthWrong, ...) rather than
        // returning false, so catch both shapes and surface one stable error.
        try verifier.verify(proof, publicInputs) returns (bool ok) {
            if (!ok) revert InvalidProof();
        } catch {
            revert InvalidProof();
        }

        nullifierSpent[proposalId][nullifier] = true;
        unchecked {
            if (support) p.yesVotes++;
            else p.noVotes++;
        }

        emit VoteCast(proposalId, nullifier, support);
    }

    /// @notice Final result. Readable by anyone once voting has closed.
    /// @dev This gate is a courtesy for consumers, not a secret: `VoteCast` events
    ///      and the vote calldata make the running count observable all along. See
    ///      NOTES.md - hiding the running tally as well needs encrypted ballots,
    ///      which is a different and much heavier design.
    function tally(uint256 proposalId) external view returns (uint32 yesVotes, uint32 noVotes, uint32 eligible) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.votingEnds) revert VotingStillOpen();
        return (p.yesVotes, p.noVotes, p.eligible);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposals.length) revert UnknownProposal();
        return proposals[proposalId];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }
}
